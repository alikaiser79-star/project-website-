/* ============================================================
   THE WATCHERS (§14.3) — the Gmail lead-watcher. READ-ONLY: scans the
   inbox for genuine booking inquiries (Makadi Airbnb / Hidden Garden),
   and for each NEW thread logs a leads/booking_inquiry Spine event. The
   pulse (_pulse-core) turns an unanswered inquiry >2h into a priority
   push; the Night Ledger and Leads pipeline surface the rest.

   Discipline: ONE inbox read + ONE cheap classify call per scan (the
   one-search-cap), throttled. Never sends — a reply only leaves the
   device through the Gate. Silent when Gmail isn't wired.

   The Makadi market-watcher is a web watch and lives in the Radar seed
   set (watches.ts); this module is the mail half of §14.3.
   ============================================================ */

import { logEvent, getEvents } from './events';
import { addLead } from './leads';
import { askClaude } from '../claude';

const SEEN = 'kai.mailwatch.seen';        // thread ids already turned into inquiries
const LAST = 'kai.mailwatch.last';
const MIN_GAP = 30 * 60 * 1000;           // ≥30min between inbox scans
const QUERY =
  'in:inbox newer_than:3d -category:promotions ' +
  '(booking OR reservation OR available OR availability OR nights OR stay OR "check in" OR ' +
  'checkin OR Makadi OR "Hidden Garden" OR guest OR dates)';

interface MailMsg { id: string; from: string; subject: string; date: string; snippet: string; threadId?: string; }

function seen(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { return new Set(); } }
function markSeen(ids: string[]) { try { const s = seen(); ids.forEach((i) => s.add(i)); localStorage.setItem(SEEN, JSON.stringify([...s].slice(-200))); } catch { /* ignore */ } }
function lastScan(): number { try { return Number(localStorage.getItem(LAST)) || 0; } catch { return 0; } }
function markScanned(now: number) { try { localStorage.setItem(LAST, String(now)); } catch { /* ignore */ } }

export interface MailScanResult { ran: boolean; scanned: number; inquiries: number; }

/* Scan the inbox once. Returns the count of NEW booking inquiries logged. */
export async function scanInbox(force = false, now = Date.now()): Promise<MailScanResult> {
  if (!force && now - lastScan() < MIN_GAP) return { ran: false, scanned: 0, inquiries: 0 };

  let msgs: MailMsg[] = [];
  try {
    const r = await fetch('/api/gmail/list?q=' + encodeURIComponent(QUERY));
    if (!r.ok) { markScanned(now); return { ran: false, scanned: 0, inquiries: 0 }; }  // not wired / no auth
    const d = await r.json();
    msgs = Array.isArray(d.messages) ? d.messages : [];
  } catch { markScanned(now); return { ran: false, scanned: 0, inquiries: 0 }; }
  markScanned(now);

  /* Only classify threads we haven't already turned into inquiries. Use
     message id as the thread key (list is metadata-only; the id is stable
     and dedupes repeat scans of the same message). */
  const already = seen();
  const fresh = msgs.filter((m) => m.id && !already.has(m.threadId || m.id));
  if (!fresh.length) return { ran: true, scanned: msgs.length, inquiries: 0 };

  /* ONE cheap classify call over the fresh batch. */
  let flags: Record<string, { inquiry: boolean; who?: string; summary?: string }> = {};
  try {
    const list = fresh.slice(0, 12).map((m, i) =>
      `[${i}] from:${m.from} subj:${m.subject} — ${m.snippet}`).join('\n');
    const prompt =
      'Ali runs a Makadi (Hurghada) Airbnb and the Hidden Garden venue in Cairo. From these ' +
      'inbox messages, mark which are GENUINE booking / availability / reservation inquiries from ' +
      'a prospective guest (not newsletters, receipts, or platform notifications). Return ONLY a ' +
      'JSON array of {"i":<index>,"inquiry":true|false,"who":"<name or property>","summary":"<=10 words"}.\n\n' +
      list;
    const raw = await askClaude(prompt, [], { tier: 'cheap', feature: 'mailwatch', maxTokens: 500 });
    const m = String(raw || '').match(/\[[\s\S]*\]/);
    if (m) for (const item of JSON.parse(m[0])) {
      const msg = fresh[item.i];
      if (msg) flags[msg.id] = { inquiry: !!item.inquiry, who: item.who, summary: item.summary };
    }
  } catch { /* classification failed — mark seen so we don't loop, log nothing */ }

  let inquiries = 0;
  for (const m of fresh.slice(0, 12)) {
    const f = flags[m.id];
    if (f?.inquiry) {
      const thread = m.threadId || m.id;
      logEvent({
        domain: 'leads', type: 'booking_inquiry',
        meta: { thread, from: m.from, subject: m.subject, snippet: m.snippet.slice(0, 160), who: f.who || m.from, summary: f.summary || m.subject },
        source: 'auto',
      });
      try { addLead({ name: `${f.who || m.from} — booking`, stage: 'FOUND', dossier: f.summary || m.subject }); } catch { /* ignore */ }
      inquiries++;
    }
  }
  markSeen(fresh.map((m) => m.threadId || m.id));
  return { ran: true, scanned: msgs.length, inquiries };
}

/* Mark an inquiry thread answered so the pulse stops alarming — called
   when Ali approves a reply to that thread at the Gate. */
export function markInquiryReplied(thread: string): void {
  try { logEvent({ domain: 'leads', type: 'booking_replied', meta: { thread }, source: 'user' }); } catch { /* ignore */ }
}

/* Open (unanswered) booking inquiries, newest first — for surfaces. */
export function openInquiries(now = Date.now()) {
  const evs = getEvents({ domain: 'leads', since: now - 7 * 86_400_000 });
  const replied = new Set(evs.filter((e) => e.type === 'booking_replied').map((e) => String(e.meta?.thread)));
  return evs.filter((e) => e.type === 'booking_inquiry' && !replied.has(String(e.meta?.thread))).reverse();
}
