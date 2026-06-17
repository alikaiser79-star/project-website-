/* ============================================================
   /api/calendar — read-only Google Calendar via secret iCal URL.

   The .ics URL lives ONLY in server env GOOGLE_CALENDAR_ICAL_URL.
   The browser POSTs (well, GETs) this endpoint; we fetch the
   .ics, parse it with node-ical, and return up to 10 upcoming
   events as JSON. The URL never reaches the client.

   In-memory cache + edge cache-control so we don't hammer Google.
   ============================================================ */

import * as ical from 'node-ical';

type EventOut = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
};

type Result = {
  ok: boolean;
  status: 'ok' | 'no-key' | 'fetch-error' | 'parse-error' | 'method-not-allowed';
  events: EventOut[];
  message?: string;
  cached_at?: number;
};

let cache: Result | null = null;
let cacheAt = 0;
const TTL_OK_MS   = 5 * 60 * 1000;
const TTL_ERR_MS  =       60 * 1000;

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  /* Tell the edge to cache this for 5 minutes; SWR lets stale
     responses serve instantly while we revalidate behind the
     scenes. */
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');

  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ ok: false, status: 'method-not-allowed', events: [] });
  }

  const url = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!url || !url.trim()) {
    /* Soft failure — let the client show a clean empty state. */
    const out: Result = {
      ok: false,
      status: 'no-key',
      events: [],
      message: 'GOOGLE_CALENDAR_ICAL_URL not set on the server.',
    };
    return res.status(200).json(out);
  }

  /* In-process cache — survives warm invocations. */
  const ttl = cache?.status === 'ok' ? TTL_OK_MS : TTL_ERR_MS;
  if (cache && Date.now() - cacheAt < ttl) {
    return res.status(200).json({ ...cache, cached_at: cacheAt });
  }

  try {
    const events = await fetchAndParse(url);
    cache = { ok: true, status: 'ok', events };
    cacheAt = Date.now();
    return res.status(200).json({ ...cache, cached_at: cacheAt });
  } catch (e: any) {
    const msg = String(e?.message || e || 'unknown').slice(0, 240);
    const status: Result['status'] =
      /parse|vevent|dtstart|ical/i.test(msg) ? 'parse-error' : 'fetch-error';
    const out: Result = { ok: false, status, events: [], message: msg };
    cache = out;
    cacheAt = Date.now();
    return res.status(200).json({ ...out, cached_at: cacheAt });
  }
}

async function fetchAndParse(url: string): Promise<EventOut[]> {
  /* node-ical fetches + parses in one go. Throws on HTTP / parse error. */
  const data = await (ical as any).async.fromURL(url);
  const now = Date.now();
  const horizonMs = 120 * 86_400_000;     /* look 120 days forward */
  const out: EventOut[] = [];

  for (const key of Object.keys(data)) {
    const ev: any = (data as any)[key];
    if (!ev || ev.type !== 'VEVENT') continue;
    if (!ev.start) continue;

    if (ev.rrule) {
      /* Recurring — expand instances inside the window. */
      try {
        const range = ev.rrule.between(
          new Date(now - 86_400_000),
          new Date(now + horizonMs),
          true,
        );
        const duration = ev.end
          ? ev.end.getTime() - ev.start.getTime()
          : 0;
        for (const occ of range) {
          if (occ.getTime() < now - 60_000) continue;
          if (ev.exdate) {
            const fullKey = occ.toISOString();
            const dayKey  = fullKey.slice(0, 10);
            if (ev.exdate[fullKey] || ev.exdate[dayKey]) continue;
          }
          const occEnd = new Date(occ.getTime() + duration);
          out.push(formatEvent(ev, occ, occEnd));
          if (out.length > 80) break;
        }
      } catch {
        /* malformed rrule — skip silently */
      }
    } else {
      const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
      const end   = ev.end   instanceof Date ? ev.end   : new Date(ev.end || ev.start);
      if (Number.isNaN(+start)) continue;
      if (start.getTime() < now - 60_000) continue;
      if (start.getTime() > now + horizonMs) continue;
      out.push(formatEvent(ev, start, end));
    }
  }

  out.sort((a, b) => +new Date(a.start) - +new Date(b.start));
  return out.slice(0, 10);
}

function formatEvent(ev: any, start: Date, end: Date): EventOut {
  const out: EventOut = {
    title: cleanString(ev.summary ?? '(untitled)'),
    start: start.toISOString(),
    end:   end.toISOString(),
    allDay: isAllDay(ev, start, end),
  };
  if (ev.location) {
    const loc = cleanString(ev.location);
    if (loc) out.location = loc;
  }
  return out;
}

function isAllDay(ev: any, start: Date, end: Date): boolean {
  /* node-ical flags DATE-only events with `datetype === 'date'`. */
  if (ev.datetype === 'date') return true;
  return (
    start.getUTCHours() === 0 && start.getUTCMinutes() === 0 &&
    end.getUTCHours()   === 0 && end.getUTCMinutes()   === 0 &&
    (end.getTime() - start.getTime()) % 86_400_000 === 0
  );
}

function cleanString(s: any): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}
