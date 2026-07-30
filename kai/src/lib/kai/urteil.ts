/* ============================================================
   §44.1 DAS URTEIL — the ruling, and the record of obeying it.

   The inversion: he stops choosing and KAI stops reporting. One ruling
   a day, with its reasoning, followed or explicitly overridden — and
   the override is recorded and scored.

   ── WHAT MAKES THIS DIFFERENT FROM A TO-DO LIST ───────────────
   A to-do list has no opinion and never finds out whether it was
   right. This one commits: it names ONE thing, states why that thing
   and not the others, and then — crucially — checks afterwards whether
   the thing actually moved. Over a year that produces the only honest
   answer to "does following it work", which is the entire point.

   ── THE SCORING IS THE HARD PART AND IT REFUSES EARLY ─────────
   "Obeying beats overriding" is a claim about him, and a wrong one
   would be worse than none: he would either distrust the system or,
   worse, obey a machine that has not earned it. So:

     · a ruling is only SCORED once its subject can be checked —
       did anything actually touch that subject in the days after?
     · obeyed-and-advanced and overridden-and-advanced are counted
       SEPARATELY, because "I ignored it and did the thing anyway" is
       a different fact from "I ignored it and nothing happened"
     · below a floor of scored rulings it returns no verdict at all
       and names how many more it needs

   An override is never punished and never discouraged. It is recorded.
   The machine's job is to find out whether he was right, not to win.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';
import { type CouncilContext, councilQueue } from './council';

const DAY = 86_400_000;

/* How long after a ruling its subject may still be "advanced". */
const WINDOW_DAYS = 3;
/* Below this, no verdict on his discipline. */
const MIN_SCORED = 12;

export interface Ruling {
  /* Stable per day, so obeying and overriding attach to the same thing. */
  id: string;
  text: string;
  because: string;
  /* Words that prove the subject moved. Checked against later events. */
  subject: string[];
  evidence: string[];
  at: number;
}

function dayKey(ts: number): string { return new Date(ts).toISOString().slice(0, 10); }

function subjectWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3).slice(0, 4);
}

/* ── the ruling ───────────────────────────────────────────────
   ONE thing. The Council already ranks what needs him; this takes the
   top of that queue and commits to it in the imperative, with the
   reason the others were not chosen. */

export function rule(ctx: CouncilContext, now = Date.now()): Ruling | null {
  const queue = (() => { try { return councilQueue(ctx); } catch { return []; } })();
  if (!queue.length) return null;
  const top = queue[0];
  const rest = queue.length - 1;

  const text = `Today: ${top.text}. Nothing else until it is done.`;
  const because = rest > 0
    ? `${rest} other thing${rest === 1 ? '' : 's'} are asking for you. This one is first because it is the most urgent thing your own record can point at — the rest keep.`
    : 'It is the only thing your record is asking for.';

  return {
    id: 'urteil:' + dayKey(now),
    text, because,
    subject: subjectWords(top.text),
    evidence: [], at: now,
  };
}

/* ── obeying and overriding, both recorded ───────────────────── */

export type Response = 'obeyed' | 'overridden';

export function respond(r: Ruling, how: Response, reason = '', now = Date.now()): void {
  try {
    logEvent({
      domain: 'system', type: 'urteil_response',
      meta: { id: r.id, how, reason: reason.slice(0, 200), text: r.text, subject: r.subject },
      source: 'user', ts: now,
    });
  } catch { /* ignore */ }
}

export function responseFor(id: string, now = Date.now()): { how: Response; reason: string; at: number } | null {
  const e = getEvents({ domain: 'system', type: 'urteil_response' })
    .filter((x) => x.ts <= now && x.meta?.id === id).slice(-1)[0];
  if (!e) return null;
  return { how: String(e.meta?.how) as Response, reason: String(e.meta?.reason || ''), at: e.ts };
}

/* ── the scoring ──────────────────────────────────────────────
   Did the subject actually move in the days after the ruling? That is
   the only outcome this system can honestly observe. */

function advanced(subject: string[], from: number, now: number): boolean {
  if (!subject.length) return false;
  const until = Math.min(now, from + WINDOW_DAYS * DAY);
  return getEvents({ since: from, until })
    .some((e) => {
      if (e.type === 'urteil_response') return false;
      const blob = (e.type + ' ' + JSON.stringify(e.meta || {})).toLowerCase();
      return subject.some((w) => blob.includes(w));
    });
}

export interface Scored { id: string; how: Response; advanced: boolean; at: number; text: string }

export function scoredRulings(now = Date.now()): Scored[] {
  return getEvents({ domain: 'system', type: 'urteil_response' })
    .filter((e) => e.ts <= now - WINDOW_DAYS * DAY)   // not judged before its window closes
    .map((e) => ({
      id: String(e.meta?.id || ''),
      how: String(e.meta?.how) as Response,
      at: e.ts,
      text: String(e.meta?.text || ''),
      advanced: advanced((e.meta?.subject as string[]) || [], e.ts, now),
    }));
}

export interface Discipline {
  scored: number;
  obeyed: number; obeyedAdvanced: number;
  overridden: number; overriddenAdvanced: number;
  verdict: string;
}

export function discipline(now = Date.now()): Discipline {
  const s = scoredRulings(now);
  const ob = s.filter((x) => x.how === 'obeyed');
  const ov = s.filter((x) => x.how === 'overridden');
  const obA = ob.filter((x) => x.advanced).length;
  const ovA = ov.filter((x) => x.advanced).length;

  let verdict: string;
  if (s.length < MIN_SCORED) {
    verdict = `${s.length} rulings have run their course. This needs ${MIN_SCORED} before it says anything about you — a verdict on your discipline from ${s.length} days would be noise wearing a number.`;
  } else if (!ob.length || !ov.length) {
    verdict = ob.length
      ? `You have obeyed every one of ${ob.length} rulings. There is nothing to compare against — an override would tell me more than another obedience.`
      : `You have overridden all ${ov.length}. There is no obedience to compare against, so this cannot say whether following it would work.`;
  } else {
    const obR = Math.round((obA / ob.length) * 100);
    const ovR = Math.round((ovA / ov.length) * 100);
    verdict = obR > ovR
      ? `Obeying moved the thing ${obR}% of the time (${obA} of ${ob.length}). Overriding: ${ovR}% (${ovA} of ${ov.length}). Following it has worked better for you.`
      : obR < ovR
        ? `Overriding moved the thing ${ovR}% of the time (${ovA} of ${ov.length}) against ${obR}% when you obeyed. Your own judgement has beaten the ruling — that is the finding, and the ruling is the thing that should change.`
        : `Obeying and overriding both moved it ${obR}% of the time. On this record the ruling adds nothing you were not already doing.`;
  }

  return { scored: s.length, obeyed: ob.length, obeyedAdvanced: obA, overridden: ov.length, overriddenAdvanced: ovA, verdict };
}

export function urteilText(ctx: CouncilContext, now = Date.now()): string {
  const r = rule(ctx, now);
  const d = discipline(now);
  const L = ['DAS URTEIL', ''];
  if (!r) {
    L.push('No ruling. Your record is not asking for anything today.');
    L.push('');
    L.push('That is not a rest day awarded to you — it is an empty queue.');
    return L.join('\n');
  }
  L.push(r.text);
  L.push('');
  L.push('  ' + r.because);
  const prev = responseFor(r.id, now);
  if (prev) L.push(`  You ${prev.how} this${prev.reason ? ` — "${prev.reason}"` : ''}.`);
  L.push('');
  L.push('YOUR DISCIPLINE, MEASURED:');
  L.push('  ' + d.verdict);
  return L.join('\n');
}
