/* ============================================================
   ConfirmationFloating — pill + slideover wrapper around the gate.

   The inline ConfirmationGate is great for 1-2 proposals; once
   Autopilot stacks 8+ it eats the whole screen. This wrapper:

   - Renders a small amber pill fixed top-right under the TopBar
     when there's anything pending (or failed).
   - Pulses the pill for ~2 s whenever the count GROWS, so the
     user spots new proposals at a glance.
   - Tap the pill → a right-side slideover drawer with the full
     inline gate inside, scrollable, doesn't push layout.
   - Auto-opens once when the count first goes from 0 → ≥3 since
     boot (Autopilot just dropped a batch). Subsequent grows
     only pulse — no surprise drawers.

   The actual row + payload + approve / reject UI is the
   existing ConfirmationGate — reused via portal.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';
import { useKaiVersion } from './mirror';
import { listAll, getPending, type PendingAction } from './pending';
import ConfirmationGate from './ConfirmationGate';
import { sfx } from '../sound';

export default function ConfirmationFloating() {
  useKaiVersion();
  const pending = getPending().length;
  const failed  = listAll().filter((a: PendingAction) => a.status === 'failed').length;
  const total = pending + failed;

  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevTotalRef = useRef(0);
  const autoOpenedRef = useRef(false);

  /* Pulse on growth; auto-open once on a Big drop (≥3 new). */
  useEffect(() => {
    const prev = prevTotalRef.current;
    if (total > prev && total > 0) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1800);
      if (!autoOpenedRef.current && total - prev >= 3) {
        autoOpenedRef.current = true;
        setOpen(true);
      }
      prevTotalRef.current = total;
      return () => clearTimeout(t);
    }
    prevTotalRef.current = total;
  }, [total]);

  /* Reset the "auto-opened" guard when the queue empties so a
     fresh Autopilot batch will auto-open again. */
  useEffect(() => {
    if (total === 0) autoOpenedRef.current = false;
  }, [total]);

  /* Esc closes the drawer. */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Floating pill — hidden when nothing pending or failed. */}
      <AnimatePresence>
        {total > 0 && (
          <motion.button
            key="pill"
            initial={{ opacity: 0, y: -6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            onClick={() => { sfx.click(); setOpen(true); }}
            className="fixed top-3 sm:top-4 right-3 sm:right-4 z-[60] glass rounded-full pl-2.5 pr-3 py-1.5 flex items-center gap-2 border-amber/45 hover:border-amber transition"
            style={{
              boxShadow: pulse
                ? '0 0 0 4px rgba(255,179,0,0.18), 0 0 22px rgba(255,179,0,0.35)'
                : '0 0 14px rgba(255,179,0,0.12)',
            }}
            title={`${pending} pending${failed ? ' · ' + failed + ' failed' : ''} — tap to review`}
          >
            <motion.span
              animate={pulse ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.7, repeat: pulse ? 2 : 0 }}
            >
              <ShieldAlert size={13} className="text-amber" />
            </motion.span>
            <span className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-amber tabular-nums">
              {pending}{failed ? '+' + failed : ''}
            </span>
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-amber/65 hidden sm:inline">
              pending
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slideover drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[70]"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            style={{ background: 'rgba(10,14,20,0.55)', backdropFilter: 'blur(5px)' }}
          >
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute right-0 top-0 bottom-0 w-full sm:w-[440px] max-w-full bg-ink/95 border-l border-amber/15 flex flex-col"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <header className="flex items-center gap-2 px-4 py-3 border-b border-amber/15 shrink-0">
                <ShieldAlert size={13} className="text-amber" />
                <h3 className="font-sans text-bone text-sm tracking-wide">Approval queue</h3>
                <span className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase text-steel/75">
                  {pending} pending{failed ? ' · ' + failed + ' failed' : ''}
                </span>
                <button
                  onClick={() => { sfx.click(); setOpen(false); }}
                  className="text-steel hover:text-amber p-1 ml-2"
                  title="Close (Esc)"
                >
                  <X size={14} />
                </button>
              </header>
              {/* Reuse the inline gate inside the drawer — same UI,
                  same approve / reject / retry flow, just scrollable
                  in a panel that doesn't push the dashboard around. */}
              <div className="flex-1 overflow-y-auto p-3">
                {total === 0 ? (
                  <p className="font-mono text-[11px] text-steel/75 text-center py-8">
                    Queue empty. KAI hasn't proposed anything since the last sweep.
                  </p>
                ) : (
                  <ConfirmationGate />
                )}
              </div>
              <footer className="px-4 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.18em] uppercase text-steel/65 flex justify-between shrink-0">
                <span>kai · hands</span>
                <span><kbd>Esc</kbd> close</span>
              </footer>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
