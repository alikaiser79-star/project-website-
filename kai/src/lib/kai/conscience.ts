/* ============================================================
   §28.5 THE COUNCIL → THE CONSCIENCE.

   The Council synthesised nightly — useful, but always after the fact. A
   conscience speaks BEFORE:

     checkIntent()   the instant he's about to do something his own record
                     says ends badly — a purchase in a thin week, a vague
                     commitment, a spend right after a win — it says so,
                     with the history that earns the warning. It never
                     blocks; it objects, and he decides.
     weeklyVerdict() Sunday, one page: what he said, what he did, what it
                     cost, what it earned, graded. From the Spine only.
                     No mercy, no flattery, no invented credit.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { getCommitments } from './commitments';
import { toEgp } from './money';
import { isSpecific } from './twin';
import type { CouncilContext } from './council';
import type { Currency } from '../../types';

const DAY = 86_400_000;

/* ── the interrupt ───────────────────────────────────────────── */
export type IntentKind = 'spend' | 'commit';
export interface Objection {
  severity: 'warn' | 'note';
  text: string;              // the objection
  because: string;           // the history that earns it
}

/* Does his own record object to what he's about to do? */
export function checkIntent(
  kind: IntentKind,
  input: { amountEgp?: number; text?: string },
  ctx: CouncilContext,
): Objection | null {
  const now = ctx.now;

  if (kind === 'spend' && (input.amountEgp ?? 0) > 0) {
    const amount = input.amountEgp!;
    const runway = ctx.runway?.runwayDays ?? null;
    const cash = ctx.runway?.liquidCash ?? 0;
    const burn = ctx.runway?.dailyBurn ?? 0;

    /* a thin week — the spend costs days he doesn't have */
    if (runway != null && isFinite(runway) && burn > 0) {
      const days = amount / burn;
      if (runway < 21 && days >= 1) {
        return {
          severity: 'warn',
          text: `That's ${days.toFixed(1)} day${days >= 1.05 ? 's' : ''} of freedom, and you're down to ${Math.floor(runway)}.`,
          because: `${Math.round(cash).toLocaleString('en-GB')} EGP against ${Math.round(burn).toLocaleString('en-GB')} EGP/day burn.`,
        };
      }
    }

    /* the reward reflex — his own Twin measured it */
    if (ctx.twin?.spending?.flags && ctx.twin.spending.ratio != null) {
      const recentWin = ctx.events.some((e) => now - e.ts < 3 * DAY && (
        (e.domain === 'makadi' && e.type === 'booking_confirmed') ||
        (e.domain === 'money' && e.type === 'milestone') ||
        (e.domain === 'income' && e.type === 'received')));
      if (recentWin) {
        return {
          severity: 'warn',
          text: 'Money just landed, and this is the window where it leaves again.',
          because: `After a win you spend ${ctx.twin.spending.ratio.toFixed(1)}× your usual — measured across ${ctx.twin.spending.wins} wins.`,
        };
      }
    }

    /* a large spend against an overdue promise */
    if (ctx.overdue.length && amount >= 1000) {
      return {
        severity: 'note',
        text: `You have ${ctx.overdue.length} commitment${ctx.overdue.length === 1 ? '' : 's'} overdue while this goes out.`,
        because: `Oldest: "${(ctx.overdue[0].text || '').slice(0, 40)}".`,
      };
    }
  }

  if (kind === 'commit' && input.text) {
    const vague = !isSpecific({ text: input.text } as any);
    const rate = ctx.twin?.reliability?.vague;
    if (vague && rate && rate.total >= 2 && (rate.pct ?? 100) < 60) {
      return {
        severity: 'warn',
        text: 'No date on that one.',
        because: `You keep ${rate.pct}% of vague commitments (${rate.kept}/${rate.total}) against ${ctx.twin.reliability.specific.pct ?? '—'}% of dated ones.`,
      };
    }
  }

  return null;
}

/* Log that the conscience spoke — so the Twin can later see whether he
   listened. An objection nobody records teaches nothing. */
export function recordObjection(o: Objection, heeded: boolean | null, now = Date.now()): void {
  try {
    logEvent({
      domain: 'counsel', type: 'objection',
      meta: { text: o.text, because: o.because, severity: o.severity, heeded },
      source: 'ai', ts: now,
    });
  } catch { /* ignore */ }
}

/* ── the Sunday verdict ──────────────────────────────────────── */
export interface Verdict {
  from: number; to: number;
  said: string[];        // what he committed to
  did: string[];         // what actually landed
  cost: number;          // EGP out
  earned: number;        // EGP in
  kept: number; broke: number;
  grade: string;         // A–F
  ruling: string;        // one honest line
}

export function weeklyVerdict(ctx: CouncilContext, now = Date.now()): Verdict {
  const from = now - 7 * DAY;
  const evs = ctx.events.filter((e) => e.ts >= from && e.ts <= now);

  const kept = evs.filter((e) => e.domain === 'commitment' && e.type === 'commitment_kept').length;
  const broke = evs.filter((e) => e.domain === 'commitment' && e.type === 'commitment_broken').length;

  let cost = 0, earned = 0;
  for (const e of evs) {
    const v = typeof e.value === 'number' ? toEgp(e.value, (e.ccy as Currency) || 'EGP') : 0;
    if (e.domain === 'expense') cost += v;
    if (e.domain === 'income' || (e.domain === 'makadi' && e.type === 'booking_confirmed')) earned += v;
  }

  /* what he SAID — commitments made or standing this week */
  const said = getCommitments()
    .filter((c) => c.createdAt >= from || (c.status === 'open' && c.deadline >= from))
    .slice(0, 6)
    .map((c) => `${c.status === 'kept' ? '✓' : c.status === 'broken' ? '✗' : '·'} ${(c.text || '').slice(0, 52)}`);

  /* what he DID — the events that actually moved something */
  const didEvents = evs.filter((e) =>
    (e.domain === 'makadi' && (e.type === 'booking_confirmed' || e.type === 'rate_changed')) ||
    (e.domain === 'debt' && e.type === 'payment_logged') ||
    (e.domain === 'content' && e.type === 'reel_posted') ||
    (e.domain === 'hunter' && e.type === 'actioned') ||
    (e.domain === 'income' && e.type === 'received'));
  const did = didEvents.slice(-6).map((e) => {
    const v = typeof e.value === 'number' ? ` ${Math.round(e.value).toLocaleString('en-GB')}${e.ccy ? ' ' + e.ccy : ''}` : '';
    return `${e.domain}.${e.type}${v}`;
  });

  /* the grade — earned, not given */
  const resolved = kept + broke;
  const keepRate = resolved ? kept / resolved : null;
  const net = earned - cost;
  let score = 0;
  if (keepRate != null) score += keepRate * 60; else score += 25;      // no promises resolved = neutral
  score += net > 0 ? 25 : net === 0 ? 12 : 0;
  score += Math.min(15, didEvents.length * 3);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  const egp = (n: number) => Math.round(n).toLocaleString('en-GB');
  const ruling = resolved === 0 && didEvents.length === 0
    ? 'A week with nothing resolved and nothing moved. That is its own verdict.'
    : broke > kept
      ? `You broke more than you kept (${broke} to ${kept}). ${net >= 0 ? `The money held — ${egp(net)} EGP net.` : `And it cost you ${egp(-net)} EGP net.`}`
      : net < 0 && didEvents.length < 2
        ? `${egp(-net)} EGP out, little moved. Quiet weeks compound the wrong way.`
        : `${kept}/${resolved || 0} kept, ${egp(net)} EGP net across ${didEvents.length} real move${didEvents.length === 1 ? '' : 's'}.`;

  return { from, to: now, said, did, cost, earned, kept, broke, grade, ruling };
}

export function isSunday(now = Date.now()): boolean {
  return new Date(now).getDay() === 0;
}

/* Render the one page. */
export function verdictText(v: Verdict): string {
  const egp = (n: number) => Math.round(n).toLocaleString('en-GB');
  const d = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return [
    `THE WEEK — ${d(v.from)} to ${d(v.to)}   ·   GRADE ${v.grade}`,
    '',
    'YOU SAID',
    ...(v.said.length ? v.said.map((s) => '  ' + s) : ['  (nothing on record)']),
    '',
    'YOU DID',
    ...(v.did.length ? v.did.map((s) => '  ' + s) : ['  (nothing moved)']),
    '',
    `COST ${egp(v.cost)} EGP   ·   EARNED ${egp(v.earned)} EGP   ·   NET ${egp(v.earned - v.cost)} EGP`,
    `KEPT ${v.kept}   ·   BROKE ${v.broke}`,
    '',
    v.ruling,
  ].join('\n');
}
