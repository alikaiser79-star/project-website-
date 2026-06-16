import { loadState, saveState } from './store';
import { monthlyTotalEGP } from '../kaiConfig';
import type { Snapshot } from '../types';

const MAX_SNAPS = 180;

function isoDay(d = new Date()) { return d.toISOString().slice(0, 10); }

/* Idempotent per ISO day. Captures a snapshot from the live store. */
export function recordSnapshot() {
  const s = loadState();
  const today = isoDay();
  if (s.snapshots.some(x => x.d === today)) return;

  const habitsToday = s.habits.filter(h => h.history.includes(today)).length;
  const igByHandle: Record<string, number> = {};
  let igTotal = 0;
  for (const a of s.instagram) {
    igByHandle[a.handle] = a.followers;
    igTotal += a.followers;
  }
  const snap: Snapshot = {
    d: today,
    debt: s.debtCurrent,
    incomeMonthly: Math.round(monthlyTotalEGP(s.income, s.fxEgpPerEur)),
    prioritiesOpen: s.priorities.filter(p => !p.done).length,
    prioritiesDone: s.priorities.filter(p => p.done).length,
    habitsToday,
    journalCount: s.journal.length,
    igFollowers: igTotal,
    igByHandle,
  };
  s.snapshots = [...s.snapshots, snap].slice(-MAX_SNAPS);
  saveState(s);
}

/* Real snapshots only — no backfill, no synthesis. The most recent
   `days` of actual data, oldest first. May be empty or short for
   new users; callers must handle that. */
export function getSnapshots(days = 14): Snapshot[] {
  return loadState().snapshots.slice(-days);
}

/* How many real days of data we currently have. */
export function coverage(): number {
  return loadState().snapshots.length;
}

/* A trend over the last `days` of REAL data. Returns null when we
   don't have at least 2 captures — insights / sparklines must check
   this before claiming any direction. */
export function trend(field: keyof Snapshot, days = 14):
  { delta: number; pct: number; from: number; to: number; samples: number } | null {
  const snaps = getSnapshots(days);
  if (snaps.length < 2) return null;
  const vals = snaps
    .map(s => Number(s[field]))
    .filter(n => Number.isFinite(n));
  if (vals.length < 2) return null;
  const first = vals[0];
  const last  = vals[vals.length - 1];
  const delta = last - first;
  const pct = first === 0 ? 0 : (delta / Math.abs(first)) * 100;
  return { delta, pct, from: first, to: last, samples: vals.length };
}

/* Convenience for sparklines: real values when we have ≥2, otherwise
   an empty array (callers render a "building history" placeholder). */
export function seriesFor(field: keyof Snapshot, days = 14): number[] {
  const snaps = getSnapshots(days);
  if (snaps.length < 2) return [];
  return snaps
    .map(s => Number(s[field]))
    .filter(n => Number.isFinite(n));
}

/* Per-handle Instagram series — reads from snap.igByHandle. */
export function instagramSeries(handle: string, days = 14): number[] {
  const snaps = getSnapshots(days);
  const vals: number[] = [];
  for (const s of snaps) {
    const v = s.igByHandle?.[handle];
    if (typeof v === 'number') vals.push(v);
  }
  return vals.length >= 2 ? vals : [];
}
