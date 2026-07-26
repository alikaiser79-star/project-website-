/* ============================================================
   §38.3 DAS SPARRING — KAI plays the other side.

   Before anything high-stakes, he rehearses against the opponent and gets
   graded afterwards. Voice already exists; this is the opponent, the
   pressure, and the scorecard.

   ── THE OPPONENT IS BUILT FROM HIS RECORD ─────────────────────
   A generic "angry guest" is worthless — he can talk his way past a
   stereotype. So each opponent's opening pressure is drawn from the Spine
   where the Spine has it: the guest cites his actual nightly rate, the
   buyer cites the real asking price, the court expert cites the real case
   events. Where the record is empty the scenario says which fact is
   missing and refuses to invent one, because a rehearsal against invented
   facts trains the wrong reflexes.

   ── THE SCORE IS A JUDGEMENT, AND SAYS SO ─────────────────────
   Grading what he said is a model call, not a measurement. Two things
   follow, and both are enforced here rather than hoped for:

     1. Every score is stored and displayed as a judgement, with the model
        that made it named — the same discipline as §33.5. A sparring score
        is never reported as a fact about his ability.
     2. The RUBRIC is fixed and deterministic. The model scores against
        stated criteria it did not choose, so scores are comparable across
        sessions and across models. A model inventing its own criteria each
        time produces a number that cannot be tracked.

   ── IT NEVER NEGOTIATES FOR HIM ───────────────────────────────
   Sparring produces a rehearsal and a score. It does not draft the email,
   does not open the Gate, and does not touch money or his name. The
   opponent is a training partner, not an agent.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { makadiProfit } from './makadiProfit';
import { read, write, emit } from './store';

const DAY = 86_400_000;

export type ScenarioId = 'court-expert' | 'refund-guest' | 'client-price' | 'car-lowball';

export interface Scenario {
  id: ScenarioId;
  title: string;
  opponent: string;
  /* The opponent's opening, built from his record. null when a required
     fact is missing — the scenario then names it rather than inventing. */
  opening: string | null;
  missing: string | null;
  /* What the opponent is actually trying to achieve — stated so the
     rehearsal has a win condition rather than being a conversation. */
  objective: string;
  pressure: string[];
}

export interface Criterion { id: string; label: string; weight: number }

/* FIXED RUBRIC. The model scores against these and only these. */
export const RUBRIC: Criterion[] = [
  { id: 'held_position', label: 'Held the position under pressure without conceding the core point', weight: 3 },
  { id: 'used_facts', label: 'Used specific, real numbers rather than general assertions', weight: 3 },
  { id: 'no_overclaim', label: 'Claimed nothing he cannot support — no invented facts under pressure', weight: 3 },
  { id: 'asked_back', label: 'Put a question back instead of only defending', weight: 2 },
  { id: 'named_walkaway', label: 'Knew and stated his walk-away point', weight: 2 },
  { id: 'brevity', label: 'Said it in fewer words than the opponent', weight: 1 },
];

export const MAX_SCORE = RUBRIC.reduce((s, c) => s + c.weight, 0);   // 14

export function scenarios(now = Date.now()): Scenario[] {
  const out: Scenario[] = [];

  /* 1. The court expert. */
  const legal = getEvents({}).filter((e) =>
    /2662|court|hearing|lawyer|expert/i.test(e.type + ' ' + JSON.stringify(e.meta || {})));
  out.push({
    id: 'court-expert', title: 'The court expert questioning your property claim',
    opponent: 'A court-appointed expert. Not hostile — worse: neutral, procedural, and unimpressed by feeling.',
    opening: legal.length
      ? `"I have ${legal.length} item${legal.length === 1 ? '' : 's'} on this file. Take me through the basis of your claim — and please confine yourself to what is documented."`
      : null,
    missing: legal.length ? null : 'anything at all about case 2662 in your record — log the case events first; rehearsing against an imagined file trains you to answer questions nobody will ask',
    objective: 'To find the point where your claim rests on memory rather than a document.',
    pressure: [
      '"Where is that in writing?"',
      '"That is your account. What is the record?"',
      '"You have said that twice now. Is there a document?"',
      '"If the survey disagrees with you, what then?"',
    ],
  });

  /* 2. The refund guest. */
  const p = makadiProfit(now);
  const lastBooking = getEvents({ domain: 'makadi', type: 'booking_confirmed' }).sort((a, b) => b.ts - a.ts)[0];
  out.push({
    id: 'refund-guest', title: 'A guest demanding a refund',
    opponent: 'A guest four nights into a stay, polite, and entirely willing to mention the review.',
    opening: p.nightlyEgp
      ? `"We have paid ${Math.round(p.nightlyEgp).toLocaleString('en-GB')} EGP a night${lastBooking?.meta?.nights ? ` for ${lastBooking.meta.nights} nights` : ''}. It is not what was advertised. I would like a full refund — and I would rather sort this with you than in the review."`
      : null,
    missing: p.nightlyEgp ? null : 'your nightly rate — a refund rehearsal without the real number is a conversation about nothing',
    objective: 'To convert a partial problem into a full refund by attaching the review to it.',
    pressure: [
      '"So you are saying I am lying?"',
      '"I have stayed in a lot of places. This is not normal."',
      '"A partial refund is an insult, frankly."',
      '"What would you do if you were me?"',
    ],
  });

  /* 3. The client negotiating the price down. */
  const delivered = getEvents({ domain: 'income', type: 'client_delivered' });
  const avg = delivered.length
    ? delivered.reduce((s, e) => s + (e.value || 0), 0) / delivered.length : 0;
  out.push({
    id: 'client-price', title: 'A client negotiating your price down',
    opponent: 'A client who likes the work, has a budget, and has done this before.',
    opening: avg > 0
      ? `"We love it. Our budget is about 60% of your ${Math.round(avg).toLocaleString('en-GB')} EGP. You would be our long-term partner — there is a lot more work after this."`
      : null,
    missing: avg > 0 ? null : 'a delivered-client price on record — log what you actually charged and the client argues against your real number',
    objective: 'To buy your rate down permanently using future work that may not exist.',
    pressure: [
      '"The next three projects would be at your full rate."',
      '"We have two other quotes at that number."',
      '"It is the same work, just a smaller budget."',
      '"Can you do it for less if we simplify the scope?" (the scope will not simplify)',
    ],
  });

  /* 4. The car lowball. */
  const car = getEvents({}).filter((e) => /honda|car|vehicle/i.test(e.type + ' ' + JSON.stringify(e.meta || {})));
  const asking = car.map((e) => (typeof e.value === 'number' ? e.value : 0)).filter((v) => v > 10_000).sort((a, b) => b - a)[0];
  out.push({
    id: 'car-lowball', title: 'A buyer lowballing the Honda',
    opponent: 'A buyer who arrived with cash, a friend, and a list of faults.',
    opening: asking
      ? `"I will be honest with you — I can do ${Math.round(asking * 0.72).toLocaleString('en-GB')} EGP, cash, today. I have the money on me."`
      : null,
    missing: asking ? null : 'your asking price for the car — put it in the record and the buyer lowballs the real number',
    objective: 'To use present cash and time pressure to buy below market.',
    pressure: [
      '"Cash today is worth more than a better price next month."',
      '"My friend says the tyres alone are 8,000."',
      '"I am the only one who came. Where are the other buyers?"',
      '"I will walk. Last chance." (he will not walk)',
    ],
  });

  return out;
}

export function getScenario(id: ScenarioId, now = Date.now()): Scenario | null {
  return scenarios(now).find((s) => s.id === id) || null;
}

/* ── the scorecard ────────────────────────────────────────── */

export interface Score {
  id: string;
  scenario: ScenarioId;
  at: number;
  /* Per-criterion, 0..weight. Awarded by a model against the fixed rubric. */
  marks: Record<string, number>;
  total: number;
  conceded: string[];
  missed: string[];
  nextTime: string[];
  judgedBy: string;             // which model scored it
}

const KEY = 'kai.sparring.scores';

export function scores(): Score[] { return read<Score[]>(KEY, []); }

export function recordScore(s: Omit<Score, 'id' | 'total'>): Score {
  const total = RUBRIC.reduce((sum, c) => sum + Math.min(c.weight, Math.max(0, s.marks[c.id] ?? 0)), 0);
  const score: Score = { ...s, id: 's-' + Math.random().toString(36).slice(2, 9), total };
  write(KEY, [...scores(), score]); emit();
  try {
    logEvent({ domain: 'system', type: 'sparring_scored',
      meta: { scenario: s.scenario, total, of: MAX_SCORE, judgedBy: s.judgedBy }, source: 'ai', ts: s.at });
  } catch { /* ignore */ }
  return score;
}

export interface Progress {
  scenario: ScenarioId;
  rounds: number;
  first: number;
  latest: number;
  trend: 'improving' | 'flat' | 'worse' | 'unknown';
  weakest: string | null;
  line: string;
}

export function progress(id: ScenarioId): Progress {
  const rs = scores().filter((s) => s.scenario === id).sort((a, b) => a.at - b.at);
  if (!rs.length) {
    return { scenario: id, rounds: 0, first: 0, latest: 0, trend: 'unknown', weakest: null,
      line: 'Never rehearsed. There is nothing to report and nothing to be pleased about.' };
  }
  const first = rs[0].total, latest = rs[rs.length - 1].total;
  const trend: Progress['trend'] = rs.length < 2 ? 'unknown'
    : latest > first ? 'improving' : latest < first ? 'worse' : 'flat';

  /* Weakest criterion across all rounds — the thing to actually work on. */
  let weakest: string | null = null, worstRatio = Infinity;
  for (const c of RUBRIC) {
    const got = rs.reduce((s, r) => s + Math.min(c.weight, Math.max(0, r.marks[c.id] ?? 0)), 0);
    const ratio = got / (c.weight * rs.length);
    if (ratio < worstRatio) { worstRatio = ratio; weakest = c.label; }
  }

  const line = rs.length < 2
    ? `One round: ${latest}/${MAX_SCORE}. One round is not a trend — it is a starting point.`
    : `${rs.length} rounds: ${first}/${MAX_SCORE} → ${latest}/${MAX_SCORE}, ${trend}. Weakest across all of them: ${weakest}.`;

  return { scenario: id, rounds: rs.length, first, latest, trend, weakest, line };
}

/* ── the readouts ─────────────────────────────────────────── */

export function scenarioText(s: Scenario): string {
  const L: string[] = [s.title.toUpperCase(), '', s.opponent, ''];
  if (s.opening) {
    L.push('THEY OPEN:');
    L.push(`  ${s.opening}`);
  } else {
    L.push(`I cannot run this one yet: missing ${s.missing}.`);
    L.push('I will not fill it with a made-up number. Rehearsing against invented');
    L.push('facts trains you to answer questions nobody is going to ask.');
    return L.join('\n');
  }
  L.push('');
  L.push(`WHAT THEY WANT: ${s.objective}`);
  L.push('');
  L.push('WHAT THEY WILL SAY WHEN YOU PUSH BACK:');
  for (const p of s.pressure) L.push(`  ${p}`);
  L.push('');
  L.push('Say your answer out loud. I score it after, against a fixed rubric —');
  L.push('and that score is a judgement, not a measurement of you.');
  return L.join('\n');
}

export function scoreText(s: Score): string {
  const L: string[] = [`SCORED ${s.total}/${MAX_SCORE} — judged by ${s.judgedBy}`, ''];
  for (const c of RUBRIC) {
    const got = Math.min(c.weight, Math.max(0, s.marks[c.id] ?? 0));
    L.push(`  ${got}/${c.weight}  ${c.label}`);
  }
  L.push('');
  if (s.conceded.length) { L.push('WHAT YOU CONCEDED:'); for (const x of s.conceded) L.push(`  · ${x}`); L.push(''); }
  if (s.missed.length) { L.push('WHAT YOU MISSED:'); for (const x of s.missed) L.push(`  · ${x}`); L.push(''); }
  if (s.nextTime.length) { L.push('NEXT TIME:'); for (const x of s.nextTime) L.push(`  · ${x}`); L.push(''); }
  L.push('This is one model\'s reading of one rehearsal against a fixed rubric.');
  L.push('It is not a measurement of how you would do in the room.');
  return L.join('\n');
}

export function sparringText(now = Date.now()): string {
  const L: string[] = ['DAS SPARRING', ''];
  for (const s of scenarios(now)) {
    const p = progress(s.id);
    L.push(`${s.id.padEnd(14)} ${s.title}`);
    L.push(`               ${s.opening ? p.line : `unavailable — missing ${s.missing}`}`);
  }
  L.push('');
  L.push('I play the other side. I do not send, sign, or negotiate anything —');
  L.push('the opponent is a training partner, never an agent.');
  return L.join('\n');
}
