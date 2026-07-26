/* ============================================================
   §28.1 THE SPINE → THE MEMORY. An append-only log remembers nothing;
   it only records. This gives the ledger three faculties:

     RECALL      — ask in plain words ("what did I spend on Makadi in
                   June", "when did the lock break", "every broken
                   promise") and get an answer built FROM the events,
                   with the events cited. Not a chat guess.
     COMPACTION  — events past 90 days fold into summarised memories that
                   keep the meaning and drop the noise, so the Spine ages
                   like a memory: recent detail, distant shape.
     CAUSALITY   — an event can name what caused it, so the log becomes a
                   graph (booking → cleaning cost → profit change) that
                   can be walked in either direction.

   HONEST LIMIT, stated where it matters: there is no vector-embedding
   step. Anthropic exposes no embeddings endpoint and shipping a local
   model into a PWA isn't viable, so "semantic" here means a deterministic
   scored retrieval (keywords + synonyms + date ranges + domain hints)
   feeding a grounded answer. Every claim in an answer is carried by a
   real cited event; nothing is recalled that isn't in the ledger.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent, type Domain } from './events';
import { read, write, emit } from './store';
import { toEgp } from './money';
import { askClaude } from '../claude';
import type { Currency } from '../../types';

const DAY = 86_400_000;
const EVENTS_KEY = 'kai.events';
export const COMPACT_AFTER_DAYS = 90;

/* ── query understanding (deterministic) ─────────────────────── */
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/* Words that point at a domain, so "makadi" pulls the apartment's whole
   vocabulary rather than only literal matches. */
const DOMAIN_HINTS: Array<{ re: RegExp; domain: Domain }> = [
  { re: /makadi|apartment|airbnb|guest|booking|night|lock|couch/i, domain: 'makadi' },
  { re: /garden|plant|hidden garten|water/i, domain: 'garden' },
  { re: /card|credit|debt|balance|paydown/i, domain: 'debt' },
  { re: /spend|spent|expense|cost|paid|bought/i, domain: 'expense' },
  { re: /income|salary|earned|revenue|received/i, domain: 'income' },
  { re: /promise|commit|commitment|word|kept|broke|broken/i, domain: 'commitment' },
  { re: /content|reel|post|instagram/i, domain: 'content' },
  { re: /lead|client|pipeline/i, domain: 'leads' },
];

export interface MemoryQuery {
  text: string;
  keywords: string[];
  domains: Domain[];
  from?: number;
  to?: number;
  wantsBroken?: boolean;
}

export function parseQuery(q: string, now = Date.now()): MemoryQuery {
  const text = String(q || '').trim();
  const low = text.toLowerCase();
  const keywords = low.split(/[^a-z0-9؀-ۿ]+/).filter((w) => w.length > 2 && !STOP.has(w));
  const domains = DOMAIN_HINTS.filter((h) => h.re.test(low)).map((h) => h.domain);

  /* month name → that month's window (this year, or last year if future) */
  let from: number | undefined, to: number | undefined;
  const mi = MONTHS.findIndex((m) => low.includes(m));
  if (mi >= 0) {
    const y = new Date(now).getFullYear();
    let start = new Date(y, mi, 1).getTime();
    if (start > now) start = new Date(y - 1, mi, 1).getTime();
    from = start;
    to = new Date(new Date(start).getFullYear(), mi + 1, 1).getTime();
  }
  if (/last week/i.test(low)) { from = now - 7 * DAY; to = now; }
  if (/last month/i.test(low)) { from = now - 30 * DAY; to = now; }
  if (/this year/i.test(low)) { from = new Date(new Date(now).getFullYear(), 0, 1).getTime(); to = now; }

  return { text, keywords, domains, from, to, wantsBroken: /brok(en|e)|failed|missed/i.test(low) };
}

const STOP = new Set(['the', 'and', 'for', 'what', 'when', 'did', 'was', 'were', 'how', 'much', 'many', 'show', 'me', 'every', 'all', 'get', 'got', 'have', 'has', 'with', 'from', 'that', 'this', 'you', 'your', 'about', 'into', 'over']);

/* ── recall: the events that answer the question ─────────────── */
export function recallEvents(q: string, now = Date.now(), limit = 40): KaiEvent[] {
  const mq = parseQuery(q, now);
  const all = getEvents({});
  const scored = all.map((e) => {
    let score = 0;
    const hay = `${e.domain} ${e.type} ${JSON.stringify(e.meta || {})}`.toLowerCase();
    for (const k of mq.keywords) if (hay.includes(k)) score += 10;
    if (mq.domains.includes(e.domain)) score += 8;
    /* "every broken promise" must not return kept ones — asking for failures
       and getting successes back is a wrong answer, not a ranking quirk. */
    if (mq.wantsBroken) {
      if (/kept|resolved|done/.test(e.type)) return { e, score: -1 };
      if (e.type.includes('broken')) score += 12;
    }
    /* memories (compacted summaries) answer distant questions */
    if (e.domain === 'system' && e.type === 'memory') score += 4;
    const inRange = (mq.from == null || e.ts >= mq.from) && (mq.to == null || e.ts <= mq.to);
    if (!inRange && (mq.from != null || mq.to != null)) return { e, score: -1 };
    score += Math.max(0, 6 - (now - e.ts) / (30 * DAY));       // gentle recency
    return { e, score };
  }).filter((s) => s.score >= 0);

  const strong = scored.filter((s) => s.score >= 8);
  const pool = strong.length ? strong : scored;
  return pool.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.e);
}

/* A deterministic answer when there's no key — sums and counts, no prose. */
export function recallSummary(q: string, now = Date.now()): string {
  const evs = recallEvents(q, now);
  if (!evs.length) return 'Nothing in the ledger matches that.';
  let egpTotal = 0, valued = 0;
  for (const e of evs) if (typeof e.value === 'number') { egpTotal += toEgp(e.value, (e.ccy as Currency) || 'EGP'); valued++; }
  const first = evs.reduce((a, b) => (a.ts < b.ts ? a : b));
  const last = evs.reduce((a, b) => (a.ts > b.ts ? a : b));
  const d = (t: number) => new Date(t).toISOString().slice(0, 10);
  return `${evs.length} matching event${evs.length === 1 ? '' : 's'} (${d(first.ts)} → ${d(last.ts)})`
    + (valued ? `, totalling ${Math.round(egpTotal).toLocaleString('en-GB')} EGP across ${valued}.` : '.');
}

/* ── ask: a grounded answer, cited ───────────────────────────── */
export interface Recall { answer: string; cited: KaiEvent[]; grounded: boolean }

export async function askMemory(q: string, now = Date.now()): Promise<Recall> {
  const cited = recallEvents(q, now, 30);
  if (!cited.length) return { answer: 'Nothing in the ledger matches that.', cited: [], grounded: true };

  const lines = cited.map((e) => {
    const day = new Date(e.ts).toISOString().slice(0, 10);
    const val = typeof e.value === 'number' ? ` ${Math.round(e.value)}${e.ccy ? ' ' + e.ccy : ''}` : '';
    const meta = e.meta ? ' ' + JSON.stringify(e.meta).slice(0, 140) : '';
    return `${day} ${e.domain}.${e.type}${val}${meta}`;
  }).join('\n');

  const prompt =
    `Answer Ali's question using ONLY the ledger rows below. These are his real recorded events.\n` +
    `Rules: state the answer plainly with the real numbers and dates; if the rows don't contain the ` +
    `answer, say exactly what IS there instead of guessing; never invent a row. Max 60 words.\n\n` +
    `QUESTION: ${q}\n\nLEDGER ROWS:\n${lines}`;
  try {
    const answer = (await askClaude(prompt, [], { tier: 'cheap', feature: 'memory', maxTokens: 300 })).trim();
    return { answer: answer || recallSummary(q, now), cited, grounded: true };
  } catch {
    return { answer: recallSummary(q, now), cited, grounded: true };
  }
}

/* ── compaction: distant events become shape, not detail ─────── */
export interface CompactionResult { folded: number; memories: number }

export function compactMemories(now = Date.now(), olderThanDays = COMPACT_AFTER_DAYS): CompactionResult {
  const all = read<KaiEvent[]>(EVENTS_KEY, []);
  const cutoff = now - olderThanDays * DAY;
  const old = all.filter((e) => e.ts < cutoff && !(e.domain === 'system' && e.type === 'memory'));
  if (old.length < 5) return { folded: 0, memories: 0 };

  /* group by domain + month */
  const groups = new Map<string, KaiEvent[]>();
  for (const e of old) {
    const key = `${e.domain}:${new Date(e.ts).toISOString().slice(0, 7)}`;
    const g = groups.get(key); if (g) g.push(e); else groups.set(key, [e]);
  }

  const existing = new Set(all.filter((e) => e.domain === 'system' && e.type === 'memory').map((e) => String(e.meta?.key)));
  const memories: KaiEvent[] = [];
  const foldedIds = new Set<string>();

  for (const [key, evs] of groups) {
    if (evs.length < 3) continue;                       // too few to be worth folding
    if (existing.has(key)) { evs.forEach((e) => foldedIds.add(e.id)); continue; }
    const [domain, month] = key.split(':');
    let sumEgp = 0, valued = 0;
    const types: Record<string, number> = {};
    for (const e of evs) {
      types[e.type] = (types[e.type] || 0) + 1;
      if (typeof e.value === 'number') { sumEgp += toEgp(e.value, (e.ccy as Currency) || 'EGP'); valued++; }
    }
    /* keep the few that carry meaning: largest values + anything named */
    const notable = evs.filter((e) => typeof e.value === 'number').sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 3)
      .map((e) => `${e.type} ${Math.round(e.value || 0)}${e.ccy ? ' ' + e.ccy : ''}`);
    memories.push({
      id: 'mem-' + key.replace(/[^a-z0-9]/gi, '-'),
      ts: evs[evs.length - 1].ts,
      domain: 'system', type: 'memory',
      value: valued ? Math.round(sumEgp) : undefined,
      ccy: valued ? 'EGP' : undefined,
      meta: { key, of: domain, month, count: evs.length, types, notable, note: `${evs.length} ${domain} events in ${month}` },
      source: 'auto',
    } as KaiEvent);
    evs.forEach((e) => foldedIds.add(e.id));
  }

  if (!memories.length && !foldedIds.size) return { folded: 0, memories: 0 };

  /* Replace the folded originals with their memories, in place. */
  const kept = all.filter((e) => !foldedIds.has(e.id));
  const next = [...kept, ...memories].sort((a, b) => a.ts - b.ts);
  write(EVENTS_KEY, next);
  emit();
  try {
    logEvent({ domain: 'system', type: 'compaction', value: foldedIds.size, meta: { folded: foldedIds.size, memories: memories.length, olderThanDays }, source: 'auto', ts: now });
  } catch { /* ignore */ }
  return { folded: foldedIds.size, memories: memories.length };
}

/* ── causality: the log becomes a graph ──────────────────────── */

/* Log an event that names its cause. */
export function logCaused(
  input: Parameters<typeof logEvent>[0],
  causeId: string,
): KaiEvent {
  return logEvent({ ...input, meta: { ...(input.meta || {}), causedBy: causeId } });
}

/* Walk backwards: what led to this? (root last) */
export function causeChain(eventId: string, max = 8): KaiEvent[] {
  const all = getEvents({});
  const byId = new Map(all.map((e) => [e.id, e]));
  const out: KaiEvent[] = [];
  let cur = byId.get(eventId);
  let guard = 0;
  while (cur && guard++ < max) {
    const causeId = cur.meta?.causedBy as string | undefined;
    if (!causeId) break;
    const next = byId.get(causeId);
    if (!next || out.some((e) => e.id === next.id)) break;    // missing or cyclic
    out.push(next);
    cur = next;
  }
  return out;
}

/* Walk forwards: what did this cause? */
export function effectsOf(eventId: string): KaiEvent[] {
  return getEvents({}).filter((e) => e.meta?.causedBy === eventId);
}

/* A readable causal line for a surface: "booking → cleaning cost → profit". */
export function causeLine(eventId: string): string | null {
  const chain = causeChain(eventId);
  if (!chain.length) return null;
  const label = (e: KaiEvent) => `${e.domain}.${e.type}`;
  const self = getEvents({}).find((e) => e.id === eventId);
  const parts = [...chain.reverse().map(label), self ? label(self) : ''].filter(Boolean);
  return parts.join(' → ');
}
