/* ============================================================
   ESCAPE VELOCITY panel (§6.1) — THE number, rendered as one meter:
   owned income against the base (Enpal 620 EUR). At 100%, work is a
   choice. Below it, the honest FREEDOM DATE.
   ============================================================ */

import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';
import { escapeState } from '../../lib/kai/escape';

export default function EscapeVelocityPanel({ delay = 0 }: { delay?: number }) {
  const e = escapeState();
  const pct = Math.min(100, Math.round(e.ratio * 100));
  const hot = e.ratio >= 1;
  const bar = Math.min(100, e.ratio * 100);
  const freedom = e.freedomDate
    ? new Date(e.freedomDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'NO CURRENT TRAJECTORY';

  return (
    <motion.div
      data-panel="26"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Rocket size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">Escape Velocity</span>
        <span className={'font-mono text-[9px] tracking-[0.2em] uppercase ml-auto ' + (hot ? 'text-emerald-300' : 'text-steel/50')}>
          {hot ? 'work is a choice' : 'still tethered'}
        </span>
      </div>

      <div className="flex items-end gap-2">
        <div className={'font-sans font-light tracking-tight leading-none ' + (hot ? 'text-emerald-300' : 'text-amber')} style={{ fontSize: 46 }}>
          {Math.round(e.ratio * 100)}<span className="text-[20px] text-steel/60">%</span>
        </div>
        <div className="font-mono text-[10px] text-steel/60 mb-1.5 leading-relaxed">
          {e.ownedEur.toLocaleString()} EUR owned<br />vs {e.baseEur} EUR base
        </div>
      </div>

      {/* meter */}
      <div className="mt-3 h-2 rounded-full bg-white/[0.05] overflow-hidden relative">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: bar + '%', background: hot ? 'linear-gradient(90deg,#FFC94A,#7AE6A8)' : 'linear-gradient(90deg,#FF7A48,#FFC94A)' }}
        />
        <div className="absolute inset-y-0" style={{ left: '100%', width: 1, background: 'rgba(255,255,255,0.3)' }} />
      </div>
      <div className="mt-1 font-mono text-[8px] tracking-[0.15em] text-steel/40 uppercase text-right">100% = base covered</div>

      {/* freedom date */}
      <div className="mt-4 pt-3 border-t border-white/[0.06]">
        <div className="font-mono text-[9px] tracking-[0.2em] text-steel/50 uppercase">Freedom date</div>
        <div className={'font-mono text-[15px] mt-1 ' + (e.freedomDate ? 'text-bone' : 'text-steel/50')}>{freedom}</div>
        <div className="font-mono text-[10px] text-steel/50 leading-relaxed mt-1.5">{e.reason}</div>
      </div>

      <div className="sr-only">{pct}</div>
    </motion.div>
  );
}
