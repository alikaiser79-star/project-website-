/* ============================================================
   ESCAPE VELOCITY (§6.1) — THE number. One metric rules everything:
   OWNED / PASSIVE income vs THE BASE (Enpal, 620 EUR net). At 100%,
   work is a choice. Below the meter, the FREEDOM DATE — the projected
   day debt hits zero AND owned income covers the base, from trailing
   90-day Spine deltas. Honest: if the math says never, it says
   "no current trajectory" — no fake hope.
   ============================================================ */

import { income as CONFIG_INCOME, currency } from '../../kaiConfig';
import { loadState } from '../store';
import { getEvents } from './events';
import { makadiRealisedMonthlyEgp, toEgp } from './money';

const DAY = 86_400_000;
const BASE_EUR = 620;               // Enpal net — the base to escape

export interface EscapeState {
  ownedEur: number;                 // owned monthly income, in EUR
  baseEur: number;
  ratio: number;                    // ownedEur / baseEur (1 = escape velocity)
  debtCurrent: number;
  freedomDate: number | null;       // ms, or null = no trajectory
  reason: string;                   // short explanation of the date/none
}

/* Owned income = every stream that isn't the Enpal day job, in EUR.
   Reads the live store income when present, else the config. */
function ownedMonthlyEur(now = Date.now()): number {
  const s = loadState();
  const streams = (s.income && s.income.length ? s.income : CONFIG_INCOME) as typeof CONFIG_INCOME;
  const fx = s.fxEgpPerEur || currency.egpPerEur;
  /* Accumulate every owned stream in EGP by its own currency, then
     convert once to EUR at the end. */
  let egp = 0;
  for (const st of streams) {
    if (st.id === 'enpal') continue;                     // the base, not owned-escape
    if (st.id === 'makadi') continue;                    // realised via occupancy below
    const monthly = st.cadence === 'nightly' ? st.amount * 22 : st.amount;
    egp += toEgp(monthly, st.ccy);
  }
  /* Makadi contributes only its REALISED income — booked nights × the
     nightly rate in its own currency. 0 nights → 0, so THE number never
     rides on phantom occupancy. */
  egp += makadiRealisedMonthlyEgp(now);
  return egp / fx;                                       // EGP → EUR
}

/* Trailing daily debt paydown from balance_updated events (last 90d).
   Positive = paying down. */
function debtPaydownPerDay(now = Date.now()): number {
  const evs = getEvents({ domain: 'debt', type: 'balance_updated', since: now - 90 * DAY });
  if (evs.length < 2) return 0;
  const first = evs[0], last = evs[evs.length - 1];
  const days = Math.max(1, (last.ts - first.ts) / DAY);
  const drop = (first.value ?? 0) - (last.value ?? 0);
  return drop / days;                                    // >0 means falling balance
}

export function escapeState(now = Date.now()): EscapeState {
  const ownedEur = Math.round(ownedMonthlyEur(now));
  const ratio = ownedEur / BASE_EUR;
  const s = loadState();
  const debtCurrent = s.debtCurrent ?? 0;

  const paydown = debtPaydownPerDay(now);
  let debtZero: number | null;
  if (debtCurrent <= 0) debtZero = now;
  else if (paydown > 0) debtZero = now + (debtCurrent / paydown) * DAY;
  else debtZero = null;                                   // not paying down → no trajectory

  const ownedCovers = ratio >= 1;                        // already covers the base?
  let freedomDate: number | null;
  let reason: string;
  if (!ownedCovers) {
    /* owned income doesn't cover the base yet, and we don't extrapolate
       fake growth — so freedom needs owned income to actually rise. */
    freedomDate = null;
    reason = `Owned income is ${Math.round(ratio * 100)}% of the base — grow it or no date.`;
  } else if (debtZero === null) {
    freedomDate = null;
    reason = 'Owned income covers the base, but debt isn\'t falling — no current trajectory.';
  } else {
    freedomDate = debtZero;
    reason = 'Owned income covers the base; freedom lands when the card hits zero.';
  }

  return { ownedEur, baseEur: BASE_EUR, ratio, debtCurrent, freedomDate, reason };
}

/* One-line for the briefing / Witness. */
export function escapeLine(now = Date.now()): string {
  const e = escapeState(now);
  const pct = Math.round(e.ratio * 100);
  if (e.freedomDate) {
    const d = new Date(e.freedomDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    return `Escape velocity ${pct}% — freedom projects to ${d}.`;
  }
  return `Escape velocity ${pct}% of the base. No freedom date on this trajectory.`;
}
