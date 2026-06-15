import { loadState, saveState } from './store';
import type { Habit } from '../types';

const today = () => new Date().toISOString().slice(0, 10);

export function isCheckedToday(h: Habit) {
  return h.history.includes(today());
}

export function toggleHabit(id: string) {
  const s = loadState();
  const d = today();
  s.habits = s.habits.map(h => {
    if (h.id !== id) return h;
    const has = h.history.includes(d);
    return { ...h, history: has ? h.history.filter(x => x !== d) : [d, ...h.history].slice(0, 365) };
  });
  saveState(s);
}

/* Current streak: consecutive days ending today (or yesterday if not yet today). */
export function streak(h: Habit): number {
  const set = new Set(h.history);
  let s = 0;
  const cursor = new Date();
  // If today isn't checked, allow streak ending yesterday
  if (!set.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (set.has(key)) { s++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return s;
}
