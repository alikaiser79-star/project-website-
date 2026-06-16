import { useState } from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { defaultGoals, operator } from '../kaiConfig';
import { loadState, saveState } from '../lib/store';
import { sfx } from '../lib/sound';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

export default function GoalsTile({ delay = 0 }: { delay?: number }) {
  const [tick, setTick] = useState(0);

  const goalStates = loadState().goals;
  const byId = new Map(goalStates.map(g => [g.id, g.current]));

  function bump(id: string, delta: number) {
    const s = loadState();
    s.goals = s.goals.map(g => g.id === id ? { ...g, current: Math.max(0, g.current + delta) } : g);
    saveState(s);
    setTick(t => t + 1);
    sfx.click();
  }

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-md px-3 py-2.5 flex-1 min-w-[280px]"
      key={tick}
    >
      <div className="flex items-center gap-2">
        <Target size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Long-term · goals</span>
        <span className="ml-auto font-mono text-[10px] text-steel">{defaultGoals.length}</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {defaultGoals.map(g => {
          const current = byId.get(g.id) ?? g.current;
          const pct = g.lowerIsBetter
            ? Math.max(0, Math.min(100, (1 - current / Math.max(1, g.current)) * 100))
            : Math.max(0, Math.min(100, (current / g.target) * 100));
          const done = g.lowerIsBetter ? current <= g.target : current >= g.target;
          return (
            <div key={g.id} className="group">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-mono text-[11px] text-bone truncate flex-1">{g.label}</span>
                <span className="font-mono text-[10px] text-amber tabular-nums">
                  {fmt(current)}{g.lowerIsBetter ? ' / 0' : ' / ' + fmt(g.target)} {g.unit}
                </span>
                <span className="font-mono text-[10px] text-amber/80 tabular-nums w-9 text-right">{pct.toFixed(0)}%</span>
                <span className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                  <button onClick={() => bump(g.id, g.lowerIsBetter ? -1000 : 1000)} className="text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5 border border-amber/30 hover:border-amber text-amber rounded">
                    {g.lowerIsBetter ? '−1k' : '+1k'}
                  </button>
                </span>
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
