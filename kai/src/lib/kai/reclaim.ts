/* ============================================================
   STORAGE RECLAIM — the last line of defence for Spine persistence.

   When a Spine append can't be written, trimming the event array only
   helps if the events array is what's full. On a real device the space
   is often held by OTHER keys: up to 180 daily snapshots inside the
   typed-state blob (kai.state.v1) and regenerable watcher/cache keys.
   Pruning kai.events then frees almost nothing and the append is lost
   anyway — which is exactly how the confirmed bookings never reached
   the device (listing_upgraded persisted long ago, before the origin
   filled; the newer bookings had no room).

   reclaimStorage() frees space WITHOUT ever touching irreplaceable
   state: it shrinks the regenerable snapshot history and drops known
   caches, but never the Spine, commitments, the sync key, or settings.
   Operates on raw localStorage (no saveState → no logEvent recursion,
   no import cycle).
   ============================================================ */

import { writeSafe } from './store';

/* Regenerable / cosmetic keys — safe to drop entirely to make room.
   NEVER: kai.events (the Spine), kai.state.v1 (typed truth), kai.commitments,
   kai.sync.v1 (the sync secret — losing it would orphan the device), leads,
   people, promises, deadlines, pending. */
const DISPOSABLE = [
  'kai.bookingwatch.telemetry',
  'kai.mailwatch.seen', 'kai.mailwatch.last',
  'kai.radar.lastSweep', 'kai.radar.lastReco',
  'kai.weather.tempC', 'kai.weather.updatedAt',
  'kai.build.seen', 'kai.nightledger.seen',
];

const SNAP_KEEP = 30;   // keep a month of snapshots; the rest is regenerable

/* Free storage. Returns true if it reclaimed anything worth retrying after. */
export function reclaimStorage(): boolean {
  let freed = false;
  let ls: Storage | null = null;
  try { ls = typeof localStorage !== 'undefined' ? localStorage : null; } catch { ls = null; }
  if (!ls) return false;

  /* 1. The biggest, safest win: trim the daily snapshot history that lives
     inside the typed-state blob. Snapshots are recomputed over time, so
     dropping the oldest is lossless in practice. Writing a SMALLER value
     for an existing key nets free space even at the quota ceiling. */
  try {
    const raw = ls.getItem('kai.state.v1');
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s?.snapshots) && s.snapshots.length > SNAP_KEEP) {
        s.snapshots = s.snapshots.slice(-SNAP_KEEP);
        if (writeSafe('kai.state.v1', s)) freed = true;
      }
    }
  } catch { /* corrupt/absent blob — skip, never throw */ }

  /* 2. Drop regenerable caches outright. */
  for (const k of DISPOSABLE) {
    try { if (ls.getItem(k) != null) { ls.removeItem(k); freed = true; } } catch { /* ignore */ }
  }

  return freed;
}
