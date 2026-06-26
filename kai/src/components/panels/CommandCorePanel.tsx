/* ============================================================
   Command Core — the Living Body view.

   Replaces the previous Command cockpit. A full-bleed canvas
   with the heart + vasculature + flow + bloom (rendered by the
   CommandCore engine), 12 organ panels at viewport-% anchors,
   and a minimal HUD (BPM + state + sub).

   Real signals drive everything via getCommandSignals().
   Acking a calling organ pings the source panel (which lives
   on its own view) via the existing emitAction bus, so this
   view doubles as the launchpad into the full panel UI.

   Performance: per the brief, per-frame mutation goes directly
   on DOM nodes from the engine — React only manages mount /
   click handlers. NEVER re-renders 60×/sec.
   ============================================================ */

import { useEffect, useRef } from 'react';
import { CommandCore, type OrganDom } from '../../lib/kai/commandCore';
import { getCommandSignals, ACK_ROUTE } from '../../lib/kai/commandSignals';
import { emitAction } from '../../lib/actions';
import { sfx } from '../../lib/sound';

interface OrganDef {
  id: string;
  label: string;
  x: number;     // viewport-% horizontal
  y: number;     // viewport-% vertical
  align?: 'left' | 'right';
}

const ORGANS: OrganDef[] = [
  { id: '01', label: 'INCOME',     x: 11, y: 18,  align: 'left'  },
  { id: '02', label: 'DEBT',       x: 11, y: 39,  align: 'left'  },
  { id: '03', label: 'GARDEN',     x: 11, y: 61,  align: 'left'  },
  { id: '04', label: 'MAKADI',     x: 11, y: 82,  align: 'left'  },
  { id: '05', label: 'INSTAGRAM',  x: 89, y: 18,  align: 'right' },
  { id: '06', label: 'PRIORITIES', x: 89, y: 39,  align: 'right' },
  { id: '07', label: 'EXPENSES',   x: 89, y: 61,  align: 'right' },
  { id: '08', label: 'CONTENT',    x: 89, y: 82,  align: 'right' },
  { id: '09', label: 'MIRROR',     x: 37, y: 8.5             },
  { id: '10', label: 'LEDGER',     x: 63, y: 8.5             },
  { id: '11', label: 'TOLLGATE',   x: 30, y: 91.5            },
  { id: '12', label: 'INBOX',      x: 70, y: 91.5            },
];

export default function CommandCorePanel() {
  const rootRef    = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const bpmRef     = useRef<HTMLDivElement>(null);
  const stateRef   = useRef<HTMLDivElement>(null);
  const subRef     = useRef<HTMLDivElement>(null);
  const organRefs  = useRef<Record<string, HTMLDivElement | null>>({});
  const dotRefs    = useRef<Record<string, HTMLSpanElement | null>>({});
  const barRefs    = useRef<Record<string, HTMLDivElement | null>>({});
  const valRefs    = useRef<Record<string, HTMLDivElement | null>>({});
  const flagRefs   = useRef<Record<string, HTMLDivElement | null>>({});

  const coreRef    = useRef<CommandCore | null>(null);
  const soundOnRef = useRef(false);

  useEffect(() => {
    if (!canvasRef.current || !rootRef.current || !bpmRef.current || !stateRef.current || !subRef.current) return;

    const organs: Record<string, OrganDom> = {};
    for (const o of ORGANS) {
      const el = organRefs.current[o.id];
      const dot = dotRefs.current[o.id];
      const bar = barRefs.current[o.id];
      const val = valRefs.current[o.id];
      const flag = flagRefs.current[o.id];
      if (!el || !dot || !bar || !val || !flag) continue;
      organs[o.id] = { el, dot, bar, val, flag, label: o.label };
    }

    const core = new CommandCore({
      canvas: canvasRef.current,
      root:   rootRef.current,
      organs,
      hud: { bpm: bpmRef.current, state: stateRef.current, sub: subRef.current },
      signalProvider: getCommandSignals,
      onAck: (id) => {
        const target = ACK_ROUTE[id];
        if (target) emitAction({ type: 'ping-panel', panel: target });
      },
    });
    coreRef.current = core;
    core.start();

    return () => {
      core.stop();
      coreRef.current = null;
    };
  }, []);

  function toggleSound() {
    sfx.click();
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    coreRef.current?.setAudio(next);
    /* mutate the button label directly — avoid re-render */
    const btn = document.getElementById('kai-cc-sound');
    if (btn) btn.textContent = next ? '◉ SOUND ON' : '○ SOUND OFF';
  }

  function ackAll() {
    sfx.whoosh();
    coreRef.current?.ackAll();
  }

  return (
    <div
      ref={rootRef}
      className="kai-cc-root"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#030303',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        cursor: 'crosshair',
        zIndex: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', zIndex: 1 }}
        aria-hidden
      />

      {/* HUD — vitals (top-right). KAI brand is already in the
          existing TopBar so we don't duplicate it. Position below
          the TopBar to avoid overlap. */}
      <div
        style={{
          position: 'absolute', top: 90, right: 28,
          textAlign: 'right', zIndex: 4, pointerEvents: 'none',
        }}
      >
        <div
          ref={bpmRef}
          style={{
            fontSize: 15, letterSpacing: 3, color: '#ffcaa0',
            textShadow: '0 0 14px rgba(255,140,70,0.45)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >58 BPM</div>
        <div
          ref={stateRef}
          style={{
            marginTop: 7, fontSize: 8, letterSpacing: 5,
            color: 'rgba(255,160,90,0.55)',
          }}
        >CALM</div>
        <div
          ref={subRef}
          style={{
            marginTop: 5, fontSize: 7, letterSpacing: 3,
            color: 'rgba(232,210,190,0.3)',
          }}
        >ALL SYSTEMS QUIET</div>
      </div>

      {/* The 12 organ panels */}
      {ORGANS.map(o => (
        <div
          key={o.id}
          ref={(el) => { organRefs.current[o.id] = el; }}
          data-id={o.id}
          style={{
            position: 'absolute',
            left: o.x + '%',
            top:  o.y + '%',
            transform: 'translate(-50%,-50%)',
            width: 158,
            padding: '12px 15px 13px',
            background: 'rgba(9,5,4,0.45)',
            border: '1px solid rgba(255,170,90,0.16)',
            borderRadius: 3,
            boxShadow: '0 0 12px rgba(255,140,60,0.05), inset 0 0 16px rgba(255,110,50,0.03)',
            zIndex: 3,
            cursor: 'pointer',
            willChange: 'border-color, box-shadow, transform',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(255,185,120,0.5)' }}>{o.id}</span>
            <span
              ref={(el) => { dotRefs.current[o.id] = el; }}
              style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'rgba(255,170,90,0.45)',
                boxShadow: '0 0 6px rgba(255,160,80,0.5)',
                display: 'inline-block',
              }}
            />
          </div>
          <div style={{ marginTop: 9, fontSize: 12, letterSpacing: 3, color: '#efe1cf' }}>{o.label}</div>
          <div
            ref={(el) => { valRefs.current[o.id] = el; }}
            style={{
              marginTop: 8, fontSize: 14, letterSpacing: 1, color: '#f3ddbd',
              fontVariantNumeric: 'tabular-nums',
              textShadow: '0 0 10px rgba(255,160,90,0.25)',
              minHeight: 16,
            }}
          />
          <div
            ref={(el) => { barRefs.current[o.id] = el; }}
            style={{
              marginTop: 9, height: 1, width: '100%',
              background: o.align === 'right'
                ? 'linear-gradient(90deg, rgba(255,170,90,0), rgba(255,170,90,0.5))'
                : 'linear-gradient(90deg, rgba(255,170,90,0.5), rgba(255,170,90,0))',
              opacity: 0.22,
            }}
          />
          <div
            ref={(el) => { flagRefs.current[o.id] = el; }}
            style={{
              marginTop: 8, fontSize: 7, letterSpacing: 3,
              color: 'rgba(255,180,120,0.4)',
              minHeight: 8,
            }}
          />
        </div>
      ))}

      {/* Sound toggle — bottom-left. Off by default per spec. */}
      <button
        id="kai-cc-sound"
        onClick={toggleSound}
        style={{
          position: 'absolute', left: 28, bottom: 24,
          background: 'rgba(20,8,6,0.6)',
          border: '1px solid rgba(255,150,80,0.28)',
          color: 'rgba(242,228,210,0.75)',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 9, letterSpacing: 3,
          padding: '9px 16px', borderRadius: 2,
          cursor: 'pointer', zIndex: 6,
          backdropFilter: 'blur(3px)',
        }}
      >○ SOUND OFF</button>

      {/* Ack all — bottom-center */}
      <button
        onClick={ackAll}
        style={{
          position: 'absolute', left: '50%', bottom: 22,
          transform: 'translateX(-50%)', whiteSpace: 'nowrap',
          background: 'rgba(20,8,6,0.6)',
          border: '1px solid rgba(255,150,80,0.32)',
          color: '#f2e4d2',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10, letterSpacing: 4,
          padding: '11px 28px', borderRadius: 2,
          cursor: 'pointer', zIndex: 6,
          backdropFilter: 'blur(3px)',
          textShadow: '0 0 10px rgba(255,140,70,0.3)',
        }}
      >ACK ALL</button>
    </div>
  );
}
