/* ============================================================
   §46 DER MANN — the one thing the Spine never tracked.

   Everything in KAI serves the assets. This serves the man running
   them, and it is the only part of the system where being useful and
   being quiet are the same thing.

   ── THE HARD BOUNDARY, AND IT IS NOT NEGOTIABLE ───────────────
   This file touches real prescriptions — a biologic on a schedule, a
   controlled stimulant, an inhaler. It holds DATES AND COUNTS HE
   ENTERS and nothing else. It does not:

     · advise on doses, timing, or whether to take anything
     · suggest rationing, stretching, skipping, or stockpiling
     · interpret a symptom, a flare, or a missed dose
     · infer anything clinical from anything logged

   It is a calendar and a stock count with an alarm. That is the whole
   contract, it is stated in the readout so it can never be mistaken
   for more, and the correct place for every question this file
   deliberately cannot answer is his prescriber. This is the same rule
   as the property-law pack: the dangerous move is not being unhelpful,
   it is being confidently wrong about something with a body attached.

   ── CORRELATION IS REPORTED AS CO-OCCURRENCE, NEVER CAUSE ─────
   "Your worst decision weeks and your worst sleep weeks are the same
   weeks" is a real, computable, useful observation. "Bad sleep causes
   bad decisions" is a claim this record cannot support. The first is
   said with counts; the second is never said.

   ── AND THE WEEKLY ANSWER IS NEVER JUDGED ─────────────────────
   No sentiment scoring, no trend line on his mood, no gentle nudge
   when the answers get darker. It is recorded in his words and read
   back in his words. A machine that grades how you feel is a machine
   you stop telling the truth to, and then the whole thing is worthless.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';
import { getCommitments } from './commitments';
import { read, write, emit } from './store';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/* ── 1. THE BODY LEDGER ──────────────────────────────────────
   Same three-word shape as everything else. */

export type BodyKind = 'sleep' | 'med_taken' | 'med_skipped' | 'flare' | 'weight' | 'ate' | 'day_off';

export interface BodyEntry { kind: BodyKind; value?: number; what?: string; at: number }

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => BodyEntry]> = [
  [/^slept?\s+([\d.]+)/i,            (m) => ({ kind: 'sleep', value: parseFloat(m[1]), at: 0 })],
  [/^no\s+(\w+)/i,                   (m) => ({ kind: 'med_skipped', what: m[1].toLowerCase(), at: 0 })],
  [/^took\s+(\w+)/i,                 (m) => ({ kind: 'med_taken', what: m[1].toLowerCase(), at: 0 })],
  [/^flare/i,                        () => ({ kind: 'flare', at: 0 })],
  [/^weight\s+([\d.]+)/i,            (m) => ({ kind: 'weight', value: parseFloat(m[1]), at: 0 })],
  [/^ate(?:\s+(\w+))?/i,             (m) => ({ kind: 'ate', what: m[1]?.toLowerCase(), at: 0 })],
  [/^(day off|rest day|off today)/i, () => ({ kind: 'day_off', at: 0 })],
];

export function parseBody(line: string, now = Date.now()): BodyEntry | null {
  const raw = String(line || '').trim();
  for (const [re, make] of PATTERNS) {
    const m = raw.match(re);
    if (m) return { ...make(m), at: now };
  }
  return null;
}

export function knownMed(name: string): boolean {
  return meds().some((m) => m.name.toLowerCase() === name.toLowerCase());
}

/* The command bar sees every line the user types, so a bare `no <word>`
   wired at the top would file "no idea" as a skipped dose. A spurious
   entry in a MEDICATION record is not a cosmetic bug — he may later
   read it back as a fact about his own adherence. So at the command
   layer the two med verbs only fire for a med he has actually
   registered; everything else about the body stays bare, because
   "slept 5" and "flare" cannot be mistaken for anything.
   `skipped <x>` / `took <x>` in full are the unrestricted escape hatch. */
export function parseBodyCommand(line: string, now = Date.now()): BodyEntry | null {
  const raw = String(line || '').trim();
  const explicit = raw.match(/^(skipped|dose taken)\s+(\w+)$/i);
  if (explicit) {
    return { kind: /skipped/i.test(explicit[1]) ? 'med_skipped' : 'med_taken', what: explicit[2].toLowerCase(), at: now };
  }
  const e = parseBody(raw, now);
  if (!e) return null;
  if ((e.kind === 'med_skipped' || e.kind === 'med_taken') && !knownMed(e.what || '')) return null;
  return e;
}

export function logBody(e: BodyEntry): void {
  try {
    logEvent({ domain: 'habit', type: 'body_' + e.kind, value: e.value,
      meta: { body: true, kind: e.kind, what: e.what }, source: 'user', ts: e.at });
  } catch { /* ignore */ }
}

export function bodyEvents(kind: BodyKind | null, now = Date.now(), days = 400): KaiEvent[] {
  return getEvents({ since: now - days * DAY })
    .filter((e) => e.ts <= now && e.meta?.body === true && (!kind || e.meta?.kind === kind));
}

/* ── the co-occurrence, with counts and no causal claim ──────── */

const MIN_WEEKS = 8;
const BAD_SLEEP = 6;      // hours; his own threshold would be better and is not invented

export interface WeekRow { week: string; avgSleep: number | null; broken: number }
export interface CoOccurrence { weeks: number; both: number; line: string }

function weekKey(ts: number): string {
  const d = new Date(ts); const day = (d.getDay() + 6) % 7;
  return new Date(ts - day * DAY).toISOString().slice(0, 10);
}

export function weeks(now = Date.now()): WeekRow[] {
  const sleep = bodyEvents('sleep', now);
  const broken = getCommitments().filter((c) => c.status === 'broken');
  const keys = new Set<string>([...sleep.map((e) => weekKey(e.ts)), ...broken.map((c) => weekKey(c.resolvedAt ?? c.deadline))]);
  return [...keys].sort().map((week) => {
    const s = sleep.filter((e) => weekKey(e.ts) === week).map((e) => e.value || 0).filter((v) => v > 0);
    return {
      week,
      avgSleep: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null,
      broken: broken.filter((c) => weekKey(c.resolvedAt ?? c.deadline) === week).length,
    };
  });
}

export function coOccurrence(now = Date.now()): CoOccurrence {
  const rows = weeks(now).filter((r) => r.avgSleep !== null);
  if (rows.length < MIN_WEEKS) {
    /* Says what it actually counted — weeks with sleep on record — not
       "weeks with both", which was the filter's description and not the
       filter. Broken promises need no sleep entry to exist. */
    const w = (n: number) => `${n} week${n === 1 ? '' : 's'}`;
    return {
      weeks: rows.length, both: 0,
      line: `${w(rows.length)} of sleep on record. This needs ${MIN_WEEKS} before it is worth saying — a pattern from ${w(rows.length)} is a coincidence with a chart.`,
    };
  }
  const badSleep = rows.filter((r) => (r.avgSleep as number) < BAD_SLEEP);
  const both = badSleep.filter((r) => r.broken > 0).length;
  const goodBroke = rows.filter((r) => (r.avgSleep as number) >= BAD_SLEEP && r.broken > 0).length;

  return {
    weeks: rows.length, both,
    line: badSleep.length === 0
      ? `No week on record averaged under ${BAD_SLEEP} hours. Nothing to compare.`
      : `${both} of your ${badSleep.length} worst-sleep weeks also broke a promise. ${goodBroke} of your ${rows.length - badSleep.length} better-sleep weeks did. ` +
        `That is co-occurrence, counted — NOT a cause. The record cannot tell you which way it runs, or whether a third thing drives both.`,
  };
}

/* ── 2. THE MEDICATION GUARD — dates and stock, nothing else ── */

export interface Med { name: string; everyDays?: number; lastAt?: number; stock?: number; note?: string }

const MEDS_KEY = 'kai.mann.meds';
export function meds(): Med[] { return read<Med[]>(MEDS_KEY, []); }

export function setMed(m: Med): void {
  const list = meds().filter((x) => x.name.toLowerCase() !== m.name.toLowerCase());
  list.push(m); write(MEDS_KEY, list); emit();
  try { logEvent({ domain: 'habit', type: 'med_set', meta: { name: m.name, everyDays: m.everyDays, stock: m.stock }, source: 'user' }); } catch { /* ignore */ }
}

/* `daysLeft` is the ONLY ranking key, and it is null when the record
   cannot produce one. An earlier version ranked schedule alerts above
   stock alerts using two invented constants, which meant "a date three
   days out" always outranked "four left" — a priority nobody chose and
   the record cannot justify. A stock with no cadence on file cannot be
   converted to days at all, so it is not ranked against ones that can;
   it sorts last and says why. Same rule as unpriced positions on the
   board: a blank beats a number that was made up. */
export interface MedAlert { name: string; text: string; daysLeft: number | null }

/* Dates and counts. No clinical inference of any kind. */
export function medAlerts(now = Date.now()): MedAlert[] {
  const out: MedAlert[] = [];
  for (const m of meds()) {
    if (m.everyDays && m.lastAt) {
      const due = m.lastAt + m.everyDays * DAY;
      const daysOut = Math.ceil((due - now) / DAY);
      if (daysOut <= 7) {
        out.push({
          name: m.name,
          text: daysOut < 0
            ? `${m.name}: the date you entered was ${Math.abs(daysOut)} days ago.`
            : daysOut === 0 ? `${m.name}: the date you entered is today.`
            : `${m.name}: ${daysOut} days to the date you entered.`,
          daysLeft: daysOut,
        });
      }
    }
    if (typeof m.stock === 'number' && m.stock <= 7) {
      /* Cover in days, only when a cadence is on file. */
      const cover = m.everyDays ? m.stock * m.everyDays : null;
      out.push({
        name: m.name,
        /* States the count. It does not say what that count means, how
           long it will last beyond his own cadence, or what to do. */
        text: `${m.name}: ${m.stock} left by your own count.` +
          (cover === null ? ' No interval on file, so this is a count, not a countdown.' : ` At every ${m.everyDays} day${m.everyDays === 1 ? '' : 's'}, that is ${cover} days of it.`),
        daysLeft: cover,
      });
    }
  }
  return out.sort((a, b) =>
    (a.daysLeft === null ? Infinity : a.daysLeft) - (b.daysLeft === null ? Infinity : b.daysLeft));
}

export const MED_BOUNDARY =
  'These are dates and counts YOU entered. This is a calendar with an alarm — it does not know what any of it is for, ' +
  'and it will never tell you to take, skip, delay, or ration anything. Those questions go to whoever prescribes them.';

/* ── 3. THE HOURS LEDGER ─────────────────────────────────────── */

export interface HoursRow { where: string; hours: number }
export interface HoursMonth { rows: HoursRow[]; worked: number; his: number; line: string }

const MINE = /^(me|myself|rest|own|self)$/i;

export function hoursMonth(now = Date.now()): HoursMonth {
  const start = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const evs = getEvents({ since: start }).filter((e) => e.ts <= now && typeof e.meta?.hours === 'number');
  const by = new Map<string, number>();
  for (const e of evs) {
    const where = String(e.meta?.where || e.meta?.on || e.domain);
    by.set(where, (by.get(where) || 0) + Number(e.meta!.hours));
  }
  const rows = [...by.entries()].map(([where, hours]) => ({ where, hours })).sort((a, b) => b.hours - a.hours);
  const his = rows.filter((r) => MINE.test(r.where)).reduce((s, r) => s + r.hours, 0);
  const worked = rows.reduce((s, r) => s + r.hours, 0) - his;

  return {
    rows, worked, his,
    /* One sentence. No advice — the number is the whole point. */
    line: rows.length === 0
      ? 'No hours logged this month. Nothing to report, which is its own kind of answer.'
      : `This month: ${Math.round(worked)} hours worked, ${Math.round(his)} hour${Math.round(his) === 1 ? '' : 's'} that were yours.`,
  };
}

/* ── 4. THE PEOPLE COLUMN — tracked gently ───────────────────── */

export interface Close { name: string; lastAt: number | null; lastWasLogistics: boolean; days: number | null; line: string }

const LOGISTICS = /invoice|payment|money|paid|owe|booking|schedule|pick up|drop off|appointment|admin/i;

/* Who counts as close is his call and nobody else's. There is no
   inferring it from event volume — the people you transact with most
   are precisely not the answer to this question. */
const CLOSE_KEY = 'kai.mann.close';
export function closeNames(): string[] { return read<string[]>(CLOSE_KEY, []); }
export function setCloseNames(names: string[]): string[] {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  write(CLOSE_KEY, clean); emit();
  return clean;
}

export function closeOnes(names: string[], now = Date.now()): Close[] {
  return names.map((name) => {
    const evs = getEvents({}).filter((e) => {
      if (e.ts > now) return false;
      const blob = (JSON.stringify(e.meta || {}) + ' ' + e.type).toLowerCase();
      return blob.includes(name.toLowerCase());
    }).sort((a, b) => b.ts - a.ts);

    if (!evs.length) {
      return { name, lastAt: null, lastWasLogistics: false, days: null,
        line: `${name}: nothing on the record. Not a judgement — the record only holds what gets written down.` };
    }
    const last = evs[0];
    const logistics = LOGISTICS.test(JSON.stringify(last.meta || {}) + last.type);
    const nonLogistics = evs.find((e) => !LOGISTICS.test(JSON.stringify(e.meta || {}) + e.type));
    const days = Math.floor((now - last.ts) / DAY);

    /* When the most recent touch was ALREADY not logistics there is no
       second number to give, and printing "20 days ago… 20 days ago"
       reads as a machine padding. The gap between the two dates is the
       only thing worth saying, so it is only said when there is one. */
    const nlDays = nonLogistics ? Math.floor((now - nonLogistics.ts) / DAY) : null;
    return {
      name, lastAt: last.ts, lastWasLogistics: logistics, days,
      line: !nonLogistics
        ? `${name}: ${evs.length} touch${evs.length === 1 ? '' : 'es'}, all of them logistics. The last one was ${days} days ago.`
        : nlDays === days
          ? `${name}: last time was ${days} days ago, and it was not logistics.`
          : `${name}: last time was ${days} days ago, and it was logistics. Last thing that was not: ${nlDays} days ago.`,
    };
  });
}

/* ── 5. THE ONE QUESTION ─────────────────────────────────────── */

export const THE_QUESTION = 'How was this week — honestly?';

export function askedThisWeek(now = Date.now()): boolean {
  return getEvents({ domain: 'habit', type: 'week_answer', since: now - WEEK })
    .some((e) => e.ts <= now);
}

export function answerWeek(words: string, now = Date.now()): { ok: boolean; reason: string } {
  if (!words.trim()) return { ok: false, reason: 'Nothing recorded. One sentence, or none — an empty answer is not an answer.' };
  try {
    logEvent({ domain: 'habit', type: 'week_answer', meta: { words: words.slice(0, 600), week: weekKey(now) }, source: 'user', ts: now });
  } catch { /* ignore */ }
  /* No response to the content. None. */
  return { ok: true, reason: 'Recorded, in your words. Not read back to you, not scored, not acted on.' };
}

export interface YearRow { week: string; words: string; earnedEgp: number }

export function theYear(now = Date.now()): YearRow[] {
  const answers = getEvents({ domain: 'habit', type: 'week_answer', since: now - 400 * DAY }).filter((e) => e.ts <= now);
  return answers.map((a) => {
    const start = Date.parse(String(a.meta?.week));
    const earned = getEvents({ domain: 'income', since: start, until: start + WEEK })
      .reduce((s, e) => s + (e.value || 0), 0);
    return { week: String(a.meta?.week), words: String(a.meta?.words || ''), earnedEgp: earned };
  }).sort((x, y) => y.week.localeCompare(x.week));
}

/* ── the readout ─────────────────────────────────────────────── */

export function mannText(now = Date.now(), names: string[] = []): string {
  const L = ['DER MANN', ''];

  const alerts = medAlerts(now);
  L.push('MEDICATION — dates and counts you entered:');
  if (!alerts.length) L.push('  Nothing inside seven days, by the dates on record.');
  else for (const a of alerts) L.push(`  ${a.text}`);
  L.push(`  ${MED_BOUNDARY}`);
  L.push('');

  const h = hoursMonth(now);
  L.push('HOURS:');
  L.push('  ' + h.line);
  L.push('');

  const s = bodyEvents('sleep', now, 7).map((e) => e.value || 0).filter((v) => v > 0);
  L.push('BODY:');
  L.push(s.length
    ? `  ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1)}h average across ${s.length} nights logged this week.`
    : '  No sleep logged this week.');
  L.push('  ' + coOccurrence(now).line);
  L.push('');

  if (names.length) {
    L.push('THE PEOPLE:');
    for (const c of closeOnes(names, now)) L.push('  ' + c.line);
    L.push('');
  }

  const day = new Date(now).getDay();
  if (day === 0 && !askedThisWeek(now)) {
    L.push(`"${THE_QUESTION}"`);
    L.push('  "honestly <one sentence>". It is recorded and never judged.');
  }
  return L.join('\n');
}
