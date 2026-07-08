/* ============================================================
   SPINE RETRIEVAL (§13.3a) — Ask-KAI stops being "last 18 events".
   A client-side keyword+recency index over the WHOLE Spine, so a
   question like "what did I decide about FRISCH in May" pulls the
   RIGHT events into context, not just the most recent ones. No new
   functions, no server — pure scoring over kai.events.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';

const DAY = 86_400_000;
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'was', 'what', 'did', 'i', 'my', 'me', 'about', 'how', 'when', 'do', 'does', 'with', 'at', 'it', 'this', 'that']);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !STOP.has(t));
}

/* A searchable text blob for an event — domain, type, and any string
   values in meta (so names like "FRISCH" or "Katie" are matchable). */
function eventText(e: KaiEvent): string {
  const parts = [e.domain, e.type];
  if (e.meta) for (const v of Object.values(e.meta)) if (typeof v === 'string') parts.push(v);
  if (e.ccy) parts.push(e.ccy);
  return parts.join(' ').toLowerCase();
}

export interface ScoredEvent { event: KaiEvent; score: number; }

/* Score = keyword overlap (primary) + a gentle recency prior, so an
   exact topic match from months ago beats a fresh but irrelevant event,
   while ties break toward recent. Month names in the query bias toward
   that month's events. */
export function retrieveEvents(query: string, now = Date.now(), limit = 14): KaiEvent[] {
  const terms = tokenize(query);
  const all = getEvents({});
  if (!all.length) return [];
  if (!terms.length) return all.slice(-limit);

  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthHint = terms.map((t) => MONTHS.indexOf(t.slice(0, 3))).find((i) => i >= 0);

  const scored: ScoredEvent[] = all.map((e) => {
    const text = eventText(e);
    let kw = 0;
    for (const t of terms) if (text.includes(t)) kw += 1;
    const ageDays = Math.max(0, (now - e.ts) / DAY);
    const recency = Math.exp(-ageDays / 120);                 // 120-day half-life-ish prior
    let score = kw * 10 + recency;                             // keywords dominate
    if (monthHint !== undefined && new Date(e.ts).getMonth() === monthHint) score += 4;
    return { event: e, score };
  });

  const anyKw = scored.some((s) => s.score >= 10);
  const pool = anyKw ? scored.filter((s) => s.score >= 10) : scored;   // if nothing matches, fall back to recency
  return pool.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.event)
    .sort((a, b) => a.ts - b.ts);                              // chronological for the model
}

/* A compact, model-ready block of the most relevant events for a query. */
export function retrievalBlock(query: string, now = Date.now()): string {
  const evs = retrieveEvents(query, now);
  if (!evs.length) return '';
  const lines = evs.map((e) => {
    const dago = Math.max(0, Math.round((now - e.ts) / DAY));
    const v = typeof e.value === 'number' ? ` ${e.value}${e.ccy ? ' ' + e.ccy : ''}` : '';
    const meta = e.meta ? ' ' + Object.entries(e.meta).filter(([, x]) => typeof x === 'string').map(([k, x]) => `${k}=${x}`).join(' ') : '';
    return `    ${dago}d ago · ${e.domain}.${e.type}${v}${meta}`.trimEnd();
  });
  return `\nRELEVANT HISTORY (retrieved for this question, oldest→newest):\n${lines.join('\n')}`;
}
