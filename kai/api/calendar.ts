/* ============================================================
   /api/calendar — read-only Google Calendar via secret iCal URL.

   Server-side env: GOOGLE_CALENDAR_ICAL_URL (never exposed to the
   client). Uses native `fetch` (available on Node 18+) and a small
   inline ICS parser — no `node-ical` / `rrule` / `moment-timezone`
   so the function bundles cleanly and deploys instead of falling
   back to the SPA.

   Returns JSON: { ok, status, events: [{title, start, end, allDay,
   location?}], message?, cached_at? }. Up to 10 upcoming events
   inside a 120-day horizon. Recurring events (DAILY / WEEKLY /
   MONTHLY / YEARLY with INTERVAL / COUNT / UNTIL / BYDAY) are
   expanded.
   ============================================================ */

const DAY_MS = 86_400_000;
const HORIZON_MS = 120 * DAY_MS;
const TTL_OK_MS  = 5 * 60 * 1000;
const TTL_ERR_MS =     60 * 1000;

type EventOut = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
};

type Result = {
  ok: boolean;
  status: 'ok' | 'no-key' | 'fetch-error' | 'parse-error' | 'method-not-allowed' | string;
  events: EventOut[];
  message?: string;
  cached_at?: number;
};

let cache: Result | null = null;
let cacheAt = 0;

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');

  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, status: 'method-not-allowed', events: [] });
  }

  const url = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!url || !url.trim()) {
    return res.status(200).json({
      ok: false,
      status: 'no-key',
      events: [],
      message: 'GOOGLE_CALENDAR_ICAL_URL not set on the server.',
    });
  }

  const ttl = cache?.status === 'ok' ? TTL_OK_MS : TTL_ERR_MS;
  if (cache && Date.now() - cacheAt < ttl) {
    return res.status(200).json({ ...cache, cached_at: cacheAt });
  }

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'KAI/1.0' },
      /* AbortSignal.timeout is available in Node 18+; guarded below. */
      signal: typeof (AbortSignal as any).timeout === 'function'
        ? (AbortSignal as any).timeout(10_000)
        : undefined,
    });
    if (!r.ok) {
      const out: Result = { ok: false, status: 'http-' + r.status, events: [] };
      cache = out; cacheAt = Date.now();
      return res.status(200).json({ ...out, cached_at: cacheAt });
    }
    const text = await r.text();
    const parsed = parseICS(text);
    const expanded = expandEvents(parsed, HORIZON_MS);

    const now = Date.now();
    const formatted = expanded
      .filter(ev => ev.start && +ev.start > now - 60_000)
      .sort((a, b) => +a.start! - +b.start!)
      .slice(0, 10)
      .map<EventOut>(ev => {
        const out: EventOut = {
          title: cleanString(ev.summary) || '(untitled)',
          start: ev.start!.toISOString(),
          end:   (ev.end || ev.start!).toISOString(),
          allDay: !!ev.allDay,
        };
        const loc = cleanString(ev.location);
        if (loc) out.location = loc;
        return out;
      });

    cache = { ok: true, status: 'ok', events: formatted };
    cacheAt = Date.now();
    return res.status(200).json({ ...cache, cached_at: cacheAt });
  } catch (e: any) {
    const msg = String(e?.message || e || 'unknown').slice(0, 240);
    const status = /parse|vevent|dtstart|rrule/i.test(msg) ? 'parse-error' : 'fetch-error';
    const out: Result = { ok: false, status, events: [], message: msg };
    cache = out; cacheAt = Date.now();
    return res.status(200).json({ ...out, cached_at: cacheAt });
  }
}

/* ──────────────────────────────────────────────────────────────
   Inline ICS parser. Handles VEVENT blocks, line unfolding,
   RFC-5545 escape sequences, DATE/DATE-TIME values, and the most
   common RRULE shapes. Deliberately ignores VALARM / VTIMEZONE
   / TZID — we coerce TZID datetimes as UTC since the calendar
   tile cares about ordering, not down-to-the-minute local times.
   ────────────────────────────────────────────────────────────── */

type ParsedEvent = {
  uid?: string;
  summary?: string;
  start?: Date;
  end?: Date;
  location?: string;
  allDay?: boolean;
  rrule?: ParsedRRule;
};

type RruleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type ParsedRRule = {
  freq?: RruleFreq;
  interval?: number;
  until?: Date;
  count?: number;
  byday?: string[];
};

const DAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseICS(text: string): ParsedEvent[] {
  /* Unfold per RFC 5545: a leading space or tab means line continuation. */
  const lines: string[] = [];
  for (const raw of String(text || '').split(/\r\n|\n|\r/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }

  const events: ParsedEvent[] = [];
  let cur: ParsedEvent | null = null;
  let inEvent = false;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; inEvent = true; continue; }
    if (line === 'END:VEVENT')   {
      if (cur && cur.start) events.push(cur);
      cur = null; inEvent = false; continue;
    }
    if (!inEvent || !cur) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const left  = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const segs  = left.split(';');
    const name  = segs[0];
    const params = segs.slice(1);

    if (name === 'SUMMARY')      cur.summary  = unescapeIcs(value);
    else if (name === 'LOCATION') cur.location = unescapeIcs(value);
    else if (name === 'UID')      cur.uid      = value;
    else if (name === 'DTSTART') {
      const isDateOnly = params.includes('VALUE=DATE') || /^\d{8}$/.test(value);
      cur.start = parseDateValue(value);
      if (isDateOnly) cur.allDay = true;
    }
    else if (name === 'DTEND') {
      cur.end = parseDateValue(value);
    }
    else if (name === 'RRULE') {
      cur.rrule = parseRRule(value);
    }
  }

  return events;
}

function unescapeIcs(s: string): string {
  return String(s)
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseDateValue(value: string): Date {
  if (/^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4);
    const m = +value.slice(4, 6) - 1;
    const d = +value.slice(6, 8);
    return new Date(Date.UTC(y, m, d));
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const Y = +m[1], M = +m[2] - 1, D = +m[3];
    const H = +m[4], MI = +m[5], S = +m[6];
    /* Z = UTC. No Z and no TZID = "floating" — we treat as UTC. */
    return new Date(Date.UTC(Y, M, D, H, MI, S));
  }
  const n = Date.parse(value);
  return Number.isNaN(n) ? new Date(0) : new Date(n);
}

function parseRRule(value: string): ParsedRRule {
  const out: ParsedRRule = {};
  for (const part of String(value).split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === 'FREQ' && (v === 'DAILY' || v === 'WEEKLY' || v === 'MONTHLY' || v === 'YEARLY')) {
      out.freq = v;
    } else if (k === 'INTERVAL') out.interval = parseInt(v) || 1;
    else if (k === 'COUNT')      out.count    = parseInt(v) || 0;
    else if (k === 'UNTIL')      out.until    = parseDateValue(v);
    else if (k === 'BYDAY')      out.byday    = v.split(',').map(s => s.replace(/^[+-]?\d+/, ''));
  }
  return out;
}

/* Expand recurring events into concrete occurrences within the horizon. */
function expandEvents(events: ParsedEvent[], horizonMs: number): ParsedEvent[] {
  const now = Date.now();
  const horizonEnd = now + horizonMs;
  const out: ParsedEvent[] = [];

  for (const ev of events) {
    if (!ev.start || Number.isNaN(+ev.start)) continue;

    if (!ev.rrule) {
      if (+ev.start > now - DAY_MS && +ev.start < horizonEnd) out.push(ev);
      continue;
    }

    const { freq, interval = 1, until, count, byday } = ev.rrule;
    if (!freq) { out.push(ev); continue; }

    const duration = ev.end ? Math.max(0, +ev.end - +ev.start) : 0;
    const stopAt = until ? Math.min(+until, horizonEnd) : horizonEnd;
    const maxCount = count && count > 0 ? count : 400;

    let cur = new Date(+ev.start);
    let i = 0;
    while (+cur < stopAt && i < maxCount && out.length < 400) {
      const inWindow = +cur > now - DAY_MS;
      const dayOk = !byday || byday.length === 0
        ? true
        : byday.includes(Object.keys(DAY_INDEX).find(k => DAY_INDEX[k] === cur.getUTCDay()) || '');
      if (inWindow && dayOk) {
        out.push({ ...ev, start: new Date(+cur), end: new Date(+cur + duration) });
      }
      cur = step(cur, freq, interval);
      i++;
    }
  }

  return out;
}

function step(d: Date, freq: RruleFreq, interval: number): Date {
  const t = new Date(d);
  if (freq === 'DAILY')   t.setUTCDate(t.getUTCDate() + interval);
  else if (freq === 'WEEKLY')  t.setUTCDate(t.getUTCDate() + 7 * interval);
  else if (freq === 'MONTHLY') t.setUTCMonth(t.getUTCMonth() + interval);
  else                          t.setUTCFullYear(t.getUTCFullYear() + interval);
  return t;
}

function cleanString(s: any): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}
