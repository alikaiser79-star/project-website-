/* ============================================================
   §29.8 THE SENSES → THE CONTINUOUS EYE.

   Capture→ask was one-shot: KAI looked, answered, forgot. Sight now
   persists.

     OBSERVE     every photo taken through KAI is remembered WITH its
                 reading, filed under a SUBJECT — "the lemon tree", "the
                 apartment", "the Honda licence" — not a filename.
     COMPARE     "show me this plant last month" returns the same subject
                 over time, with what changed between the readings.
     REASON      each observation is written to the Spine, so the Twin and
                 the Council can reason about what the eye saw.

   Storage discipline: thumbnails only (~140px), capped, and pruned oldest-
   first — a PWA that fills its origin with full-resolution photos would
   take the Spine down with it (the §fix that cost us the bookings). The
   READING is the durable artefact; the image is an aide-mémoire.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { read, write, emit } from './store';

const DAY = 86_400_000;
const OBS_KEY = 'kai.observations';
const MAX_THUMBS = 60;              // hard cap on stored thumbnails

export interface Observation {
  id: string;
  subject: string;          // normalised: "lemon tree", "apartment", "honda licence"
  label: string;            // as spoken/seen
  reading: string;          // what KAI saw
  at: number;
  thumb?: string;           // small data URL, may be pruned away
  kind: 'plant' | 'place' | 'document' | 'thing';
}

/* ── subject identity — the thing that makes tracking possible ── */
const STOP = new Set([
  'the', 'a', 'an', 'my', 'this', 'that', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'of',
  'and', 'what', 'doing', 'show', 'me', 'how', 'looks', 'look', 'looking', 'again', 'now',
  /* inspection words that describe the ACT, not the subject — without these,
     "lemon tree check" and "lemon tree" become two different subjects and
     tracking over time silently breaks */
  'check', 'checking', 'photo', 'picture', 'pic', 'image', 'shot', 'status', 'update',
  'document', 'doc', 'file', 'scan', 'here', 'see', 'tell', 'about',
]);

/* Time phrases describe WHEN, never WHAT. Left in, "show me the lemon tree
   last month" keys on "last month" and the subject is lost — the brief's own
   example. Stripped before the subject is read. */
const TIME_RE = /\b(last|past|previous)\s+(week|month|year|time)\b|\b\d{1,3}\s*(days?|weeks?|months?)\s*ago\b|\b(today|yesterday|tomorrow|earlier|before|recently|then)\b/gi;

export function subjectKey(text: string): string {
  const words = String(text || '').toLowerCase()
    .replace(TIME_RE, ' ')
    .replace(/[^a-z0-9؀-ۿ ]/g, ' ')
    .split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  /* the last two meaningful words carry the noun in both EN and AR order */
  return words.slice(-2).join(' ') || words.join(' ') || 'subject';
}

export function classify(text: string, reading: string): Observation['kind'] {
  const s = (text + ' ' + reading).toLowerCase();
  if (/plant|tree|leaf|leaves|soil|garden|flower|نبات|شجرة/.test(s)) return 'plant';
  if (/room|apartment|kitchen|balcony|wall|floor|makadi|شقة|غرفة/.test(s)) return 'place';
  if (/licence|license|passport|contract|invoice|receipt|document|court|papers?|رخصة|عقد|مستند/.test(s)) return 'document';
  return 'thing';
}

/* ── remember ────────────────────────────────────────────────── */
export function observe(input: { question: string; reading: string; thumb?: string; now?: number }): Observation {
  const now = input.now ?? Date.now();
  const subject = subjectKey(input.question);
  const kind = classify(input.question, input.reading);
  const obs: Observation = {
    id: 'obs-' + now.toString(36) + Math.random().toString(36).slice(2, 6),
    subject, label: input.question.trim().slice(0, 80),
    reading: input.reading.trim(), at: now, thumb: input.thumb, kind,
  };

  const all = read<Observation[]>(OBS_KEY, []);
  all.push(obs);
  /* Keep every READING; drop the oldest IMAGES once past the cap. The text
     is what the Twin reasons over — the picture is only a reminder. */
  const withThumbs = all.filter((o) => o.thumb);
  if (withThumbs.length > MAX_THUMBS) {
    const drop = new Set(withThumbs.sort((a, b) => a.at - b.at).slice(0, withThumbs.length - MAX_THUMBS).map((o) => o.id));
    for (const o of all) if (drop.has(o.id)) delete o.thumb;
  }
  write(OBS_KEY, all.slice(-400));
  emit();

  /* the Spine gets the observation so the Twin/Council can reason on it */
  try {
    logEvent({
      domain: 'system', type: 'observation',
      meta: { subject, kind, label: obs.label, reading: obs.reading.slice(0, 300) },
      source: 'ai', ts: now,
    });
  } catch { /* ignore */ }
  return obs;
}

export function allObservations(): Observation[] { return read<Observation[]>(OBS_KEY, []); }

/* ── recall a subject over time ──────────────────────────────── */
export function history(question: string, now = Date.now()): Observation[] {
  const key = subjectKey(question);
  const all = allObservations();
  /* exact subject first; fall back to any shared word so "the plant" finds
     "lemon tree" when that's the only plant on record */
  const exact = all.filter((o) => o.subject === key);
  if (exact.length) return exact.sort((a, b) => a.at - b.at);
  const words = key.split(' ').filter(Boolean);
  return all.filter((o) => words.some((w) => o.subject.includes(w) || o.label.toLowerCase().includes(w)))
    .sort((a, b) => a.at - b.at);
}

export interface Comparison {
  subject: string;
  then: Observation | null;
  now: Observation | null;
  gapDays: number | null;
  line: string;
}

/* "show me this plant last month" — same subject, two points in time. */
export function compare(question: string, now = Date.now()): Comparison {
  const h = history(question, now);
  if (!h.length) return { subject: subjectKey(question), then: null, now: null, gapDays: null, line: 'I have never looked at that.' };
  if (h.length === 1) {
    const only = h[0];
    return { subject: only.subject, then: null, now: only, gapDays: null, line: `Only one look on record — ${ago(only.at, now)}: ${only.reading.slice(0, 160)}` };
  }
  const latest = h[h.length - 1];
  /* prefer a reading near the window the question implies */
  const want = wantedWindow(question, now);
  const earlier = want != null
    ? h.slice(0, -1).reduce((best, o) => (Math.abs(o.at - want) < Math.abs(best.at - want) ? o : best), h[0])
    : h[0];
  const gapDays = Math.round((latest.at - earlier.at) / DAY);
  return {
    subject: latest.subject, then: earlier, now: latest, gapDays,
    line: `${gapDays}d apart — ${ago(earlier.at, now)}: “${earlier.reading.slice(0, 110)}” → ${ago(latest.at, now)}: “${latest.reading.slice(0, 110)}”`,
  };
}

function wantedWindow(q: string, now: number): number | null {
  const s = q.toLowerCase();
  if (/last month|a month ago/.test(s)) return now - 30 * DAY;
  if (/last week/.test(s)) return now - 7 * DAY;
  if (/last year|a year ago/.test(s)) return now - 365 * DAY;
  const m = s.match(/(\d{1,3})\s*days? ago/);
  if (m) return now - parseInt(m[1], 10) * DAY;
  return null;
}

function ago(ts: number, now: number): string {
  const d = Math.floor((now - ts) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}

/* ── file a document by what it SAYS ─────────────────────────── */
export function findDocument(query: string): Observation[] {
  const words = String(query || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  return allObservations()
    .filter((o) => o.kind === 'document')
    .filter((o) => words.some((w) => o.reading.toLowerCase().includes(w) || o.label.toLowerCase().includes(w)))
    .sort((a, b) => b.at - a.at);
}

/* What the eye has been watching — for a surface or the Council. */
export function watchedSubjects(now = Date.now()): Array<{ subject: string; looks: number; last: number; kind: Observation['kind'] }> {
  const by = new Map<string, { subject: string; looks: number; last: number; kind: Observation['kind'] }>();
  for (const o of allObservations()) {
    const cur = by.get(o.subject);
    if (cur) { cur.looks++; cur.last = Math.max(cur.last, o.at); }
    else by.set(o.subject, { subject: o.subject, looks: 1, last: o.at, kind: o.kind });
  }
  return [...by.values()].sort((a, b) => b.last - a.last);
}

/* The prompt directive that makes a second look a COMPARISON. */
export function priorReadingNote(question: string, now = Date.now()): string {
  const h = history(question, now);
  if (!h.length) return '';
  const last = h[h.length - 1];
  return `\n\nYOU HAVE SEEN THIS BEFORE — ${ago(last.at, now)} you observed: "${last.reading.slice(0, 220)}". Say what has CHANGED since, specifically. If nothing visibly changed, say that plainly.`;
}
