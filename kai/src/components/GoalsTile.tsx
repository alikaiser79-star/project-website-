import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { operator } from '../kaiConfig';
import type { Goal } from '../types';
import { listGoals, goalCurrent, goalPct, goalDone, updateGoal } from '../lib/goals';
import { sfx } from '../lib/sound';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

export default function GoalsTile({ delay = 0 }: { delay?: number }) {
  const [goals, setGoals] = useState<Goal[]>(() => listGoals());

  /* Re-sync when the user (or AI) updates a goal or any live-data
     source the derived goals read from. */
  useEffect(() => {
    const sync = () => setGoals(listGoals());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    const t = setInterval(sync, 4000);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      clearInterval(t);
    };
  }, []);

  function bump(id: string, delta: number) {
    const g = goals.find(x => x.id === id);
    if (!g || g.liveSource) return;
    updateGoal(id, { current: Math.max(0, (Number(g.current) || 0) + delta) });
    setGoals(listGoals());
    sfx.click();
  }

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg px-4 py-4"
    >
      <div className="flex items-center gap-2">
        <Target size={14} className="text-amber/85" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Long-term · goals</span>
        <span className="ml-auto font-mono text-[10px] text-steel">{goals.length}</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {goals.length === 0 && (
          <div className="font-mono text-[11px] text-steel">No goals yet. Add some in Settings → Goals.</div>
        )}
        {goals.map(g => {
          const current = goalCurrent(g);
          const pct = goalPct(g);
          const done = goalDone(g);
          const isLive = !!g.liveSource;
          return (
            <div key={g.id} className="group">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-mono text-[11px] text-bone truncate flex-1">{g.label || '—'}</span>
                <span className="font-mono text-[10px] text-amber tabular-nums">
                  {fmt(current)}{g.lowerIsBetter ? ' / 0' : ' / ' + fmt(g.target)} {g.unit}
                </span>
                <span className="font-mono text-[10px] text-amber/80 tabular-nums w-9 text-right">{pct.toFixed(0)}%</span>
                {!isLive && (
                  <span className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                    <button
                      onClick={() => bump(g.id, g.lowerIsBetter ? -1000 : 1000)}
                      className="text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5 border border-amber/30 hover:border-amber text-amber rounded"
                    >
                      {g.lowerIsBetter ? '−1k' : '+1k'}
                    </button>
                  </span>
                )}
              </div>
              <div className="h-[3px] bg-ink2 border border-amber/15 overflow-hidden">
                <div
                  className={'h-full transition-all ' + (done ? 'bg-ok shadow-[0_0_8px_#7AE6A8]' : 'bg-gradient-to-r from-amber/40 to-amber shadow-glow-amber')}
                  style={{ width: pct + '%' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
