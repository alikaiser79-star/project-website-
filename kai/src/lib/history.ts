import { loadState, saveState } from './store';
import { monthlyTotalEGP, instagram } from '../kaiConfig';
import type { Snapshot } from '../types';

const MAX_SNAPS = 180; // ~6 months

function isoDay(d = new Date()) { return d.toISOString().slice(0, 10); }

export function recordSnapshot() {
  const s = loadState();
  const today = isoDay();
  if (s.snapshots.some(x => x.d === today)) return; // already captured

  const habitsToday = s.habits.filter(h => h.history.includes(today)).length;
  const snap: Snapshot = {
    d: today,
    debt: s.debtCurrent,
    incomeMonthly: Math.round(monthlyTotalEGP(s.income)),
    prioritiesOpen: s.priorities.filter(p => !p.done).length,
    prioritiesDone: s.priorities.filter(p => p.done).length,
    habitsToday,
    journalCount: s.journal.length,
    igFollowers: instagram.accounts.reduce((sum, a) => sum + a.followers, 0),
  };
  s.snapshots = [...s.snapshots, snap].slice(-MAX_SNAPS);
  saveState(s);
}

export function getSnapshots(days = 30): Snapshot[] {
  return loadState().snapshots.slice(-days);
}

/* Backfill missing days with synthesised midline values so a fresh user
   still gets a sparkline that looks alive. Real future snapshots
   override these the moment they're captured. */
export function withBackfill(days = 14): Snapshot[] {
  const real = getSnapshots(days);
  if (real.length >= days) return real.slice(-days);
  const s = loadState();
  const todaySnap: Snapshot = {
    d: isoDay(),
    debt: s.debtCurrent,
    incomeMonthly: Math.round(monthlyTotalEGP(s.income)),
    prioritiesOpen: s.priorities.filter(p => !p.done).length,
    prioritiesDone: s.priorities.filter(p => p.done).length,
    habitsToday: s.habits.filter(h => h.history.includes(isoDay())).length,
    journalCount: s.journal.length,
    igFollowers: instagram.accounts.reduce((sum, a) => sum + a.followers, 0),
  };
  const out: Snapshot[] = [];
  const need = days - real.length;
  for (let i = need; i > 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const jitter = (k: number) => Math.round(k + k * 0.02 * Math.sin(i * 1.7));
    out.push({
      d: isoDay(d),
      debt: jitter(todaySnap.debt),
      incomeMonthly: jitter(todaySnap.incomeMonthly),
      prioritiesOpen: todaySnap.prioritiesOpen,
      prioritiesDone: todaySnap.prioritiesDone,
      habitsToday: todaySnap.habitsToday,
      journalCount: todaySnap.journalCount,
      igFollowers: jitter(todaySnap.igFollowers),
    });
  }
  return [...out, ...real, ...(real.some(r => r.d === isoDay()) ? [] : [todaySnap])].slice(-days);
}

export function trend(field: keyof Snapshot, days = 14) {
  const arr = withBackfill(days);
  const vals = arr.map(s => Number(s[field])).filter(n => Number.isFinite(n));
  if (vals.length < 2) return { delta: 0, pct: 0 };
  const first = vals[0]; const last = vals[vals.length - 1];
  const delta = last - first;
  const pct = first === 0 ? 0 : (delta / Math.abs(first)) * 100;
  return { delta, pct };
}
