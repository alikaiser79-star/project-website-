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
     makadi  rate_changed     34      USD after tax (≈ 1,700 EGP)
     makadi  nights_booked    0       (rentable, listing pending Katie's photos)
     garden  plant_added      85
     content reel_posted      4       {window:'30d'}
     expense trip_makadi      25000   {lock:8000, transport:6000, arrears:11000}
     expense gear_glasses     3000    {purpose:'street_content'}
     expense brother          5000
     system  cash_on_hand     15000   {until_payday:'all obligations paid'}

   Store writes (kills any stale demo state on-device):
     debtCurrent   → 59000
     makadi.rate   → 34 USD, occupancy → 0, fixLock → false
     garden.plants → 85
     liquidCash    → 15000
     + the 3 real expenses added to the expenses store
   ============================================================ */

import { loadState, saveState } from '../store';
import { addExpense } from '../expenses';
import { logEvent, getEvents } from './events';
import { markKeptByMatch, getCommitments } from './commitments';
import { read, write, emit } from './store';

const SEED_FLAG = 'kai.seeded.v3';
const LISTING_FLAG = 'kai.makadi.listingUpgraded.v1';

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
    s.makadi = { ...s.makadi, nightlyRate: 34, rateCcy: 'USD', occupancy30d: 0, fixLock: false };
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
      { domain: 'debt',    type: 'payment_logged',  value: 4700,  ccy: 'EGP', source: 'user', ts: at(8) },
      { domain: 'debt',    type: 'balance_updated',  value: 59000, ccy: 'EGP', source: 'user', ts: at(8) },
      { domain: 'income',  type: 'salary_logged',    value: 33000, ccy: 'EGP', meta: { src: 'enpal_eur', gross: '620 EUR', spent: 'fully' }, source: 'auto', ts: at(6) },
      { domain: 'income',  type: 'rent_paid',        value: 16000, ccy: 'EGP', meta: { src: 'honda' }, source: 'auto', ts: at(5) },
      { domain: 'makadi',  type: 'lock_replaced',    value: 1,     meta: { cost: 8000, source: 'russia_family' }, source: 'user', ts: at(12) },
      { domain: 'makadi',  type: 'couch_installed',  value: 1,     meta: { transport: 6000 }, source: 'user', ts: at(11) },
      { domain: 'makadi',  type: 'arrears_paid',     value: 11000, ccy: 'EGP', meta: { remaining: 4000 }, source: 'user', ts: at(10) },
      { domain: 'makadi',  type: 'rate_changed',     value: 34,    ccy: 'USD', meta: { afterTax: true, egpApprox: 1700 }, source: 'user', ts: at(9) },
      { domain: 'makadi',  type: 'nights_booked',    value: 0,     source: 'auto', ts: at(1) },
      { domain: 'garden',  type: 'plant_added',      value: 85,    source: 'user', ts: at(14) },
      { domain: 'content', type: 'reel_posted',      value: 4,     meta: { window: '30d' }, source: 'user', ts: at(4) },
      { domain: 'expense', type: 'trip_makadi',      value: 25000, ccy: 'EGP', meta: { lock: 8000, transport: 6000, arrears: 11000 }, source: 'user', ts: at(11) },
      { domain: 'expense', type: 'gear_glasses',     value: 3000,  ccy: 'EGP', meta: { purpose: 'street_content' }, source: 'user', ts: at(7) },
      { domain: 'expense', type: 'brother',          value: 5000,  ccy: 'EGP', source: 'user', ts: at(3) },
      { domain: 'system',  type: 'cash_on_hand',     value: 15000, ccy: 'EGP', meta: { until_payday: 'all obligations paid' }, source: 'user', ts: at(1) },
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

/* Currency migration — runs every boot, independent of the seed flag,
   so devices ALREADY seeded (v3, before the currency discipline) get
   corrected without re-running the whole seed (which would duplicate
   events + expenses). Idempotent: only touches a makadi state that has
   no rateCcy yet. The legacy "45 EGP-equivalent" was wrong on both the
   number and the unit — the real listing is 34 USD after tax. Logs a
   currency-tagged rate_changed so history/Rewind stay honest. */
export function migrateMoney(): void {
  try {
    const s = loadState();
    if (s.makadi && (s.makadi as any).rateCcy == null) {
      const wasLegacy = s.makadi.nightlyRate === 45;
      const rate = wasLegacy ? 34 : s.makadi.nightlyRate;
      s.makadi = { ...s.makadi, nightlyRate: rate, rateCcy: 'USD' };
      saveState(s);
      logEvent({ domain: 'makadi', type: 'rate_changed', value: rate, ccy: 'USD', meta: { correction: 'currency-fix', afterTax: true }, source: 'auto' });
    }
  } catch { /* ignore — boot must never throw here */ }

  /* §13.2 — backfill currency onto legacy money events that predate the
     money discipline (e.g. expense_logged before ccy was first-class),
     so the Integrity audit reads zero discrepancies on real data without
     a manual reconcile. Tagging only — values are never touched. */
  try {
    const KEY = 'kai.events';
    const list = read<any[]>(KEY, []);
    const rateCcy = (loadState().makadi?.rateCcy ?? 'USD');
    let changed = false;
    for (const e of list) {
      if (e.ccy || typeof e.value !== 'number') continue;
      const money =
        e.domain === 'debt' || e.domain === 'income' || e.domain === 'expense' || e.domain === 'money'
        || (e.domain === 'makadi' && (e.type === 'rate_changed' || e.type === 'arrears_paid'))
        || (e.domain === 'system' && e.type === 'cash_on_hand');
      if (!money) continue;
      e.ccy = (e.domain === 'makadi' && e.type === 'rate_changed') ? rateCcy : 'EGP';
      changed = true;
    }
    if (changed) { write(KEY, list); emit(); }
  } catch { /* ignore — boot must never throw here */ }
}

/* ── §14.3 status update — THE MAKADI LISTING IS LIVE ──────────
   The renovated listing went live 2026-07-14 (new golden-hour photo set,
   priced against scouted comps, peak season). Run-once (guarded by
   LISTING_FLAG): log the win to the Spine, and RECOVER the July-12 listing
   commitment — force it KEPT with this event as evidence, since the Mirror's
   auto-resolver can't revive a commitment it already marked broken. The
   "first booking by Aug 1" commitment is deliberately left untouched: it
   stays armed, watching for a real makadi booking event. Idempotent. */
export function migrateMakadiListing(now: number = Date.now()): void {
  try {
    /* SELF-HEALING GUARD — gate on the EVENT actually being present in the
       Spine, NOT a one-shot localStorage flag. The old flag could be set
       synchronously while its event was clobbered by a concurrent sync
       write (sync captured the pre-migration snapshot, then overwrote), so
       the flag stranded the device in the unlisted state forever. Keying on
       the event means: if it didn't stick, the next load re-logs it until
       it does. Idempotent once the event persists. */
    if (getEvents({ domain: 'makadi', type: 'listing_upgraded' }).length > 0) return;

    const ev = logEvent({
      domain: 'makadi', type: 'listing_upgraded', value: 1,
      meta: { photos: 'new set', cover: 'golden hour', date: '2026-07-14' },
      source: 'user', ts: now,
    });

    /* Recover ONLY the listing commitment — makadi domain, listing-shaped
       text, and explicitly NOT a booking commitment (that one stays armed). */
    const recovered = markKeptByMatch((c) => {
      const t = (c.text || '').toLowerCase();
      const makadi = c.metric?.domain === 'makadi' || /makadi/.test(t);
      const listing = /(list|photo|relist|upload|go[- ]?live|\blive\b|publish|renovat|ready)/.test(t);
      const booking = /book/.test(t);
      return makadi && listing && !booking;
    }, ev.id, now);

    /* VISIBLE CONFIRMATION — so "did the migration run?" is never a guess.
       Reports how many commitments it recovered AND every makadi/listing/
       booking commitment it saw (status + text), so a NON-match is
       diagnosable straight from the Spine (read via window.__kaiMakadi()). */
    const seen = getCommitments()
      .filter((c) => /makadi|list|book/i.test(c.text || '') || c.metric?.domain === 'makadi')
      .map((c) => `${c.status}: ${(c.text || '').slice(0, 60)}`);
    try {
      logEvent({
        domain: 'system', type: 'listing_migration', value: 1,
        meta: { evId: ev.id, recovered, commitmentsSeen: seen, note: 'makadi listing_upgraded seeded' },
        source: 'auto', ts: now,
      });
    } catch { /* confirmation is best-effort */ }

    try { localStorage.setItem(LISTING_FLAG, '1'); } catch { /* legacy bookkeeping only */ }
  } catch { /* boot must never throw here */ }
}

/* ── TRUTH RECORD (BUG SWEEP §1) — the withdrawn inquiry ────────
   On 2026-07-18 a real Airbnb inquiry arrived (guest "Hatem", Modern Stay
   | Pool & Balcony Fun, Jul 19–24) and was WITHDRAWN by the guest the same
   day ("all plans gone away"). It was NOT a confirmed booking. The Spine
   records exactly what happened — an inquiry and its withdrawal — and
   nothing more. We log booking_replied for the same thread so the pulse
   treats it as resolved and never nags. Self-healing guard on the event
   (survives a sync clobber). This is the honest alternative to the
   fabricated booking_confirmed we correctly refused to write. */
export function recordWithdrawnInquiry(now: number = Date.now()): void {
  try {
    const thread = 'gmail-19f7457f6e2c0fa1';
    if (getEvents({ domain: 'makadi', type: 'booking_inquiry' }).some((e) => e.meta?.thread === thread)) return;
    logEvent({
      domain: 'makadi', type: 'booking_inquiry',
      meta: { thread, guest: 'Hatem', dates: 'Jul 19–24, 2026', listing: 'Modern Stay | Pool & Balcony Fun',
        subject: 'Inquiry for Modern Stay | Pool & Balcony Fun for Jul 19 – 24, 2026', source: 'gmail', status: 'withdrawn' },
      source: 'user', ts: now,
    });
    logEvent({ domain: 'makadi', type: 'booking_replied', meta: { thread, reason: 'withdrawn_by_guest' }, source: 'user', ts: now });
  } catch { /* boot must never throw here */ }
}

/* ── FIRST BOOKINGS — REAL, CONFIRMED (operator-confirmed) ─────
   Two real Makadi bookings, recorded as truth on Kaiser's word:
     1. Airbnb — Hatem, Jul 27–30, 3 nights, $103.34 (USD).
     2. Direct — Jul 26, 1 night, 1,500 EGP.
   Currency discipline: each event carries its OWN amount in `value` with
   an explicit `ccy` — USD and EGP are stored separately, never mixed; the
   Profit Line normalises to EGP at read time via toEgp. nights_booked=4
   quiets the Makadi organ (the truth changing, not a bug), and the
   "first booking by Aug 1" commitment resolves KEPT with these as evidence.
   Self-healing guard on the booking ref (survives a sync clobber). */
export interface BookingRecordResult { ran: boolean; persisted: boolean; count: number; reason?: string; }

export function recordRealBookings(now: number = Date.now(), force = false): BookingRecordResult {
  try {
    const REF = 'real-booking-hatem-jul27';
    const present = () => getEvents({ domain: 'makadi', type: 'booking_confirmed' });
    if (!force && present().some((e) => e.meta?.ref === REF)) {
      return { ran: false, persisted: true, count: present().length, reason: 'already-present' };
    }

    /* Per-ref idempotence — safe under force re-run (the repair button):
       only write a booking whose ref isn't already in the Spine, so a
       forced heal fills gaps without ever duplicating. */
    const has = (ref: string) => present().some((e) => e.meta?.ref === ref);

    let airbnbId = present().find((e) => e.meta?.ref === REF)?.id;
    if (!has(REF)) {
      airbnbId = logEvent({
        domain: 'makadi', type: 'booking_confirmed', value: 103.34, ccy: 'USD',
        meta: { ref: REF, guest: 'Hatem', dates: 'Jul 27–30, 2026', nights: 3, source: 'airbnb', amount: '$103.34' },
        source: 'user', ts: now,
      }).id;
    }
    if (!has('real-booking-direct-jul26')) {
      logEvent({
        domain: 'makadi', type: 'booking_confirmed', value: 1500, ccy: 'EGP',
        meta: { ref: 'real-booking-direct-jul26', guest: 'Direct booking', dates: 'Jul 26, 2026', nights: 1, source: 'direct', amount: '1,500 EGP' },
        source: 'user', ts: now,
      });
    }
    /* Total booked nights — a count, no currency. Quiets the organ. */
    if (!getEvents({ domain: 'makadi', type: 'nights_booked' }).some((e) => e.meta?.ref === 'real-bookings-jul')) {
      logEvent({ domain: 'makadi', type: 'nights_booked', value: 4, meta: { ref: 'real-bookings-jul', source: 'confirmed' }, source: 'user', ts: now });
    }

    /* Resolve the "first booking" commitment KEPT — makadi + booking-shaped
       text, explicitly NOT the listing commitment. Evidence: the Airbnb event. */
    let recovered = 0;
    if (airbnbId) {
      recovered = markKeptByMatch((c) => {
        const t = (c.text || '').toLowerCase();
        const makadi = c.metric?.domain === 'makadi' || /makadi/.test(t);
        return makadi && /book/.test(t);
      }, airbnbId, now);
    }

    /* VERIFY the writes actually persisted (the whole point of this pass):
       re-read the Spine and confirm both bookings survived. On a storage-
       starved device logEvent now prunes+retries, so this should hold — but
       we report the truth either way so a real failure is visible, never
       silently assumed. */
    const count = present().length;
    const persisted = has(REF) && has('real-booking-direct-jul26');

    try {
      logEvent({
        domain: 'system', type: 'booking_recorded', value: 4,
        meta: { recovered, persisted, forced: force, bookings: ['Airbnb Hatem $103.34 (3n)', 'Direct 1,500 EGP (1n)'], nights: 4, note: 'first real Makadi bookings' },
        source: 'user', ts: now,
      });
    } catch { /* best-effort */ }

    return { ran: true, persisted, count };
  } catch (err) {
    return { ran: false, persisted: false, count: 0, reason: String((err as any)?.message || err) };
  }
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
