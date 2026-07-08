/* ============================================================
   Command Core — the Living Body view (§7 interface redesign).

   The V6 engine/canvas is unchanged. This DOM layer is rebuilt to
   instrument-grade clarity: a disciplined 6/6 column grid whose true
   panel anchors are measured and handed to the engine (setAnchors) so
   the arteries connect to the real cards; per-card sparklines + honest
   ghosts + a full state system; storm triage; and Rewind (R / long-
   press SystemPulse) that replays the whole view from the Spine.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { CommandCore, type OrganDom } from '../../lib/kai/commandCoreV6';
import { getCommandSignals, ACK_ROUTE } from '../../lib/kai/commandSignals';
import { organCardData, organWeight } from '../../lib/kai/organCard';
import { signalsAt, rewindRange } from '../../lib/kai/rewind';
import { emitAction } from '../../lib/actions';
import { sfx } from '../../lib/sound';

interface OrganDef { id: string; label: string; col: 'left' | 'right'; row: number; }

/* Disciplined 6/6 grid: left column, right column, six even rows. */
const ORGANS: OrganDef[] = [
  { id: '01', label: 'INCOME',     col: 'left',  row: 0 },
  { id: '02', label: 'DEBT',       col: 'left',  row: 1 },
  { id: '03', label: 'GARDEN',     col: 'left',  row: 2 },
  { id: '04', label: 'MAKADI',     col: 'left',  row: 3 },
  { id: '05', label: 'INSTAGRAM',  col: 'left',  row: 4 },
  { id: '06', label: 'PRIORITIES', col: 'left',  row: 5 },
  { id: '07', label: 'EXPENSES',   col: 'right', row: 0 },
  { id: '08', label: 'CONTENT',    col: 'right', row: 1 },
  { id: '09', label: 'MIRROR',     col: 'right', row: 2 },
  { id: '10', label: 'LEDGER',     col: 'right', row: 3 },
  { id: '11', label: 'TOLLGATE',   col: 'right', row: 4 },
  { id: '12', label: 'INBOX',      col: 'right', row: 5 },
];
const ROWS = 6;
/* Cards are CENTER-anchored: the engine writes translate(-50%,-50%)
   scale() to each organ el every frame (beat scale), so we position
   by the card's centre point and let the engine centre + scale it.
   Six even rows, centres 12%…82%; columns just outside the sacred
   ellipse. */
const rowCenter = (row: number) => `${9.5 + row * ((90.5 - 9.5) / (ROWS - 1))}%`;
const colCenter = (col: 'left' | 'right') => (col === 'left' ? '11.5%' : '88.5%');

function Spark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const w = 46, h = 13, min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="kai-cc-spark" aria-hidden><polyline points={pts} fill="none" stroke="rgba(255,190,110,0.7)" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

interface CardState { calling: boolean; victory?: boolean; series: number[]; delta: number | null; ghost: string | null; }

export default function CommandCorePanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bpmRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const organRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dotRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const barRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const valRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const flagRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const coreRef = useRef<CommandCore | null>(null);
  const soundOnRef = useRef(false);

  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [rewindTs, setRewindTs] = useState<number | null>(null);
  const range = rewindRange();

  /* Measure each card's inner-edge anchor (facing the core) in canvas-
     local px and hand them to the engine so arteries hit the real grid. */
  function pushAnchors() {
    const core = coreRef.current, canvas = canvasRef.current;
    if (!core || !canvas) return;
    const cr = canvas.getBoundingClientRect();
    const map: Record<string, { x: number; y: number }> = {};
    for (const o of ORGANS) {
      const el = organRefs.current[o.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const x = (o.col === 'left' ? r.right : r.left) - cr.left;
      const y = r.top + r.height / 2 - cr.top;
      map[o.id] = { x, y };
    }
    core.setAnchors(map);
  }

  useEffect(() => {
    if (!canvasRef.current || !rootRef.current || !bpmRef.current || !stateRef.current || !subRef.current) return;
    const organs: Record<string, OrganDom> = {};
    for (const o of ORGANS) {
      const el = organRefs.current[o.id], dot = dotRefs.current[o.id], bar = barRefs.current[o.id], val = valRefs.current[o.id], flag = flagRefs.current[o.id];
      if (!el || !dot || !bar || !val || !flag) continue;
      organs[o.id] = { el, dot, bar, val, flag, label: o.label };
    }
    const core = new CommandCore({
      canvas: canvasRef.current, root: rootRef.current, organs,
      hud: { bpm: bpmRef.current, state: stateRef.current, sub: subRef.current },
      signalProvider: getCommandSignals,
      onAck: (id) => { const t = ACK_ROUTE[id]; if (t) emitAction({ type: 'ping-panel', panel: t }); },
    });
    coreRef.current = core;
    core.start();
    const t0 = setTimeout(pushAnchors, 120);     // after first layout
    const onResize = () => pushAnchors();
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(t0); window.removeEventListener('resize', onResize); core.stop(); coreRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Card memory + state on a slow tick. */
  useEffect(() => {
    const pull = () => {
      const sig = getCommandSignals();
      const next: Record<string, CardState> = {};
      for (const o of ORGANS) { const cd = organCardData(o.id); next[o.id] = { calling: !!sig[o.id]?.calling, victory: !!sig[o.id]?.victory, ...cd }; }
      setCards(next);
    };
    pull();
    const t = setInterval(pull, 2000);
    return () => clearInterval(t);
  }, []);

  /* Rewind (§7.8): R toggles; long-press SystemPulse dispatches kai:rewind. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      setRewindTs(v => (v == null ? range.max : null));
    };
    const onEvt = () => setRewindTs(v => (v == null ? range.max : null));
    window.addEventListener('keydown', onKey);
    window.addEventListener('kai:rewind', onEvt as EventListener);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('kai:rewind', onEvt as EventListener); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.max]);

  /* Drive the engine's signal source from the scrub position. */
  useEffect(() => {
    const core = coreRef.current;
    if (!core) return;
    if (rewindTs == null) core.setSignalProvider(getCommandSignals);
    else { const ts = rewindTs; core.setSignalProvider(() => signalsAt(ts)); }
  }, [rewindTs]);

  const callingIds = ORGANS.filter(o => cards[o.id]?.calling).map(o => o.id).sort((a, b) => organWeight(b) - organWeight(a));
  const storm = callingIds.length >= 3;

  function toggleSound() {
    sfx.click();
    const next = !soundOnRef.current; soundOnRef.current = next;
    coreRef.current?.setAudio(next);
    const btn = document.getElementById('kai-cc-sound');
    if (btn) btn.textContent = next ? '◉ SOUND ON' : '○ SOUND OFF';
  }
  function ackAll() { sfx.whoosh(); coreRef.current?.ackAll(); }

  return (
    <div ref={rootRef} className="kai-cc-root">
      <canvas ref={canvasRef} className="kai-cc-canvas" aria-hidden />

      {/* HUD — top-center: BPM, state, one sub. */}
      <div className="kai-cc-hud">
        <div ref={bpmRef} className="kai-cc-bpm">58 BPM</div>
        <div ref={stateRef} className="kai-cc-state">CALM</div>
        <div ref={subRef} className="kai-cc-sub">ALL SYSTEMS QUIET</div>
      </div>

      {/* The 12 organ cards — 6/6 grid, full anatomy. */}
      {ORGANS.map(o => {
        const c = cards[o.id];
        const muted = storm && o.id !== callingIds[0] && !!c?.calling;
        const goodDown = o.id === '02' || o.id === '07';
        const deltaGood = c?.delta == null ? true : (goodDown ? c.delta < 0 : c.delta > 0);
        return (
          <div
            key={o.id}
            ref={(el) => { organRefs.current[o.id] = el; }}
            data-id={o.id}
            className={'kai-cc-card' + (c?.victory ? ' is-victory' : c?.calling ? (muted ? ' is-muted' : ' is-calling') : '')}
            style={{ left: colCenter(o.col), top: rowCenter(o.row) }}
          >
            <div className="kai-cc-card-head">
              <span className="kai-cc-num">{o.id}</span>
              <span className="kai-cc-label">{o.label}</span>
              <span ref={(el) => { dotRefs.current[o.id] = el; }} className="kai-cc-dot" />
            </div>
            <div ref={(el) => { valRefs.current[o.id] = el; }} className="kai-cc-value" />
            {c?.delta != null && Math.abs(c.delta) >= 1 && (
              <div className={'kai-cc-delta ' + (deltaGood ? 'good' : 'bad')}>{c.delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(c.delta)).toLocaleString()} · 7d</div>
            )}
            {(c && (c.series.length >= 2 || c.ghost)) && (
              <div className="kai-cc-sparkrow"><Spark data={c.series} />{c.ghost && <span className="kai-cc-ghost">{c.ghost}</span>}</div>
            )}
            <div ref={(el) => { barRefs.current[o.id] = el; }} className="kai-cc-bar" />
            <div ref={(el) => { flagRefs.current[o.id] = el; }} className="kai-cc-flag" />
          </div>
        );
      })}

      {/* Rewind scrubber + banner (§7.8) */}
      {rewindTs != null && (
        <>
          <div className="kai-cc-rewind-banner">REWIND · {new Date(rewindTs).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
          <div className="kai-cc-rewind-bar">
            <input
              type="range" min={range.min} max={range.max} value={rewindTs} step={86_400_000}
              onChange={(e) => setRewindTs(Number(e.target.value))}
              onPointerUp={() => setRewindTs(null)}
              onKeyUp={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRewindTs(null); }}
              aria-label="rewind scrubber"
            />
            <span className="kai-cc-rewind-hint">release to snap back to now</span>
          </div>
        </>
      )}

      <button id="kai-cc-sound" onClick={toggleSound} className="kai-cc-btn kai-cc-sound">○ SOUND OFF</button>
      <button onClick={ackAll} className="kai-cc-btn kai-cc-ackall">ACK ALL</button>
    </div>
  );
}
