/* ============================================================
   Spine seed — Ali's real July truth. Run-once (guarded by
   localStorage flag kai.seeded.v3). Logs the 15 canonical events
   via the real logEvent, AND writes real store state so every
   panel reads truth, not demo defaults.

   The 15 events (operator-provided, exact):
     debt    payment_logged   4700
     debt    balance_updated  59000   (59,000 of an 89,000 limit)
     income  salary_logged    33000   {src:'enpal_eur', spent:'fully'}
     income  rent_paid        16000   {src:'honda'}
     makadi  lock_replaced    1       {cost:8000, source:'russia_family'}
     makadi  couch_installed  1       {transport:6000}
     makadi  arrears_paid     11000   {remaining:4000}
     makadi  rate_changed     45
     makadi  nights_booked    0       (rentable, listing pending Katie's photos)
     garden  plant_added      85
     content reel_posted      4       {window:'30d'}
     expense trip_makadi      25000   {lock:8000, transport:6000, arrears:11000}
     expense gear_glasses     3000    {purpose:'street_content'}
     expense brother          5000
     system  cash_on_hand     15000   {until_payday:'all obligations paid'}

   Store writes (kills any stale demo state on-device):
     debtCurrent   → 59000
     makadi.rate   → 45, occupancy → 0, fixLock → false
     garden.plants → 85
     liquidCash    → 15000
     + the 3 real expenses added to the expenses store
   ============================================================ */

import { loadState, saveState } from '../store';
import { addExpense } from '../expenses';
import { logEvent } from './events';

const SEED_FLAG = 'kai.seeded.v3';

export interface SeedResult { ran: boolean; reason?: string; events?: number; }

export function isSeeded(): boolean {
  try { return localStorage.getItem(SEED_FLAG) === '1'; } catch { return false; }
}

export function seedSpine(force = false): SeedResult {
  if (!force && isSeeded()) return { ran: false, reason: 'already-seeded' };

  try {
    /* ── 1. Real store state (kills demo defaults on-device) ── */
    const s = loadState();
    s.debtCurrent = 59000;
    s.makadi = { ...s.makadi, nightlyRate: 45, occupancy30d: 0, fixLock: false };
    s.garden = { ...s.garden, plantCount: 85 };
    s.liquidCash = 15000;
    saveState(s);

    /* Real expenses into the expenses store so ExpensesPanel +
       monthlyTotal read truth. Dated this month. */
    const today = new Date().toISOString().slice(0, 10);
    try {
      addExpense({ merchant: 'Makadi trip (lock+couch+arrears)', total: 25000, currency: 'EGP', date: today, category: 'other' });
      addExpense({ merchant: 'Street-content glasses',           total: 3000,  currency: 'EGP', date: today, category: 'shopping' });
      addExpense({ merchant: 'Brother',                          total: 5000,  currency: 'EGP', date: today, category: 'other' });
    } catch { /* expenses store optional */ }

    /* ── 2. The 15 canonical Spine events ── */
    const DAY = 86_400_000;
    const now = Date.now();
    const at = (d: number) => now - d * DAY;

    const events: Array<Parameters<typeof logEvent>[0]> = [
      { domain: 'debt',    type: 'payment_logged',  value: 4700,  source: 'user', ts: at(8) },
      { domain: 'debt',    type: 'balance_updated',  value: 59000, source: 'user', ts: at(8) },
      { domain: 'income',  type: 'salary_logged',    value: 33000, meta: { src: 'enpal_eur', spent: 'fully' }, source: 'auto', ts: at(6) },
      { domain: 'income',  type: 'rent_paid',        value: 16000, meta: { src: 'honda' }, source: 'auto', ts: at(5) },
      { domain: 'makadi',  type: 'lock_replaced',    value: 1,     meta: { cost: 8000, source: 'russia_family' }, source: 'user', ts: at(12) },
      { domain: 'makadi',  type: 'couch_installed',  value: 1,     meta: { transport: 6000 }, source: 'user', ts: at(11) },
      { domain: 'makadi',  type: 'arrears_paid',     value: 11000, meta: { remaining: 4000 }, source: 'user', ts: at(10) },
      { domain: 'makadi',  type: 'rate_changed',     value: 45,    source: 'user', ts: at(9) },
      { domain: 'makadi',  type: 'nights_booked',    value: 0,     source: 'auto', ts: at(1) },
      { domain: 'garden',  type: 'plant_added',      value: 85,    source: 'user', ts: at(14) },
      { domain: 'content', type: 'reel_posted',      value: 4,     meta: { window: '30d' }, source: 'user', ts: at(4) },
      { domain: 'expense', type: 'trip_makadi',      value: 25000, meta: { lock: 8000, transport: 6000, arrears: 11000 }, source: 'user', ts: at(11) },
      { domain: 'expense', type: 'gear_glasses',     value: 3000,  meta: { purpose: 'street_content' }, source: 'user', ts: at(7) },
      { domain: 'expense', type: 'brother',          value: 5000,  source: 'user', ts: at(3) },
      { domain: 'system',  type: 'cash_on_hand',     value: 15000, meta: { until_payday: 'all obligations paid' }, source: 'user', ts: at(1) },
    ];

    for (const e of events) {
      try { logEvent(e); } catch { /* one bad event shouldn't abort */ }
    }

    try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
    return { ran: true, events: events.length };
  } catch (err) {
    return { ran: false, reason: String((err as any)?.message || err || 'unknown') };
  }
}

export function resetSeedFlag(): void {
  try { localStorage.removeItem(SEED_FLAG); } catch { /* ignore */ }
}

/* Dev console hooks:
   window.__kaiSeed()   → force re-seed
   window.__kaiUnseed() → clear the flag (re-seeds next boot) */
export function installSeedDevHooks(): void {
  try {
    (window as any).__kaiSeed = () => { const r = seedSpine(true); console.info('[KAI seed]', r); return r; };
    (window as any).__kaiUnseed = () => { resetSeedFlag(); console.info('[KAI seed] flag cleared'); };
  } catch { /* ignore */ }
}
