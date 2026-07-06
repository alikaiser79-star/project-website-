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
        Brand top-left, BPM/state top-right, CORE-V4M bottom-right.
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
import { CommandCore, type OrganDom } from '../lib/kai/commandCore';
import { getCommandSignals, ACK_ROUTE } from '../lib/kai/commandSignals';
import { emitAction } from '../lib/actions';
import { sfx } from '../lib/sound';
import { briefing } from '../lib/commands';
import IntelStrip from './IntelStrip';

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

interface MobileCommandProps {
  /* Swipe down on the hero → open the testimony scroll. */
  onRevealScroll?: () => void;
}

export default function MobileCommand({ onRevealScroll }: MobileCommandProps) {
  const heroRef   = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bpmRef    = useRef<HTMLDivElement>(null);
  const stateRef  = useRef<HTMLDivElement>(null);
  const subRef    = useRef<HTMLDivElement>(null);
  const coreRef   = useRef<CommandCore | null>(null);

  const [signals, setSignals] = useState<Record<string, { formatted: string; calling: boolean }>>({});
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
    return () => { core.stop(); cleanup(); coreRef.current = null; };
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

  /* Calling organs rise to the top; otherwise keep canonical order. */
  const ordered = [...ORGANS].sort((a, b) => {
    const ca = signals[a.id]?.calling ? 1 : 0;
    const cb = signals[b.id]?.calling ? 1 : 0;
    return cb - ca;
  });

  /* Downward swipe on the hero reveals the testimony scroll. */
  function onHeroTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onHeroTouchEnd(e: React.TouchEvent) {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dy = t.clientY - s.y;
    const dx = Math.abs(t.clientX - s.x);
    if (dy > 55 && dy > dx) onRevealScroll?.();
  }

  return (
    <div className="kai-mc">
      {/* ── HERO ─────────────────────────────────────────── */}
      <div
        ref={heroRef}
        className="kai-mc-hero"
        onTouchStart={onHeroTouchStart}
        onTouchEnd={onHeroTouchEnd}
      >
        <canvas ref={canvasRef} className="kai-mc-canvas" aria-hidden />
        <div className="kai-mc-brand">KAI</div>
        <div className="kai-mc-vitals">
          <div ref={bpmRef} className="kai-mc-bpm">58 BPM</div>
          <div ref={stateRef} className="kai-mc-state">CALM</div>
          <div ref={subRef} className="kai-mc-sub">ALL SYSTEMS QUIET</div>
        </div>
        {/* Marker — occludes the engine's canvas CORE-V4 stamp with the
            mobile variant so a glance confirms the mobile layout is live. */}
        <div className="kai-mc-ver">CORE-V4M</div>
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

        <div className="kai-mc-grid">
          {ordered.map(o => {
            const s = signals[o.id];
            const calling = !!s?.calling;
            return (
              <button
                key={o.id}
                className={'kai-mc-card' + (calling ? ' is-calling' : '')}
                onClick={() => tapOrgan(o.id)}
              >
                <div className="kai-mc-card-top">
                  <span className="kai-mc-card-id">{o.id}</span>
                  <span className="kai-mc-card-dot" />
                </div>
                <div className="kai-mc-card-label">{o.label}</div>
                <div className="kai-mc-card-val">{s?.formatted ?? '—'}</div>
                <div className="kai-mc-card-flag">{calling ? 'NEEDS YOU' : ''}</div>
              </button>
            );
          })}
        </div>

        {/* Utility widgets — same data, restyled into blood-gold via a
            scoped .glass override in index.css. Never overlays the heart. */}
        <div className="kai-mc-utils">
          <div className="kai-mc-section">SYSTEMS</div>
          <IntelStrip />
        </div>
      </div>
    </div>
  );
}
