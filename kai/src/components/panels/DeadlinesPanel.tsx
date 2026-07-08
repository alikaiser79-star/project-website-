/* ============================================================
   CALENDAR OF WAR (§6.2) — the deadline sentinel. Shows every hard
   date on the board (T-7 and in), colour escalating as it nears;
   past-due goes crimson and stays. Add via ⌘K "deadline: <date> <text>".
   ============================================================ */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, X } from 'lucide-react';
import { activeDeadlines, tierOf, removeDeadline, type DeadlineTier } from '../../lib/kai/deadlines';
import { useKaiVersion } from '../../lib/kai/mirror';

const TIER_COLOR: Record<DeadlineTier, string> = {
  far: 'text-steel/50', appear: 'text-steel/80', calling: 'text-amber', dominant: 'text-[#FF7A48]', overdue: 'text-danger',
};

export default function DeadlinesPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const [, force] = useState(0);
  const now = Date.now();
  const list = activeDeadlines(now);

  return (
    <motion.div
      data-panel="27"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">Calendar of War</span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-steel/50 uppercase ml-auto">{list.length} on the board</span>
      </div>

      {list.length === 0 && (
        <div className="font-mono text-[11px] text-steel/50 leading-relaxed">
          No hard dates within 7 days. Add one: <span className="text-amber/70">⌘K → "deadline: 2026-08-01 FRISCH go-live"</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {list.map(d => {
          const t = tierOf(d, now);
          const days = Math.round((d.date - now) / 86_400_000);
          const when = t === 'overdue' ? `${-days}d OVERDUE` : days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `${days}d`;
          return (
            <div key={d.id} className={'flex items-center gap-2.5 border-l-2 pl-3 py-1.5 ' + (t === 'overdue' ? 'border-danger' : t === 'dominant' ? 'border-[#FF7A48]' : t === 'calling' ? 'border-amber' : 'border-white/10')}>
              <span className={'font-mono text-[10px] tracking-[0.1em] w-20 shrink-0 uppercase ' + TIER_COLOR[t]}>{when}</span>
              <span className="font-mono text-[12px] text-bone/90 flex-1 truncate">{d.text}</span>
              <button onClick={() => { removeDeadline(d.id); force(n => n + 1); }} className="text-steel/40 hover:text-danger shrink-0" aria-label="remove"><X size={12} /></button>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
