/* ============================================================
   KAI Command Core — Living Body engine.

   Ported verbatim from KAI Command Core.dc.html — the heart,
   vasculature, feed/absorb fronts, shockwaves, embers, bloom,
   cardiac envelope, lightning arcs, panel glow. The x-dc /
   DCLogic wrapper and the support.js preview harness are NOT
   ported — only the rendering logic.

   Framework-agnostic class. Takes a canvas + organ DOM refs +
   HUD refs + a signalProvider that maps organ id → real value
   and calling state. All per-frame DOM mutation happens on
   direct refs (never via framework state) per the brief's
   performance rule.

   Per the brief, the demo's random-walk + random-call-scheduling
   is REPLACED with a real signalProvider. Organs only call when
   their real domain says so; values only update from real data.
   ============================================================ */

export interface OrganSignal {
  formatted: string;            // display value, e.g. "$12,480"
  calling: boolean;             // domain says "needs you"
}

export type SignalProvider = () => Record<string, OrganSignal>;

export interface OrganDom {
  el: HTMLElement;
  dot: HTMLElement;
  bar: HTMLElement;
  val: HTMLElement;
  flag: HTMLElement;
  label: string;
}

export interface HudDom {
  bpm:   HTMLElement;
  state: HTMLElement;
  sub:   HTMLElement;
}

export interface CommandCoreOptions {
  canvas: HTMLCanvasElement;
  root:   HTMLElement;
  organs: Record<string, OrganDom>;
  hud:    HudDom;
  signalProvider: SignalProvider;
  onAck?: (id: string) => void;
  restBpm?: number;
  peakBpm?: number;
  bloom?: number;
}

interface VeinPt { x: number; y: number; r: number; }
interface Vein   { pts: VeinPt[]; w: number; artery?: boolean; }
interface Filament { pts: { x: number; y: number }[]; w: number; }
interface Ember  { x: number; y: number; s: number; vy: number; sw: number; sa: number; }
interface Molten { ang: number; rad: number; size: number; spd: number; ph: number; hue: number; }
interface Front  { r: number; type: 'feed' | 'absorb'; v: number; life?: number; flared?: boolean; }
interface Shock  { r: number; v: number; life: number; x: number; y: number; }
interface Ripple { x: number; y: number; r: number; life: number; }
interface Arc    { pts: VeinPt[]; t0: number; dur: number; color: string; dir: 'in' | 'out'; }

interface OrganState {
  status: 'idle' | 'calling';
  ackFlash: number;
  callStart: number;
  _lvs?: string;
  _lvc?: string;
  _lfc?: boolean;
  label: string;
}

const PANEL_DEFS: ReadonlyArray<[string, number, number]> = [
  ['01', 0.11, 0.18], ['02', 0.11, 0.39], ['03', 0.11, 0.61], ['04', 0.11, 0.82],
  ['05', 0.89, 0.18], ['06', 0.89, 0.39], ['07', 0.89, 0.61], ['08', 0.89, 0.82],
  ['09', 0.37, 0.085], ['10', 0.63, 0.085], ['11', 0.30, 0.915], ['12', 0.70, 0.915],
];

export class CommandCore {
  /* runtime state — refs, not framework state */
  private canvas: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private root: HTMLElement;
  private organsDom: Record<string, OrganDom>;
  private hud: HudDom;
  private signalProvider: SignalProvider;
  private onAck?: (id: string) => void;

  private restBpm: number;
  private peakBpm: number;
  private bloomStrength: number;

  private W = 1; private H = 1; private cx = 0; private cy = 0;
  private heartR = 1; private maxR = 1;
  private rect: DOMRect | null = null;

  private phase = 0; private last = 0;
  private fronts: Front[] = []; private shock: Shock[] = [];
  private ripples: Ripple[] = []; private arcs: Arc[] = [];
  private charge: Record<string, number> = {};
  private hover:  Record<string, number> = {};
  private absorbFlare = 0; private beatPulse = 0; private thump = 0; private ambient = 0;
  private lean = { x: 0, y: 0 };
  private mouse = { x: 0, y: 0, has: false };
  private arousal = 0; private targetArousal = 0;
  private storm = 0;

  private organs: Record<string, OrganState> = {};
  private panelAnchors: Record<string, VeinPt> = {};
  private arteryByPanel: Record<string, Vein> = {};
  private veins: Vein[] = [];
  private capPath = new Path2D();
  private artPath = new Path2D();
  private glowPath = new Path2D();
  private filaments: Filament[] = [];
  private embers: Ember[] = [];
  private molten: Molten[] = [];

  /* bloom downsample buffer */
  private bloomC: HTMLCanvasElement;
  private bctx!: CanvasRenderingContext2D | null;
  private bw = 2; private bh = 2;

  /* HUD diff cache */
  private _lbpm: string | null = null;
  private _lhot: boolean | null = null;
  private _lsub: string | null = null;

  private raf = 0;
  private callTimer = 0;
  private valTimer = 0;
  private _onResize: () => void;
  private _onPointerMove: (e: PointerEvent) => void;
  private _onPointerLeave: () => void;
  private _onPointerDown: (e: PointerEvent) => void;
  private _organClickHandlers: Array<{ el: HTMLElement; fn: (e: Event) => void }> = [];
  private _organEnterHandlers: Array<{ el: HTMLElement; fn: () => void; id: string }> = [];
  private _organLeaveHandlers: Array<{ el: HTMLElement; fn: () => void; id: string }> = [];

  /* audio */
  private audioOn = false;
  private actx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private droneG: GainNode | null = null;
  private tideG: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  constructor(opts: CommandCoreOptions) {
    this.canvas = opts.canvas;
    this.root = opts.root;
    this.organsDom = opts.organs;
    this.hud = opts.hud;
    this.signalProvider = opts.signalProvider;
    this.onAck = opts.onAck;
    this.restBpm = opts.restBpm ?? 58;
    this.peakBpm = opts.peakBpm ?? 134;
    this.bloomStrength = opts.bloom ?? 0.9;

    this.bloomC = document.createElement('canvas');

    /* seed organ states */
    for (const [id] of PANEL_DEFS) {
      this.organs[id] = {
        status: 'idle', ackFlash: 0, callStart: 0,
        label: this.organsDom[id]?.label ?? id,
      };
    }

    this._onResize = () => this._resize();
    this._onPointerMove = (e) => {
      const r = this.rect || this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; this.mouse.has = true;
    };
    this._onPointerLeave = () => { this.mouse.has = false; };
    this._onPointerDown = (e) => {
      if (e.target !== this.canvas) return;
      const r = this.rect || this.canvas.getBoundingClientRect();
      this._ripple(e.clientX - r.left, e.clientY - r.top);
    };
  }

  start() {
    window.addEventListener('resize', this._onResize);
    this.root.addEventListener('pointermove', this._onPointerMove);
    this.root.addEventListener('pointerleave', this._onPointerLeave);
    this.root.addEventListener('pointerdown', this._onPointerDown);

    for (const [id] of PANEL_DEFS) {
      const o = this.organsDom[id];
      if (!o) continue;
      const click = (e: Event) => { e.stopPropagation(); this._ack(id); };
      const enter = () => { this.hover[id] = 1; };
      const leave = () => { this.hover[id] = 0; };
      o.el.addEventListener('click', click);
      o.el.addEventListener('mouseenter', enter);
      o.el.addEventListener('mouseleave', leave);
      this._organClickHandlers.push({ el: o.el, fn: click });
      this._organEnterHandlers.push({ el: o.el, fn: enter, id });
      this._organLeaveHandlers.push({ el: o.el, fn: leave, id });
    }

    this._resize();
    this._pullValues(true);   /* prime values from real signals immediately */
    this.last = performance.now() / 1000;
    this.valTimer = this.last + 1.1;
    this.callTimer = this.last + 0.4;
    const loop = () => {
      try { this._frame(); }
      catch (e) { console.error('[KAI command core]', e); }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    this.root.removeEventListener('pointermove', this._onPointerMove);
    this.root.removeEventListener('pointerleave', this._onPointerLeave);
    this.root.removeEventListener('pointerdown', this._onPointerDown);
    for (const h of this._organClickHandlers) h.el.removeEventListener('click', h.fn);
    for (const h of this._organEnterHandlers) h.el.removeEventListener('mouseenter', h.fn);
    for (const h of this._organLeaveHandlers) h.el.removeEventListener('mouseleave', h.fn);
    if (this.actx) { try { this.actx.close(); } catch { /* ignore */ } }
  }

  ackAll() {
    for (const id in this.organs) {
      const o = this.organs[id];
      if (o.status === 'calling') {
        o.status = 'idle';
        o.ackFlash = 0.8;
        this.charge[id] = Math.max(this.charge[id] || 0, 1.1);
        this._spawnArc(id, 'out', '#ffcf86');
      }
    }
  }

  /* ── Layout / geometry ───────────────────────────────── */

  private _resize() {
    const c = this.canvas;
    this.rect = c.getBoundingClientRect();
    const W = c.clientWidth || window.innerWidth;
    const H = c.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    this.ctx = c.getContext('2d')!;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = W; this.H = H;
    this.cx = W / 2; this.cy = H / 2;
    if (!this.mouse.has) { this.mouse.x = this.cx; this.mouse.y = this.cy; }
    this.heartR = Math.min(W, H) * 0.15;
    this.maxR = Math.hypot(W, H) * 0.6;
    this.bw = Math.max(2, Math.round(W * 0.24));
    this.bh = Math.max(2, Math.round(H * 0.24));
    this.bloomC.width = this.bw; this.bloomC.height = this.bh;
    this.bctx = this.bloomC.getContext('2d');
    this._buildVeins();
    this._buildEmbers();
    this._buildMolten();
  }

  /* ── Geometry builders (verbatim port) ───────────────── */

  private _buildMolten() {
    this.molten = [];
    for (let i = 0; i < 13; i++) {
      this.molten.push({
        ang: Math.random() * 6.2832, rad: 0.08 + Math.random() * 0.6,
        size: 0.16 + Math.random() * 0.34, spd: (0.12 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1),
        ph: Math.random() * 6.2832, hue: Math.random(),
      });
    }
  }

  private _buildVeins() {
    const { cx, cy, W, H, heartR, maxR } = this;
    const veins: Vein[] = [];
    const startR = heartR * 0.58;
    const pt = (x: number, y: number): VeinPt => ({ x, y, r: Math.hypot(x - cx, y - cy) });

    const grow = (x: number, y: number, ang: number, len: number, width: number, depth: number, jit: number) => {
      const pts: VeinPt[] = [pt(x, y)];
      const steps = Math.max(5, Math.floor(len / 14));
      let a = ang, px = x, py = y;
      for (let i = 0; i < steps; i++) {
        a += (Math.random() - 0.5) * jit;
        px += Math.cos(a) * (len / steps);
        py += Math.sin(a) * (len / steps);
        pts.push(pt(px, py));
      }
      veins.push({ pts, w: width });
      if (depth > 0) {
        const nb = Math.random() < 0.72 ? 2 : 1;
        for (let k = 0; k < nb; k++) {
          grow(px, py, a + (Math.random() - 0.5) * 1.25, len * (0.52 + Math.random() * 0.22), Math.max(0.35, width * 0.62), depth - 1, jit * 1.18);
        }
      }
    };

    this.panelAnchors = {};
    this.arteryByPanel = {};
    for (const [id, fx, fy] of PANEL_DEFS) {
      const tx = fx * W, ty = fy * H;
      this.panelAnchors[id] = pt(tx, ty);
      const dx = tx - cx, dy = ty - cy, dist = Math.hypot(dx, dy);
      const ux = dx / dist, uy = dy / dist, nx = -uy, ny = ux;
      const amp = dist * 0.085 * (Math.random() < 0.5 ? -1 : 1);
      const freq = 1 + Math.random();
      const N = 34, pts: VeinPt[] = [];
      const sx = cx + ux * startR, sy = cy + uy * startR;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const wob = Math.sin(u * Math.PI * freq) * amp * (1 - Math.abs(u - 0.5) * 0.5);
        const x = sx + (tx - sx) * u + nx * wob;
        const y = sy + (ty - sy) * u + ny * wob;
        pts.push(pt(x, y));
      }
      const artery: Vein = { pts, w: 3.0, artery: true };
      veins.push(artery);
      this.arteryByPanel[id] = artery;
      for (let b = 0; b < 3; b++) {
        const idx = 7 + Math.floor(Math.random() * (N - 11));
        const base = pts[idx];
        const ba = Math.atan2(base.y - cy, base.x - cx) + (Math.random() - 0.5) * 1.7;
        grow(base.x, base.y, ba, dist * 0.26, 1.3, 2, 0.5);
      }
    }

    const dirs = 66;
    for (let i = 0; i < dirs; i++) {
      const ang = (i / dirs) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
      const sx = cx + Math.cos(ang) * startR, sy = cy + Math.sin(ang) * startR;
      grow(sx, sy, ang, maxR * (0.6 + Math.random() * 0.5), 2.1, 4, 0.4);
    }
    for (let i = 0; i < 48; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r0 = heartR * (1.3 + Math.random() * 1.4);
      const sx = cx + Math.cos(ang) * r0, sy = cy + Math.sin(ang) * r0;
      grow(sx, sy, ang + (Math.random() - 0.5), maxR * 0.45, 1.2, 3, 0.5);
    }
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r0 = maxR * (0.3 + Math.random() * 0.55);
      const sx = cx + Math.cos(ang) * r0, sy = cy + Math.sin(ang) * r0;
      grow(sx, sy, Math.random() * 6.2832, maxR * 0.3, 0.9, 2, 0.7);
    }

    this.veins = veins;
    const capPath = new Path2D(), artPath = new Path2D(), glowPath = new Path2D();
    for (const v of veins) {
      const tp = v.artery ? artPath : capPath;
      const p = v.pts;
      tp.moveTo(p[0].x, p[0].y); glowPath.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length; i++) { tp.lineTo(p[i].x, p[i].y); glowPath.lineTo(p[i].x, p[i].y); }
    }
    this.capPath = capPath; this.artPath = artPath; this.glowPath = glowPath;

    this.filaments = [];
    const growFil = (x: number, y: number, ang: number, len: number, depth: number, wmul: number) => {
      const pts: { x: number; y: number }[] = [{ x, y }];
      const steps = 7; let a = ang, px = x, py = y;
      for (let i = 0; i < steps; i++) {
        a += (Math.random() - 0.5) * 0.95;
        px += Math.cos(a) * (len / steps);
        py += Math.sin(a) * (len / steps);
        const rr = Math.hypot(px, py);
        if (rr > 0.9) { px *= 0.9 / rr; py *= 0.9 / rr; }
        pts.push({ x: px, y: py });
      }
      this.filaments.push({ pts, w: 0.006 * wmul });
      if (depth > 0) {
        const nb = Math.random() < 0.7 ? 2 : 1;
        for (let k = 0; k < nb; k++) growFil(px, py, a + (Math.random() - 0.5) * 1.5, len * 0.62, depth - 1, wmul * 0.7);
      }
    };
    for (let i = 0; i < 11; i++) {
      const a0 = (i / 11) * Math.PI * 2 + Math.random() * 0.4;
      const r0 = 0.42 + Math.random() * 0.32;
      growFil(Math.cos(a0) * r0, Math.sin(a0) * r0, a0 + Math.PI * (0.45 + Math.random() * 0.5), 0.45 + Math.random() * 0.3, 3, 1.5);
    }
  }

  private _buildEmbers() {
    const { W, H } = this;
    this.embers = [];
    const n = 38;
    for (let i = 0; i < n; i++) {
      this.embers.push({
        x: Math.random() * W, y: Math.random() * H,
        s: 0.5 + Math.random() * 1.7, vy: -(3 + Math.random() * 11),
        sw: Math.random() * 6.28, sa: 0.18 + Math.random() * 0.5,
      });
    }
  }

  private _mix(a: number[], b: number[], t: number): number[] {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  private _cardiac(p: number): number {
    const lub = Math.exp(-Math.pow((p - 0.045) / 0.043, 2));
    const dub = 0.5 * Math.exp(-Math.pow((p - 0.205) / 0.05, 2));
    const recoil = -0.12 * Math.exp(-Math.pow((p - 0.35) / 0.06, 2));
    return Math.max(0, lub + dub + recoil);
  }

  /* ── Organ events (real-signal driven) ────────────────── */

  private _callingCount(): number {
    let n = 0; for (const k in this.organs) if (this.organs[k].status === 'calling') n++; return n;
  }

  /* Pull real signal state. Anything signaling `calling: true`
     and currently idle starts a call. Anything no longer calling
     (signal gone) self-resolves to idle. */
  private _evaluateSignals() {
    const signals = this.signalProvider();
    for (const id in this.organs) {
      const s = signals[id];
      const o = this.organs[id];
      const wantsCall = !!s?.calling;
      if (wantsCall && o.status === 'idle') {
        o.status = 'calling';
        o.callStart = this.last;
        this._spawnArc(id, 'in', '#d6402e');
        this._alertSound();
      } else if (!wantsCall && o.status === 'calling') {
        /* signal resolved itself externally */
        o.status = 'idle';
        o.ackFlash = 0.4;
        this._spawnArc(id, 'out', '#ffcf86');
      }
    }
  }

  private _ack(id: string) {
    const o = this.organs[id]; if (!o) return;
    const a = this.panelAnchors[id];
    if (o.status === 'calling') {
      o.status = 'idle'; o.ackFlash = 1.0;
      this.charge[id] = Math.max(this.charge[id] || 0, 1.5);
      this._spawnArc(id, 'out', '#ffd089');
      if (a) this.shock.push({ r: a.r * 0.4, v: this.maxR / 0.6, life: 0.8, x: a.x, y: a.y });
      this._ackSound();
    } else {
      o.ackFlash = 0.55;
      this.charge[id] = Math.max(this.charge[id] || 0, 0.7);
      this._spawnArc(id, 'out', '#ffc070');
      this._tap();
    }
    this.onAck?.(id);
  }

  private _spawnArc(id: string, dir: 'in' | 'out', color: string) {
    const art = this.arteryByPanel[id]; if (!art) return;
    this.arcs.push({ pts: art.pts, t0: performance.now() / 1000, dur: 0.55, color, dir });
  }

  private _ripple(x: number, y: number) {
    this.ripples.push({ x, y, r: 4, life: 1 });
    this._tap();
  }

  /* Pull real values from signalProvider; mutate DOM directly. */
  private _pullValues(force: boolean) {
    const signals = this.signalProvider();
    for (const id in this.organs) {
      const o = this.organs[id];
      const s = signals[id];
      const dom = this.organsDom[id];
      if (!s || !dom) continue;
      if (force || s.formatted !== o._lvs) {
        dom.val.textContent = s.formatted;
        o._lvs = s.formatted;
      }
    }
  }

  /* ── Frame ──────────────────────────────────────────── */

  private _frame() {
    const ctx = this.ctx; if (!ctx) return;
    const now = performance.now() / 1000;
    let dt = now - this.last; this.last = now;
    if (dt > 0.05) dt = 0.05;
    const { W, H, cx, cy, maxR, heartR } = this;

    /* organ events — re-evaluate real signals on a slow cadence */
    if (now >= this.callTimer) {
      this._evaluateSignals();
      this.callTimer = now + 1.0;     /* signals re-checked every ~1 s */
    }
    const callingN = this._callingCount();

    /* arousal driven entirely by REAL calls (no random storm). */
    this.storm = callingN >= 3 ? 1 : 0;
    let tgt = this.storm ? 0.7 : 0;
    tgt += Math.min(this.storm ? 0.3 : 0.85, callingN * (this.storm ? 0.1 : 0.3));
    this.targetArousal = Math.min(1, tgt);
    this.arousal += (this.targetArousal - this.arousal) * (1 - Math.pow(0.00012, dt));
    const ar = this.arousal;

    /* audio levels */
    if (this.audioOn && this.droneG && this.actx) {
      this.droneG.gain.setTargetAtTime(0.04 + 0.13 * ar, this.actx.currentTime, 0.3);
      if (this.tideG) this.tideG.gain.setTargetAtTime(0.012 + 0.05 * ar, this.actx.currentTime, 0.5);
    }

    /* pull real values from signals */
    if (now >= this.valTimer) { this._pullValues(false); this.valTimer = now + 1.1; }

    /* pointer lean */
    const lx = this.mouse.has ? (this.mouse.x - cx) * 0.05 : 0;
    const ly = this.mouse.has ? (this.mouse.y - cy) * 0.05 : 0;
    this.lean.x += (lx - this.lean.x) * (1 - Math.pow(0.02, dt));
    this.lean.y += (ly - this.lean.y) * (1 - Math.pow(0.02, dt));

    const bpm = this.restBpm + (this.peakBpm - this.restBpm) * ar;
    this.phase += dt * (bpm / 60);
    let beat = false;
    if (this.phase >= 1) { this.phase -= 1; beat = true; }
    const contraction = this._cardiac(this.phase);
    if (beat) {
      this.beatPulse = 1;
      const travel = 0.78 - 0.46 * ar;
      const speed = maxR / travel;
      this.fronts.push({ r: heartR * 0.5, type: 'feed', v: speed, life: 1 });
      this.fronts.push({ r: maxR, type: 'absorb', v: speed * 0.92, flared: false });
      this.shock.push({ r: heartR * 0.85, v: maxR / 0.5, life: 1, x: cx, y: cy });
      let cc = 0;
      for (const k in this.organs) {
        if (this.organs[k].status === 'calling' && cc < 3) {
          this.fronts.push({ r: this.panelAnchors[k].r, type: 'absorb', v: speed * 0.95, flared: false });
          cc++;
        }
      }
      if (this.fronts.length > 16) this.fronts.splice(0, this.fronts.length - 16);
      this._beatSound(ar);
    }
    this.thump = Math.max(this.thump * Math.pow(0.015, dt), contraction);
    this.beatPulse *= Math.pow(0.02, dt);
    this.absorbFlare *= Math.pow(0.05, dt);
    this.ambient += dt * (0.10 + 0.05 * ar);
    const ambR = ((this.ambient % 1) * maxR);

    const shellW = 66 + 60 * ar;
    const inv2 = 1 / (shellW * shellW);
    for (const f of this.fronts) {
      if (f.type === 'feed') { f.r += f.v * dt; f.life = Math.max(0, 1 - f.r / maxR); }
      else { f.r -= f.v * dt; if (!f.flared && f.r < heartR * 0.7) { f.flared = true; this.absorbFlare = Math.min(1.6, this.absorbFlare + 0.95); } }
    }
    this.fronts = this.fronts.filter(f => f.type === 'feed' ? f.r < maxR : f.r > heartR * 0.28);

    /* ===== draw ===== */
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);

    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.95);
    const bgHot = 0.06 + 0.2 * ar + 0.13 * this.beatPulse;
    bg.addColorStop(0, `rgba(${Math.round(60 + 46 * ar)},${Math.round(18 + 5 * ar)},12,${bgHot})`);
    bg.addColorStop(0.35, `rgba(${Math.round(42 + 30 * ar)},12,8,${bgHot * 0.5})`);
    bg.addColorStop(0.7, `rgba(22,7,5,${bgHot * 0.25})`);
    bg.addColorStop(1, 'rgba(3,3,3,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    const vGlow = this._mix([120, 46, 26], [182, 52, 34], ar);
    ctx.strokeStyle = `rgba(${vGlow[0] | 0},${vGlow[1] | 0},${vGlow[2] | 0},${0.05 + 0.045 * ar})`;
    ctx.lineWidth = 5 + 2 * ar; ctx.stroke(this.glowPath);
    ctx.globalCompositeOperation = 'source-over';
    const capCol = this._mix([158, 84, 46], [205, 74, 50], ar);
    ctx.strokeStyle = `rgba(${capCol[0] | 0},${capCol[1] | 0},${capCol[2] | 0},${0.17 + 0.08 * ar})`;
    ctx.lineWidth = 0.9 + 0.35 * ar; ctx.stroke(this.capPath);
    const artCol = this._mix([192, 106, 60], [232, 90, 62], ar);
    ctx.strokeStyle = `rgba(${artCol[0] | 0},${artCol[1] | 0},${artCol[2] | 0},${0.27 + 0.1 * ar})`;
    ctx.lineWidth = 1.9 + 0.8 * ar; ctx.stroke(this.artPath);

    ctx.globalCompositeOperation = 'lighter';
    const gold = this._mix([255, 172, 92], [255, 122, 72], ar);
    const crim = [196, 62, 42];
    const mx = this.mouse.x, my = this.mouse.y, mhas = this.mouse.has;
    const cSigPx = maxR * 0.17, csig = 1 / (cSigPx * cSigPx), cBox = cSigPx * 3;
    const near = 3 * shellW, ambNear = shellW * 2.6;
    for (const v of this.veins) {
      const p = v.pts; const wMul = v.artery ? 1.2 : 0.62;
      for (let i = 1; i < p.length; i++) {
        const r = (p[i].r + p[i - 1].r) * 0.5;
        const midx = (p[i].x + p[i - 1].x) * 0.5, midy = (p[i].y + p[i - 1].y) * 0.5;
        const inCursor = mhas && Math.abs(midx - mx) < cBox && Math.abs(midy - my) < cBox;
        let activeNear = Math.abs(r - ambR) < ambNear;
        if (!activeNear) { for (const f of this.fronts) { if (Math.abs(r - f.r) < near) { activeNear = true; break; } } }
        if (!activeNear && !inCursor) continue;
        let bf = 0, ba = 0;
        for (const f of this.fronts) { const d = r - f.r; if (d < -near || d > near) continue; const g = Math.exp(-(d * d) * inv2); if (f.type === 'feed') bf += g * (f.life || 0); else ba += g; }
        const da = r - ambR; if (da > -ambNear && da < ambNear) bf += Math.exp(-(da * da) / (shellW * shellW * 2.2)) * 0.16;
        if (inCursor) { const ddx = midx - mx, ddy = midy - my; bf += Math.exp(-(ddx * ddx + ddy * ddy) * csig) * 0.5; }
        const inten = bf + ba;
        if (inten < 0.05) continue;
        const t = ba / (bf + ba + 1e-6);
        const c = this._mix(gold, crim, t);
        const a = Math.min(0.95, inten * (0.62 + 0.4 * ar));
        ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
        ctx.lineWidth = (v.w * wMul) * (1.0 + inten * 1.5);
        ctx.beginPath(); ctx.moveTo(p[i - 1].x, p[i - 1].y); ctx.lineTo(p[i].x, p[i].y); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    if (mhas) {
      ctx.globalCompositeOperation = 'lighter';
      const cr = heartR * 0.7;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, cr);
      g.addColorStop(0, `rgba(255,180,110,${0.05 + 0.05 * ar})`);
      g.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, cr, 0, 6.2832); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    for (const [id] of PANEL_DEFS) {
      const anchor = this.panelAnchors[id]; if (!anchor) continue;
      const pr = anchor.r;
      let hit = this.charge[id] || 0;
      for (const f of this.fronts) if (f.type === 'feed' && Math.abs(pr - f.r) < shellW * 0.85) hit = Math.max(hit, (f.life || 0) * 0.95 + 0.05);
      this.charge[id] = hit * Math.pow(0.1, dt);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const [id] of PANEL_DEFS) {
      const c = this.charge[id] || 0;
      if (c > 0.03) {
        const a = this.panelAnchors[id]; const br = 90 * Math.min(1.4, c);
        const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, br);
        g.addColorStop(0, `rgba(255,182,104,${0.2 * Math.min(1.2, c)})`);
        g.addColorStop(1, 'rgba(255,150,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x, a.y, br, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    this._drawArcs(ctx, now);

    ctx.globalCompositeOperation = 'lighter';
    for (const e of this.embers) {
      e.y += e.vy * dt * (0.6 + ar * 1.9);
      e.sw += dt * (0.6 + ar);
      e.x += Math.sin(e.sw) * 0.35;
      if (mhas) {
        const dx = mx - e.x, dy = my - e.y, dd = Math.hypot(dx, dy) + 1e-3;
        const infl = Math.exp(-dd / (Math.min(W, H) * 0.2));
        e.x += (-dy / dd) * infl * 26 * dt + (dx / dd) * infl * 6 * dt;
        e.y += (dx / dd) * infl * 26 * dt + (dy / dd) * infl * 6 * dt;
      }
      if (e.y < -12) { e.y = H + 12; e.x = Math.random() * W; }
      const flick = 0.55 + 0.45 * Math.sin(e.sw * 3);
      const col = ar > 0.5 ? '255,118,68' : '255,182,114';
      const rr = e.s * 4;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, rr);
      g.addColorStop(0, `rgba(${col},${e.sa * flick * (0.45 + 0.55 * ar)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalCompositeOperation = 'lighter';
    for (const rp of this.ripples) {
      rp.r += (maxR / 0.75) * dt; rp.life -= dt / 0.75;
      if (rp.life <= 0) continue;
      const band = 16 + 22 * ar;
      const inner = Math.max(0, rp.r - band), outer = rp.r + band;
      const g = ctx.createRadialGradient(rp.x, rp.y, inner, rp.x, rp.y, outer);
      g.addColorStop(0, 'rgba(255,190,120,0)');
      g.addColorStop(0.5, `rgba(255,196,128,${0.32 * rp.life * rp.life})`);
      g.addColorStop(1, 'rgba(255,160,90,0)');
      ctx.fillStyle = g; ctx.fillRect(rp.x - outer, rp.y - outer, outer * 2, outer * 2);
    }
    this.ripples = this.ripples.filter(r => r.life > 0);
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.shock) {
      s.r += s.v * dt; s.life -= dt / 0.5;
      const band = 24 + 34 * ar;
      const inner = Math.max(0, s.r - band), outer = s.r + band;
      const col = ar > 0.5 ? '255,124,82' : '255,184,116';
      const ox = s.x, oy = s.y;
      const g = ctx.createRadialGradient(ox, oy, inner, ox, oy, outer);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.5, `rgba(${col},${0.24 * Math.max(0, s.life) * Math.max(0, s.life)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(ox - outer, oy - outer, outer * 2, outer * 2);
    }
    this.shock = this.shock.filter(s => s.life > 0 && s.r < maxR * 1.2);
    ctx.globalCompositeOperation = 'source-over';

    this._drawHeart(ctx, now, contraction, ar);
    this._bloom(ctx, ar);

    const vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.26, cx, cy, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${0.58 - 0.14 * ar})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    this._paintPanels(ar, now, dt);

    /* HUD */
    const hot = ar > 0.5;
    const bpmStr = Math.round(bpm) + ' BPM';
    if (bpmStr !== this._lbpm) { this.hud.bpm.textContent = bpmStr; this._lbpm = bpmStr; }
    if (hot !== this._lhot) {
      this.hud.bpm.style.color = hot ? '#ff8a64' : '#ffcaa0';
      this.hud.state.textContent = hot ? 'NEEDS YOU' : 'CALM';
      this.hud.state.style.color = hot ? 'rgba(255,92,60,0.9)' : 'rgba(255,160,90,0.55)';
      this._lhot = hot;
    }
    let sub: string, scol: string;
    const names: string[] = [];
    for (const [id] of PANEL_DEFS) if (this.organs[id].status === 'calling') names.push(this.organs[id].label);
    if (names.length) {
      sub = names.slice(0, 2).join(' · ') + (names.length > 2 ? ' +' + (names.length - 2) : '') + ' NEEDS YOU';
      scol = 'rgba(255,120,90,0.7)';
    } else if (this.storm > 0.5) { sub = 'ELEVATED'; scol = 'rgba(255,150,100,0.55)'; }
    else { sub = 'ALL SYSTEMS QUIET'; scol = 'rgba(232,210,190,0.3)'; }
    if (sub !== this._lsub) { this.hud.sub.textContent = sub; this.hud.sub.style.color = scol; this._lsub = sub; }
  }

  private _bloom(ctx: CanvasRenderingContext2D, ar: number) {
    const strength = this.bloomStrength * (0.5 + 0.28 * ar + 0.45 * this.beatPulse);
    if (strength <= 0.01 || !this.bctx) return;
    const b = this.bctx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, this.bw, this.bh);
    b.imageSmoothingEnabled = true;
    b.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, this.bw, this.bh);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1.1, strength);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bloomC, 0, 0, this.bw, this.bh, 0, 0, this.W, this.H);
    ctx.restore();
  }

  private _drawArcs(ctx: CanvasRenderingContext2D, now: number) {
    ctx.globalCompositeOperation = 'lighter';
    for (const arc of this.arcs) {
      const p = (now - arc.t0) / arc.dur;
      if (p >= 1 || p < 0) continue;
      const pts = arc.pts; const L = pts.length - 1;
      const pos = arc.dir === 'out' ? p : 1 - p;
      const headF = pos * L;
      const head = Math.floor(headF);
      const tail = 7;
      let cr = 0, cg = 0, cb = 0;
      if (arc.color === '#d6402e') { cr = 214; cg = 64; cb = 46; }
      else if (arc.color === '#ffd089') { cr = 255; cg = 208; cb = 137; }
      else if (arc.color === '#ffcf86') { cr = 255; cg = 207; cb = 134; }
      else { cr = 255; cg = 192; cb = 112; }
      const fade = Math.sin(Math.min(1, p) * Math.PI);
      ctx.lineCap = 'round';
      for (let k = 0; k < tail; k++) {
        const idx = head - k; if (idx < 0 || idx >= L) continue;
        const a = (1 - k / tail) * fade;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.85 * a})`;
        ctx.lineWidth = (3.6 - k * 0.4) * (0.6 + a);
        ctx.beginPath(); ctx.moveTo(pts[idx].x, pts[idx].y); ctx.lineTo(pts[idx + 1].x, pts[idx + 1].y); ctx.stroke();
      }
      const hp = pts[Math.max(0, Math.min(L, head))];
      const hr = 12 * fade;
      const g = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, hr);
      g.addColorStop(0, `rgba(255,240,210,${0.9 * fade})`);
      g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${0.6 * fade})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hp.x, hp.y, hr, 0, 6.2832); ctx.fill();
    }
    this.arcs = this.arcs.filter(a => (now - a.t0) / a.dur < 1);
    ctx.globalCompositeOperation = 'source-over';
  }

  private _paintPanels(ar: number, now: number, dt: number) {
    for (const id in this.organsDom) {
      const dom = this.organsDom[id];
      const o = this.organs[id];
      const el = dom.el;
      const c = this.charge[id] || 0;
      o.ackFlash *= Math.pow(0.05, dt);
      const calling = o.status === 'calling';
      const callPulse = calling ? 0.5 + 0.5 * Math.sin(now * 7) : 0;
      const hv = (this.hover[id] || 0) * 0.22;
      const redMix = Math.max(ar, callPulse * 0.9);
      const e = Math.min(1.2, c + callPulse * 0.85 + o.ackFlash + hv);
      const bc = this._mix([255, 170, 90], [255, 84, 54], redMix);
      const cs = `${bc[0] | 0},${bc[1] | 0},${bc[2] | 0}`;
      el.style.borderColor = `rgba(${cs},${Math.min(0.97, 0.16 + e * 0.7 + ar * 0.1)})`;
      el.style.boxShadow = `0 0 ${9 + e * 34 + ar * 10}px rgba(${cs},${0.05 + e * 0.5 + ar * 0.08}),inset 0 0 ${14 + e * 24}px rgba(255,110,50,${0.03 + e * 0.2})`;
      el.style.transform = `translate(-50%,-50%) scale(${1 + 0.05 * o.ackFlash + 0.012 * callPulse})`;
      dom.dot.style.background = `rgba(${cs},${0.45 + e * 0.5})`;
      dom.dot.style.boxShadow = `0 0 ${6 + e * 14}px rgba(${cs},${0.5 + e * 0.4})`;
      dom.bar.style.opacity = String(0.2 + Math.min(1, e) * 0.78);
      dom.bar.style.boxShadow = e > 0.05 ? `0 0 ${5 + e * 9}px rgba(${cs},${Math.min(1, e) * 0.7})` : 'none';
      const vc = calling ? '#ff8a66' : (ar > 0.5 ? '#ffd0ad' : '#f3ddbd');
      if (vc !== o._lvc) { dom.val.style.color = vc; o._lvc = vc; }
      if (calling !== o._lfc) {
        dom.flag.textContent = calling ? '▲ NEEDS YOU' : '● LIVE';
        if (!calling) dom.flag.style.color = 'rgba(255,180,120,0.4)';
        o._lfc = calling;
      }
      if (calling) dom.flag.style.color = `rgba(255,96,66,${(0.55 + 0.4 * callPulse).toFixed(2)})`;
    }
  }

  private _drawHeart(ctx: CanvasRenderingContext2D, t: number, contraction: number, ar: number) {
    let { cx, cy } = this; const { heartR } = this;
    cx += this.lean.x; cy += this.lean.y;
    const trem = ar * heartR * 0.055;
    cx += (Math.sin(t * 38) + Math.sin(t * 53.7) * 0.6) * trem;
    cy += (Math.cos(t * 41) + Math.sin(t * 61.3) * 0.6) * trem;

    const R = heartR * (1 - 0.12 * contraction * (0.55 + ar) + 0.06 * this.beatPulse + 0.025 * Math.sin(t * 0.55));

    const N = 140; const wob = 0.05 + 0.055 * ar; const pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const rr = R * (1
        + wob * Math.sin(3 * th + t * 0.7)
        + wob * 0.7 * Math.sin(5 * th - t * 1.05)
        + wob * 0.5 * Math.sin(2 * th + t * 0.45)
        + (0.025 + ar * 0.03) * Math.sin(7 * th + t * 2.0)
        + (ar * 0.02) * Math.sin(11 * th - t * 3.0));
      pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
    }
    const blob = new Path2D();
    blob.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) blob.lineTo(pts[i][0], pts[i][1]);
    blob.closePath();

    ctx.globalCompositeOperation = 'lighter';
    const glowCol = this._mix([255, 122, 62], [255, 72, 50], ar);
    const gc = `${glowCol[0] | 0},${glowCol[1] | 0},${glowCol[2] | 0}`;
    const ogA = 0.13 + 0.2 * ar + 0.16 * contraction + this.absorbFlare * 0.12;
    let og = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 3.0);
    og.addColorStop(0, `rgba(${gc},${ogA * 1.05})`);
    og.addColorStop(0.32, `rgba(150,32,22,${ogA * 0.3 + 0.03})`);
    og.addColorStop(0.6, `rgba(${gc},${ogA * 0.26})`);
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og; ctx.fillRect(cx - R * 3.1, cy - R * 3.1, R * 6.2, R * 6.2);
    og = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 1.35);
    og.addColorStop(0, `rgba(255,140,80,${0.12 + 0.14 * contraction + 0.1 * ar})`);
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og; ctx.fillRect(cx - R * 1.5, cy - R * 1.5, R * 3, R * 3);

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(t * 0.18);
    for (let a = 0; a < 3; a++) {
      const rr = R * (1.5 + a * 0.42);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const th = (i / 60) * Math.PI * 2;
        const w = 1 + 0.12 * Math.sin(th * (3 + a) + t * (1 + a));
        const x = Math.cos(th) * rr * w, y = Math.sin(th) * rr * w;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(255,${150 - a * 20},${90 - a * 30},${(0.05 + 0.06 * ar) * (1 - a * 0.25)})`;
      ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.clip(blob);
    const hot = ar;
    const gx = cx - R * 0.16, gy = cy - R * 0.2;
    const grad = ctx.createRadialGradient(gx, gy, R * 0.02, cx, cy, R * 1.08);
    const core = this._mix([255, 253, 240], [255, 255, 255], hot);
    const s1 = this._mix([255, 231, 176], [255, 208, 120], hot);
    const s2 = this._mix([255, 138, 74], [255, 92, 48], hot);
    const s3 = this._mix([184, 48, 48], [214, 48, 46], hot);
    const s4 = this._mix([98, 24, 24], [124, 22, 20], hot);
    const clv = 1 + contraction * 0.55;
    grad.addColorStop(0.0, `rgb(${Math.min(255, core[0] * clv) | 0},${Math.min(255, core[1] * Math.min(1.05, clv)) | 0},${core[2] | 0})`);
    grad.addColorStop(0.11, `rgb(${s1[0] | 0},${s1[1] | 0},${s1[2] | 0})`);
    grad.addColorStop(0.30, `rgb(${s2[0] | 0},${s2[1] | 0},${s2[2] | 0})`);
    grad.addColorStop(0.56, `rgb(${s3[0] | 0},${s3[1] | 0},${s3[2] | 0})`);
    grad.addColorStop(0.80, `rgb(${s4[0] | 0},${s4[1] | 0},${s4[2] | 0})`);
    grad.addColorStop(0.93, 'rgba(58,12,12,0.55)');
    grad.addColorStop(1.0, 'rgba(38,8,8,0)');
    ctx.fillStyle = grad; ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);

    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.molten) {
      const a = m.ph + t * m.spd;
      const wb = 1 + 0.18 * Math.sin(t * 0.9 + m.ph);
      const ox = Math.cos(a) * R * m.rad, oy = Math.sin(a) * R * m.rad * 0.92;
      const cr = R * m.size * wb;
      const heatC = this._mix([255, 150, 70], [255, 96, 52], (ar + m.hue) * 0.5);
      const inner = m.rad < 0.32 ? this._mix([255, 226, 152], heatC, 0.4) : heatC;
      const al = (0.05 + 0.055 * contraction) * (1.1 - m.rad);
      const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, cr);
      g.addColorStop(0, `rgba(${inner[0] | 0},${inner[1] | 0},${inner[2] | 0},${al})`);
      g.addColorStop(1, `rgba(${heatC[0] | 0},${heatC[1] | 0},40,0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + ox, cy + oy, cr, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = `rgba(26,5,5,${0.32 + 0.14 * ar})`;
    const sway = Math.sin(t * 0.5) * 0.05 + Math.sin(t * 0.27) * 0.03;
    for (const f of this.filaments) {
      ctx.lineWidth = Math.max(0.5, f.w * R);
      ctx.beginPath();
      const p = f.pts;
      for (let i = 0; i < p.length; i++) {
        const d = Math.hypot(p[i].x, p[i].y);
        const rot = sway * (0.4 + d);
        const ca = Math.cos(rot), sa = Math.sin(rot);
        const x = cx + (p[i].x * ca - p[i].y * sa) * R;
        const y = cy + (p[i].x * sa + p[i].y * ca) * R;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalCompositeOperation = 'lighter';
    const nucR = R * (0.36 - 0.14 * contraction) * (1 - 0.05 * ar);
    const nucBright = 0.46 + contraction * 0.62 + this.beatPulse * 0.22 + this.absorbFlare * 0.45;
    let ng = ctx.createRadialGradient(gx, gy, 0, gx, gy, nucR);
    ng.addColorStop(0, `rgba(255,255,250,${Math.min(1, nucBright)})`);
    ng.addColorStop(0.4, `rgba(255,228,166,${Math.min(0.95, nucBright * 0.8)})`);
    ng.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(gx, gy, nucR, 0, 6.2832); ctx.fill();

    ctx.save();
    ctx.translate(cx - R * 0.3, cy - R * 0.36); ctx.rotate(-0.5); ctx.scale(1, 0.5);
    let sp = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.28);
    sp.addColorStop(0, 'rgba(255,255,255,0.55)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, 6.2832); ctx.fill();
    ctx.restore();
    sp = ctx.createRadialGradient(cx + R * 0.12, cy - R * 0.04, 0, cx + R * 0.12, cy - R * 0.04, R * 0.08);
    sp.addColorStop(0, 'rgba(255,250,235,0.4)');
    sp.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(cx + R * 0.12, cy - R * 0.04, R * 0.08, 0, 6.2832); ctx.fill();

    const rim = ctx.createRadialGradient(cx, cy - R * 0.55, R * 0.5, cx, cy - R * 0.2, R * 1.06);
    rim.addColorStop(0, 'rgba(255,240,210,0)');
    rim.addColorStop(0.82, 'rgba(255,210,150,0)');
    rim.addColorStop(0.96, `rgba(255,226,172,${0.18 + 0.12 * ar})`);
    rim.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = rim; ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
    ctx.globalCompositeOperation = 'source-over';

    ctx.restore();
  }

  /* ── Audio (gated behind user toggle) ──────────────── */

  setAudio(on: boolean) {
    this.audioOn = on;
    if (on) {
      if (!this.actx) this._initAudio();
      if (this.actx && this.actx.state === 'suspended') this.actx.resume();
      if (this.master && this.actx) this.master.gain.setTargetAtTime(0.85, this.actx.currentTime, 0.4);
    } else if (this.master && this.actx) {
      this.master.gain.setTargetAtTime(0.0001, this.actx.currentTime, 0.25);
    }
  }

  private _initAudio() {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.actx = new AC();
    if (!this.actx) return;
    this.master = this.actx.createGain(); this.master.gain.value = 0.0001;
    this.master.connect(this.actx.destination);
    this.drone = this.actx.createOscillator(); this.drone.type = 'sine'; this.drone.frequency.value = 38;
    this.droneG = this.actx.createGain(); this.droneG.gain.value = 0.0;
    this.drone.connect(this.droneG); this.droneG.connect(this.master); this.drone.start();
    const buf = this.actx.createBuffer(1, this.actx.sampleRate * 2, this.actx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const tide = this.actx.createBufferSource(); tide.buffer = buf; tide.loop = true;
    const bp = this.actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 220; bp.Q.value = 0.7;
    this.tideG = this.actx.createGain(); this.tideG.gain.value = 0.0;
    tide.connect(bp); bp.connect(this.tideG); this.tideG.connect(this.master); tide.start();
  }

  private _tone(o: { type?: OscillatorType; freq: number; freq2?: number; dur?: number; peak?: number; atk?: number }) {
    if (!this.audioOn || !this.actx || !this.master) return;
    const t = this.actx.currentTime;
    const osc = this.actx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freq2) osc.frequency.exponentialRampToValueAtTime(o.freq2, t + (o.dur || 0.3));
    const g = this.actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.peak || 0.3), t + (o.atk || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.3));
    osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + (o.dur || 0.3) + 0.05);
  }

  private _noiseBurst(dur: number, freq: number, q: number, peak: number) {
    if (!this.audioOn || !this.actx || !this.master || !this.noiseBuf) return;
    const t = this.actx.currentTime;
    const src = this.actx.createBufferSource(); src.buffer = this.noiseBuf;
    const bp = this.actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q || 1;
    const g = this.actx.createGain();
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + 0.02);
  }

  private _beatSound(ar: number) {
    if (!this.audioOn) return;
    this._tone({ type: 'sine', freq: 56 * (1 + 0.12 * ar), freq2: 34, dur: 0.22, peak: 0.9, atk: 0.005 });
    this._noiseBurst(0.04, 180, 1.2, 0.18 + 0.12 * ar);
    setTimeout(() => {
      this._tone({ type: 'sine', freq: 46 * (1 + 0.1 * ar), freq2: 30, dur: 0.16, peak: 0.5, atk: 0.005 });
      this._noiseBurst(0.03, 150, 1.2, 0.1);
    }, 95);
  }

  private _alertSound() { this._tone({ type: 'sine', freq: 392, freq2: 370, dur: 0.5, peak: 0.16, atk: 0.02 }); this._tone({ type: 'triangle', freq: 588, freq2: 555, dur: 0.45, peak: 0.06, atk: 0.03 }); }
  private _ackSound()   { this._tone({ type: 'sine', freq: 330, freq2: 494, dur: 0.4, peak: 0.18, atk: 0.01 }); this._tone({ type: 'triangle', freq: 660, freq2: 988, dur: 0.36, peak: 0.07, atk: 0.02 }); }
  private _tap()        { this._tone({ type: 'sine', freq: 220, freq2: 150, dur: 0.16, peak: 0.12, atk: 0.004 }); }
}
