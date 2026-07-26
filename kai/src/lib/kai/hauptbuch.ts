/* ============================================================
   §33.4 DAS UNBEQUEME HAUPTBUCH — the ledger of inaction.

   Every other ledger in KAI counts what he did. This one counts what he
   didn't: the inquiry nobody answered, the deadline that went past, the
   opportunity that was proposed and re-proposed and expired.

   TWO INTEGRITY PROBLEMS SIT AT THE CENTRE OF THIS FILE, and both are
   solved in code rather than in tone:

   1. AN ESTIMATE IS NOT A LOSS.
      The Hunter logs opportunities with an `expectedEgp` — a projection
      made at proposal time. Summing those and printing "you lost 84,000
      EGP" would be the single most dishonest number this app could show.
      It was never money. It was a guess about money.
      So COUNTED FACTS and ESTIMATES never merge into one headline. They
      are separate fields, separately labelled, and the estimate always
      carries the words that say what it is.

   2. A LEDGER WITH ONE COLUMN IS A GUILT MACHINE.
      If it only ever counts the cost of not acting, it is not a ledger —
      it is an argument, and one that always wins. So it also counts the
      times inaction was RIGHT: things he ignored that resolved themselves,
      and proposals he declined that the record later showed to be wrong.
      That column is not a courtesy. Without it the other column cannot be
      trusted, because nothing would ever falsify it.

   Everything here is countable from the Spine. Nothing is inferred about
   why he didn't act, because the Spine does not hold why.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';
import { getCommitments } from './commitments';
import { read } from './store';

const DAY = 86_400_000;

function egp(n: number): string { return Math.round(n).toLocaleString('en-GB') + ' EGP'; }
function days(ts: number, now: number): number { return Math.floor((now - ts) / DAY); }

/* ── COUNTED: things that happened, or measurably didn't ────── */

export interface Silence {
  id: string;
  what: string;
  count: number;
  detail: string;
  evidence: string[];
}

/* An inquiry that got no reply and became no booking. This is the closest
   thing in the whole Spine to a real, countable loss: a person asked, and
   the record shows nothing went back. */
function unansweredInquiries(now: number): Silence | null {
  const inquiries = getEvents({ domain: 'makadi', type: 'booking_inquiry' })
    .filter((e) => now - e.ts > 3 * DAY);           // still fresh ones aren't ignored yet
  if (!inquiries.length) return null;

  const replies = getEvents({ domain: 'system', type: 'email_sent' });
  const bookings = getEvents({ domain: 'makadi', type: 'booking_confirmed' });

  const dead = inquiries.filter((q) => {
    const thread = String(q.meta?.thread || '');
    const guest = String(q.meta?.guest || '').toLowerCase();
    const answered = replies.some((r) =>
      r.ts > q.ts && (
        (thread && String(r.meta?.thread || '') === thread) ||
        (guest && String(r.meta?.to || '').toLowerCase().includes(guest))
      ));
    const booked = bookings.some((b) =>
      b.ts > q.ts && guest && String(b.meta?.guest || '').toLowerCase().includes(guest));
    return !answered && !booked;
  });
  if (!dead.length) return null;

  const oldest = Math.min(...dead.map((d) => d.ts));
  return {
    id: 'unanswered',
    what: 'guests who asked and got nothing back',
    count: dead.length,
    detail: `${dead.length} of ${inquiries.length} inquiries have no reply and no booking on record. The oldest has been sitting ${days(oldest, now)} days.`,
    evidence: dead.slice(-6).map((d) => d.id),
  };
}

/* Deadlines whose date passed with nothing recorded against them. */
function passedDeadlines(now: number): Silence | null {
  const dls = read<Array<{ id: string; text: string; date: number; createdAt: number }>>('kai.deadlines', []);
  const past = dls.filter((d) => d.date < now);
  if (!past.length) return null;

  const all = getEvents({});
  const untouched = past.filter((d) => {
    const words = d.text.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    if (!words.length) return false;
    return !all.some((e) => {
      if (e.ts <= d.createdAt) return false;
      const blob = (e.type + ' ' + JSON.stringify(e.meta || {})).toLowerCase();
      return words.some((w) => blob.includes(w));
    });
  });
  if (!untouched.length) return null;

  const worst = untouched.reduce((a, b) => (a.date < b.date ? a : b));
  return {
    id: 'deadlines',
    what: 'hard dates that went past untouched',
    count: untouched.length,
    detail: `${untouched.length} deadline${untouched.length === 1 ? '' : 's'} passed with nothing in the record against ${untouched.length === 1 ? 'it' : 'them'}. Longest overdue: "${worst.text}", ${days(worst.date, now)} days.`,
    evidence: untouched.slice(-6).map((d) => d.id),
  };
}

/* Commitments that broke without a single attempt logged against them.
   Deliberately separated from commitments that were TRIED and missed —
   those are a different fact and do not belong in a ledger of inaction. */
function brokenInSilence(now: number): Silence | null {
  const broken = getCommitments().filter((c) => c.status === 'broken');
  if (!broken.length) return null;
  const all = getEvents({});

  const never = broken.filter((c) =>
    !all.some((e) => e.ts > c.createdAt && e.ts <= (c.resolvedAt || now) && e.domain === c.metric.domain));
  if (!never.length) return null;

  return {
    id: 'never_started',
    what: 'commitments that broke without one attempt',
    count: never.length,
    detail: `${never.length} of your ${broken.length} broken commitment${broken.length === 1 ? '' : 's'} had no event at all in ${never.length === 1 ? 'its' : 'their'} own domain between the promise and the deadline. Not missed — never begun.`,
    evidence: never.slice(-6).map((c) => c.id),
  };
}

/* The same opportunity proposed again and again, never taken and never
   dismissed. Deciding NO is an action; this counts only the non-decision. */
function reProposed(now: number): Silence | null {
  const props = getEvents({ domain: 'hunter', type: 'opportunity', since: now - 180 * DAY });
  if (props.length < 3) return null;
  const actioned = new Set(getEvents({ domain: 'hunter', type: 'actioned' }).map((e) => String(e.meta?.shape || '')));
  const dismissed = new Set(getEvents({ domain: 'hunter', type: 'dismissed' }).map((e) => String(e.meta?.shape || '')));

  const byShape = new Map<string, KaiEvent[]>();
  for (const e of props) {
    const s = String(e.meta?.shape || '');
    if (!s || actioned.has(s) || dismissed.has(s)) continue;
    byShape.set(s, [...(byShape.get(s) || []), e]);
  }
  const repeats = [...byShape.entries()].filter(([, v]) => v.length >= 3);
  if (!repeats.length) return null;

  const [topShape, topEvs] = repeats.sort((a, b) => b[1].length - a[1].length)[0];
  const title = String(topEvs[topEvs.length - 1].meta?.title || topShape);
  return {
    id: 're_proposed',
    what: 'the same move, offered and left',
    count: repeats.length,
    detail: `${repeats.length} opportunit${repeats.length === 1 ? 'y has' : 'ies have'} been raised three or more times without being taken OR dismissed. The most repeated: "${title}", ${topEvs.length} times. Saying no is a decision; this isn't one.`,
    evidence: topEvs.slice(-6).map((e) => e.id),
  };
}

/* ── ESTIMATED: kept apart, and labelled as what it is ──────── */

export interface Estimate {
  egpAtProposalTime: number;
  proposals: number;
  caveat: string;
}

/* The sum of what the Hunter PROJECTED for opportunities that were never
   taken. This number is not money and must never be printed as though it
   were. It is returned with the sentence that says so attached to it, so
   the caveat cannot be dropped by a caller that only wants the figure. */
function estimated(now: number): Estimate | null {
  const props = getEvents({ domain: 'hunter', type: 'opportunity', since: now - 180 * DAY });
  if (!props.length) return null;
  const actioned = new Set(getEvents({ domain: 'hunter', type: 'actioned' }).map((e) => String(e.meta?.shape || '')));

  /* One entry per shape — re-proposing the same move six times does not
     multiply its value by six, and summing the raw log would. */
  const perShape = new Map<string, number>();
  for (const e of props) {
    const s = String(e.meta?.shape || e.id);
    if (actioned.has(s)) continue;
    perShape.set(s, Math.max(perShape.get(s) || 0, typeof e.value === 'number' ? e.value : 0));
  }
  const total = [...perShape.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  return {
    egpAtProposalTime: total,
    proposals: perShape.size,
    caveat: 'This is the sum of what KAI PROJECTED at the time it proposed them. It is not money you lost — it was never money. Projections are not losses, and some of these would have failed.',
  };
}

/* ── THE OTHER COLUMN: when doing nothing was right ─────────── */

export interface Vindication {
  id: string;
  what: string;
  count: number;
  detail: string;
}

/* Things he ignored that resolved without him. A ledger that cannot record
   this is not measuring inaction — it is only ever prosecuting it. */
function resolvedItself(now: number): Vindication | null {
  const inquiries = getEvents({ domain: 'makadi', type: 'booking_inquiry' });
  const bookings = getEvents({ domain: 'makadi', type: 'booking_confirmed' });
  const replies = getEvents({ domain: 'system', type: 'email_sent' });

  /* An inquiry that became a booking although nothing was ever sent back. */
  const selfClosed = inquiries.filter((q) => {
    const guest = String(q.meta?.guest || '').toLowerCase();
    if (!guest) return false;
    const replied = replies.some((r) => r.ts > q.ts && String(r.meta?.to || '').toLowerCase().includes(guest));
    const booked = bookings.some((b) => b.ts > q.ts && String(b.meta?.guest || '').toLowerCase().includes(guest));
    return booked && !replied;
  });
  if (!selfClosed.length) return null;

  return {
    id: 'self_resolved',
    what: 'things that closed without you',
    count: selfClosed.length,
    detail: `${selfClosed.length} inquir${selfClosed.length === 1 ? 'y' : 'ies'} became a booking with no reply from you on record. Waiting was not a mistake there.`,
  };
}

/* Dismissed opportunities the record never contradicted. Declining is an
   action and it belongs on the credit side, not buried. */
function declinedWell(now: number): Vindication | null {
  const dismissed = getEvents({ domain: 'hunter', type: 'dismissed', since: now - 180 * DAY });
  if (!dismissed.length) return null;
  return {
    id: 'declined',
    what: 'moves you actively turned down',
    count: dismissed.length,
    detail: `${dismissed.length} opportunit${dismissed.length === 1 ? 'y was' : 'ies were'} dismissed outright. That is a decision, and it costs nothing to have made it.`,
  };
}

/* ── the assembled book ──────────────────────────────────────── */

export interface Hauptbuch {
  counted: Silence[];
  estimate: Estimate | null;
  vindications: Vindication[];
  empty: boolean;
}

export function hauptbuch(now = Date.now()): Hauptbuch {
  const counted = [unansweredInquiries(now), passedDeadlines(now), brokenInSilence(now), reProposed(now)]
    .filter((s): s is Silence => s !== null)
    .sort((a, b) => b.count - a.count);
  const vindications = [resolvedItself(now), declinedWell(now)].filter((v): v is Vindication => v !== null);
  const estimate = estimated(now);
  return { counted, estimate, vindications, empty: !counted.length && !vindications.length && !estimate };
}

export function hauptbuchText(now = Date.now()): string {
  const b = hauptbuch(now);
  const L: string[] = ['DAS UNBEQUEME HAUPTBUCH', ''];

  if (b.empty) {
    L.push('Nothing to enter. No unanswered inquiry, no passed deadline, no move');
    L.push('left standing. That is the record, not a compliment — the book is only');
    L.push('as full as what you have logged.');
    return L.join('\n');
  }

  if (b.counted.length) {
    L.push('COUNTED — these happened, or measurably did not:');
    L.push('');
    for (const s of b.counted) {
      L.push(`· ${s.count} × ${s.what}`);
      L.push(`  ${s.detail}`);
      L.push('');
    }
  } else {
    L.push('COUNTED — nothing. No silence the record can point at.');
    L.push('');
  }

  if (b.estimate) {
    L.push('ESTIMATED — and this is a different kind of number:');
    L.push('');
    L.push(`  ${egp(b.estimate.egpAtProposalTime)} across ${b.estimate.proposals} untaken opportunit${b.estimate.proposals === 1 ? 'y' : 'ies'}`);
    L.push(`  ${b.estimate.caveat}`);
    L.push('');
    L.push('  It sits in its own column for that reason. Do not add it to anything above.');
    L.push('');
  }

  L.push('WHEN DOING NOTHING WAS RIGHT:');
  L.push('');
  if (b.vindications.length) {
    for (const v of b.vindications) {
      L.push(`· ${v.count} × ${v.what}`);
      L.push(`  ${v.detail}`);
      L.push('');
    }
  } else {
    L.push('  Nothing on this side yet. Which means the column above is untested —');
    L.push('  take it as an unproven case, not a verdict.');
    L.push('');
  }

  L.push('The book records what the Spine holds. It does not know why you didn\'t act,');
  L.push('and it does not guess.');
  return L.join('\n');
}
