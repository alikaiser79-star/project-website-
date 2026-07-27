/* ============================================================
   §28.3 THE TWIN → THE SIMULATOR.

   The Twin described the past. This projects the future — not advice, a
   consequence with a date on it:

     "At this pace the card clears 14 Mar 2027. Raise Makadi to $60 and
      hold 40% occupancy and it clears 4 Feb 2027 — 5 weeks sooner."

   Every projection is built from HIS OWN measured rates (paydown from the
   debt ledger, burn from expenses, Makadi income from real bookings), and
   every assumption a scenario introduces is stated on the result. A
   projection with no measurable rate behind it returns null rather than a
   comforting guess.
   ============================================================ */

import { getEvents } from './events';
import { loadState } from '../store';
import { toEgp } from './money';
import { makadiProfit } from './makadiProfit';
import type { Currency } from '../../types';

const DAY = 86_400_000;
const MONTH = 30 * DAY;

export interface Scenario {
  nightlyRate?: number;        // new Makadi rate
  rateCcy?: Currency;
  occupancy?: number;          // 0..1 nights filled
  monthlyPaydown?: number;     // EGP/month at the card
  cutBurnPct?: number;         // 0..1 reduction in daily burn
}

export interface Projection {
  clearsAt: number | null;     // ms timestamp the card hits zero
  months: number | null;
  monthlyNet: number;          // EGP/month going at the debt
  balance: number;
  assumptions: string[];       // every input that isn't measured history
  basis: string[];             // what WAS measured, and over what window
}

/* ── measured rates, from his own ledger ─────────────────────── */

/* Average EGP/month actually paid at the card over the trailing 90 days. */
export function measuredPaydown(now = Date.now()): { egpPerMonth: number; window: number; payments: number } {
  const since = now - 90 * DAY;
  const pays = getEvents({ domain: 'debt', type: 'payment_logged', since });
  const total = pays.reduce((s, e) => s + toEgp(e.value || 0, (e.ccy as Currency) || 'EGP'), 0);
  return { egpPerMonth: total / 3, window: 90, payments: pays.length };
}

/* Average EGP/month of real Makadi income over the trailing 90 days. */
export function measuredMakadiIncome(now = Date.now()): { egpPerMonth: number; bookings: number } {
  const since = now - 90 * DAY;
  const bs = getEvents({ domain: 'makadi', type: 'booking_confirmed', since });
  const total = bs.reduce((s, e) => s + toEgp(e.value || 0, (e.ccy as Currency) || 'EGP'), 0);
  return { egpPerMonth: total / 3, bookings: bs.length };
}

/* ── the projection ──────────────────────────────────────────── */
export function projectDebtClear(scenario: Scenario = {}, now = Date.now()): Projection {
  const s = safeState();
  const balance = s?.debtCurrent ?? 0;
  const assumptions: string[] = [];
  const basis: string[] = [];

  const paydown = measuredPaydown(now);
  const makadi = measuredMakadiIncome(now);

  /* baseline: what he actually pays, from the ledger */
  let monthlyNet = scenario.monthlyPaydown ?? paydown.egpPerMonth;
  if (scenario.monthlyPaydown != null) assumptions.push(`paying ${Math.round(scenario.monthlyPaydown).toLocaleString('en-GB')} EGP/month at the card`);
  else basis.push(`${Math.round(paydown.egpPerMonth).toLocaleString('en-GB')} EGP/month measured from ${paydown.payments} payment${paydown.payments === 1 ? '' : 's'} in 90 days`);

  /* a rate/occupancy scenario adds Makadi income ABOVE what he earns today */
  if (scenario.nightlyRate != null || scenario.occupancy != null) {
    const rate = scenario.nightlyRate ?? s?.makadi?.nightlyRate ?? 0;
    const ccy = (scenario.rateCcy ?? s?.makadi?.rateCcy ?? 'USD') as Currency;
    const occ = scenario.occupancy ?? s?.makadi?.occupancy30d ?? 0;
    const projected = toEgp(rate, ccy) * 30 * occ;
    const delta = projected - makadi.egpPerMonth;
    monthlyNet += Math.max(0, delta);
    assumptions.push(`Makadi at ${rate} ${ccy}/night and ${Math.round(occ * 100)}% occupancy → ${Math.round(projected).toLocaleString('en-GB')} EGP/month`);
    basis.push(`today it earns ${Math.round(makadi.egpPerMonth).toLocaleString('en-GB')} EGP/month from ${makadi.bookings} booking${makadi.bookings === 1 ? '' : 's'} in 90 days`);
  }

  if (scenario.cutBurnPct != null) {
    const burn = safeBurn(now) * 30;
    const saved = burn * scenario.cutBurnPct;
    monthlyNet += saved;
    assumptions.push(`cutting burn ${Math.round(scenario.cutBurnPct * 100)}% → ${Math.round(saved).toLocaleString('en-GB')} EGP/month freed`);
  }

  if (balance <= 0) return { clearsAt: now, months: 0, monthlyNet, balance, assumptions, basis };
  /* No measurable rate → no date. A projection with nothing behind it is a
     wish, and KAI does not hand him wishes. */
  if (!(monthlyNet > 0)) return { clearsAt: null, months: null, monthlyNet: 0, balance, assumptions, basis };

  const months = balance / monthlyNet;
  return { clearsAt: now + months * MONTH, months, monthlyNet, balance, assumptions, basis };
}

/* Compare a scenario against the baseline — the shape the brief asks for. */
export interface Comparison { base: Projection; alt: Projection; weeksSooner: number | null; line: string }

export function compareScenario(scenario: Scenario, now = Date.now()): Comparison {
  const base = projectDebtClear({}, now);
  const alt = projectDebtClear(scenario, now);
  let weeksSooner: number | null = null;
  if (base.clearsAt != null && alt.clearsAt != null) weeksSooner = Math.round((base.clearsAt - alt.clearsAt) / (7 * DAY));

  const d = (t: number | null) => (t == null ? 'never at this pace' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
  let line: string;
  if (base.clearsAt == null && alt.clearsAt == null) {
    line = 'No measurable paydown yet — log a card payment and I can put a date on it.';
  } else if (base.clearsAt == null) {
    line = `At today's pace the card never clears. ${alt.assumptions.join(' and ')} clears it ${d(alt.clearsAt)}.`;
  } else if (weeksSooner != null && weeksSooner > 0) {
    line = `At this pace the card clears ${d(base.clearsAt)}. ${cap(alt.assumptions.join(' and '))} clears it ${d(alt.clearsAt)} — ${weeksSooner} week${weeksSooner === 1 ? '' : 's'} sooner.`;
  } else if (weeksSooner != null && weeksSooner < 0) {
    line = `At this pace the card clears ${d(base.clearsAt)}. That change puts it ${Math.abs(weeksSooner)} week${Math.abs(weeksSooner) === 1 ? '' : 's'} LATER.`;
  } else {
    line = `At this pace the card clears ${d(base.clearsAt)}. That change moves nothing.`;
  }
  return { base, alt, weeksSooner, line };
}

/* ── spoken scenarios: "raise makadi to 60 at 40%" ───────────── */
export function parseScenario(text: string): Scenario | null {
  const s = String(text || '').toLowerCase();
  const out: Scenario = {};
  const rate = s.match(/(?:makadi|rate|night)\D{0,16}?(\d{2,5})/);
  if (rate) { out.nightlyRate = parseInt(rate[1], 10); out.rateCcy = /\$|usd|dollar/.test(s) ? 'USD' : /egp|pound/.test(s) ? 'EGP' : 'USD'; }
  /* Cut claims its percentage FIRST — otherwise "cut burn 20%" reads the 20%
     as occupancy and silently invents a Makadi scenario he never asked for. */
  const cut = s.match(/cut\D{0,12}?(\d{1,2})\s*%/);
  if (cut) out.cutBurnPct = parseInt(cut[1], 10) / 100;
  /* A percentage is only occupancy when the sentence is about occupancy. */
  if (/occupan|booked|full|nights?\b/.test(s)) {
    const occ = s.match(/(\d{1,3})\s*%|\b(\d{1,3})\s*percent/);
    if (occ) { const n = parseInt(occ[1] || occ[2], 10); if (n > 0 && n <= 100) out.occupancy = n / 100; }
  }
  const pay = s.match(/pay(?:ing|down)?\D{0,12}?(\d[\d,]{2,})/);
  if (pay) out.monthlyPaydown = parseFloat(pay[1].replace(/,/g, ''));
  return Object.keys(out).length ? out : null;
}

function cap(x: string): string { return x ? x[0].toUpperCase() + x.slice(1) : x; }
function safeState() { try { return loadState(); } catch { return null; } }
function safeBurn(now: number): number {
  try {
    const since = now - 30 * DAY;
    const evs = getEvents({ domain: 'expense', since });
    return evs.reduce((s, e) => s + toEgp(e.value || 0, (e.ccy as Currency) || 'EGP'), 0) / 30;
  } catch { return 0; }
}

/* A headline the Twin drawer can show without being asked. */
export function baselineLine(now = Date.now()): string {
  const p = projectDebtClear({}, now);
  if (p.balance <= 0) return 'The card is clear.';
  if (p.clearsAt == null) return 'No card payments logged in 90 days — no clearing date yet.';
  const when = new Date(p.clearsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const mp = makadiProfit(now);
  const tail = mp.nightsToBreakEven > 0 ? ` Makadi breaks even in ${mp.nightsToBreakEven} more booked night${mp.nightsToBreakEven === 1 ? '' : 's'}.` : '';
  return `At ${Math.round(p.monthlyNet).toLocaleString('en-GB')} EGP/month the card clears ${when}.${tail}`;
}
