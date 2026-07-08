/* ============================================================
   KAI Mobile Command — "the sun and the river".

   Phones (<768px) can't hold the desktop 12-anchor radial layout:
   panels overlap the heart and each other. This is the mobile
   replacement, mounted in place of CommandCorePanel on the command
   view when useIsMobile() is true. Desktop is untouched.

   Architecture:
     1. HERO (sticky, 42vh) — the heart alone, rendered by the
        CommandCore engine (untouched). Its lower veins clip at the
        hero's bottom edge, reading as roots descending into the page.
        Brand top-left, BPM/state top-right, CORE-V6M bottom-right.
     2. BRIEF BAR — one slim dismissible line under the hero.
     3. THE RIVER — a 2-column feed of the 12 organ cards (blood-gold,
        charge-glow + NEEDS-YOU), calling organs sorted to the top,
        then the utility widgets (weather/markets/focus/…) restyled
        into the same card language via a scoped .glass override.
     4. VEIN THREAD — one gold polyline down the river's left edge
        with sparks travelling it, continuing the heart's vasculature.

   The engine only mutates the organ DOM refs it's handed; the visible
   river cards are driven independently from getCommandSignals(), so
   the heart engine stays byte-for-byte the same (CORE-V4).
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { CommandCore, type OrganDom } from '../lib/kai/commandCoreV6';
import { getCommandSignals, ACK_ROUTE } from '../lib/kai/commandSignals';
import { emitAction } from '../lib/actions';
import { sfx } from '../lib/sound';
import { briefing } from '../lib/commands';
import IntelStrip from './IntelStrip';
import { organCardData, organWeight, type OrganCardData } from '../lib/kai/organCard';
import { loadState } from '../lib/store';

/* Micro-sparkline (§7.7): 7 real points, single gold stroke, no axes. */
function Spark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const w = 40, h = 12, min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="kai-mc-spark7" aria-hidden>
      <polyline points={pts} fill="none" stroke="rgba(255,190,110,0.7)" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface OrganDef { id: string; label: string; }
const ORGANS: OrganDef[] = [
  { id: '01', label: 'INCOME' },
  { id: '02', label: 'DEBT' },
  { id: '03', label: 'GARDEN' },
  { id: '04', label: 'MAKADI' },
  { id: '05', label: 'INSTAGRAM' },
  { id: '06', label: 'PRIORITIES' },
  { id: '07', label: 'EXPENSES' },
  { id: '08', label: 'CONTENT' },
  { id: '09', label: 'MIRROR' },
  { id: '10', label: 'LEDGER' },
  { id: '11', label: 'TOLLGATE' },
  { id: '12', label: 'INBOX' },
];

/* Build the hidden organ DOM the engine expects (el/dot/bar/val/flag
   per organ). These never show — they only satisfy the engine's
   contract so the heart renders. The visible cards live in the river
   and are driven separately. Returns a cleanup that detaches them. */
function makeHiddenOrgans(host: HTMLElement): { organs: Record<string, OrganDom>; cleanup: () => void } {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
  const organs: Record<string, OrganDom> = {};
  for (const o of ORGANS) {
    const el = document.createElement('div');
    const dot = document.createElement('span');
    const bar = document.createElement('div');
    const val = document.createElement('div');
    const flag = document.createElement('div');
    el.append(dot, bar, val, flag);
    wrap.append(el);
    organs[o.id] = { el, dot, bar, val, flag, label: o.label };
  }
  host.append(wrap);
  return { organs, cleanup: () => wrap.remove() };
}

export default function MobileCommand() {
  const heroRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bpmRef    = useRef<HTMLDivElement>(null);
  const stateRef  = useRef<HTMLDivElement>(null);
  const subRef    = useRef<HTMLDivElement>(null);
  const coreRef   = useRef<CommandCore | null>(null);

  const [signals, setSignals] = useState<Record<string, { formatted: string; calling: boolean; victory?: boolean }>>({});
  const [brief, setBrief] = useState<string>('');
  const [briefOpen, setBriefOpen] = useState(true);

  /* Boot the heart engine into the hero canvas. */
  useEffect(() => {
    if (!canvasRef.current || !heroRef.current || !bpmRef.current || !stateRef.current || !subRef.current) return;
    const { organs, cleanup } = makeHiddenOrgans(heroRef.current);
    const core = new CommandCore({
      canvas: canvasRef.current,
      root:   heroRef.current,
      organs,
      hud: { bpm: bpmRef.current, state: stateRef.current, sub: subRef.current },
      signalProvider: getCommandSignals,
    });
    coreRef.current = core;
    core.start();
    /* V6: on the first touch of the hero, ask for device-orientation
       so the core leans with the phone (iOS gates this behind a tap). */
    const hero = heroRef.current;
    const tilt = () => { core.enableTilt(); hero.removeEventListener('touchstart', tilt); };
    hero.addEventListener('touchstart', tilt, { once: true });
    return () => { core.stop(); cleanup(); hero.removeEventListener('touchstart', tilt); coreRef.current = null; };
  }, []);

  /* Drive the visible river cards from real signals on a slow tick.
     Cheap — 12 lookups; the heart's 60fps loop is elsewhere. */
  useEffect(() => {
    const pull = () => setSignals(getCommandSignals());
    pull();
    const t = setInterval(pull, 2000);
    return () => clearInterval(t);
  }, []);

  /* The briefing line — first sentence only, for the slim bar. */
  useEffect(() => {
    try {
      const full = briefing();
      const firstMove = full.split('\n').find(l => /^\d\.\s/.test(l)) || full.split('\n')[0] || '';
      setBrief(firstMove.replace(/^\d\.\s*/, '').trim());
    } catch { setBrief(''); }
  }, []);

  function tapOrgan(id: string) {
    sfx.click();
    const target = ACK_ROUTE[id];
    if (target) emitAction({ type: 'ping-panel', panel: target });
  }

  /* Storm triage (§7.3): calling organs rise, ranked by domain
     weight; the rest keep canonical order. */
  const callingOrgans = ORGANS.filter(o => signals[o.id]?.calling).sort((a, b) => organWeight(b.id) - organWeight(a.id));
  const quietOrgans = ORGANS.filter(o => !signals[o.id]?.calling);
  const storm = callingOrgans.length >= 3;

  /* Haptic pulse (§7.10): while any organ calls and we're foreground,
     a soft double-tap synced loosely to the heartbeat. iOS Safari has
     no vibration → progressive, Android primary. */
  const hapticsOn = (() => { try { return loadState().settings.haptics !== false; } catch { return true; } })();
  useEffect(() => {
    if (!hapticsOn || callingOrgans.length === 0) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const beat = () => { if (document.visibilityState === 'visible') navigator.vibrate([18, 90, 14]); };
    beat();
    const t = setInterval(beat, 2600);
    return () => { clearInterval(t); try { navigator.vibrate(0); } catch { /* ignore */ } };
  }, [hapticsOn, callingOrgans.length]);

  const renderCard = (o: OrganDef, muted: boolean) => {
    const s = signals[o.id];
    const calling = !!s?.calling;
    const victory = !!s?.victory;
    const cd: OrganCardData = organCardData(o.id);
    const goodDown = o.id === '02' || o.id === '07';
    const deltaGood = cd.delta == null ? true : (goodDown ? cd.delta < 0 : cd.delta > 0);
    return (
      <button
        key={o.id}
        className={'kai-mc-card' + (victory ? ' is-victory' : calling ? (muted ? ' is-muted' : ' is-calling') : '')}
        onClick={() => tapOrgan(o.id)}
      >
        <div className="kai-mc-card-top">
          <span className="kai-mc-card-id">{o.id}</span>
          <span className="kai-mc-card-name">{o.label}</span>
          <span className="kai-mc-card-dot" />
        </div>
        <div className="kai-mc-card-val">{s?.formatted ?? '—'}</div>
        {cd.delta != null && Math.abs(cd.delta) >= 1 && (
          <div className={'kai-mc-card-delta ' + (deltaGood ? 'good' : 'bad')}>
            {cd.delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(cd.delta)).toLocaleString()} · 7d
          </div>
        )}
        {(cd.series.length >= 2 || cd.ghost) && (
          <div className="kai-mc-card-spark">
            <Spark data={cd.series} />
            {cd.ghost && <span className="kai-mc-card-ghost">{cd.ghost}</span>}
          </div>
        )}
        <div className="kai-mc-card-flag">{calling ? 'NEEDS YOU' : ''}</div>
      </button>
    );
  };

  return (
    <div className="kai-mc">
      {/* ── HERO ─────────────────────────────────────────── */}
      <div ref={heroRef} className="kai-mc-hero">
        <canvas ref={canvasRef} className="kai-mc-canvas" aria-hidden />
        <div className="kai-mc-brand">KAI</div>
        <div className="kai-mc-vitals">
          <div ref={bpmRef} className="kai-mc-bpm">58 BPM</div>
          <div ref={stateRef} className="kai-mc-state">CALM</div>
          <div ref={subRef} className="kai-mc-sub">ALL SYSTEMS QUIET</div>
        </div>
        {/* Marker — occludes the engine's canvas CORE-V4 stamp with the
            mobile variant so a glance confirms the mobile layout is live. */}
        <div className="kai-mc-ver">CORE-V6M</div>
      </div>

      {/* ── BRIEF BAR ────────────────────────────────────── */}
      {briefOpen && brief && (
        <div className="kai-mc-brief">
          <span className="kai-mc-brief-tag">NEXT</span>
          <span className="kai-mc-brief-text">{brief}</span>
          <button className="kai-mc-brief-x" onClick={() => setBriefOpen(false)} aria-label="dismiss">✕</button>
        </div>
      )}

      {/* ── THE RIVER ────────────────────────────────────── */}
      <div className="kai-mc-river">
        {/* Vein thread down the left edge */}
        <div className="kai-mc-vein" aria-hidden>
          <span className="kai-mc-spark" style={{ animationDelay: '0s' }} />
          <span className="kai-mc-spark" style={{ animationDelay: '2.6s' }} />
          <span className="kai-mc-spark kai-mc-spark--crimson" style={{ animationDelay: '1.3s' }} />
        </div>

        {callingOrgans.length > 0 && (
          <>
            <div className="kai-mc-ribbon calling">{storm ? `${callingOrgans.length} CALLING · ${callingOrgans[0].label} FIRST` : 'CALLING'}</div>
            <div className="kai-mc-grid">{callingOrgans.map((o, i) => renderCard(o, storm && i > 0))}</div>
          </>
        )}

        <div className="kai-mc-ribbon">QUIET</div>
        <div className="kai-mc-grid">{quietOrgans.map(o => renderCard(o, false))}</div>

        {/* Utility widgets — same data, restyled into blood-gold via a
            scoped .glass override in index.css. Never overlays the heart. */}
        <div className="kai-mc-utils">
          <div className="kai-mc-ribbon">SYSTEMS</div>
          <IntelStrip />
        </div>
      </div>
    </div>
  );
}
