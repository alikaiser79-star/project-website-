/* ============================================================
   DER TAG — the ten-second logger.

   Amount plus one word. That is the whole interaction, and the whole
   design constraint: anything that takes longer than a traffic light
   does not get done, and a logger that does not get used is worth
   nothing regardless of how good it is.

   ── WHY IT WRITES STRAIGHT TO THE SPINE ───────────────────────
   The first version of this exported formatted text for bulk paste.
   That is a worse tool wearing the same UI: an export is a promise to
   do the real work later, and "later" is where every logging habit
   dies. Entries go through logEvent() the moment they are made — the
   streak and the Spine are then the same fact, not two things that can
   disagree.

   ── THE STREAK IS A MEASUREMENT, NOT A GAME ───────────────────
   It counts consecutive days with at least one entry, from the record.
   It is never awarded, never rounded up, and a missed day breaks it —
   because a streak that forgives is not a record of anything. Today
   does not break it until today ends.
   ============================================================ */

import { getEvents, logEvent, type Domain, type KaiEvent } from './events';
import type { Currency } from '../../types';

const DAY = 86_400_000;

export interface Entry {
  amountEgp: number;
  word: string;
  domain: Domain;
  kind: 'expense' | 'income';
  at: number;
}

/* ── the parse: "340 fuel", "spent 340 on fuel", "+2000 makadi" ──
   One line, one entry. Deliberately forgiving about shape and strict
   about the two things that matter: a number, and a word for it. */

const INCOME_HINT = /^\+|\b(in|got|earned|received|paid me|income)\b/i;
const STOP = new Set(['on', 'for', 'the', 'a', 'of', 'to', 'at', 'spent', 'paid', 'bought', 'got', 'in', 'egp', 'le', 'pounds']);

/* Which organ a word belongs to. Unmapped words land in `expense`,
   which is honest — a word KAI does not recognise is still money out. */
/* ANCHORED. Without \b, /car/ matches "card" and a credit-card payment
   gets filed as transport — a whole organ's worth of money in the wrong
   place, from one missing boundary. Debt is checked before transport as
   a second guard. */
const DOMAIN_WORDS: Array<[RegExp, Domain]> = [
  [/\b(card|visa|debt|instal\w*|mastercard)\b/i, 'debt'],
  [/\b(makadi|guest|airbnb|cleaner|turnover)\b/i, 'makadi'],
  [/\b(garden|plant\w*|water\w*|soil|seed\w*|lemon|jasmine)\b/i, 'garden'],
  [/\b(enpal|salary|client|invoice|freelance)\b/i, 'income'],
  [/\b(fuel|petrol|car|cars|uber|taxi|transport|parking)\b/i, 'expense'],
  [/\b(food|grocer\w*|coffee|lunch|dinner)\b/i, 'expense'],
];

export interface Parsed { entry: Entry | null; problem: string | null }

export function parseTag(line: string, now = Date.now()): Parsed {
  const raw = String(line || '').trim();
  if (!raw) return { entry: null, problem: 'Nothing to log.' };

  const m = raw.match(/(-|\+)?\s*(\d[\d,.]*)\s*(k\b)?/i);
  if (!m) return { entry: null, problem: 'No amount in that. It needs a number and a word — "340 fuel".' };

  let amount = parseFloat(m[2].replace(/,/g, ''));
  if (m[3]) amount *= 1000;
  if (!isFinite(amount) || amount <= 0) {
    return { entry: null, problem: 'That amount is not a number I can use.' };
  }

  /* The word: the first meaningful token that is not the number. */
  const word = raw
    .replace(m[0], ' ')
    .split(/[^\p{L}]+/u)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()))[0];

  if (!word) {
    return { entry: null, problem: `"${Math.round(amount).toLocaleString('en-GB')}" what? One word — "340 fuel".` };
  }

  const income = INCOME_HINT.test(raw) || m[1] === '+';
  const domain = (DOMAIN_WORDS.find(([re]) => re.test(word))?.[1]) ?? (income ? 'income' : 'expense');

  return {
    entry: { amountEgp: amount, word: word.toLowerCase(), domain, kind: income ? 'income' : 'expense', at: now },
    problem: null,
  };
}

/* ── the write: straight into the Spine, no export step ─────── */

export function logTag(e: Entry): KaiEvent | null {
  try {
    return logEvent({
      domain: e.domain,
      type: e.kind === 'income' ? 'income_received' : 'expense_logged',
      value: e.amountEgp,
      ccy: 'EGP' as Currency,
      /* `tag: true` marks it as coming from the ten-second logger, so the
         streak counts the same events everything else reasons over. */
      meta: { tag: true, word: e.word, label: e.word },
      source: 'user',
      ts: e.at,
    });
  } catch { return null; }
}

/* ── the record ──────────────────────────────────────────────── */

function dayKey(ts: number): string { return new Date(ts).toISOString().slice(0, 10); }

export function entries(now = Date.now(), windowDays = 400): KaiEvent[] {
  return getEvents({ since: now - windowDays * DAY })
    .filter((e) => e.ts <= now && e.meta?.tag === true)
    .sort((a, b) => b.ts - a.ts);
}

export interface Streak { days: number; today: boolean; longest: number; total: number }

export function streak(now = Date.now()): Streak {
  const evs = entries(now);
  const days = new Set(evs.map((e) => dayKey(e.ts)));
  const today = days.has(dayKey(now));

  /* Count back from today. Today NOT being logged does not break the
     streak — the day is not over. Yesterday missing does. */
  let n = 0;
  for (let i = today ? 0 : 1; ; i++) {
    if (!days.has(dayKey(now - i * DAY))) break;
    n++;
  }

  /* Longest run anywhere in the record. */
  const sorted = [...days].sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    if (prev && Date.parse(d) - Date.parse(prev) === DAY) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return { days: n, today, longest, total: evs.length };
}

export interface DayTotal { day: string; egp: number; words: string[] }

export function byDay(now = Date.now(), limit = 14): DayTotal[] {
  const map = new Map<string, DayTotal>();
  for (const e of entries(now)) {
    const d = dayKey(e.ts);
    const cur = map.get(d) || { day: d, egp: 0, words: [] };
    const sign = e.type === 'income_received' ? 1 : -1;
    cur.egp += sign * (e.value || 0);
    const w = String(e.meta?.word || '');
    if (w && !cur.words.includes(w)) cur.words.push(w);
    map.set(d, cur);
  }
  return [...map.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, limit);
}

export function tagText(now = Date.now()): string {
  const s = streak(now);
  const L = ['DER TAG', ''];
  L.push(s.total === 0
    ? 'Nothing logged yet. Amount and one word — "340 fuel".'
    : `${s.days} day streak${s.today ? '' : ' — today is still open'} · ${s.total} entries · longest ${s.longest}`);
  const days = byDay(now, 7);
  if (days.length) {
    L.push('');
    for (const d of days) {
      L.push(`  ${d.day}  ${d.egp >= 0 ? '+' : '−'}${Math.abs(Math.round(d.egp)).toLocaleString('en-GB')} EGP  ${d.words.join(' · ')}`);
    }
  }
  L.push('');
  L.push('Every entry is already in the Spine. There is nothing to export.');
  return L.join('\n');
}
