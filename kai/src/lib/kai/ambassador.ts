/* ============================================================
   DER BOTSCHAFTER (§Q3.2) — THE AMBASSADOR. Makadi runs itself.

   A guest-lifecycle agent that watches Makadi booking events on the Spine
   and, at each stage, DRAFTS the right message and PROPOSES it through the
   Gate. Nothing sends without Ali's one tap — the doctrine's Gate is the
   perimeter. Target: Makadi runs on ~5 taps per booking.

     inquiry     → reply in the guest's language (EN/DE/RU/AR)
     confirmed   → welcome + flag the cleaner for the turnover date
     check-in    → instructions + smart-lock code, at the right hour
     checkout    → request the review

   Every draft is grounded in the operator's MakadiConfig (lock code, wifi,
   address, check-in/out hours, cleaner). Every proposal is deduped per
   thread+stage via a Spine event, so a stage is offered exactly once and
   survives a sync. Reads the real Spine; drafts real messages; sends
   nothing on its own.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';
import { proposeAction } from './pending';
import { askClaude } from '../claude';
import { read, write } from './store';

const DAY = 86_400_000;
const CFG_KEY = 'kai.makadi.config';

export interface MakadiConfig {
  enabled: boolean;
  lockCode: string;
  wifi: string;
  address: string;
  houseRules: string;
  checkInHour: number;    // 0–23, local — default 15:00
  checkOutHour: number;   // default 11:00
  cleanerEmail: string;
  cleanerName: string;
  hostName: string;       // signature
}

const DEFAULT_CFG: MakadiConfig = {
  enabled: false, lockCode: '', wifi: '', address: '', houseRules: '',
  checkInHour: 15, checkOutHour: 11, cleanerEmail: '', cleanerName: '', hostName: 'Ali',
};

export function getMakadiConfig(): MakadiConfig {
  return { ...DEFAULT_CFG, ...read<Partial<MakadiConfig>>(CFG_KEY, {}) };
}
export function setMakadiConfig(patch: Partial<MakadiConfig>): MakadiConfig {
  const next = { ...getMakadiConfig(), ...patch };
  write(CFG_KEY, next);
  return next;
}

/* ── lifecycle stages ─────────────────────────────────────── */
export type Stage = 'inquiry_reply' | 'welcome' | 'checkin' | 'review' | 'cleaner';

interface Booking {
  thread: string;
  guest: string;
  to?: string;               // reply-to (Airbnb relay) resolved from the inquiry
  dates?: string;
  nights: number;
  checkInTs?: number;
  checkOutTs?: number;
  confirmed: boolean;
}

/* Resolve the reply-to for a thread — the inquiry carries the guest's
   (relay) From address; confirmations don't. */
function replyToFor(thread: string): string | undefined {
  const inq = getEvents({ domain: 'makadi', type: 'booking_inquiry' }).find((e) => e.meta?.thread === thread);
  const from = inq?.meta?.from as string | undefined;
  return from && /@/.test(from) ? from : undefined;
}

/* Parse a check-in date from a free-text dates string like "Jul 27–30, 2026"
   or "Aug 3 – 6". Returns [checkInTs, checkOutTs] at the configured hours, or
   nulls when it can't be read (the operator still gets the proposal, just
   un-scheduled). */
const MONTHS: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
export function parseStay(dates: string | undefined, nights: number, cfg: MakadiConfig, now: number): { checkInTs?: number; checkOutTs?: number } {
  if (!dates) return {};
  const m = String(dates).toLowerCase().match(/([a-z]{3})[a-z]*\.?\s*(\d{1,2})(?:\s*[–\-—to]+\s*(?:([a-z]{3})[a-z]*\.?\s*)?(\d{1,2}))?(?:,?\s*(\d{4}))?/);
  if (!m) return {};
  const mon = MONTHS[m[1]]; if (mon == null) return {};
  const d1 = parseInt(m[2], 10);
  const mon2 = m[3] ? MONTHS[m[3]] ?? mon : mon;
  const d2 = m[4] ? parseInt(m[4], 10) : undefined;
  const year = m[5] ? parseInt(m[5], 10) : new Date(now).getFullYear();
  const checkIn = new Date(year, mon, d1, cfg.checkInHour, 0, 0, 0);
  /* year rollover: a Jan check-in read in December is next year. */
  if (checkIn.getTime() < now - 120 * DAY) checkIn.setFullYear(year + 1);
  const checkInTs = checkIn.getTime();
  let checkOutTs: number | undefined;
  if (d2 != null) checkOutTs = new Date(checkIn.getFullYear(), mon2, d2, cfg.checkOutHour, 0, 0, 0).getTime();
  else if (nights > 0) checkOutTs = checkInTs + nights * DAY;
  return { checkInTs, checkOutTs };
}

/* Collect the current Makadi bookings from the Spine (deduped per thread,
   confirmations winning). Manual bookings with no thread are skipped — the
   Ambassador acts on watcher-detected mail where a guest is reachable. */
function bookings(now: number, cfg: MakadiConfig): Booking[] {
  const byThread = new Map<string, Booking>();
  const consider = (e: KaiEvent, confirmed: boolean) => {
    const thread = e.meta?.thread as string | undefined;
    if (!thread) return;
    const nights = Number(e.meta?.nights) || 0;
    const dates = e.meta?.dates as string | undefined;
    const prev = byThread.get(thread);
    const stay = parseStay(dates, nights, cfg, now);
    const b: Booking = {
      thread,
      guest: String(e.meta?.guest || prev?.guest || 'Guest'),
      to: replyToFor(thread) || prev?.to,
      dates: dates || prev?.dates,
      nights: nights || prev?.nights || 0,
      checkInTs: stay.checkInTs ?? prev?.checkInTs,
      checkOutTs: stay.checkOutTs ?? prev?.checkOutTs,
      confirmed: confirmed || !!prev?.confirmed,
    };
    byThread.set(thread, b);
  };
  for (const e of getEvents({ domain: 'makadi', type: 'booking_inquiry' })) consider(e, false);
  for (const e of getEvents({ domain: 'makadi', type: 'booking_confirmed' })) consider(e, true);
  return [...byThread.values()];
}

/* Stages already proposed for a thread (deduped via Spine, so it survives a
   sync and never double-offers). Also treats an operator reply as "inquiry
   handled". */
function handledStages(thread: string): Set<Stage> {
  const s = new Set<Stage>();
  for (const e of getEvents({ domain: 'ambassador', type: 'proposed' })) {
    if (e.meta?.thread === thread && e.meta?.stage) s.add(e.meta.stage as Stage);
  }
  if (getEvents({ domain: 'makadi', type: 'booking_replied' }).some((e) => e.meta?.thread === thread)) s.add('inquiry_reply');
  return s;
}

/* Which stages are DUE for a booking right now (given what's handled). */
function dueStages(b: Booking, handled: Set<Stage>, now: number): Stage[] {
  const due: Stage[] = [];
  if (!b.confirmed) {
    if (!handled.has('inquiry_reply') && b.to) due.push('inquiry_reply');
    return due;
  }
  /* confirmed */
  if (!handled.has('welcome') && b.to) due.push('welcome');
  if (!handled.has('cleaner')) due.push('cleaner');
  const ci = b.checkInTs;
  if (!handled.has('checkin') && b.to && (ci == null || now >= ci - DAY)) due.push('checkin');
  const co = b.checkOutTs;
  if (!handled.has('review') && b.to && co != null && now >= co + 6 * 3600_000) due.push('review');
  return due;
}

/* ── drafting ─────────────────────────────────────────────── */
function stageBrief(stage: Stage, b: Booking, cfg: MakadiConfig): string {
  switch (stage) {
    case 'inquiry_reply': return `Reply warmly to ${b.guest}'s inquiry about the Makadi (Hurghada, Red Sea) stay${b.dates ? ` for ${b.dates}` : ''}. Answer availability positively, invite them to book, offer to answer questions. Do NOT include the lock code or address (not booked yet).`;
    case 'welcome': return `Thank ${b.guest} for booking${b.dates ? ` (${b.dates})` : ''}. Warm welcome, say you'll send check-in details closer to arrival. Do NOT include the lock code yet.`;
    case 'checkin': return `Send ${b.guest} their check-in instructions for arrival${b.dates ? ` (${b.dates})` : ''}. Include: address "${cfg.address || '[address not set]'}", smart-lock code "${cfg.lockCode || '[lock code not set]'}", wifi "${cfg.wifi || '[wifi not set]'}", check-in from ${cfg.checkInHour}:00. House rules: ${cfg.houseRules || 'the usual courtesies'}. Clear and friendly.`;
    case 'review': return `Thank ${b.guest} after checkout and politely ask them to leave a review. Warm, brief, no pressure.`;
    case 'cleaner': return `Notify the cleaner ${cfg.cleanerName || ''} that Makadi has a turnover: guest ${b.guest}${b.dates ? `, dates ${b.dates}` : ''}${b.checkOutTs ? `, checkout ${new Date(b.checkOutTs).toDateString()}` : ''}. Ask them to clean and prep for the next guest. Practical, short.`;
  }
}

function guestLang(b: Booking): string {
  return `Detect ${b.guest}'s likely language from their name (English, German, Russian, or Arabic) and write in it; default to English if unsure.`;
}

async function draft(stage: Stage, b: Booking, cfg: MakadiConfig): Promise<{ subject: string; body: string } | null> {
  const audience = stage === 'cleaner'
    ? 'You are writing to the apartment CLEANER (in English or Arabic — Egypt).'
    : `You are writing to a Makadi Airbnb GUEST as the host (${cfg.hostName || 'the host'}). ${guestLang(b)}`;
  const prompt =
    `${audience}\n\nTASK: ${stageBrief(stage, b, cfg)}\n\n` +
    `Return ONLY a JSON object {"subject": "...", "body": "..."} — no prose, no code fence. ` +
    `The body is a complete, ready-to-send email (greeting + message + sign-off as "${cfg.hostName || 'Ali'}"). ` +
    `Warm, concise, human. Never invent facts not given; if a detail is a "[... not set]" placeholder, omit that line gracefully.`;
  let raw = '';
  try { raw = await askClaude(prompt, [], { tier: 'heavy', feature: 'ambassador', maxTokens: 600 }); }
  catch { return null; }
  const m = String(raw || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const subject = String(o.subject || '').trim();
    const body = String(o.body || '').trim();
    if (!subject || !body) return null;
    return { subject, body };
  } catch { return null; }
}

/* ── the run ──────────────────────────────────────────────── */
export interface AmbassadorRun { ran: boolean; reason: string; proposed: number; stages: string[]; }

export async function runAmbassador(now = Date.now(), max = 4): Promise<AmbassadorRun> {
  const cfg = getMakadiConfig();
  if (!cfg.enabled) return { ran: false, reason: 'disabled', proposed: 0, stages: [] };

  const list = bookings(now, cfg);
  if (!list.length) return { ran: true, reason: 'no_bookings', proposed: 0, stages: [] };

  /* Build the work list: (booking, stage) pairs that are due and unhandled. */
  const work: Array<{ b: Booking; stage: Stage }> = [];
  for (const b of list) {
    const handled = handledStages(b.thread);
    for (const stage of dueStages(b, handled, now)) work.push({ b, stage });
  }
  if (!work.length) return { ran: true, reason: 'nothing_due', proposed: 0, stages: [] };

  let proposed = 0;
  const stages: string[] = [];
  for (const { b, stage } of work.slice(0, max)) {
    const to = stage === 'cleaner' ? cfg.cleanerEmail : b.to;
    if (!to) continue;                                   // no reachable address → skip cleanly
    const d = await draft(stage, b, cfg);
    if (!d) continue;
    const who = stage === 'cleaner' ? (cfg.cleanerName || 'the cleaner') : b.guest;
    proposeAction('email_send', `Ambassador · ${labelFor(stage)} → ${who}`, { to, subject: d.subject, body: d.body });
    try { logEvent({ domain: 'ambassador', type: 'proposed', meta: { thread: b.thread, stage, to, guest: b.guest, subject: d.subject }, source: 'ai', ts: now }); } catch { /* ignore */ }
    proposed++; stages.push(stage);
  }
  return { ran: true, reason: proposed ? 'ok' : 'no_address', proposed, stages };
}

function labelFor(stage: Stage): string {
  return stage === 'inquiry_reply' ? 'inquiry reply'
    : stage === 'welcome' ? 'booking welcome'
    : stage === 'checkin' ? 'check-in + lock code'
    : stage === 'review' ? 'review request'
    : 'cleaner turnover';
}
