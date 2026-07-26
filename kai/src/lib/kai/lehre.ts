/* ============================================================
   §38 DIE LEHRE — the teaching. Curriculum, daily lesson, retention
   test, and the compounding record.

   ── RANKING THE CURRICULUM ────────────────────────────────────
   The brief asks for skills ranked by "which, if acquired, moves the
   freedom date most". §35 refused to project a freedom date, because that
   needs an assumed growth rate — and ranking by a projected date shift
   would need the same invented number, twice over (once for the date, once
   for the counterfactual where he has the skill).

   So the ranking is by EXPOSURE, which is measurable: how much money is
   already moving through the area the skill governs. That gives the same
   ordering the brief wants for a reason that is true — revenue management
   ranks high because Makadi money is real and large, not because a model
   guessed it would save 40 days.

   Two kinds of exposure, never compared by size:
     FLOW     — EGP measurably moving through that domain
     AT RISK  — an asset or obligation with a deadline and no EGP flow

   Case 2662 has no cash flow. Under a pure flow ranking it would sort last,
   which is obviously wrong: it is land, and there is a court date. So
   AT-RISK items with a live deadline rank ABOVE all flow items, by a stated
   rule rather than by a fabricated number that makes the comparison look
   arithmetic. Property law before video editing — for the right reason.

   ── LESSONS ARE NEVER ABSTRACT ────────────────────────────────
   A lesson that cannot reach his numbers does not fall back to a general
   explanation. It says which number is missing. "Never abstract" is only
   real if the abstract version is unavailable as a fallback.

   ── THE COMPOUNDING RECORD ────────────────────────────────────
   It shows what was learned and what the money did afterwards, side by
   side, and states plainly that this is sequence and not cause. A lesson
   is not why a month earned. Claiming otherwise would be the most
   flattering lie this file could tell.
   ============================================================ */

import { getEvents, logEvent, type Domain } from './events';
import { computeRunway } from './runway';
import { makadiProfit } from './makadiProfit';
import { getPack, renderPack } from './packs';
import { read, write, emit } from './store';

const DAY = 86_400_000;

/* ── 38.1 THE CURRICULUM ──────────────────────────────────── */

export type ExposureKind = 'flow' | 'at_risk';

export interface Gap {
  id: string;
  skill: string;
  packId: string;
  kind: ExposureKind;
  /* EGP for flow gaps; null for at-risk ones, which are NOT priced. */
  exposureEgp: number | null;
  basis: string;
  live: boolean;          // is this gap actually present in his record?
}

function sum(domain: Domain, since: number, type?: string): number {
  return getEvents(type ? { domain, type, since } : { domain, since })
    .reduce((s, e) => s + (typeof e.value === 'number' ? e.value : 0), 0);
}

export function gaps(now = Date.now(), windowDays = 180): Gap[] {
  const since = now - windowDays * DAY;
  const out: Gap[] = [];

  /* Revenue management — exposure is the money Makadi actually moved. */
  const p = makadiProfit(now);
  out.push({
    id: 'revenue-management', skill: 'Revenue management — rate, occupancy and the arithmetic between them',
    packId: 'airbnb', kind: 'flow',
    exposureEgp: p.earned,
    basis: `${Math.round(p.earned).toLocaleString('en-GB')} EGP earned across ${p.nightsBooked} recorded nights`,
    live: p.earned > 0 || p.nightsBooked > 0,
  });

  /* Accounting / finance — exposure is everything moving in and out. */
  const income = sum('income', since);
  const expense = sum('expense', since);
  const flow = income + expense;
  out.push({
    id: 'finance', skill: 'Small business finance — cash flow, unit economics, when debt is right',
    packId: 'finance', kind: 'flow',
    exposureEgp: flow,
    basis: `${Math.round(income).toLocaleString('en-GB')} EGP in and ${Math.round(expense).toLocaleString('en-GB')} EGP out over ${windowDays} days`,
    live: flow > 0,
  });

  /* Trading — exposure is capital actually put at risk. */
  const traded = sum('money', since, 'trade_bought');
  out.push({
    id: 'trading', skill: 'Market trading — margin discipline and return per hour',
    packId: 'trading', kind: 'flow',
    exposureEgp: traded,
    basis: `${Math.round(traded).toLocaleString('en-GB')} EGP of capital deployed into trades`,
    live: traded > 0,
  });

  /* Content — exposure is the money attached, which for most accounts is
     zero. Ranked honestly low rather than talked up.

     Instagram `value` is usually a COUNT — `reel_posted` carries value: 1
     meaning "one post", not "one pound". Summing it as EGP reported a
     0-revenue account as having 1 EGP of exposure. Money here is counted
     only where an explicit currency says it is money. */
  const igPosts = getEvents({ domain: 'instagram', since }).length;
  const igMoney = getEvents({ domain: 'instagram', since })
    .filter((e) => e.ccy !== undefined)
    .reduce((s, e) => s + (typeof e.value === 'number' ? e.value : 0), 0);
  out.push({
    id: 'content', skill: 'Content — what performs on your account, from your numbers',
    packId: 'content', kind: 'flow',
    exposureEgp: igMoney,
    basis: igMoney > 0
      ? `${Math.round(igMoney).toLocaleString('en-GB')} EGP attributed to content`
      : `${igPosts} post${igPosts === 1 ? '' : 's'} on record and no money attributed to ${igPosts === 1 ? 'it' : 'any of them'}`,
    live: igPosts > 0,
  });

  /* Property law — AT RISK. Deliberately unpriced. */
  const legal = getEvents({}).filter((e) =>
    /2662|court|hearing|lawyer|expert/i.test(e.type + ' ' + JSON.stringify(e.meta || {})));
  const deadlines = read<Array<{ text: string; date: number }>>('kai.deadlines', [])
    .filter((d) => /2662|court|hearing|legal/i.test(d.text));
  const nextDate = deadlines.filter((d) => d.date > now).sort((a, b) => a.date - b.date)[0];
  out.push({
    id: 'property-law', skill: 'Property law — the provisions actually touching case 2662',
    packId: 'property-law', kind: 'at_risk',
    exposureEgp: null,
    basis: nextDate
      ? `land, with a date on it: "${nextDate.text}" in ${Math.ceil((nextDate.date - now) / DAY)} days`
      : legal.length
        ? `land, ${legal.length} events on the case record, no future date currently set`
        : 'land — nothing on the case in your record yet',
    live: legal.length > 0 || deadlines.length > 0,
  });

  return out;
}

/* AT-RISK with a live deadline outranks every flow gap. Below that, flow
   gaps sort by measured EGP. Nothing compares a null to a number. */
export function curriculum(now = Date.now()): Gap[] {
  const all = gaps(now).filter((g) => g.live);
  const atRisk = all.filter((g) => g.kind === 'at_risk');
  const flows = all.filter((g) => g.kind === 'flow')
    .sort((a, b) => (b.exposureEgp ?? 0) - (a.exposureEgp ?? 0));
  return [...atRisk, ...flows];
}

/* ── 38.1 THE DAILY LESSON ────────────────────────────────── */

export interface Lesson {
  id: string;
  packId: string;
  concept: string;
  minutes: number;
  applied: string | null;      // null = his numbers cannot support it yet
  missing: string | null;      // what is missing, when applied is null
  question: string;
  answer: string;              // the deterministic key for the retention test
}

/* Each lesson MUST reach his data. Where it cannot, `applied` is null and
   `missing` names the number — there is no abstract fallback by design. */
const LESSONS: Array<{
  id: string; packId: string; concept: string; minutes: number;
  question: string; answer: string;
  apply: (now: number) => { applied: string } | { missing: string };
}> = [
  {
    id: 'adr-vs-occupancy', packId: 'airbnb', minutes: 3,
    concept: 'Occupancy versus rate: revenue is rate × nights, so a higher rate at lower occupancy can beat a lower rate at higher occupancy.',
    question: 'At your recorded rate, does a 30% occupancy month at +27% rate beat a 40% month at your current rate?',
    answer: 'no',
    apply: (now) => {
      const p = makadiProfit(now);
      if (!p.nightlyEgp) return { missing: 'your nightly rate — set it and this lesson computes on your own calendar' };
      const rate = p.nightlyEgp;
      const higher = rate * 1.27;
      const a = rate * 30 * 0.40;              // 40% of a 30-day month at current rate
      const b = higher * 30 * 0.30;            // 30% at the higher rate
      return { applied:
        `On YOUR calendar: ${Math.round(rate).toLocaleString('en-GB')} EGP/night at 40% occupancy earns ${Math.round(a).toLocaleString('en-GB')} EGP a month. ` +
        `Raising to ${Math.round(higher).toLocaleString('en-GB')} and dropping to 30% earns ${Math.round(b).toLocaleString('en-GB')}. ` +
        `${b > a ? 'The higher rate wins' : 'The lower rate wins'} — by ${Math.abs(Math.round(b - a)).toLocaleString('en-GB')} EGP. ` +
        `The point is not which one; it is that occupancy alone never answers it.` };
    },
  },
  {
    id: 'fixed-vs-variable', packId: 'finance', minutes: 3,
    concept: 'Runway is set by fixed costs. Cutting one fixed line extends it further than trimming many variable ones.',
    question: 'Which extends runway more — one recurring cost removed, or ten small purchases skipped?',
    answer: 'fixed',
    apply: (now) => {
      const r = computeRunway(now);
      if (r.runwayDays === null || r.sampleCount < 8) {
        return { missing: `a burn signal — you have ${r.sampleCount} expenses logged and this needs at least 8` };
      }
      /* Cutting burn by 10% multiplies runway by 1/0.9 — it changes the
         RATE permanently. It does not add days monthly, and saying so
         would overstate it. */
      const extended = r.runwayDays / 0.9;
      return { applied:
        `Yours: ${Math.round(r.dailyBurn).toLocaleString('en-GB')} EGP/day against ${Math.round(r.liquidCash).toLocaleString('en-GB')} EGP liquid — ${Math.floor(r.runwayDays)} days. ` +
        `Remove one recurring line worth 10% of that burn and the same cash lasts ${Math.floor(extended)} days instead of ${Math.floor(r.runwayDays)} — permanently, without deciding again. ` +
        `Skipping ${Math.round(r.dailyBurn * 0.1 * 30 / 200)} small purchases saves the same money once, and you have to keep choosing it.` };
    },
  },
  {
    id: 'unit-economics', packId: 'finance', minutes: 3,
    concept: 'Until one unit makes money after ALL costs including your time, more volume makes things worse.',
    question: 'Your unit loses money after costs. Does doubling volume help?',
    answer: 'no',
    apply: (now) => {
      const p = makadiProfit(now);
      if (!p.nightsBooked) return { missing: 'booked nights — nothing to compute a per-night economics on yet' };
      const perNight = (p.earned - p.spent) / p.nightsBooked;
      return { applied:
        `Yours: ${Math.round(p.earned).toLocaleString('en-GB')} in, ${Math.round(p.spent).toLocaleString('en-GB')} out, ${p.nightsBooked} nights — ` +
        `${Math.round(perNight).toLocaleString('en-GB')} EGP per night after costs. ` +
        `${perNight > 0 ? 'Positive, so volume compounds in your favour.' : 'Negative — every extra night booked at this shape loses you money faster.'}` };
    },
  },
  {
    id: 'perishable-inventory', packId: 'airbnb', minutes: 2,
    concept: 'An empty night is worth zero and cannot be recovered, which argues for discounting late rather than early.',
    question: 'Should a rate cut come months out or close to the date?',
    answer: 'close',
    apply: (now) => {
      const b = getEvents({ domain: 'makadi', type: 'booking_confirmed' });
      if (b.length < 3) return { missing: 'a booking history — three confirmed bookings and this uses your real lead times' };
      const last = Math.max(...b.map((e) => e.ts));
      return { applied:
        `Yours: ${b.length} bookings on record, the most recent ${Math.floor((now - last) / DAY)} days ago. ` +
        `Every night between then and now that went unsold is gone — it was not banked, it expired. That is the cost of discounting early: you sell cheap the nights that would have sold anyway.` };
    },
  },
  {
    id: 'debt-when-poison', packId: 'finance', minutes: 3,
    concept: 'Debt to buy something that earns more than it costs, arriving before payment is due, is right. Debt to cover a shortfall is always wrong.',
    question: 'Debt taken to cover a gap in cash — right or poison?',
    answer: 'poison',
    apply: (now) => {
      const debt = getEvents({ domain: 'debt' }).sort((a, b) => b.ts - a.ts)[0];
      if (!debt || typeof debt.value !== 'number') return { missing: 'a card balance on record' };
      return { applied:
        `Yours: ${Math.round(debt.value).toLocaleString('en-GB')} EGP outstanding as of ${new Date(debt.ts).toISOString().slice(0, 10)}. ` +
        `The test for every future borrowing: does the thing it buys return more than the debt costs, AND does that return land before the payment is due? Both, or it is the second kind.` };
    },
  },
];

const TAUGHT_KEY = 'kai.lehre.taught';
interface Taught { id: string; at: number; tested: boolean; passed: boolean | null; testedAt: number | null }

function taught(): Taught[] { return read<Taught[]>(TAUGHT_KEY, []); }

/* The next lesson: prefer the top curriculum gap's pack, never repeat one
   already taught unless it FAILED its retention test — a failed lesson is
   re-taught, which is the brief's "retention or it re-teaches". */
export function nextLesson(now = Date.now()): Lesson | null {
  const done = taught();
  const failedIds = new Set(done.filter((d) => d.tested && d.passed === false).map((d) => d.id));
  const passedIds = new Set(done.filter((d) => d.passed === true).map((d) => d.id));
  const openIds = new Set(done.filter((d) => !d.tested).map((d) => d.id));

  const order = curriculum(now).map((g) => g.packId);
  const eligible = LESSONS.filter((l) => failedIds.has(l.id) || (!passedIds.has(l.id) && !openIds.has(l.id)));
  if (!eligible.length) return null;

  eligible.sort((a, b) => {
    const ai = order.indexOf(a.packId), bi = order.indexOf(b.packId);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  const l = eligible[0];
  const r = l.apply(now);
  return {
    id: l.id, packId: l.packId, concept: l.concept, minutes: l.minutes,
    applied: 'applied' in r ? r.applied : null,
    missing: 'missing' in r ? r.missing : null,
    question: l.question, answer: l.answer,
  };
}

export function teach(now = Date.now()): Lesson | null {
  const l = nextLesson(now);
  if (!l) return null;
  const list = taught().filter((d) => d.id !== l.id);
  list.push({ id: l.id, at: now, tested: false, passed: null, testedAt: null });
  write(TAUGHT_KEY, list); emit();
  try {
    logEvent({ domain: 'system', type: 'lesson_taught',
      meta: { id: l.id, packId: l.packId, applied: l.applied !== null }, source: 'auto', ts: now });
  } catch { /* ignore */ }
  return l;
}

export function lessonText(l: Lesson): string {
  const L = [`TODAY — ${l.minutes} minutes`, '', l.concept, ''];
  if (l.applied) {
    L.push(l.applied);
  } else {
    L.push(`I cannot apply this to you yet: missing ${l.missing}.`);
    L.push('I am not going to teach it in the abstract — an example about somebody else\'s apartment is not a lesson, it is filler.');
  }
  L.push('');
  L.push('In a week I will ask you one question about this, once.');
  return L.join('\n');
}

/* ── 38.1 THE RETENTION TEST ──────────────────────────────── */

const TEST_AFTER_DAYS = 7;

export interface Due { lessonId: string; question: string; taughtDaysAgo: number }

export function dueForTest(now = Date.now()): Due | null {
  const d = taught().find((x) => !x.tested && now - x.at >= TEST_AFTER_DAYS * DAY);
  if (!d) return null;
  const l = LESSONS.find((x) => x.id === d.id);
  if (!l) return null;
  return { lessonId: d.id, question: l.question, taughtDaysAgo: Math.floor((now - d.at) / DAY) };
}

export interface TestResult { passed: boolean; reason: string; reteach: boolean }

/* Graded deterministically against a key — no model judges retention, so
   the record of what he retained is a fact rather than an opinion. */
export function answerTest(lessonId: string, given: string, now = Date.now()): TestResult {
  const l = LESSONS.find((x) => x.id === lessonId);
  const rec = taught().find((x) => x.id === lessonId);
  if (!l || !rec) return { passed: false, reason: 'No open lesson with that id.', reteach: false };
  if (rec.tested) return { passed: false, reason: 'Already tested — asked once, by design.', reteach: false };

  const passed = new RegExp(`\\b${l.answer}\\b`, 'i').test(given.trim());
  const list = taught().map((x) => x.id === lessonId ? { ...x, tested: true, passed, testedAt: now } : x);
  write(TAUGHT_KEY, list); emit();
  try {
    logEvent({ domain: 'system', type: 'lesson_tested',
      meta: { id: lessonId, passed, daysAfter: Math.floor((now - rec.at) / DAY) }, source: 'user', ts: now });
  } catch { /* ignore */ }

  return passed
    ? { passed: true, reason: 'Retained. It goes on the record as learned.', reteach: false }
    : { passed: false, reason: `Not retained — the answer was "${l.answer}". It comes back into the queue; you will get it again.`, reteach: true };
}

/* ── 38.4 THE COMPOUNDING RECORD ──────────────────────────── */

export interface Learned {
  lessons: number;
  tested: number;
  retained: number;
  retentionPct: number | null;
  byPack: Array<{ packId: string; taught: number; retained: number }>;
  line: string;
}

export function learnedRecord(now = Date.now()): Learned {
  const done = taught();
  const tested = done.filter((d) => d.tested);
  const retained = tested.filter((d) => d.passed === true);
  const byPack = new Map<string, { taught: number; retained: number }>();
  for (const d of done) {
    const l = LESSONS.find((x) => x.id === d.id);
    if (!l) continue;
    const cur = byPack.get(l.packId) || { taught: 0, retained: 0 };
    cur.taught++;
    if (d.passed === true) cur.retained++;
    byPack.set(l.packId, cur);
  }
  const pct = tested.length ? Math.round((retained.length / tested.length) * 100) : null;
  return {
    lessons: done.length, tested: tested.length, retained: retained.length, retentionPct: pct,
    byPack: [...byPack.entries()].map(([packId, v]) => ({ packId, ...v })),
    line: pct === null
      ? `${done.length} lesson${done.length === 1 ? '' : 's'} taught, none tested yet. Retention is unknown, which is not the same as good.`
      : `${retained.length} of ${tested.length} tested concepts retained (${pct}%), across ${done.length} lessons taught.`,
  };
}

/* What was learned, and what the money did afterwards — SIDE BY SIDE, never
   as cause. A lesson is not why a month earned, and the record says so. */
export function compoundingText(now = Date.now(), windowDays = 365): string {
  const rec = learnedRecord(now);
  const since = now - windowDays * DAY;
  const L: string[] = ['THE COMPOUNDING RECORD', '', rec.line, ''];

  if (rec.byPack.length) {
    L.push('BY AREA:');
    for (const p of rec.byPack) {
      const pack = getPack(p.packId);
      L.push(`  ${pack?.title || p.packId}: ${p.retained} retained of ${p.taught} taught`);
    }
    L.push('');
  }

  const income = getEvents({ domain: 'income', since }).reduce((s, e) => s + (e.value || 0), 0);
  const makadi = makadiProfit(now);
  L.push('AND WHAT THE MONEY DID OVER THE SAME PERIOD:');
  L.push(`  ${Math.round(income).toLocaleString('en-GB')} EGP income recorded · Makadi net ${Math.round(makadi.net).toLocaleString('en-GB')} EGP`);
  L.push('');
  L.push('These two things sit next to each other because you asked to see them');
  L.push('together. They are NOT connected here, and I will not connect them:');
  L.push('nothing in the record shows that a lesson caused a pound of that money.');
  L.push('Sequence is not cause, and a tutor claiming credit for your income');
  L.push('would be the most flattering lie this system could tell you.');
  return L.join('\n');
}

export function curriculumText(now = Date.now()): string {
  const cur = curriculum(now);
  const L: string[] = ['DIE LEHRE — THE CURRICULUM', ''];
  if (!cur.length) {
    L.push('Nothing in your record yet shows where the gaps are. The curriculum is');
    L.push('built from what you actually run, so it stays empty until the Spine has');
    L.push('something to read.');
    return L.join('\n');
  }
  L.push('Ranked by what is already exposed, not by a projected freedom date —');
  L.push('that projection needs a growth rate nobody has.');
  L.push('');
  for (const [i, g] of cur.entries()) {
    L.push(`${i + 1}. ${g.skill}`);
    L.push(`   ${g.kind === 'at_risk' ? 'AT RISK' : 'exposure'}: ${g.basis}`);
    if (g.kind === 'at_risk') {
      L.push('   Ranked above everything with a number on it. There is no cash flow to');
      L.push('   measure here, so it is not being compared by size — it is land with a');
      L.push('   date, and that outranks arithmetic.');
    }
    const notes = renderPack(g.packId, now);
    L.push(`   pack: ${getPack(g.packId)?.title} (${notes.length} note${notes.length === 1 ? '' : 's'})`);
    L.push('');
  }
  return L.join('\n');
}
