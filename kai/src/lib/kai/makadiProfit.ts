/* ============================================================
   MAKADI PROFIT LINE — the single number that says whether the apartment
   paid for itself. PURE SPINE ARITHMETIC — no projections, no demo data.
   Recomputes live as real events land.

     SPENT  = the expense ledger's Makadi outflows (money OUT). In the
              money discipline, cash out is the `expense` domain, so we sum
              expense events attributable to Makadi. The `trip_makadi`
              event (25,000 EGP) is the cash total of the renovation trip;
              the makadi-domain markers it itemises (lock_replaced,
              couch_installed, arrears_paid) carry their split in meta but
              are NOT re-summed here — that would double-count the same
              cash. Future Makadi costs logged as expense events add
              automatically.
     EARNED = real Makadi rental income: makadi/booking_confirmed (amount
              from meta, else booked nights × the real nightly rate) plus
              any income-domain event attributed to Makadi. Zero until a
              real booking lands.
     NET     = earned − spent. Negative = still invested.

   All figures normalised to EGP via the currency discipline (toEgp).
   ============================================================ */

import { getEvents } from './events';
import { toEgp } from './money';
import { loadState } from '../store';
import type { Currency } from '../../types';

export interface MakadiProfit {
  spent: number;            // EGP out
  earned: number;           // EGP in
  net: number;              // earned − spent (negative = underwater)
  nightlyEgp: number;       // real nightly rate in EGP
  nightsBooked: number;     // real booked nights recorded
  nightsToBreakEven: number;// bookings still needed; 0 once break-even
  brokeEven: boolean;
  verdict: string;
}

/* Best-effort money parse from a free-text amount (e.g. "$220", "3,400 EGP").
   Currency inferred from symbol/code; defaults to USD (Makadi lists in USD). */
function amountToEgp(s?: unknown): number {
  if (s == null) return 0;
  const str = String(s);
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (!isFinite(num) || num <= 0) return 0;
  const ccy: Currency = /€|eur/i.test(str) ? 'EUR' : /egp|\ble\b|£/i.test(str) ? 'EGP' : 'USD';
  return toEgp(num, ccy);
}

export function makadiProfit(now = Date.now()): MakadiProfit {
  let spent = 0, earned = 0, nightsBooked = 0;

  const mk = (() => { try { return loadState().makadi; } catch { return undefined; } })();
  const nightlyEgp = mk ? toEgp(mk.nightlyRate ?? 0, (mk.rateCcy ?? 'USD') as Currency) : 0;

  /* SPENT — expense-domain outflows attributable to Makadi (cash out). */
  for (const e of getEvents({ domain: 'expense' })) {
    if (/makadi/i.test(e.type) || (e.meta as any)?.makadi) {
      spent += toEgp(e.value || 0, (e.ccy as Currency) || 'EGP');
    }
  }

  /* EARNED — real Makadi rental income. Currency-disciplined: the amount
     rides in value + ccy (USD and EGP stored separately), normalised to EGP
     here via toEgp. A legacy value of 1 is the old "a booking happened" flag,
     not money — for those, fall back to a parsed meta.amount, else booked
     nights × the real nightly rate. */
  for (const e of getEvents({ domain: 'makadi', type: 'booking_confirmed' })) {
    const nights = Number((e.meta as any)?.nights) || 0;
    nightsBooked += nights;
    if ((e.value ?? 0) > 1) {
      earned += toEgp(e.value as number, (e.ccy as Currency) || 'EGP');
    } else {
      const amt = amountToEgp((e.meta as any)?.amount);
      earned += amt > 0 ? amt : nights * nightlyEgp;
    }
  }
  for (const e of getEvents({ domain: 'income' })) {
    if ((e.meta as any)?.src === 'makadi' || /makadi/i.test(e.type) || (e.meta as any)?.makadi) {
      earned += toEgp(e.value || 0, (e.ccy as Currency) || 'EGP');
    }
  }

  const net = earned - spent;
  const brokeEven = net >= 0 && spent > 0;
  const remaining = Math.max(0, spent - earned);
  const nightsToBreakEven = nightlyEgp > 0 ? Math.ceil(remaining / nightlyEgp) : 0;

  const egp = (n: number) => Math.round(n).toLocaleString('en-GB');
  let verdict: string;
  if (spent === 0 && earned === 0) {
    verdict = 'No Makadi money logged yet.';
  } else if (brokeEven) {
    verdict = `PAID FOR ITSELF — +${egp(net)} EGP net across ${nightsBooked} night${nightsBooked === 1 ? '' : 's'}.`;
  } else {
    verdict = `${egp(spent)} EGP invested · ${egp(earned)} EGP earned · ${nightsToBreakEven} night${nightsToBreakEven === 1 ? '' : 's'} of bookings to break even.`;
  }

  return { spent, earned, net, nightlyEgp, nightsBooked, nightsToBreakEven, brokeEven, verdict };
}
