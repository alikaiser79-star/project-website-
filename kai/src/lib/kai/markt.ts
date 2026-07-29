/* ============================================================
   §44.3 DER MARKT IN MIR — the whole board, one model.
   §44.4 DIE STIMME DES HAUSES — the assets speak for themselves.

   Every asset priced against every alternative: return per pound and
   return per hour, ranked, so the next pound and the next hour stop
   being guesses.

   ── THE LINE THIS FILE WILL NOT CROSS ─────────────────────────
   The brief's own example contains the trap: "the garden WC returns an
   estimated 400% in year one and needs 40k". That number cannot come
   from anywhere real — there is no WC, no bookings against it, and no
   comparable. Printing it beside "the card returns 38% guaranteed"
   would put a fantasy and a contractual fact in the same column, in
   the same units, sorted against each other.

   So every position on the board carries HOW ITS RETURN IS KNOWN:

     contractual — arithmetic on a rate he is actually paying. Paying
                   down a 38% APR card returns 38%, guaranteed, and it
                   is the only guaranteed return most people ever get.
     realised    — measured from money that actually moved.
     unpriced    — a real asset with no measurable return yet. It
                   appears on the board with NO number, because a blank
                   is honest and a guess is not.

   Nothing is ever sorted against a number that was invented, and an
   unpriced position cannot be ranked above a measured one.
   ============================================================ */

import { getEvents } from './events';
import { makadiProfit } from './makadiProfit';
import { gardenProfit, produce } from './gaertner';
import { computeRunway } from './runway';
import { loadState } from '../store';
import { debt as debtCfg } from '../../kaiConfig';

const DAY = 86_400_000;
const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

export type Basis = 'contractual' | 'realised' | 'unpriced';

export interface Position {
  name: string;
  /* Capital currently in it, EGP. */
  capital: number;
  /* Return per pound, as a percentage. null when unpriced. */
  returnPct: number | null;
  hours: number | null;
  perHour: number | null;
  basis: Basis;
  how: string;              // exactly how that number is known
  voice: string;            // §44.4 — the asset, first person
}

function hoursFor(pred: (d: string, t: string, m: any) => boolean, now: number): number | null {
  const evs = getEvents({}).filter((e) => e.ts <= now && typeof e.meta?.hours === 'number' && pred(e.domain, e.type, e.meta));
  return evs.length ? evs.reduce((s, e) => s + Number(e.meta!.hours), 0) : null;
}

export function board(now = Date.now()): Position[] {
  const out: Position[] = [];
  const state = (() => { try { return loadState(); } catch { return null as any; } })();

  /* ── THE CARD. The only guaranteed return on the board. ── */
  const bal = Number(state?.debtCurrent) || 0;
  const apr = Number(debtCfg?.apr) || 0;
  if (bal > 0 && apr > 0) {
    out.push({
      name: 'The card', capital: bal, returnPct: apr, hours: 0, perHour: null,
      basis: 'contractual',
      how: `${apr}% APR you are actually being charged. A pound against this returns ${apr}% with certainty — nothing else here is certain.`,
      voice: `I am ${egp(bal)} EGP of your money working against you at ${apr}% a year. Every pound you send me returns ${apr}% guaranteed, which is more than most things you are considering.`,
    });
  }

  /* ── MAKADI. Realised. ── */
  const m = makadiProfit(now);
  const mh = hoursFor((d, _t, meta) => d === 'makadi' || meta?.makadi === true, now);
  if (m.spent > 0 || m.earned > 0) {
    const pct = m.spent > 0 ? ((m.earned - m.spent) / m.spent) * 100 : null;
    out.push({
      name: 'Makadi', capital: m.spent,
      returnPct: pct, hours: mh, perHour: mh && mh > 0 ? (m.earned - m.spent) / mh : null,
      basis: 'realised',
      how: `${egp(m.earned)} earned against ${egp(m.spent)} invested, from bookings that actually happened.`,
      voice: m.brokeEven
        ? `I have paid for myself. ${m.nightsBooked} nights, ${egp(m.earned)} earned against ${egp(m.spent)} you put in. Everything from here is yours.`
        : `${m.nightsBooked} nights, ${egp(m.earned)} earned. You are still owed ${egp(m.spent - m.earned)}. I am ${m.nightsToBreakEven} nights from paying for myself.`,
    });
  }

  /* ── THE GARDEN. Realised, and usually uncomfortable. ── */
  const g = gardenProfit(now);
  const gh = hoursFor((d, _t, meta) => d === 'garden' || meta?.garden === true, now);
  const pr = produce(now);
  if (g.spent > 0 || g.earned > 0) {
    const pct = g.spent > 0 ? ((g.earned - g.spent) / g.spent) * 100 : null;
    out.push({
      name: 'The garden', capital: g.spent,
      returnPct: pct, hours: gh, perHour: gh && gh > 0 ? (g.earned - g.spent) / gh : null,
      basis: 'realised',
      how: `${egp(g.earned)} earned against ${egp(g.spent)} invested, from events completed and produce sold.`,
      voice: g.earned === 0
        ? `I cost you ${egp(g.spent)} and earned you nothing. ${pr.harvests ? `I gave you ${egp(pr.marketValueEgp)} EGP of food, which you ate.` : 'I have not been harvested.'} I am land, and land does nothing on its own.`
        : `I cost you ${egp(g.spent)} and returned ${egp(g.earned)} across ${g.eventsHeld} events. ${g.brokeEven ? 'I have paid for myself.' : `I am ${g.eventsToBreakEven} events from paying for myself.`}`,
    });
  } else {
    /* A real asset with nothing measured. It goes on the board with no
       number rather than being left off — invisible is how it stayed
       unmeasured in the first place. */
    out.push({
      name: 'The garden', capital: 0, returnPct: null, hours: gh, perHour: null,
      basis: 'unpriced',
      how: 'Nothing logged. Not a zero return — an unmeasured one, which is a different and worse thing.',
      voice: 'I cost you nothing this month and earned you nothing, because nobody wrote anything down about me. I am still here.',
    });
  }

  /* ── CASH. Real, and it earns nothing. ── */
  const r = computeRunway(now);
  if (r.liquidCash > 0) {
    out.push({
      name: 'Cash', capital: r.liquidCash, returnPct: 0, hours: 0, perHour: null,
      basis: 'contractual',
      how: 'Cash earns 0%. That is not a criticism — it is what a buffer costs, and a buffer is a real thing to buy.',
      voice: `I am ${egp(r.liquidCash)} EGP doing nothing, on purpose. I am ${r.runwayDays === null ? 'your buffer' : `${Math.floor(r.runwayDays)} days of your life`}. Spending me buys return and costs sleep.`,
    });
  }

  /* ── HIS HOURS. Priced only from what he has actually earned. ── */
  const totalHours = [mh, gh].filter((x): x is number => x !== null).reduce((s, x) => s + x, 0);
  if (totalHours > 0) {
    const netAll = (m.earned - m.spent) + (g.earned - g.spent);
    out.push({
      name: 'Your hours', capital: 0, returnPct: null,
      hours: totalHours, perHour: netAll / totalHours,
      basis: 'realised',
      how: `${totalHours} hours logged across the assets, returning ${egp(netAll)} net between them.`,
      voice: `You have logged ${totalHours} hours on these. They came back at ${egp(netAll / totalHours)} EGP an hour. You cannot buy more of me.`,
    });
  }

  /* Ranked by return per pound — but an unpriced position can never
     outrank a measured one, so it sorts to the bottom by construction. */
  return out.sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity));
}

export function marktText(now = Date.now()): string {
  const b = board(now);
  const L = ['DER MARKT IN MIR', ''];
  if (!b.length) {
    L.push('Nothing on the board. No capital, no return, nothing to rank.');
    return L.join('\n');
  }
  for (const p of b) {
    const ret = p.returnPct === null ? '—' : `${p.returnPct >= 0 ? '+' : ''}${Math.round(p.returnPct)}%`;
    const ph = p.perHour === null ? '—' : `${egp(p.perHour)}/h`;
    L.push(`  ${p.name.padEnd(12)} ${egp(p.capital).padStart(9)} EGP   return ${ret.padStart(7)}   ${ph.padStart(10)}   [${p.basis}]`);
    L.push(`      ${p.how}`);
  }
  const measured = b.filter((p) => p.returnPct !== null);
  /* Filtered on BASIS, not on a null return. "Your hours" has no return
     per POUND — it has no pounds in it — but it is measured per hour, and
     calling it unpriced said the opposite of what the row shows. */
  const unpriced = b.filter((p) => p.basis === 'unpriced');
  const perHourOnly = b.filter((p) => p.basis !== 'unpriced' && p.returnPct === null && p.perHour !== null);
  L.push('');
  if (measured.length) {
    L.push(`THE NEXT POUND: ${measured[0].name} — ${Math.round(measured[0].returnPct!)}%, ${measured[0].basis}.`);
  }
  if (perHourOnly.length) {
    L.push(`${perHourOnly.map((p) => p.name).join(', ')}: no return per POUND because there are no pounds in it — measured per hour instead.`);
  }
  if (unpriced.length) {
    L.push(`UNPRICED: ${unpriced.map((p) => p.name).join(', ')}. Shown with no number rather than a guessed one — nothing here is ranked against an estimate.`);
  }
  return L.join('\n');
}

/* ── §44.4 the assets speak ──────────────────────────────────── */

export function hausText(now = Date.now()): string {
  const b = board(now);
  const L = ['DIE STIMME DES HAUSES', ''];
  if (!b.length) { L.push('Nothing has anything to say. Nothing is measured.'); return L.join('\n'); }
  for (const p of b) { L.push(`${p.name.toUpperCase()}`); L.push(`  "${p.voice}"`); L.push(''); }
  L.push('Written from each asset\'s own numbers. None of them is being kind to you.');
  return L.join('\n');
}
