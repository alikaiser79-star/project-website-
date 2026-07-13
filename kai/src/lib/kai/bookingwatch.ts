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
   one-search-cap), throttled. This is an INSTANCE of the watch pattern
   (like the lead-watcher `mailwatch.ts`), not a one-off. Never sends —
   detection only. Silent when Gmail isn't wired.
   ============================================================ */

import { logEvent, getEvents } from './events';
import { askClaude } from '../claude';
import { announcePush } from './shadow';

const SEEN = 'kai.bookingwatch.seen';       // thread ids already classified into events
const PUSHED = 'kai.bookingwatch.pushed';   // confirmed threads already announced (never double-push)
const LAST = 'kai.bookingwatch.last';
const MIN_GAP = 20 * 60 * 1000;             // ≥20min between booking scans
const QUERY =
  'in:inbox newer_than:14d ' +
  '(from:airbnb.com OR from:airbnb OR from:booking.com OR subject:reservation OR subject:booking OR subject:reserved) ' +
  '(reservation OR booking OR reserved OR confirmed OR guest OR "checking in" OR nights OR Makadi)';

interface MailMsg { id: string; from: string; subject: string; date: string; snippet: string; threadId?: string; }
type Kind = 'confirmed' | 'inquiry' | 'none';

function loadSet(key: string): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } }
function addToSet(key: string, ids: string[]) { try { const s = loadSet(key); ids.forEach((i) => s.add(i)); localStorage.setItem(key, JSON.stringify([...s].slice(-200))); } catch { /* ignore */ } }
function lastScan(): number { try { return Number(localStorage.getItem(LAST)) || 0; } catch { return 0; } }
function markScanned(now: number) { try { localStorage.setItem(LAST, String(now)); } catch { /* ignore */ } }

export interface BookingScanResult { ran: boolean; scanned: number; inquiries: number; confirmed: number; pushed: number; }

/* Scan once. Logs makadi booking events for fresh threads; fires the
   first-booking push on a newly-confirmed reservation. */
export async function scanBookings(force = false, now = Date.now()): Promise<BookingScanResult> {
  const nil: BookingScanResult = { ran: false, scanned: 0, inquiries: 0, confirmed: 0, pushed: 0 };
  if (!force && now - lastScan() < MIN_GAP) return nil;

  let msgs: MailMsg[] = [];
  try {
    const r = await fetch('/api/gmail/list?q=' + encodeURIComponent(QUERY));
    if (!r.ok) { markScanned(now); return nil; }        // not wired / no auth
    const d = await r.json();
    msgs = Array.isArray(d.messages) ? d.messages : [];
  } catch { markScanned(now); return nil; }
  markScanned(now);

  const seen = loadSet(SEEN);
  const fresh = msgs.filter((m) => m.id && !seen.has(m.threadId || m.id));
  if (!fresh.length) return { ran: true, scanned: msgs.length, inquiries: 0, confirmed: 0, pushed: 0 };

  /* ONE cheap classify over the fresh batch. */
  const flags: Record<string, { kind: Kind; guest?: string; dates?: string; nights?: number; amount?: string }> = {};
  try {
    const list = fresh.slice(0, 12).map((m, i) => `[${i}] from:${m.from} subj:${m.subject} — ${m.snippet}`).join('\n');
    const prompt =
      'Ali runs a Makadi (Hurghada) short-term rental, listed on Airbnb. Classify each inbox ' +
      'message as one of: "confirmed" (a reservation is CONFIRMED/booked), "inquiry" (a guest is ' +
      'requesting or asking to book, not yet confirmed), or "none" (newsletter, receipt, tips, ' +
      'platform noise). Extract the guest name, dates, night count, and amount when present. ' +
      'Return ONLY a JSON array of {"i":<index>,"kind":"confirmed"|"inquiry"|"none",' +
      '"guest":"<name>","dates":"<e.g. Aug 3–6>","nights":<int>,"amount":"<e.g. $220>"}.\n\n' + list;
    const raw = await askClaude(prompt, [], { tier: 'cheap', feature: 'bookingwatch', maxTokens: 600 });
    const m = String(raw || '').match(/\[[\s\S]*\]/);
    if (m) for (const item of JSON.parse(m[0])) {
      const msg = fresh[item.i];
      if (msg) flags[msg.threadId || msg.id] = { kind: (item.kind || 'none') as Kind, guest: item.guest, dates: item.dates, nights: Number(item.nights) || undefined, amount: item.amount };
    }
  } catch { /* classify failed — mark seen so we don't loop; log nothing */ }

  /* Was there EVER a confirmed booking before this scan? Decides the copy. */
  const hadBookingBefore = getEvents({ domain: 'makadi', type: 'booking_confirmed' }).length > 0;

  let inquiries = 0, confirmed = 0, pushed = 0;
  let firstThisScan = !hadBookingBefore;
  const pushedSet = loadSet(PUSHED);

  for (const m of fresh.slice(0, 12)) {
    const thread = m.threadId || m.id;
    const f = flags[thread];
    if (!f) continue;

    if (f.kind === 'confirmed') {
      logEvent({
        domain: 'makadi', type: 'booking_confirmed', value: 1,
        meta: { thread, guest: f.guest || m.from, dates: f.dates, nights: f.nights, amount: f.amount, subject: m.subject },
        source: 'auto', ts: now,
      });
      /* nights_booked so the organ quiets + any "first booking / N nights"
         commitment auto-resolves against a real number. */
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
        firstThisScan = false;   // only the first confirmation in a batch is "the first"
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

  addToSet(SEEN, fresh.map((m) => m.threadId || m.id));
  if (pushed) { try { localStorage.setItem(PUSHED, JSON.stringify([...pushedSet].slice(-200))); } catch { /* ignore */ } }
  return { ran: true, scanned: msgs.length, inquiries, confirmed, pushed };
}

/* Mark a booking thread replied so the pulse stops nudging — called when
   Ali approves a reply to that thread at the Gate. */
export function markBookingReplied(thread: string): void {
  try { logEvent({ domain: 'makadi', type: 'booking_replied', meta: { thread }, source: 'user' }); } catch { /* ignore */ }
}
