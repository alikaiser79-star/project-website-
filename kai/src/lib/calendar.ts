/* Calendar fetch + in-memory cache + pub/sub.

   AgendaTile + the Claude get_calendar tool + the daily briefing
   all read through this module. fetchCalendar() de-duplicates
   in-flight calls and respects a soft client-side TTL on top of
   the server's cache-control. */

export type CalEvent = {
  title: string;
  start: string;     // ISO 8601
  end: string;       // ISO 8601
  allDay: boolean;
  location?: string;
};

export type CalResult = {
  ok: boolean;
  status: string;
  events: CalEvent[];
  message?: string;
  cached_at?: number;
};

let latest: CalResult = { ok: false, status: 'idle', events: [] };
const listeners = new Set<(r: CalResult) => void>();
let inFlight: Promise<CalResult> | null = null;
let lastAt = 0;
const TTL_MS = 5 * 60_000;

export function getCalendarCached(): CalResult { return latest; }

export function onCalendarUpdate(fn: (r: CalResult) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function setLatest(r: CalResult) {
  latest = r;
  listeners.forEach(fn => { try { fn(r); } catch {} });
}

export async function fetchCalendar(force = false): Promise<CalResult> {
  if (!force && inFlight) return inFlight;
  if (!force && Date.now() - lastAt < TTL_MS && latest.status === 'ok') return latest;
  inFlight = doFetch();
  try {
    const r = await inFlight;
    lastAt = Date.now();
    setLatest(r);
    return r;
  } finally {
    inFlight = null;
  }
}

async function doFetch(): Promise<CalResult> {
  try {
    const r = await fetch('/api/calendar', { cache: 'no-store' });
    if (!r.ok) return { ok: false, status: 'http-' + r.status, events: [] };
    const j = await r.json();
    if (j && typeof j === 'object' && Array.isArray(j.events)) {
      return {
        ok: Boolean(j.ok),
        status: String(j.status || 'unknown'),
        events: j.events.filter((e: any) => e && typeof e === 'object' && typeof e.start === 'string'),
        message: typeof j.message === 'string' ? j.message : undefined,
        cached_at: typeof j.cached_at === 'number' ? j.cached_at : undefined,
      };
    }
    return { ok: false, status: 'bad-payload', events: [] };
  } catch (e: any) {
    return { ok: false, status: 'fetch-error', events: [], message: String(e?.message || e || '') };
  }
}
