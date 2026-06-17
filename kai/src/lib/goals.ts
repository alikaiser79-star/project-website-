/* Live-data wiring for goals. The Goal definition itself lives in the
   store (label/target/current/unit all editable). When a goal has a
   `liveSource`, the displayed "current" reads from the live store
   instead of the saved number. */

import { loadState, saveState } from './store';
import type { Goal } from '../types';

export function goalCurrent(g: Goal): number {
  const s = loadState();
  switch (g.liveSource) {
    case 'debt':    return Math.max(0, Number(s.debtCurrent) || 0);
    case 'plants':  return Math.max(0, Number(s.garden?.plantCount) || 0);
    case 'ig-total': {
      const list = s.instagram ?? [];
      return list.reduce((sum, a) => sum + (Number(a?.followers) || 0), 0);
    }
    case 'ig-by-handle': {
      const want = String(g.liveHandle ?? '').toLowerCase();
      if (!want) return 0;
      const list = s.instagram ?? [];
      const hit = list.find(a => String(a?.handle ?? '').toLowerCase() === want);
      return Math.max(0, Number(hit?.followers) || 0);
    }
    default:        return Math.max(0, Number(g.current) || 0);
  }
}

export function goalPct(g: Goal): number {
  const current = goalCurrent(g);
  const target = Number(g.target) || 0;
  if (g.lowerIsBetter) {
    /* Reference = the saved `current` (or the original balance for
       paydown goals). We use the SAVED current as the high-water
       mark so progress can be tracked even when liveSource is
       active. Falls back to 1 to avoid division by zero. */
    const ref = Math.max(1, Number(g.current) || current);
    return Math.max(0, Math.min(100, (1 - current / ref) * 100));
  }
  if (target <= 0) return current > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

export function goalDone(g: Goal): boolean {
  const current = goalCurrent(g);
  return g.lowerIsBetter ? current <= g.target : current >= g.target;
}

/* CRUD against the store. */
export function listGoals(): Goal[] { return loadState().goals ?? []; }

export function upsertGoal(g: Goal) {
  const s = loadState();
  const list = [...(s.goals ?? [])];
  const idx = list.findIndex(x => x.id === g.id);
  if (idx >= 0) list[idx] = g;
  else          list.push(g);
  s.goals = list;
  saveState(s);
}

export function updateGoal(id: string, patch: Partial<Goal>) {
  const s = loadState();
  s.goals = (s.goals ?? []).map(g => g.id === id ? { ...g, ...patch } : g);
  saveState(s);
}

export function removeGoal(id: string) {
  const s = loadState();
  s.goals = (s.goals ?? []).filter(g => g.id !== id);
  saveState(s);
}
