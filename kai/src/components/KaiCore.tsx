/* ============================================================
   KAI Core — neural head
   A left-facing human head silhouette traced out of ~120 glowing
   nodes connected by veins. Energy pulses travel each vein on a
   loop. Cyan-blue at the back/crown blends through galaxy violet
   to warm sun-gold at the face. 2D <canvas> + requestAnimationFrame.
   No three.js. Reacts to speak / listen / command via useKaiPulse.
   ============================================================ */

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useKaiPulse } from '../hooks/useKaiPulse';
import type { Accent } from '../types';

/* ── Left-facing head silhouette in normalized 0..1 space.
   Face features sit on the LEFT (low x); back of head on the RIGHT. */
const HEAD_POLY: ReadonlyArray<readonly [number, number]> = [
  [0.50, 0.06], [0.60, 0.06], [0.72, 0.10], [0.82, 0.16],
  [0.90, 0.26], [0.95, 0.40], [0.96, 0.54], [0.93, 0.65],
  [0.88, 0.74], [0.80, 0.81], [0.70, 0.86], [0.58, 0.89],
  [0.46, 0.92], [0.34, 0.91], [0.25, 0.86], [0.20, 0.81],
  [0.17, 0.75], [0.16, 0.71], [0.13, 0.68], [0.10, 0.64],
  [0.07, 0.60], [0.05, 0.56], [0.06, 0.52], [0.02, 0.49],
  [0.06, 0.46], [0.10, 0.43], [0.13, 0.38], [0.11, 0.34],
  [0.07, 0.32], [0.06, 0.28], [0.09, 0.22], [0.14, 0.15],
  [0.24, 0.08], [0.36, 0.06],
];

/* ── Data types ────────────────────────────────────────── */

type Node = {
  nx: number; ny: number;         // normalized 0..1 position
  colorT: number;                 // 0 = face/gold, 1 = back/cyan
  big: boolean;                   // chip-like larger node
  phase: number;                  // pulse phase offset
};

type Vein = {
  i: number; j: number;           // indices into nodes[]
  phase: number;                  // 0..1 along vein
  speed: number;                  // loops per second base rate
};

type OuterTrace = {
  segs: ReadonlyArray<readonly [number, number]>; // normalized polyline
};

type Scene = {
  headPath: Path2D;
  nodes: Node[];
  veins: Vein[];
  outer: OuterTrace[];
};

/* ── Helpers ───────────────────────────────────────────── */

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }

/* Color stops along x: gold → galaxy violet → moon cyan-blue. */
function colorAt(t: number): [number, number, number] {
  const u = clamp01(t);
  let r: number, g: number, b: number;
  if (u < 0.5) {
    const k = u / 0.5;
    r = lerp(255, 130, k); g = lerp(181, 110, k); b = lerp( 74, 200, k);
  } else {
    const k = (u - 0.5) / 0.5;
    r = lerp(130,  79, k); g = lerp(110, 184, k); b = lerp(200, 229, k);
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

function mix3(
  c: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(c[0] + (to[0] - c[0]) * t),
    Math.round(c[1] + (to[1] - c[1]) * t),
    Math.round(c[2] + (to[2] - c[2]) * t),
  ];
}

/* Deterministic seed → repeatable scene each rebuild. */
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/* ── Scene construction ────────────────────────────────── */

function buildHeadPath(W: number, H: number, scale = 0.92): Path2D {
  const margin = (1 - scale) / 2;
  const path = new Path2D();
  if (HEAD_POLY.length === 0) return path;
  const [x0, y0] = HEAD_POLY[0];
  path.moveTo((margin + x0 * scale) * W, (margin + y0 * scale) * H);
  for (let i = 1; i < HEAD_POLY.length; i++) {
    const [x, y] = HEAD_POLY[i];
    path.lineTo((margin + x * scale) * W, (margin + y * scale) * H);
  }
  path.closePath();
  return path;
}

function buildScene(W: number, H: number): Scene {
  const empty: Scene = { headPath: new Path2D(), nodes: [], veins: [], outer: [] };
  if (W < 16 || H < 16) return empty;
  if (typeof document === 'undefined') return empty;

  const rand = rng(20251218);
  const headPath = buildHeadPath(W, H);

  /* Off-screen 2D context just for isPointInPath rejection sampling. */
  const tmp = document.createElement('canvas');
  tmp.width = Math.max(1, Math.floor(W));
  tmp.height = Math.max(1, Math.floor(H));
  const tctx = tmp.getContext('2d');
  if (!tctx) return { ...empty, headPath };

  /* Nodes — rejection sample inside the silhouette with a minimum
     spacing so they don't clump. */
  const TARGET = 120;
  const minDist = Math.min(W, H) * 0.046;
  const minDist2 = minDist * minDist;
  const nodes: Node[] = [];
  for (let attempts = 0; nodes.length < TARGET && attempts < TARGET * 80; attempts++) {
    const x = rand() * W;
    const y = rand() * H;
    if (!tctx.isPointInPath(headPath, x, y)) continue;
    let ok = true;
    for (let k = 0; k < nodes.length; k++) {
      const nk = nodes[k];
      const dx = nk.nx * W - x;
      const dy = nk.ny * H - y;
      if (dx * dx + dy * dy < minDist2) { ok = false; break; }
    }
    if (!ok) continue;
    const nx = x / W;
    nodes.push({
      nx, ny: y / H,
      colorT: nx,
      big: rand() < 0.06,
      phase: rand() * Math.PI * 2,
    });
  }

  /* Veins — k-nearest (2-3 per node). Deduped, capped at 250.   */
  const veins: Vein[] = [];
  const seen = new Set<string>();
  const N = nodes.length;
  for (let i = 0; i < N; i++) {
    const a = nodes[i];
    const dists: Array<[number, number]> = [];
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const b = nodes[j];
      const dx = (a.nx - b.nx) * W;
      const dy = (a.ny - b.ny) * H;
      dists.push([j, dx * dx + dy * dy]);
    }
    dists.sort((u, v) => u[1] - v[1]);
    const k = 2 + (rand() < 0.45 ? 1 : 0);
    for (let kk = 0; kk < k && kk < dists.length; kk++) {
      const j = dists[kk][0];
      const key = i < j ? i + '-' + j : j + '-' + i;
      if (seen.has(key)) continue;
      seen.add(key);
      veins.push({
        i, j,
        phase: rand(),
        speed: 0.18 + rand() * 0.26,
      });
    }
  }

  /* A few long trunk veins linking face-side nodes to back-side
     nodes, so the network feels wired end-to-end. */
  const leftIdx: number[]  = [];
  const rightIdx: number[] = [];
  for (let i = 0; i < N; i++) {
    if (nodes[i].nx < 0.32) leftIdx.push(i);
    if (nodes[i].nx > 0.68) rightIdx.push(i);
  }
  for (let t = 0; t < 14 && leftIdx.length && rightIdx.length; t++) {
    const a = leftIdx[Math.floor(rand() * leftIdx.length)];
    const b = rightIdx[Math.floor(rand() * rightIdx.length)];
    if (a === b) continue;
    const key = a < b ? a + '-' + b : b + '-' + a;
    if (seen.has(key)) continue;
    seen.add(key);
    veins.push({
      i: a, j: b,
      phase: rand(),
      speed: 0.07 + rand() * 0.12,
    });
  }
  const capped = veins.slice(0, 250);

  /* Outer circuit traces — short polylines stepping out from the
     head edge with one 90° bend, tiny terminal nodes. */
  const outer: OuterTrace[] = [];
  for (let i = 0; i < 14; i++) {
    const angle = rand() * Math.PI * 2;
    const startR = 0.36 + rand() * 0.06;
    let cx = 0.5 + Math.cos(angle) * startR;
    let cy = 0.5 + Math.sin(angle) * startR;
    const segs: [number, number][] = [[cx, cy]];
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const l1 = 0.05 + rand() * 0.08;
    cx += dx * l1; cy += dy * l1;
    segs.push([cx, cy]);
    const bend = rand() < 0.5 ? 1 : -1;
    const px = -dy * bend, py = dx * bend;
    const l2 = 0.03 + rand() * 0.06;
    cx += px * l2; cy += py * l2;
    segs.push([cx, cy]);
    if (rand() < 0.5) {
      const l3 = 0.025 + rand() * 0.04;
      cx += dx * l3; cy += dy * l3;
      segs.push([cx, cy]);
    }
    outer.push({ segs });
  }

  return { headPath, nodes, veins: capped, outer };
}

/* ── Glow primitives ───────────────────────────────────── */

function drawGlowDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  col: readonly [number, number, number],
  brightness: number,
) {
  const [R, G, B] = col;
  /* Three additive passes stack into a soft bloom without shadowBlur. */
  ctx.fillStyle = `rgba(${R},${G},${B},${Math.min(0.45, 0.12 * brightness)})`;
  ctx.beginPath(); ctx.arc(x, y, r * 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(${R},${G},${B},${Math.min(0.72, 0.30 * brightness)})`;
  ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(${R},${G},${B},${Math.min(1, 0.85 * brightness)})`;
  ctx.beginPath(); ctx.arc(x, y, r,        0, Math.PI * 2); ctx.fill();
}

/* ── Frame draw ────────────────────────────────────────── */

const COOL_TARGET: readonly [number, number, number] = [110, 200, 255];

function drawScene(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  scene: Scene,
  now: number,
  pulses: { speakF: number; listenF: number; sweepProg: number },
) {
  const { nodes, veins, outer } = scene;
  const { speakF, listenF, sweepProg } = pulses;

  /* 1 — Solid dark background. */
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#04060c';
  ctx.fillRect(0, 0, W, H);

  /* 2 — Soft violet halo behind the head. */
  const cx = W / 2, cy = H / 2;
  const halo = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.05, cx, cy, Math.min(W, H) * 0.6);
  halo.addColorStop(0,   'rgba(80, 70, 180, 0.22)');
  halo.addColorStop(0.5, 'rgba(40, 50, 130, 0.08)');
  halo.addColorStop(1,   'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  /* Everything beyond this point is additive for a glowy network. */
  ctx.globalCompositeOperation = 'lighter';

  /* 3 — Outer circuit traces extending past the head edge. */
  for (let i = 0; i < outer.length; i++) {
    const segs = outer[i].segs;
    if (!segs || segs.length < 2) continue;
    const mid = segs[Math.floor(segs.length / 2)];
    const [r, g, b] = colorAt(clamp01(mid[0]));
    ctx.strokeStyle = `rgba(${r},${g},${b},0.32)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(segs[0][0] * W, segs[0][1] * H);
    for (let k = 1; k < segs.length; k++) ctx.lineTo(segs[k][0] * W, segs[k][1] * H);
    ctx.stroke();
    const end = segs[segs.length - 1];
    ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
    ctx.beginPath(); ctx.arc(end[0] * W, end[1] * H, 1.4, 0, Math.PI * 2); ctx.fill();
  }

  /* 4 — Static vein lines (low alpha). */
  for (let v = 0; v < veins.length; v++) {
    const vein = veins[v];
    const a = nodes[vein.i];
    const b = nodes[vein.j];
    if (!a || !b) continue;
    let col = colorAt((a.colorT + b.colorT) * 0.5);
    if (listenF > 0) col = mix3(col, COOL_TARGET, listenF * 0.55);
    ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.16)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.nx * W, a.ny * H);
    ctx.lineTo(b.nx * W, b.ny * H);
    ctx.stroke();
  }

  /* 5 — Moving energy dots + short glowing trail per vein. */
  for (let v = 0; v < veins.length; v++) {
    const vein = veins[v];
    const a = nodes[vein.i];
    const b = nodes[vein.j];
    if (!a || !b) continue;
    const ax = a.nx * W, ay = a.ny * H;
    const bx = b.nx * W, by = b.ny * H;
    const p = vein.phase;
    const x = ax + (bx - ax) * p;
    const y = ay + (by - ay) * p;
    let col = colorAt((a.colorT + b.colorT) * 0.5);
    if (listenF > 0) col = mix3(col, COOL_TARGET, listenF * 0.55);
    let brightness = 0.85 + 0.35 * speakF;
    if (sweepProg > 0) {
      const sweepX = sweepProg * W;
      const dist = Math.abs(x - sweepX);
      const range = W * 0.20;
      if (dist < range) brightness *= 1 + 1 * (1 - dist / range);
    }
    /* Short trail (gradient line). */
    const td = 0.08;
    const tx = ax + (bx - ax) * Math.max(0, p - td);
    const ty = ay + (by - ay) * Math.max(0, p - td);
    const lg = ctx.createLinearGradient(tx, ty, x, y);
    lg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    lg.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, 0.55 * brightness)})`);
    ctx.strokeStyle = lg;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    drawGlowDot(ctx, x, y, 1.6, col, brightness);
  }

  /* 6 — Junction nodes (slow pulse, chip-nodes brighter / larger). */
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const x = n.nx * W, y = n.ny * H;
    let col = colorAt(n.colorT);
    if (listenF > 0) col = mix3(col, COOL_TARGET, listenF * 0.55);
    const slow = 0.85 + 0.20 * Math.sin(now * 0.0015 + n.phase * 3);
    const r = n.big ? 3.4 : 1.7;
    let brightness = (n.big ? 1.35 : 1.0) + 0.30 * speakF;
    if (sweepProg > 0) {
      const sweepX = sweepProg * W;
      const dist = Math.abs(x - sweepX);
      const range = W * 0.20;
      if (dist < range) brightness *= 1 + 0.8 * (1 - dist / range);
    }
    drawGlowDot(ctx, x, y, r * slow, col, brightness);
  }

  ctx.globalCompositeOperation = 'source-over';
}

/* ── Public component ──────────────────────────────────── */

/* `accent` is accepted for API compat but ignored — the head is a
   fixed cyan→violet→gold palette by design. */
export default function KaiCore({ size, accent: _accent = 'amber' as Accent }: { size?: number; accent?: Accent }) {
  const wrap: CSSProperties = size ? { width: size, height: size } : { width: '100%', height: '100%' };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { speaking, listening, pulseTick } = useKaiPulse();

  /* Mirror hook values into refs so the rAF loop reads the latest
     state without re-running the effect on every change. */
  const speakingRef = useRef(speaking);
  const listeningRef = useRef(listening);
  const tickRef = useRef(pulseTick);
  useEffect(() => { speakingRef.current = speaking; },   [speaking]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  useEffect(() => { tickRef.current = pulseTick; },      [pulseTick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

    let scene: Scene = { headPath: new Path2D(), nodes: [], veins: [], outer: [] };
    function rebuild() {
      const W = Math.max(1, canvas!.clientWidth);
      const H = Math.max(1, canvas!.clientHeight);
      canvas!.width  = Math.max(1, Math.floor(W * DPR));
      canvas!.height = Math.max(1, Math.floor(H * DPR));
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      try {
        scene = buildScene(W, H);
      } catch {
        scene = { headPath: new Path2D(), nodes: [], veins: [], outer: [] };
      }
    }
    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(canvas);

    let last = performance.now();
    let raf = 0;
    let speakF = 0;
    let listenF = 0;
    let sweepProg = 0;
    let lastTick = tickRef.current;

    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      /* Smooth pulse factors */
      const ts = speakingRef.current ? 1 : 0;
      const tl = listeningRef.current ? 1 : 0;
      speakF  += (ts - speakF)  * Math.min(1, dt * 6);
      listenF += (tl - listenF) * Math.min(1, dt * 4);

      /* Command sweep — fire on tick change, propagate left→right */
      if (tickRef.current !== lastTick) {
        lastTick = tickRef.current;
        sweepProg = 0.0001;
      }
      if (sweepProg > 0) {
        sweepProg += dt * 1.4;
        if (sweepProg > 1.3) sweepProg = 0;
      }

      /* Advance vein phases — speaking accelerates the flow */
      const speedMul = 1 + speakF * 0.7;
      const veins = scene.veins;
      for (let i = 0; i < veins.length; i++) {
        const v = veins[i];
        v.phase += v.speed * dt * speedMul;
        if (v.phase >= 1) v.phase -= 1;
      }

      const W = canvas!.clientWidth || 1;
      const H = canvas!.clientHeight || 1;
      try {
        drawScene(ctx!, W, H, scene, now, { speakF, listenF, sweepProg });
      } catch { /* defensive — never let a frame error blank the screen */ }

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      try { ro.disconnect(); } catch {}
    };
  }, []);

  return (
    <div className="relative" style={wrap}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        aria-hidden
      />
    </div>
  );
}
