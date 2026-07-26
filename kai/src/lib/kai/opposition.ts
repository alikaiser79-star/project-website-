/* ============================================================
   §30.13 THE COUNCIL → THE OPPOSITION.

   Every engine agreed by construction: the Hunter proposes, the Council
   ranks, the surfaces render. Nothing in KAI ever argued back. A machine
   that only agrees with itself is an echo.

   Before any material recommendation, two cases are built FROM THE SAME
   SPINE — one FOR, one AGAINST — and both are shown. KAI does not resolve
   them. Kaiser does.

     FOR       the upside, its arithmetic, and what it rests on.
     AGAINST   the cost, the risk, and the history that warns.
     Each argument cites real events or states plainly that it is an
     assumption. An objection with nothing behind it is not shown at all —
     manufactured dissent is as dishonest as manufactured agreement.
   ============================================================ */

import { getEvents } from './events';
import { toEgp } from './money';
import type { CouncilContext } from './council';
import type { Opportunity } from './hunter';
import type { Currency } from '../../types';

const DAY = 86_400_000;

export interface Argument { claim: string; basis: string; assumed?: boolean }
export interface Debate {
  motion: string;
  forCase: Argument[];
  againstCase: Argument[];
  verdict: string;          // what the disagreement amounts to — never a decision
}

/* ── the debate over a Hunter move ───────────────────────────── */
export function debateMove(o: Opportunity, ctx: CouncilContext): Debate {
  const forCase: Argument[] = [];
  const againstCase: Argument[] = [];
  const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

  /* FOR — the move's own arithmetic, always stated with its basis */
  forCase.push({
    claim: `Worth about ${egp(o.expectedEgp)} EGP for ${o.minutes} minute${o.minutes === 1 ? '' : 's'} of your time.`,
    basis: o.rationale,
    assumed: /assumption|could fill|projected/i.test(o.rationale),
  });

  /* FOR — the Twin, when his record supports the lane */
  const lane = laneDomain(o.kind);
  const ft = ctx.twin.followThrough.find((f) => f.domain === lane);
  if (ft && ft.status === 'sustained') {
    forCase.push({ claim: `You stay with ${lane}.`, basis: `${ft.events} ${lane} events, last one ${ft.lastDaysAgo}d ago.` });
  }

  /* AGAINST — the Twin, when his record warns */
  if (ft && ft.status === 'abandoned') {
    againstCase.push({ claim: `You abandon ${lane}.`, basis: `${ft.lastDaysAgo} days since the last ${lane} move — this lane has gone quiet on you before.` });
  }

  /* AGAINST — a price rise is not free while the reputation is thin. This is
     the brief's own counter, and it only appears when the numbers support it. */
  if (o.kind === 'pricing') {
    const reviews = getEvents({ domain: 'makadi', type: 'review_received' });
    const stays = getEvents({ domain: 'makadi', type: 'booking_confirmed' }).length;
    if (reviews.length < 15) {
      againstCase.push({
        claim: 'A rise before the reviews build costs ranking more than it gains.',
        basis: `${reviews.length} review${reviews.length === 1 ? '' : 's'} on record across ${stays} stay${stays === 1 ? '' : 's'}. Placement rewards volume and recency; a higher price slows both.`,
      });
    }
    const rate = ctx.events.filter((e) => e.domain === 'makadi' && e.type === 'rate_changed').sort((a, b) => b.ts - a.ts)[0];
    if (rate && ctx.now - rate.ts < 30 * DAY) {
      againstCase.push({ claim: 'You changed the rate recently.', basis: `Last change ${Math.round((ctx.now - rate.ts) / DAY)}d ago — moving it again gives the market no time to answer the first move.` });
    }
  }

  /* AGAINST — a broadcast spends goodwill, and its fill rate is assumed */
  if (o.kind === 'broadcast') {
    againstCase.push({
      claim: 'The fill rate is an assumption, not a measurement.',
      basis: 'No broadcast has been sent and measured yet, so the projected value rests on an assumed conversion.',
      assumed: true,
    });
  }

  /* AGAINST — money in a thin week */
  const runway = ctx.runway?.runwayDays ?? null;
  if (runway != null && runway < 21 && o.minutes >= 3) {
    againstCase.push({ claim: 'Your attention is expensive this week.', basis: `${Math.floor(runway)} days of runway — the time this costs is time not spent on cash.` });
  }

  /* AGAINST — an overdue promise outranks a new venture */
  if (ctx.overdue.length) {
    againstCase.push({ claim: 'You owe something already.', basis: `${ctx.overdue.length} commitment${ctx.overdue.length === 1 ? '' : 's'} overdue — starting new work before clearing them is the pattern that breaks them.` });
  }

  return {
    motion: o.title,
    forCase, againstCase,
    verdict: summarise(forCase, againstCase),
  };
}

/* ── a debate over a stated decision (anything he types) ─────── */
export function debateDecision(text: string, ctx: CouncilContext): Debate {
  const forCase: Argument[] = [];
  const againstCase: Argument[] = [];
  const s = text.toLowerCase();

  const spend = s.match(/(\d[\d,]{2,})/);
  const amount = spend ? parseFloat(spend[1].replace(/,/g, '')) : null;

  if (amount && /spend|buy|pay|cost/.test(s)) {
    const burn = ctx.runway?.dailyBurn ?? 0;
    const runway = ctx.runway?.runwayDays ?? null;
    if (burn > 0) {
      const days = amount / burn;
      againstCase.push({ claim: `That is ${days.toFixed(1)} days of freedom.`, basis: `${Math.round(burn).toLocaleString('en-GB')} EGP/day burn${runway != null ? `, ${Math.floor(runway)} days left` : ''}.` });
    }
    if (ctx.twin.spending.flags && ctx.twin.spending.ratio != null) {
      const recentWin = ctx.events.some((e) => ctx.now - e.ts < 3 * DAY && ((e.domain === 'makadi' && e.type === 'booking_confirmed') || (e.domain === 'income' && e.type === 'received')));
      if (recentWin) againstCase.push({ claim: 'Money just landed.', basis: `You spend ${ctx.twin.spending.ratio.toFixed(1)}× your usual in the three days after a win.` });
    }
  }

  /* a commitment with no date */
  if (/i'?ll|i will|commit|promise/.test(s) && !/\d|monday|tuesday|wednesday|thursday|friday|saturday|sunday|by \w+/.test(s)) {
    const v = ctx.twin.reliability.vague;
    if (v.total >= 2) againstCase.push({ claim: 'No date on it.', basis: `You keep ${v.pct}% of vague commitments (${v.kept}/${v.total}) against ${ctx.twin.reliability.specific.pct ?? '—'}% of dated ones.` });
  }

  /* FOR — what the live moves say is available */
  const top = ctx.moves[0];
  if (top) forCase.push({ claim: `There is ${Math.round(top.expectedEgp).toLocaleString('en-GB')} EGP of live opportunity.`, basis: top.title });
  if (!forCase.length) forCase.push({ claim: 'Nothing in the record argues against it.', basis: 'No countervailing pattern found — which is not the same as a reason to do it.' });

  return { motion: text.trim().slice(0, 90), forCase, againstCase, verdict: summarise(forCase, againstCase) };
}

function laneDomain(kind: string): string {
  return kind === 'lead_nudge' ? 'leads' : 'makadi';
}

/* The verdict names the SHAPE of the disagreement. It never decides. */
function summarise(f: Argument[], a: Argument[]): string {
  if (!a.length) return 'Nothing in your record argues against this. That is not the same as a reason — it means no objection was found.';
  if (!f.length) return 'No case in favour could be built from your record.';
  const assumed = [...f, ...a].filter((x) => x.assumed).length;
  const tail = assumed ? ` ${assumed} point${assumed === 1 ? ' rests' : 's rest'} on an assumption rather than a measurement.` : '';
  return `${f.length} for, ${a.length} against, all from your own record.${tail} Yours to call.`;
}

/* ── rendering ───────────────────────────────────────────────── */
export function debateText(d: Debate): string {
  const L: string[] = [];
  L.push(`MOTION: ${d.motion}`);
  L.push('');
  L.push('FOR');
  for (const a of d.forCase) L.push(`  + ${a.claim}${a.assumed ? '  [assumption]' : ''}\n      ${a.basis}`);
  L.push('');
  L.push('AGAINST');
  if (!d.againstCase.length) L.push('  (nothing in the record objects)');
  for (const a of d.againstCase) L.push(`  − ${a.claim}${a.assumed ? '  [assumption]' : ''}\n      ${a.basis}`);
  L.push('');
  L.push(d.verdict);
  return L.join('\n');
}
