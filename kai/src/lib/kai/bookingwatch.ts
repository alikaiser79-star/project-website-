/* ============================================================
   THE WATCHERS (§14.3) — the Makadi booking-watcher. READ-ONLY: scans
   the inbox for Airbnb (and other platform) booking mail and turns it
   into Spine truth:
     • a booking REQUEST      → makadi/booking_inquiry  (pulse nudges >2h)
     • a CONFIRMED reservation → makadi/booking_confirmed + makadi/nights_booked
       → the Makadi organ QUIETS, the "first booking" commitment resolves,
       and KAI SPEAKS: an immediate push — the first booking is the moment
       KAI was built to announce.

   Discipline: ONE inbox read + ONE cheap classify per scan (the
   one-search-cap), throttled. This is an INSTANCE of the watch pattern.

   TELEMETRY (CORE-V4 rule — NO invisible operations): every scan records
   a ScanRec (ts, reason, counts, error) to a rolling log, and a real miss
   (fresh candidates we failed to classify) also logs a VISIBLE
   system/watcher_error to the Spine. A failed classify NEVER marks a
   thread seen — so a missed booking is retried, never silently burned.
   ============================================================ */

import { logEvent, getEvents } from './events';
import { askClaude } from '../claude';
import { announcePush } from './shadow';

const SEEN = 'kai.bookingwatch.seen';       // thread ids we actually CLASSIFIED (any kind)
const PUSHED = 'kai.bookingwatch.pushed';   // confirmed threads already announced (never double-push)
const LAST = 'kai.bookingwatch.last';
const TELE = 'kai.bookingwatch.telemetry';  // rolling last-N scan records (visible telemetry)
const MIN_GAP = 20 * 60 * 1000;             // ≥20min between booking scans
const QUERY =
  'in:inbox newer_than:21d ' +
  '(from:airbnb.com OR from:airbnb OR from:booking.com OR from:express@airbnb.com OR ' +
  'subject:reservation OR subject:booking OR subject:reserved OR subject:confirmed) ' +
  '(reservation OR booking OR reserved OR confirmed OR guest OR "checking in" OR "check-in" OR nights OR Makadi OR itinerary)';

interface MailMsg { id: string; from: string; subject: string; date: string; snippet: string; threadId?: string; }
type Kind = 'confirmed' | 'inquiry' | 'none';

/* A single scan's outcome — this is the visible telemetry record. */
export interface ScanRec {
  ts: number; ran: boolean; reason: string;
  scanned: number; fresh: number; classified: number;
  confirmed: number; inquiries: number; pushed: number; error?: string;
}

function loadSet(key: string): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } }
function addToSet(key: string, ids: string[]) { try { const s = loadSet(key); ids.forEach((i) => s.add(i)); localStorage.setItem(key, JSON.stringify([...s].slice(-200))); } catch { /* ignore */ } }
function lastScan(): number { try { return Number(localStorage.getItem(LAST)) || 0; } catch { return 0; } }
function markScanned(now: number) { try { localStorage.setItem(LAST, String(now)); } catch { /* ignore */ } }
function recordScan(rec: ScanRec) { try { const log: ScanRec[] = JSON.parse(localStorage.getItem(TELE) || '[]'); log.push(rec); localStorage.setItem(TELE, JSON.stringify(log.slice(-20))); } catch { /* ignore */ } }

/* Visible telemetry accessors — surfaced in the app + window.__kaiBookingLog(). */
export function getBookingTelemetry(): ScanRec[] { try { return JSON.parse(localStorage.getItem(TELE) || '[]'); } catch { return []; } }
export function lastBookingScan(): ScanRec | null { const l = getBookingTelemetry(); return l.length ? l[l.length - 1] : null; }

/* Scan once. Logs makadi booking events for fresh threads; fires the
   first-booking push on a newly-confirmed reservation. ALWAYS records a
   telemetry ScanRec (and returns it) so "did it run, and what happened?"
   is never a guess. */
export async function scanBookings(force = false, now = Date.now()): Promise<ScanRec> {
  const base: ScanRec = { ts: now, ran: false, reason: '', scanned: 0, fresh: 0, classified: 0, confirmed: 0, inquiries: 0, pushed: 0 };
  const done = (r: Partial<ScanRec>): ScanRec => { const rec = { ...base, ...r }; recordScan(rec); return rec; };

  if (!force && now - lastScan() < MIN_GAP) return done({ reason: 'throttled' });

  let msgs: MailMsg[] = [];
  try {
    const r = await fetch('/api/gmail/list?q=' + encodeURIComponent(QUERY));
    if (!r.ok) { markScanned(now); return done({ reason: r.status === 401 || r.status === 403 ? 'gmail_auth' : 'gmail_unavailable', error: 'gmail ' + r.status }); }
    const d = await r.json();
    msgs = Array.isArray(d.messages) ? d.messages : [];
  } catch (e: any) { markScanned(now); return done({ reason: 'gmail_error', error: String(e?.message || e).slice(0, 120) }); }
  markScanned(now);

  const seen = loadSet(SEEN);
  const fresh = msgs.filter((m) => m.id && !seen.has(m.threadId || m.id));
  if (!fresh.length) return done({ ran: true, reason: 'no_fresh', scanned: msgs.length });

  /* ONE cheap classify over the fresh batch. */
  const flags: Record<string, { kind: Kind; guest?: string; dates?: string; nights?: number; amount?: string }> = {};
  let classifyError: string | undefined;
  try {
    const list = fresh.slice(0, 12).map((m, i) => `[${i}] from:${m.from} subj:${m.subject} — ${m.snippet}`).join('\n');
    const prompt =
      'Ali runs a Makadi (Hurghada) short-term rental, listed on Airbnb. Classify each inbox ' +
      'message as one of: "confirmed" (a reservation is CONFIRMED/booked/itinerary), "inquiry" (a guest ' +
      'is requesting or asking to book, not yet confirmed), or "none" (newsletter, receipt, tips, ' +
      'platform noise). Extract the guest name, dates, night count, and amount when present. ' +
      'Return ONLY a JSON array of {"i":<index>,"kind":"confirmed"|"inquiry"|"none",' +
      '"guest":"<name>","dates":"<e.g. Aug 3–6>","nights":<int>,"amount":"<e.g. $220>"}.\n\n' + list;
    const raw = await askClaude(prompt, [], { tier: 'cheap', feature: 'bookingwatch', maxTokens: 600 });
    const m = String(raw || '').match(/\[[\s\S]*\]/);
    if (m) for (const item of JSON.parse(m[0])) {
      const msg = fresh[item.i];
      if (msg) flags[msg.threadId || msg.id] = { kind: (item.kind || 'none') as Kind, guest: item.guest, dates: item.dates, nights: Number(item.nights) || undefined, amount: item.amount };
    }
  } catch (e: any) { classifyError = String(e?.message || e).slice(0, 140); }

  const classifiedThreads = Object.keys(flags);

  /* A real miss: fresh candidate mail we could NOT classify (usually a
     missing ANTHROPIC_API_KEY). Make it LOUD — a Spine event that syncs and
     surfaces — and DO NOT mark the threads seen, so the very next scan (once
     the key is fixed) retries them. A booking can never be silently burned. */
  if (!classifiedThreads.length) {
    const noKey = /NO_API_KEY|api_key|503/i.test(classifyError || '');
    try {
      logEvent({
        domain: 'system', type: 'watcher_error',
        meta: { watcher: 'booking', reason: classifyError ? 'classify_failed' : 'classify_empty', fresh: fresh.length, error: classifyError, hint: noKey ? 'ANTHROPIC_API_KEY likely missing in prod' : undefined },
        source: 'auto', ts: now,
      });
    } catch { /* ignore */ }
    return done({ ran: true, reason: noKey ? 'no_api_key' : classifyError ? 'classify_error' : 'classify_empty', scanned: msgs.length, fresh: fresh.length, error: classifyError });
  }

  /* Was there EVER a confirmed booking before this scan? Decides the copy. */
  const hadBookingBefore = getEvents({ domain: 'makadi', type: 'booking_confirmed' }).length > 0;

  let inquiries = 0, confirmed = 0, pushed = 0;
  let firstThisScan = !hadBookingBefore;
  const pushedSet = loadSet(PUSHED);

  for (const m of fresh.slice(0, 12)) {
    const thread = m.threadId || m.id;
    const f = flags[thread];
    if (!f) continue;   // classifier omitted this one → left UNSEEN, retried next scan

    if (f.kind === 'confirmed') {
      logEvent({
        domain: 'makadi', type: 'booking_confirmed', value: 1,
        meta: { thread, guest: f.guest || m.from, dates: f.dates, nights: f.nights, amount: f.amount, subject: m.subject },
        source: 'auto', ts: now,
      });
      logEvent({ domain: 'makadi', type: 'nights_booked', value: f.nights && f.nights > 0 ? f.nights : 1, meta: { thread, source: 'booking_confirmed' }, source: 'auto', ts: now });
      confirmed++;

      /* SPEAK — once per reservation. The first-ever booking gets the moment. */
      if (!pushedSet.has(thread)) {
        const guest = f.guest || 'A guest';
        const when = f.dates ? ` — ${f.dates}` : '';
        const title = firstThisScan ? 'KAI · FIRST BOOKING 🌅' : 'KAI · New booking';
        const body = firstThisScan
          ? `${guest} booked Makadi${when}. Your first guest. First light.`
          : `${guest} booked Makadi${when}.`;
        try {
          const res = await announcePush(title, body, 'booking-' + thread);
          if (res.ok) { pushedSet.add(thread); pushed++; }
        } catch { /* push best-effort; the pulse fallback still covers it */ }
        firstThisScan = false;
      }
    } else if (f.kind === 'inquiry') {
      logEvent({
        domain: 'makadi', type: 'booking_inquiry',
        meta: { thread, from: m.from, subject: m.subject, guest: f.guest || m.from, dates: f.dates },
        source: 'auto', ts: now,
      });
      inquiries++;
    }
  }

  /* Mark seen ONLY the threads we actually classified (any kind) — a
     'none' won't be re-classified, but an unclassified one stays open. */
  addToSet(SEEN, classifiedThreads);
  if (pushed) { try { localStorage.setItem(PUSHED, JSON.stringify([...pushedSet].slice(-200))); } catch { /* ignore */ } }
  return done({ ran: true, reason: 'ok', scanned: msgs.length, fresh: fresh.length, classified: classifiedThreads.length, confirmed, inquiries, pushed });
}

/* Mark a booking thread replied so the pulse stops nudging — called when
   Ali approves a reply to that thread at the Gate. */
export function markBookingReplied(thread: string): void {
  try { logEvent({ domain: 'makadi', type: 'booking_replied', meta: { thread }, source: 'user' }); } catch { /* ignore */ }
}
