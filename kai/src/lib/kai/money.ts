/* ============================================================
   MONEY — the currency discipline. Every money value in KAI carries
   its currency (EGP | USD | EUR); nothing renders as a naked, unit-less
   number. fmtMoney() always appends the code; toEgp() normalises to the
   operator's home currency for cross-stream headline math.

   Rates: EUR uses the LIVE store fx (fxEgpPerEur), editable in Settings;
   USD uses a config default (currency.egpPerUsd); EGP is unity.
   ============================================================ */

import { operator, currency } from '../../kaiConfig';
import { loadState } from '../store';
import { getEvents } from './events';
import type { Currency, IncomeOverride } from '../../types';

const DAY = 86_400_000;

function safeFx(): number {
  try { return loadState().fxEgpPerEur || currency.egpPerEur; }
  catch { return currency.egpPerEur; }
}

/* EGP per 1 unit of `ccy`. */
export function egpPer(ccy: Currency): number {
  if (ccy === 'EGP') return 1;
  if (ccy === 'EUR') return safeFx();
  return currency.egpPerUsd;                 // USD
}

/* Any money amount → EGP, for headline totals that mix currencies. */
export function toEgp(value: number, ccy: Currency): number {
  return value * egpPer(ccy);
}

/* Compact magnitude only — NO currency. Internal; callers use fmtMoney. */
function compact(n: number): string {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (a >= 10_000)    return Math.round(n / 1000) + 'K';
  return Math.round(n).toLocaleString(operator.locale);
}

/* Money → compact string that ALWAYS carries its currency code, e.g.
   "34 USD", "59K EGP", "620 EUR". The one true money renderer. */
export function fmtMoney(value: number, ccy: Currency): string {
  if (!isFinite(value)) return '—';
  return `${compact(value)} ${ccy}`;
}

/* Money rendered in its own currency with an EGP conversion appended,
   e.g. "34 USD  ≈ 1.7K EGP". Used where the panel has room to show both
   and the operator benefits from the home-currency anchor. */
export function fmtMoneyWithEgp(value: number, ccy: Currency): string {
  if (ccy === 'EGP') return fmtMoney(value, 'EGP');
  return `${fmtMoney(value, ccy)}  ≈ ${compact(toEgp(value, ccy))} EGP`;
}

/* Realised Makadi monthly income in EGP, occupancy-aware: actual booked
   nights (latest nights_booked in the last 30d, else occupancy30d×30)
   × the nightly rate in ITS currency. 0 nights → 0 — no "22 nights
   assumed" phantom in the income headline or Escape Velocity. */
export function makadiRealisedMonthlyEgp(now = Date.now()): number {
  try {
    const mk = loadState().makadi;
    if (!mk) return 0;
    const ev = getEvents({ domain: 'makadi', type: 'nights_booked', since: now - 30 * DAY }).slice(-1)[0];
    const nights = ev ? (ev.value ?? 0) : Math.round((mk.occupancy30d ?? 0) * 30);
    const ccy = (mk.rateCcy ?? 'USD') as Currency;
    return Math.max(0, nights) * toEgp(mk.nightlyRate ?? 0, ccy);
  } catch { return 0; }
}

/* THE income number, in EGP — one source of truth for every surface
   (INCOME organ, IncomePanel, briefings, runway, snapshots). Each
   recurring stream is converted by its own currency; Makadi is counted
   only at its REALISED nights (occupancy-aware), never a flat 22-night
   projection — so no phantom rental income leaks into any headline.
   Pass a streams list to total a specific set, else it reads the store. */
export function monthlyIncomeEgp(
  streams?: ReadonlyArray<Pick<IncomeOverride, 'id' | 'amount' | 'ccy' | 'cadence'>>,
  now = Date.now(),
): number {
  let list = streams;
  if (!list) { try { list = loadState().income; } catch { list = []; } }
  const base = (list || []).reduce((sum, i) => i.id === 'makadi'
    ? sum
    : sum + toEgp(i.cadence === 'nightly' ? i.amount * 22 : i.amount, i.ccy), 0);
  return base + makadiRealisedMonthlyEgp(now);
}
