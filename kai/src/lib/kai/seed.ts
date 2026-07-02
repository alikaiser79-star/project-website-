/* ============================================================
   Spine seed — Ali's 8 real events + real store state.

   Run-once (guarded by localStorage flag kai.seeded.v2). Writes
   the real values into the store AND logs the 8 canonical
   events into the Spine so history / Scribe / the Command Core
   all read truth instead of the demo defaults.

   The 8 events (operator-provided):
     debt    balance_updated 59000
     income  salary_logged   33000  { src: 'enpal_eur' }
     income  rent_paid       16000  { src: 'honda' }
     makadi  rate_changed    45
     makadi  nights_booked   0
     garden  plant_added     85
     content reel_posted     4      { window: '30d' }
     expense fixed_outflows  34000  { card: 10000, brother: 4000, living: 20000 }

   Also KILLS the demo data: debtCurrent → 59000 (was 41500/75000
   default), makadi rate → 45, occupancy → 0 (0 nights), garden
   plants → 85. Panels read the store, so this makes them real.
   ============================================================ */

import { loadState, saveState } from '../store';
import { logEvent } from './events';

const SEED_FLAG = 'kai.seeded.v2';

export interface SeedResult {
  ran: boolean;
  reason?: string;
  events?: number;
}

export function isSeeded(): boolean {
  try { return localStorage.getItem(SEED_FLAG) === '1'; } catch { return false; }
}

/* Seed. Idempotent unless `force` is true. Returns what happened. */
export function seedSpine(force = false): SeedResult {
  if (!force && isSeeded()) return { ran: false, reason: 'already-seeded' };

  try {
    /* ── 1. Real store values (kills the demo defaults) ── */
    const s = loadState();

    s.debtCurrent = 59000;

    s.makadi = {
      ...s.makadi,
      nightlyRate: 45,        // per the seed — real nightly rate
      occupancy30d: 0,        // 0 nights booked → Makadi organ calls NEEDS-YOU
    };

    s.garden = {
      ...s.garden,
      plantCount: 85,
    };

    saveState(s);

    /* ── 2. The 8 canonical Spine events ── */
    /* Spread them across the last ~20 days so trend/Scribe reads
       have temporal spacing rather than one identical timestamp. */
    const DAY = 86_400_000;
    const now = Date.now();
    const at = (daysAgo: number) => now - daysAgo * DAY;

    const events: Array<Parameters<typeof logEvent>[0]> = [
      { domain: 'debt',    type: 'balance_updated', value: 59000, source: 'user', ts: at(1) },
      { domain: 'income',  type: 'salary_logged',   value: 33000, meta: { src: 'enpal_eur' }, source: 'auto', ts: at(3) },
      { domain: 'income',  type: 'rent_paid',       value: 16000, meta: { src: 'honda' },     source: 'auto', ts: at(5) },
      { domain: 'makadi',  type: 'rate_changed',    value: 45,    source: 'user', ts: at(7) },
      { domain: 'makadi',  type: 'nights_booked',   value: 0,     source: 'auto', ts: at(2) },
      { domain: 'garden',  type: 'plant_added',     value: 85,    source: 'user', ts: at(9) },
      { domain: 'content', type: 'reel_posted',     value: 4,     meta: { window: '30d' }, source: 'user', ts: at(4) },
      { domain: 'expense', type: 'fixed_outflows',  value: 34000, meta: { card: 10000, brother: 4000, living: 20000 }, source: 'user', ts: at(6) },
    ];

    for (const e of events) {
      try { logEvent(e); } catch { /* one bad event shouldn't abort the seed */ }
    }

    try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
    return { ran: true, events: events.length };
  } catch (err) {
    return { ran: false, reason: String((err as any)?.message || err || 'unknown') };
  }
}

/* Clear the seed flag so seedSpine() will run again. Dev helper. */
export function resetSeedFlag(): void {
  try { localStorage.removeItem(SEED_FLAG); } catch { /* ignore */ }
}

/* Expose a manual trigger on window for dev / console re-seeding:
   window.__kaiSeed()  → force re-seed
   window.__kaiUnseed() → clear the flag (next boot re-seeds) */
export function installSeedDevHooks(): void {
  try {
    (window as any).__kaiSeed = () => { const r = seedSpine(true); console.info('[KAI seed]', r); return r; };
    (window as any).__kaiUnseed = () => { resetSeedFlag(); console.info('[KAI seed] flag cleared — will re-seed on next boot'); };
  } catch { /* ignore */ }
}
