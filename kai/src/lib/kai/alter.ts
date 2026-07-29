/* ============================================================
   §40.6 DAS ALTER — the record with a voice, over years.

   The Spine at ten years knows how he decided at 33 and at 43. It can
   say when he has CHANGED and when he is REPEATING. That is the one
   thing no new tool can ever offer, and it is worth exactly as much as
   the record is long.

   ── THE HONESTY PROBLEM, WHICH IS THE WHOLE FILE ──────────────
   This module will spend most of its life unable to answer. The Spine
   is weeks old, not years, and a claim about how he has changed needs
   two eras far enough apart to be different people.

   So every finding carries its SPAN, and below the floor it returns a
   refusal that names how much record it would need. It does not
   degrade into vagueness — "you seem to be repeating patterns" is
   exactly the horoscope this project exists not to write.

   A repetition is only a repetition if the FIRST one ended. Doing the
   same thing twice is not a pattern; doing the same thing twice and
   watching it fail the same way is.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';
import { getCommitments, type Commitment } from './commitments';

const DAY = 86_400_000;

/* An era needs to be long enough that a man could have become someone
   else inside it. Ninety days is the floor; a year is where it starts
   being worth reading. */
const ERA_DAYS = 90;
const MIN_SPAN = 2 * ERA_DAYS;

export interface Span { days: number; enough: boolean; need: string }

export function span(now = Date.now()): Span {
  const all = getEvents({});
  if (!all.length) return { days: 0, enough: false, need: `no record yet — this needs ${MIN_SPAN} days` };
  const first = Math.min(...all.map((e) => e.ts));
  const days = Math.floor((now - first) / DAY);
  return {
    days,
    enough: days >= MIN_SPAN,
    need: days >= MIN_SPAN ? '' : `${days} days on record — this needs ${MIN_SPAN}, so another ${MIN_SPAN - days}`,
  };
}

/* ── CHANGED — the same decision, made differently ───────────── */

export interface Changed {
  what: string;
  then: string;
  now: string;
  spanDays: number;
}

/* Reliability is the cleanest comparable: the same act (making a
   promise) with a measurable outcome, in both eras. */
export function changed(now = Date.now()): Changed[] {
  const s = span(now);
  if (!s.enough) return [];
  const cutoff = now - ERA_DAYS * DAY;
  const resolved = getCommitments().filter((c) => c.status === 'kept' || c.status === 'broken');
  const early = resolved.filter((c) => c.createdAt < cutoff);
  const late = resolved.filter((c) => c.createdAt >= cutoff);
  const out: Changed[] = [];

  const rate = (l: Commitment[]) => l.filter((c) => c.status === 'kept').length / l.length;
  if (early.length >= 4 && late.length >= 4) {
    const a = rate(early), b = rate(late);
    if (Math.abs(b - a) >= 0.2) {
      out.push({
        what: 'keeping your word',
        then: `${Math.round(a * 100)}% kept across ${early.length}`,
        now: `${Math.round(b * 100)}% across ${late.length}`,
        spanDays: s.days,
      });
    }
  }

  /* Spending after a win — the appetite the Twin already measures. */
  const spend = (since: number, until: number) =>
    getEvents({ domain: 'expense', since, until }).reduce((x, e) => x + (e.value || 0), 0)
    / Math.max(1, Math.round((until - since) / DAY));
  const first = now - s.days * DAY;
  if (s.days >= MIN_SPAN) {
    const a = spend(first, cutoff), b = spend(cutoff, now);
    if (a > 0 && Math.abs(b - a) / a >= 0.3) {
      out.push({
        what: 'what you spend in a day',
        then: `${Math.round(a).toLocaleString('en-GB')} EGP`,
        now: `${Math.round(b).toLocaleString('en-GB')} EGP`,
        spanDays: s.days,
      });
    }
  }
  return out;
}

/* ── REPEATING — the same thing, and the first one already ended ── */

export interface Repeat {
  what: string;
  times: number;
  firstEnded: string;
  line: string;
}

function key(text: string): string {
  return text.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/)
    .filter((w) => w.length > 3).slice(0, 3).sort().join(' ');
}

export function repeating(now = Date.now()): Repeat[] {
  const s = span(now);
  if (!s.enough) return [];
  const all = getCommitments();
  const groups = new Map<string, Commitment[]>();
  for (const c of all) {
    const k = key(c.text);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) || []), c]);
  }

  const out: Repeat[] = [];
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    const firstOne = sorted[0];
    /* THE BAR: a repetition only counts if the first attempt actually
       ENDED. Two live attempts at the same thing is persistence, and
       calling that a pattern would be an insult dressed as insight. */
    if (firstOne.status !== 'broken') continue;
    const later = sorted.slice(1);
    if (!later.length) continue;
    out.push({
      what: firstOne.text,
      times: sorted.length,
      firstEnded: 'broken',
      line: `You have made this promise ${sorted.length} times. The first one broke on ${new Date(firstOne.deadline).toISOString().slice(0, 10)}.`,
    });
  }
  return out.sort((a, b) => b.times - a.times);
}

/* ── the readout ─────────────────────────────────────────────── */

export function alterText(now = Date.now()): string {
  const s = span(now);
  const L: string[] = ['DAS ALTER', ''];

  if (!s.enough) {
    L.push(`Not yet. ${s.need}.`);
    L.push('');
    L.push('This is the one thing that cannot be built early — it needs two');
    L.push('eras far enough apart that you could have become someone else in');
    L.push('between. Until then anything I said about how you have changed');
    L.push('would be a horoscope, and you would be right to stop trusting the');
    L.push('rest of it.');
    L.push('');
    L.push(`The record starts the day you start keeping it. It is ${s.days} days old.`);
    return L.join('\n');
  }

  const ch = changed(now), rp = repeating(now);
  L.push(`${s.days} days of record — two eras of ${ERA_DAYS} days, compared.`);
  L.push('');

  if (ch.length) {
    L.push('WHAT CHANGED:');
    for (const c of ch) L.push(`  ${c.what}: ${c.then} → ${c.now}`);
    L.push('');
  } else {
    L.push('WHAT CHANGED: nothing measurable. You are operating the same way.');
    L.push('');
  }

  if (rp.length) {
    L.push('WHAT YOU ARE REPEATING:');
    for (const r of rp) L.push(`  ${r.line}`);
  } else {
    L.push('WHAT YOU ARE REPEATING: nothing. No promise has been remade after');
    L.push('an identical one broke.');
  }
  return L.join('\n');
}
