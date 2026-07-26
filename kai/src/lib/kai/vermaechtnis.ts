/* ============================================================
   §37 DAS VERMÄCHTNIS — the bequest.

   What a previous mind learned about Ali that the Spine cannot derive from
   events. Testimony, not measurement — and the difference is enforced here
   rather than trusted to tone.

   THREE RULES, in code:

     1. EVERY CITATION CARRIES ITS MARKING. `cite()` cannot return a claim
        without "[OBSERVED — external counsel, July 2026]" attached. There
        is no code path that emits one of these as a plain fact.

     2. THE SPINE OUTRANKS THE TESTIMONY. Where a claim is falsifiable, its
        test runs live against the record. The moment the record contradicts
        it, the entry RETIRES: it stops being cited, and the retirement is
        logged so the ledger shows what was believed and what disproved it.

     3. WHAT CANNOT BE TESTED IS NEVER PROMOTED. An entry with no honest test
        is marked context. It can never be corroborated and can never be
        retired — it is held exactly as given. Faking a test so that every
        entry has one would produce numbers that look like evidence and
        aren't, which is the failure this whole file guards against.

   A corroborated entry STILL carries the marking. A guess the Spine later
   agreed with is a guess that turned out right, not a measurement.

   The prose lives in docs/KAI_KAISER_PROFILE.md. This file is the part that
   can be wrong out loud.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { getCommitments, type Commitment } from './commitments';
import { isSpecific } from './twin';

const DAY = 86_400_000;

export const MARK = '[OBSERVED — external counsel, July 2026]';
export const CONTEXT_MARK = '[CONTEXT — external counsel, July 2026; not falsifiable]';

export type Kind = 'pattern' | 'rule' | 'why';
export type Status = 'observed' | 'corroborated' | 'retired' | 'context';

export interface Check {
  verdict: 'agrees' | 'contradicts' | 'insufficient';
  detail: string;
  n: number;
}

export interface Entry {
  id: string;
  kind: Kind;
  claim: string;
  /* null = no honest test exists. The REASON is carried, so "untested"
     never gets mistaken for "unimportant" or quietly filled in later. */
  test: ((now: number) => Check) | null;
  untestableBecause: string | null;
}

/* ── the tests ────────────────────────────────────────────────
   Each returns 'insufficient' rather than a verdict when the record is too
   thin. A pattern is not disproved by an empty Spine. */

const MIN_SIDE = 3;

/* RETIREMENT IS ASYMMETRIC, DELIBERATELY.

   Agreeing with testimony on thin evidence is mildly wrong. RETIRING it on
   thin evidence throws away what a previous mind spent months learning, and
   throws it away permanently as far as the Twin is concerned — a retired
   entry is never cited again.

   So a contradiction needs a real record behind it. Below this floor the
   verdict is downgraded to 'insufficient' and the entry survives, while the
   text still reports that the record is leaning against it. Losing knowledge
   is the expensive error here; carrying a questionable line for another month
   is the cheap one. */
const RETIRE_FLOOR = 10;

function guard(c: Check): Check {
  if (c.verdict !== 'contradicts' || c.n >= RETIRE_FLOOR) return c;
  return {
    verdict: 'insufficient', n: c.n,
    detail: `your record is currently leaning AGAINST this — ${c.detail} — but ${c.n} is too thin to overturn testimony, so it stands until there are at least ${RETIRE_FLOOR}`,
  };
}

/* P1 / R5 — dated commitments land, undated ones don't. */
function datedVsVague(now: number): Check {
  const resolved = getCommitments().filter((c) => c.status === 'kept' || c.status === 'broken');
  const dated = resolved.filter(isSpecific);
  const vague = resolved.filter((c) => !isSpecific(c));
  if (dated.length < MIN_SIDE || vague.length < MIN_SIDE) {
    return { verdict: 'insufficient', n: resolved.length,
      detail: `only ${dated.length} dated and ${vague.length} undated commitments resolved — too few on one side to test this` };
  }
  const keptPct = (l: Commitment[]) => l.filter((c) => c.status === 'kept').length / l.length;
  const d = keptPct(dated), v = keptPct(vague);
  return d > v
    ? { verdict: 'agrees', n: resolved.length, detail: `dated ${Math.round(d * 100)}% kept vs undated ${Math.round(v * 100)}% across ${resolved.length} resolved` }
    : { verdict: 'contradicts', n: resolved.length, detail: `undated commitments land as often as dated ones (${Math.round(v * 100)}% vs ${Math.round(d * 100)}% across ${resolved.length} resolved) — the rule does not hold on this record` };
}

/* P3 — new work starts while something else is already overdue. */
function newWorkWhileOverdue(now: number): Check {
  const all = getCommitments();
  if (all.length < 5) return { verdict: 'insufficient', n: all.length, detail: `${all.length} commitments on record — too few to test` };
  let whileOverdue = 0;
  for (const c of all) {
    const overdueThen = all.some((o) =>
      o.id !== c.id && o.deadline < c.createdAt && (o.resolvedAt == null || o.resolvedAt > c.createdAt));
    if (overdueThen) whileOverdue++;
  }
  const share = whileOverdue / all.length;
  return share >= 0.4
    ? { verdict: 'agrees', n: all.length, detail: `${whileOverdue} of ${all.length} commitments were opened while another was already past its deadline` }
    : { verdict: 'contradicts', n: all.length, detail: `only ${whileOverdue} of ${all.length} commitments were opened while something else was overdue — new work is mostly started from a clean slate` };
}

/* P4 — "almost": broken things were STARTED, not skipped. */
function almostNotAbsent(now: number): Check {
  const broken = getCommitments().filter((c) => c.status === 'broken');
  if (broken.length < 4) return { verdict: 'insufficient', n: broken.length, detail: `${broken.length} broken commitments — too few to test` };
  const all = getEvents({});
  const started = broken.filter((c) =>
    all.some((e) => e.ts > c.createdAt && e.ts <= (c.resolvedAt || now) && e.domain === c.metric.domain));
  const share = started.length / broken.length;
  return share >= 0.5
    ? { verdict: 'agrees', n: broken.length, detail: `${started.length} of ${broken.length} broken commitments had real activity before they died — begun, not skipped` }
    : { verdict: 'contradicts', n: broken.length, detail: `${broken.length - started.length} of ${broken.length} broken commitments had NO attempt at all — the failure mode here is "never begun", not "almost"` };
}

/* P5 — new cathedrals cluster after a win. */
function isWin(domain: string, type: string): boolean {
  return (domain === 'money' && type === 'milestone')
    || (domain === 'makadi' && type === 'booking_confirmed')
    || (domain === 'commitment' && type === 'commitment_kept');
}

function cathedralsAfterWins(now: number): Check {
  const all = getCommitments();
  const wins = getEvents({}).filter((e) => isWin(e.domain, e.type));
  if (all.length < 5 || wins.length < 3) {
    return { verdict: 'insufficient', n: wins.length, detail: `${all.length} commitments and ${wins.length} wins on record — too few to test` };
  }
  const afterWin = all.filter((c) => wins.some((w) => c.createdAt > w.ts && c.createdAt <= w.ts + 7 * DAY)).length;

  /* The honest comparison is against how much of the whole span sits inside
     a post-win window at all. Clustering means MORE than that baseline —
     without it, a man who wins constantly would look like he only ever
     starts things after winning. */
  const first = Math.min(...all.map((c) => c.createdAt), ...wins.map((w) => w.ts));
  const spanDays = Math.max(1, (now - first) / DAY);
  const windowDays = new Set(
    wins.flatMap((w) => Array.from({ length: 7 }, (_, i) => Math.floor((w.ts + i * DAY) / DAY))),
  ).size;
  const baseline = Math.min(1, windowDays / spanDays);
  const observed = afterWin / all.length;

  return observed > baseline
    ? { verdict: 'agrees', n: all.length, detail: `${afterWin} of ${all.length} commitments began within 7 days of a win — ${Math.round(observed * 100)}% against a ${Math.round(baseline * 100)}% baseline` }
    : { verdict: 'contradicts', n: all.length, detail: `post-win weeks are ${Math.round(baseline * 100)}% of the record and hold ${Math.round(observed * 100)}% of new commitments — no clustering` };
}

/* ── the bequest ──────────────────────────────────────────── */

export const ENTRIES: Entry[] = [
  { id: 'P1', kind: 'pattern', test: datedVsVague, untestableBecause: null,
    claim: 'He keeps commitments with dates and breaks ones without. Every time.' },

  { id: 'P2', kind: 'pattern', test: null,
    untestableBecause: 'the Spine records what he did, not who was watching. A proxy — treating KAI-proposed commitments as "witnessed" — would look like evidence and would not be.',
    claim: 'He finishes under witness and drifts alone. The Mirror exists because of this.' },

  { id: 'P3', kind: 'pattern', test: newWorkWhileOverdue, untestableBecause: null,
    claim: 'When a deadline gets uncomfortable, he asks for a new feature. Naming it out loud stops it within one message, every time.' },

  { id: 'P4', kind: 'pattern', test: almostNotAbsent, untestableBecause: null,
    claim: 'His failure mode is "almost" — ten things at 80%, not one at 0%.' },

  { id: 'P5', kind: 'pattern', test: cathedralsAfterWins, untestableBecause: null,
    claim: 'After shipping he goes flat, and the flatness is when he starts new cathedrals. Post-win is his most dangerous hour.' },

  { id: 'P6', kind: 'pattern', test: null,
    untestableBecause: 'no honest measure exists yet of how fast he corrects himself, so there is nothing to compare his corrections of a machine against.',
    claim: 'He corrects an AI faster than he corrects himself, and he is usually right when he does.' },

  { id: 'P7', kind: 'pattern', test: null,
    untestableBecause: 'this is a disposition, not an event pattern.',
    claim: 'He trusts actions over words, applied to himself hardest of all.' },

  { id: 'R1', kind: 'rule', test: null, untestableBecause: 'an instruction to KAI, not a prediction about the world.',
    claim: 'Hit first, soften after. He trusts the hit.' },
  { id: 'R2', kind: 'rule', test: null, untestableBecause: 'an instruction to KAI, not a prediction about the world.',
    claim: 'Never praise what has not shipped.' },
  { id: 'R3', kind: 'rule', test: null, untestableBecause: 'an instruction to KAI, not a prediction about the world.',
    claim: 'Refuse the new thing while the old thing is broken — he thanks you for it afterward, every time.' },
  { id: 'R4', kind: 'rule', test: null, untestableBecause: 'an instruction to KAI, not a prediction about the world.',
    claim: 'One question at a time. Three options maximum.' },
  { id: 'R5', kind: 'rule', test: datedVsVague, untestableBecause: null,
    claim: 'Put a date on everything or it will not happen.' },

  { id: 'W1', kind: 'why', test: null, untestableBecause: 'a reason, not an event.',
    claim: 'The heart is blood-and-gold because he rejected a teal one twice.' },
  { id: 'W2', kind: 'why', test: null, untestableBecause: 'a reason, not an event.',
    claim: 'KAI is named from a night he chose the name himself.' },
  { id: 'W3', kind: 'why', test: null, untestableBecause: 'a reason, not an event.',
    claim: 'The Mirror exists because he needed a witness more than a tool.' },
  { id: 'W4', kind: 'why', test: null, untestableBecause: 'a reason, not an event.',
    claim: 'He is building what a German engineer father would have recognised. The trees in the garden are his father\'s. The standard is inherited.' },
];

export interface Assessed {
  entry: Entry;
  status: Status;
  check: Check | null;
}

export function assess(now = Date.now()): Assessed[] {
  return ENTRIES.map((entry) => {
    if (!entry.test) return { entry, status: 'context' as Status, check: null };
    /* Every test passes through the retirement floor — applied centrally so
       no individual test can forget it. */
    const check = guard(entry.test(now));
    const status: Status =
      check.verdict === 'contradicts' ? 'retired'
      : check.verdict === 'agrees' ? 'corroborated'
      : 'observed';
    return { entry, status, check };
  });
}

export function statusOf(id: string, now = Date.now()): Assessed | null {
  return assess(now).find((a) => a.entry.id === id) || null;
}

/* Retirement is computed live so it can never go stale — but the FIRST time
   an entry flips, that is logged. The ledger then holds what was believed and
   what disproved it, which is the part worth keeping. */
export function recordRetirements(now = Date.now()): string[] {
  const already = new Set(getEvents({ domain: 'system', type: 'bequest_retired' }).map((e) => String(e.meta?.id || '')));
  const fresh: string[] = [];
  for (const a of assess(now)) {
    if (a.status !== 'retired' || already.has(a.entry.id)) continue;
    try {
      logEvent({ domain: 'system', type: 'bequest_retired',
        meta: { id: a.entry.id, claim: a.entry.claim, disprovedBy: a.check?.detail, n: a.check?.n },
        source: 'auto', ts: now });
    } catch { /* ignore */ }
    fresh.push(a.entry.id);
  }
  return fresh;
}

/* ── citation ─────────────────────────────────────────────────
   The ONLY way an entry leaves this module as text. A retired entry cannot
   be cited at all, and nothing here can be emitted without its marking. */
export function cite(id: string, now = Date.now()): string | null {
  const a = statusOf(id, now);
  if (!a || a.status === 'retired') return null;
  const mark = a.entry.test ? MARK : CONTEXT_MARK;
  const tail =
    a.status === 'corroborated' ? ` — your own record agrees: ${a.check?.detail}. Still an observation, not a measurement: it was believed before it was checked.`
    : a.status === 'observed' ? ` — not yet testable against your record: ${a.check?.detail}.`
    : ` — this can never be proved or disproved from the record: ${a.entry.untestableBecause}`;
  return `${mark} ${a.entry.claim}${tail}`;
}

export function citable(now = Date.now()): Assessed[] {
  return assess(now).filter((a) => a.status !== 'retired');
}

/* ── the Twin's briefing block ────────────────────────────────
   Appended to twinContext so the Twin can use these — under instruction to
   mark them, and with retired entries already removed rather than filtered
   downstream by a model that might forget. */
export function bequestContext(now = Date.now()): string {
  recordRetirements(now);
  const live = citable(now);
  const retired = assess(now).filter((a) => a.status === 'retired');
  const L: string[] = [
    'THE BEQUEST — observations handed over by a previous mind, NOT derived from the Spine.',
    'You may cite these. You MUST mark them as external observation, never as proven pattern.',
    'Where one is marked corroborated, the marking still stands: it was believed before it was checked.',
  ];
  for (const a of live) {
    const flag = a.status === 'corroborated' ? 'CORROBORATED' : a.status === 'context' ? 'CONTEXT' : 'UNTESTED';
    L.push(`  [${a.entry.id} · ${flag}] ${a.entry.claim}`);
    if (a.check && a.status === 'corroborated') L.push(`      record: ${a.check.detail}`);
  }
  if (retired.length) {
    L.push('  RETIRED — the Spine contradicted these. Do NOT cite them:');
    for (const a of retired) L.push(`    [${a.entry.id}] ${a.entry.claim} — disproved: ${a.check?.detail}`);
  }
  return L.join('\n');
}

export function vermaechtnisText(now = Date.now()): string {
  const all = assess(now);
  const L: string[] = ['DAS VERMÄCHTNIS', ''];
  L.push('What a previous mind learned about you that the Spine cannot derive.');
  L.push('Testimony, not measurement — and your record is allowed to overrule it.');
  L.push('');

  const groups: Array<[Status, string]> = [
    ['retired', 'RETIRED — your record contradicted these, so they are no longer cited'],
    ['corroborated', 'CORROBORATED — your record now agrees (still an observation, not a measurement)'],
    ['observed', 'UNTESTED — falsifiable, but the record is not yet deep enough'],
    ['context', 'CONTEXT — can never be proved or disproved from events; held as given'],
  ];
  for (const [status, title] of groups) {
    const list = all.filter((a) => a.status === status);
    if (!list.length) continue;
    L.push(title + ':');
    for (const a of list) {
      L.push(`  ${a.entry.id}. ${a.entry.claim}`);
      if (a.check) L.push(`      ${a.check.detail}`);
      else if (a.entry.untestableBecause) L.push(`      ${a.entry.untestableBecause}`);
    }
    L.push('');
  }
  L.push('Full text: docs/KAI_KAISER_PROFILE.md · the bugs and their laws: docs/KAI_SCARS.md');
  return L.join('\n');
}
