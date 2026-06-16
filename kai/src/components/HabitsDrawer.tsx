import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Flame } from 'lucide-react';
import { loadState } from '../lib/store';
import { streak, toggleHabit } from '../lib/habits';
import { sfx } from '../lib/sound';
import type { Habit } from '../types';

function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
function lastNDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d); x.setDate(d.getDate() - i);
    out.push(isoDay(x));
  }
  return out;
}
function dayLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' });
}

const DAYS = 30;

export default function HabitsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [habits, setHabits] = useState<Habit[]>(() => loadState().habits);
  const days = useMemo(() => lastNDays(DAYS), []);
  const today = isoDay(new Date());

  useEffect(() => {
    if (open) setHabits(loadState().habits);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function tick(id: string) {
    toggleHabit(id);
    setHabits(loadState().habits);
    sfx.confirm();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[320] grid place-items-center px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{ background: 'rgba(10,14,20,0.72)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ y: -8, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass w-[min(820px,94vw)] rounded-md overflow-hidden"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-amber/15">
              <div className="flex items-center gap-2 text-amber/90">
                <Flame size={14} />
                <h3 className="font-sans text-bone text-sm tracking-wide">Habits · last {DAYS} days</h3>
              </div>
              <button onClick={onClose} className="text-steel hover:text-amber"><X size={14} /></button>
            </header>

            <div className="p-4 overflow-auto">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr>
                    <th className="text-left pb-1 text-steel tracking-[0.18em] uppercase">Habit</th>
                    {days.map(d => (
                      <th key={d} className="px-0.5 pb-1 text-steel tabular-nums" title={d}>
                        {parseInt(d.slice(-2))}
                      </th>
                    ))}
                    <th className="pl-2 pb-1 text-steel tracking-[0.18em] uppercase">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {habits.map(h => {
                    const set = new Set(h.history);
                    const sd = streak(h);
                    return (
                      <tr key={h.id} className="border-t border-amber/10">
                        <td className="py-1.5 pr-3 text-bone whitespace-nowrap">{h.label}</td>
                        {days.map(d => {
                          const hit = set.has(d);
                          const isToday = d === today;
                          return (
                            <td key={d} className="p-0.5">
                              <button
                                onClick={() => isToday && tick(h.id)}
                                title={d + (hit ? ' · done' : '')}
                                className={'block w-[14px] h-[14px] rounded-sm border transition ' +
                                  (hit
                                    ? 'bg-amber border-amber shadow-[0_0_4px_rgba(255,179,0,0.6)]'
                                    : isToday
                                      ? 'border-amber hover:bg-amber/30 cursor-pointer'
                                      : 'border-amber/15 bg-amber/[0.03] cursor-default')
                                }
                              />
                            </td>
                          );
                        })}
                        <td className={'pl-2 py-1.5 text-[12px] tabular-nums ' + (sd > 0 ? 'text-amber' : 'text-steel')}>
                          {sd}d
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-3 font-mono text-[10px] text-steel">
                Click today's cell to check or uncheck. Past days are read-only.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
