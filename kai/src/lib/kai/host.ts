/* ============================================================
   §29.6 THE AMBASSADOR → THE HOST.

   The Ambassador drafted a message per stage. The Host runs the whole
   relationship:

     THE ARC      inquiry → price answer → booking → pre-arrival →
                  in-stay check → checkout → review → repeat-guest offer
                  at ~3 months. Each stage fires on real Spine evidence.
     MEMORY       a guest is a person, not a thread. A returning name is
                  recognised and never re-onboarded.
     LEARNING     which message shapes actually got replies, which stays
                  ended in 5 stars, what guests kept asking about — the
                  next guest's messages carry what worked.
     ESCALATION   a complaint, a discount request, a date conflict reaches
                  Ali. Everything routine drafts itself and waits behind
                  one tap.

   Doctrine holds: the Host DRAFTS and PROPOSES. Nothing sends without the
   tap — a guest-facing message carries his name, and §29.7's tiering keeps
   identity actions gated forever.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/* ── the guest, remembered across stays ──────────────────────── */
export interface GuestRecord {
  name: string;
  key: string;                 // normalised identity
  threads: string[];
  stays: number;
  firstSeen: number;
  lastSeen: number;
  lastCheckout: number | null;
  replied: number;             // times they answered us
  rating: number | null;       // best known review rating
  asked: string[];             // topics they asked about
  returning: boolean;
}

export function guestKey(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z؀-ۿ ]/g, '').trim().split(/\s+/)[0] || 'guest';
}

export function guestBook(now = Date.now()): Map<string, GuestRecord> {
  const book = new Map<string, GuestRecord>();
  const touch = (name: string, ts: number, thread?: string): GuestRecord => {
    const key = guestKey(name);
    let g = book.get(key);
    if (!g) {
      g = { name, key, threads: [], stays: 0, firstSeen: ts, lastSeen: ts, lastCheckout: null, replied: 0, rating: null, asked: [], returning: false };
      book.set(key, g);
    }
    g.firstSeen = Math.min(g.firstSeen, ts);
    g.lastSeen = Math.max(g.lastSeen, ts);
    if (thread && !g.threads.includes(thread)) g.threads.push(thread);
    return g;
  };

  /* A reply or review often carries only the thread, not the name. Resolve
     thread → guest first so those still land on the right person. */
  const threadGuest = new Map<string, string>();
  for (const e of getEvents({ domain: 'makadi' })) {
    const n = String(e.meta?.guest || '').trim();
    const t = e.meta?.thread ? String(e.meta.thread) : '';
    if (n && t && !/^direct booking$/i.test(n)) threadGuest.set(t, n);
  }

  for (const e of getEvents({ domain: 'makadi' })) {
    const thread = e.meta?.thread ? String(e.meta.thread) : undefined;
    const name = String(e.meta?.guest || (thread ? threadGuest.get(thread) : '') || '').trim();
    if (!name || /^direct booking$/i.test(name)) continue;
    const g = touch(name, e.ts, thread);
    if (e.type === 'booking_confirmed') {
      g.stays++;
      const nights = Number(e.meta?.nights) || 0;
      const co = checkoutOf(e, nights);
      if (co && (g.lastCheckout == null || co > g.lastCheckout)) g.lastCheckout = co;
    }
    if (e.type === 'booking_replied') g.replied++;
    if (e.type === 'review_received' && typeof e.value === 'number') {
      g.rating = g.rating == null ? e.value : Math.max(g.rating, e.value);
    }
    const q = e.meta?.asked as string | undefined;
    if (q && !g.asked.includes(q)) g.asked.push(q);
  }

  for (const g of book.values()) g.returning = g.stays > 1 || (g.stays === 1 && g.threads.length > 1);
  return book;
}

function checkoutOf(e: KaiEvent, nights: number): number | null {
  const dates = String(e.meta?.dates || '');
  const m = dates.match(/[a-z]{3}[a-z]*\.?\s*(\d{1,2})/i);
  if (!m) return nights > 0 ? e.ts + nights * DAY : null;
  return e.ts + (nights || 1) * DAY;
}

/* Has this guest completed a stay other than the one we're writing about?
   That — not raw stay count — is what makes a greeting a re-greeting. */
export function priorStays(name: string, excludeThread?: string, now = Date.now()): number {
  const key = guestKey(name);
  let n = 0;
  for (const e of getEvents({ domain: 'makadi', type: 'booking_confirmed' })) {
    const g = String(e.meta?.guest || '');
    if (guestKey(g) !== key) continue;
    if (excludeThread && String(e.meta?.thread) === excludeThread) continue;
    n++;
  }
  return n;
}

/* ── what worked: learning from the record ───────────────────── */
export interface HostLearning {
  replyRate: number | null;      // of proposed guest messages, how many drew a reply
  sampled: number;
  bestStage: string | null;      // the stage that most reliably gets an answer
  commonQuestions: string[];     // what guests keep asking — answer it up front
  fiveStars: number;
  note: string;                  // the directive handed to the drafter
}

export function hostLearning(now = Date.now()): HostLearning {
  const proposed = getEvents({ domain: 'ambassador', type: 'proposed' });
  const replies = getEvents({ domain: 'makadi', type: 'booking_replied' });
  const repliedThreads = new Set(replies.map((e) => String(e.meta?.thread)));

  const byStage: Record<string, { sent: number; answered: number }> = {};
  for (const p of proposed) {
    const stage = String(p.meta?.stage || 'other');
    const t = String(p.meta?.thread || '');
    byStage[stage] ??= { sent: 0, answered: 0 };
    byStage[stage].sent++;
    if (repliedThreads.has(t)) byStage[stage].answered++;
  }
  const sampled = proposed.length;
  const answered = Object.values(byStage).reduce((s, v) => s + v.answered, 0);
  const replyRate = sampled >= 3 ? answered / sampled : null;

  const bestStage = Object.entries(byStage)
    .filter(([, v]) => v.sent >= 2)
    .sort((a, b) => (b[1].answered / b[1].sent) - (a[1].answered / a[1].sent))[0]?.[0] ?? null;

  /* what guests keep asking — from inquiry metadata the watcher captured */
  const asks: Record<string, number> = {};
  for (const e of getEvents({ domain: 'makadi', type: 'booking_inquiry' })) {
    const subject = String(e.meta?.subject || '') + ' ' + String(e.meta?.asked || '');
    for (const topic of TOPICS) if (topic.re.test(subject)) asks[topic.label] = (asks[topic.label] || 0) + 1;
  }
  const commonQuestions = Object.entries(asks).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3);

  const fiveStars = getEvents({ domain: 'makadi', type: 'review_received' }).filter((e) => (e.value ?? 0) >= 5).length;

  const bits: string[] = [];
  if (replyRate != null) bits.push(`Your guest messages draw a reply ${Math.round(replyRate * 100)}% of the time (${sampled} sent).`);
  if (commonQuestions.length) bits.push(`Guests keep asking about ${commonQuestions.join(', ')} — answer it before they ask.`);
  if (fiveStars >= 2) bits.push(`${fiveStars} five-star stays: keep the tone that earned them — warm, brief, specific.`);
  return { replyRate, sampled, bestStage, commonQuestions, fiveStars, note: bits.join(' ') || 'No stay history yet — write warm and brief.' };
}

const TOPICS: Array<{ re: RegExp; label: string }> = [
  { re: /wifi|internet|password/i, label: 'wifi' },
  { re: /check[- ]?in|arrival|key|lock|code/i, label: 'check-in' },
  { re: /pool|beach|sea/i, label: 'the pool/beach' },
  { re: /taxi|transfer|airport|transport/i, label: 'transport' },
  { re: /price|discount|cheaper|offer|rate/i, label: 'price' },
  { re: /parking|car/i, label: 'parking' },
];

/* ── escalation: what must reach Ali ─────────────────────────── */
export type Escalation = 'complaint' | 'discount' | 'date_conflict' | null;

export function classifyEscalation(text: string): Escalation {
  const s = String(text || '').toLowerCase();
  if (/broken|dirty|smell|no water|no power|not working|complain|refund|awful|terrible|مشكلة|شكوى/.test(s)) return 'complaint';
  if (/discount|cheaper|lower price|best price|deal|offer me|خصم/.test(s)) return 'discount';
  if (/different dates|change the dates|another date|reschedule|double book|already booked|conflict/.test(s)) return 'date_conflict';
  return null;
}

export const ESCALATION_REASON: Record<Exclude<Escalation, null>, string> = {
  complaint: 'A complaint — your name and your money are both on this one.',
  discount: 'A discount request — pricing is yours to decide, never mine.',
  date_conflict: 'A date conflict — only you know what else is committed.',
};

/* ── the arc ─────────────────────────────────────────────────── */
export type HostStage =
  | 'inquiry_reply' | 'price_answer' | 'welcome' | 'pre_arrival'
  | 'in_stay' | 'checkout' | 'review' | 'repeat_offer';

export interface StageDue { stage: HostStage; guest: string; thread: string; why: string }

const STAGE_ORDER: HostStage[] = ['inquiry_reply', 'price_answer', 'welcome', 'pre_arrival', 'in_stay', 'checkout', 'review', 'repeat_offer'];

/* Stages already handled for a thread, from the Spine (survives sync). */
function handled(thread: string): Set<HostStage> {
  const s = new Set<HostStage>();
  for (const e of getEvents({ domain: 'ambassador', type: 'proposed' })) {
    if (String(e.meta?.thread) === thread && e.meta?.stage) s.add(e.meta.stage as HostStage);
  }
  return s;
}

export function dueStages(now = Date.now()): StageDue[] {
  const out: StageDue[] = [];
  const book = guestBook(now);
  const inquiries = getEvents({ domain: 'makadi', type: 'booking_inquiry' });
  const confirmed = getEvents({ domain: 'makadi', type: 'booking_confirmed' });
  const repliedThreads = new Set(getEvents({ domain: 'makadi', type: 'booking_replied' }).map((e) => String(e.meta?.thread)));
  const confirmedThreads = new Set(confirmed.map((e) => String(e.meta?.thread)));

  /* pre-booking */
  for (const e of inquiries) {
    const thread = String(e.meta?.thread || e.id);
    const guest = String(e.meta?.guest || 'guest');
    const h = handled(thread);
    if (confirmedThreads.has(thread) || repliedThreads.has(thread)) continue;
    if (now - e.ts < 2 * HOUR) continue;
    const asked = String(e.meta?.subject || '') + ' ' + String(e.meta?.asked || '');
    if (/price|rate|discount|cost|how much/i.test(asked) && !h.has('price_answer')) {
      out.push({ stage: 'price_answer', guest, thread, why: 'they asked about price' });
    } else if (!h.has('inquiry_reply')) {
      out.push({ stage: 'inquiry_reply', guest, thread, why: `unanswered ${Math.round((now - e.ts) / HOUR)}h` });
    }
  }

  /* post-booking arc */
  for (const e of confirmed) {
    const thread = String(e.meta?.thread || e.id);
    const guest = String(e.meta?.guest || 'guest');
    if (/^direct booking$/i.test(guest)) continue;
    const h = handled(thread);
    const nights = Number(e.meta?.nights) || 1;
    const arrival = e.ts;                       // best available anchor
    const checkout = arrival + nights * DAY;

    if (!h.has('welcome')) { out.push({ stage: 'welcome', guest, thread, why: 'booking confirmed' }); continue; }
    if (!h.has('pre_arrival') && now >= arrival - DAY) { out.push({ stage: 'pre_arrival', guest, thread, why: 'arriving within a day' }); continue; }
    if (!h.has('in_stay') && now >= arrival + DAY && now < checkout) { out.push({ stage: 'in_stay', guest, thread, why: 'mid-stay check' }); continue; }
    if (!h.has('checkout') && now >= checkout && now < checkout + DAY) { out.push({ stage: 'checkout', guest, thread, why: 'checking out' }); continue; }
    if (!h.has('review') && now >= checkout + 6 * HOUR) { out.push({ stage: 'review', guest, thread, why: 'stay finished' }); continue; }

    /* the long game — a past guest, three months on */
    const g = book.get(guestKey(guest));
    if (!h.has('repeat_offer') && g?.lastCheckout && now >= g.lastCheckout + 90 * DAY && (g.rating == null || g.rating >= 4)) {
      out.push({ stage: 'repeat_offer', guest, thread, why: '3 months since their stay' });
    }
  }

  return out.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
}

/* ── the brief handed to the drafter ─────────────────────────── */
export function stageBrief(due: StageDue, now = Date.now()): string {
  const g = guestBook(now).get(guestKey(due.guest));
  /* A repeat offer BY DEFINITION follows a completed stay, so the guest is
     known even when this thread is their only one. Re-onboarding someone who
     already stayed is the exact failure this stage exists to avoid. */
  const prior = due.stage === 'repeat_offer'
    ? Math.max(1, g?.stays ?? 1)
    : priorStays(due.guest, due.thread, now);
  const known = prior > 0
    ? `${due.guest} has stayed ${prior} time${prior === 1 ? '' : 's'} before${g?.rating ? ` and left ${g.rating} stars` : ''} — greet them as a returning guest, do NOT re-explain the basics.`
    : `${due.guest} is new.`;
  const learn = hostLearning(now).note;

  const body: Record<HostStage, string> = {
    inquiry_reply: 'Answer their inquiry warmly, confirm availability, invite them to book.',
    price_answer: 'They asked about price. State the nightly rate plainly and what it includes. Do NOT offer a discount — that is Ali\'s call alone.',
    welcome: 'Thank them for booking and say check-in details follow closer to arrival.',
    pre_arrival: 'They arrive within a day: send arrival details and ask their approximate arrival time.',
    in_stay: 'They are mid-stay: one short, unintrusive check — is everything good, anything needed.',
    checkout: 'They check out today: thank them, note checkout time, wish them well.',
    review: 'The stay is finished: thank them and ask, briefly and without pressure, for a review.',
    repeat_offer: 'It has been about three months since their stay: a short, warm offer to come back, referencing that they stayed before.',
  };

  return `${body[due.stage]}\n\nGUEST: ${known}\nWHAT WORKS: ${learn}`;
}

/* ── run: what the Host would do now ─────────────────────────── */
export interface HostPlan { due: StageDue[]; escalations: Array<{ thread: string; guest: string; kind: Exclude<Escalation, null>; reason: string }> }

export function hostPlan(now = Date.now()): HostPlan {
  const escalations: HostPlan['escalations'] = [];
  for (const e of getEvents({ domain: 'makadi', type: 'booking_inquiry' })) {
    const text = `${e.meta?.subject || ''} ${e.meta?.snippet || ''} ${e.meta?.asked || ''}`;
    const kind = classifyEscalation(text);
    if (kind) {
      escalations.push({ thread: String(e.meta?.thread || e.id), guest: String(e.meta?.guest || 'guest'), kind, reason: ESCALATION_REASON[kind] });
    }
  }
  const escalated = new Set(escalations.map((x) => x.thread));
  /* An escalated thread is Ali's — the Host does not draft over it. */
  return { due: dueStages(now).filter((d) => !escalated.has(d.thread)), escalations };
}

export function recordStage(due: StageDue, now = Date.now()): void {
  try {
    logEvent({ domain: 'ambassador', type: 'proposed', meta: { thread: due.thread, stage: due.stage, guest: due.guest }, source: 'ai', ts: now });
  } catch { /* ignore */ }
}
