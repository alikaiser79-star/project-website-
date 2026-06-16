import { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Maximize2 } from 'lucide-react';
import HabitsDrawer from './HabitsDrawer';
import { loadState } from '../lib/store';
import { isCheckedToday, toggleHabit, streak } from '../lib/habits';
import type { Habit } from '../types';
import { sfx } from '../lib/sound';

function last7DaysISO() {
  const out: string[] = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export default function HabitsTile({ delay = 0 }: { delay?: number }) {
  const [habits, setHabits] = useState<Habit[]>(() => loadState().habits);
  const [drawer, setDrawer] = useState(false);

  function click(id: string) {
    toggleHabit(id);
    setHabits(loadState().habits);
    sfx.confirm();
  }

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-md px-3 py-2.5 flex-1 min-w-[260px]"
    >
      <div className="flex items-center gap-2">
        <Flame size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Habits · today</span>
        <button
          onClick={() => { sfx.click(); setDrawer(true); }}
          className="ml-auto text-amber/60 hover:text-amber transition"
          title="Expand · 30-day view"
        >
          <Maximize2 size={11} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        {habits.map(h => {
          const on = isCheckedToday(h);
          const s = streak(h);
          const days = last7DaysISO();
          return (
            <button
              key={h.id}
              onClick={() => click(h.id)}
              onMouseEnter={() => sfx.hover()}
              className={'group flex flex-col gap-1 px-2 py-1.5 rounded border transition text-left ' +
                (on
                  ? 'border-amber bg-amber/10 shadow-glow-amber'
                  : 'border-amber/15 hover:border-amber/50')
              }
            >
              <div className="flex items-center gap-2 w-full">
                <span className={'w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition ' +
                  (on ? 'bg-amber border-amber text-ink' : 'border-amber/40')}>
                  {on && <span className="text-[10px] leading-none">✓</span>}
                </span>
                <span className="text-bone text-[11.5px] truncate flex-1">{h.label}</span>
                <span className={'font-mono text-[10px] tabular-nums ' + (s > 0 ? 'text-amber' : 'text-steel')}>
                  {s}d
                </span>
              </div>
              <div className="flex gap-0.5 w-full">
                {days.map(d => {
                  const hit = h.history.includes(d);
                  return (
                    <span
                      key={d}
                      title={d}
                      className={'flex-1 h-[5px] rounded-sm ' + (hit ? 'bg-amber shadow-[0_0_4px_rgba(255,179,0,0.7)]' : 'bg-amber/12')}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
      <HabitsDrawer open={drawer} onClose={() => setDrawer(false)} />
    </motion.div>
  );
}
