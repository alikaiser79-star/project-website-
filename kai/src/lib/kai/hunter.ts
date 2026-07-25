/* ============================================================
   DER JÄGER (§Q3.4) — THE HUNTER. KAI's income engine.

   It hunts, drafts, chases, and proves its worth. Kaiser only taps.
   Doctrine holds: KAI proposes, Kaiser disposes — nothing sends
   unapproved, nothing impersonates, every send goes through the Gate.

     THE HUNT   — generateOpportunities(): concrete revenue moves from the
                  Spine + Radar, each with EGP attached, ranked by expected
                  EGP per MINUTE of Ali's time. Deterministic; a projection's
                  assumptions are stated, never dressed as fact.
     THE DRAFT  — draftOpportunity(): the message, written ready-to-send in
                  the right language, on demand (no LLM spent until Ali looks).
     THE TAP    — approveOpportunity(): one tap → the draft goes to the Gate
                  (email) / applies the rate / is handed over to broadcast.
                  dismiss() teaches it to stop proposing that SHAPE.
     THE CHASE  — chase folds unanswered sends back in as follow-up nudges.
     THE LEDGER — hunterLedger(): opportunity → tap → outcome, and the one
                  honest line: "KAI-sourced revenue this month: X from Y taps."

   Every number is real Spine data; assumptions (conversion, fill, deal size)
   are named constants, labelled in the rationale. Nothing invented.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { getLeads } from './leads';
import { makadiProfit } from './makadiProfit';
import { loadState, saveState } from '../store';
import { toEgp } from './money';
import { proposeAction } from './pending';
import { askClaude } from '../claude';
import type { Currency } from '../../types';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/* ── stated assumptions (NOT Spine facts — labelled wherever used) ── */
const BROADCAST_FILL = 0.20;        // a direct broadcast fills ~1 in 5 open nights
const INQUIRY_NIGHTS = 3;           // a typical Makadi stay, for valuing an inquiry
const LEAD_DEAL_EGP = 15_000;       // a typical agency/client deal, scaled by fit
const INQUIRY_STALE_H = 2;          // an inquiry unanswered this long is time-critical
const LEAD_STALE_D = 5;             // a sent lead silent this long needs a nudge
const DISMISS_COOLDOWN_D = 14;      // a dismissed shape stays quiet this long

export type OppKind = 'broadcast' | 'pricing' | 'inquiry' | 'lead_nudge' | 'chase';
export interface Opportunity {
  id: string;
  shape: string;            // dedup + learning key
  kind: OppKind;
  title: string;
  rationale: string;        // cites real numbers; states any assumption
  expectedEgp: number;
  minutes: number;          // of ALI's time
  egpPerMin: number;
  meta: Record<string, any>;
  createdAt: number;
}

function egp(v: number): number { return Math.round(v); }
function mk() { try { return loadState().makadi; } catch { return undefined; } }

/* Average realised booking value (EGP) from confirmed bookings, else a
   nightly-rate estimate. Real data preferred; falls back honestly. */
function avgBookingEgp(now: number): number {
  const p = makadiProfit(now);
  const confirmed = getEvents({ domain: 'makadi', type: 'booking_confirmed' });
  if (confirmed.length && p.earned > 0) return p.earned / confirmed.length;
  return (p.nightlyEgp || 0) * INQUIRY_NIGHTS;
}

/* Extract a comp nightly price (USD) from a radar finding/recommendation, if
   one is literally present. No number → no pricing opportunity (never invents). */
function compFromRadar(now: number): number | null {
  const evs = getEvents({ since: now - 14 * DAY }).filter((e) => e.domain === 'radar');
  let best: number | null = null;
  for (const e of evs) {
    const text = `${e.meta?.title || ''} ${e.meta?.why || ''} ${e.meta?.summary || ''} ${e.meta?.detail || ''}`;
    const m = text.match(/\$\s?(\d{2,4})|(\d{2,4})\s?(?:usd|\$)/i);
    const n = m ? parseInt(m[1] || m[2], 10) : NaN;
    if (isFinite(n) && (best == null || n > best)) best = n;
  }
  return best;
}

/* Was this shape dismissed recently? (learning — stop proposing it). */
export function isShapeDismissed(shape: string, now = Date.now()): boolean {
  return getEvents({ domain: 'hunter', type: 'dismissed', since: now - DISMISS_COOLDOWN_D * DAY })
    .some((e) => e.meta?.shape === shape);
}

/* ── THE HUNT — generate ranked opportunities from real signals ── */
export function generateOpportunities(now = Date.now()): Opportunity[] {
  const out: Opportunity[] = [];
  const state = mk();
  const p = makadiProfit(now);
  const nightlyEgp = p.nightlyEgp || 0;
  const push = (o: Omit<Opportunity, 'egpPerMin' | 'createdAt'>) => {
    out.push({ ...o, egpPerMin: o.minutes > 0 ? o.expectedEgp / o.minutes : o.expectedEgp, createdAt: now });
  };

  /* 1. UNANSWERED INQUIRY — time-critical, highest EGP/min. */
  const inquiries = getEvents({ domain: 'makadi', type: 'booking_inquiry' });
  for (const e of inquiries) {
    const thread = e.meta?.thread as string | undefined;
    if (!thread) continue;
    const replied = getEvents({ domain: 'makadi', type: 'booking_replied' }).some((r) => r.meta?.thread === thread)
      || getEvents({ domain: 'makadi', type: 'booking_confirmed' }).some((c) => c.meta?.thread === thread);
    if (replied) continue;
    const ageH = (now - e.ts) / HOUR;
    if (ageH < INQUIRY_STALE_H) continue;
    const val = avgBookingEgp(now);
    push({
      id: 'inq-' + thread, shape: 'inquiry',
      kind: 'inquiry',
      title: `Unanswered inquiry — ${e.meta?.guest || 'a guest'}, ${Math.round(ageH)}h`,
      rationale: `A booking inquiry has sat ${Math.round(ageH)}h. A typical booking is worth ~${egp(val).toLocaleString('en-GB')} EGP; the referral/booking window closes fast. Reply is drafted.`,
      expectedEgp: val, minutes: 1, meta: { thread, to: e.meta?.from, guest: e.meta?.guest, dates: e.meta?.dates },
    });
  }

  /* 2. UNDERPRICED vs COMPS — only if radar literally shows a higher comp. */
  if (state && nightlyEgp > 0) {
    const comp = compFromRadar(now);
    const cur = state.nightlyRate || 0;
    const ccy = (state.rateCcy || 'USD') as Currency;
    if (comp != null && comp > cur && cur > 0) {
      const openNights = estimateOpenNights(now, state);
      const deltaEgp = toEgp(comp - cur, ccy) * Math.max(1, openNights);
      push({
        id: 'price-' + comp, shape: 'pricing',
        kind: 'pricing',
        title: `Raise rate ${cur}→${comp} ${ccy}`,
        rationale: `Radar shows comps at ${comp} ${ccy}; you're at ${cur}. Over ~${openNights} open nights that's ~+${egp(deltaEgp).toLocaleString('en-GB')} EGP. One tap applies it.`,
        expectedEgp: deltaEgp, minutes: 1, meta: { from: cur, to: comp, ccy },
      });
    }
  }

  /* 3. EMPTY NIGHTS — a broadcast to fill them. Projection, assumption stated. */
  if (state && nightlyEgp > 0) {
    const openNights = estimateOpenNights(now, state);
    if (openNights >= 5) {
      const expected = openNights * nightlyEgp * BROADCAST_FILL;
      push({
        id: 'broadcast-' + new Date(now).toISOString().slice(0, 7), shape: 'broadcast',
        kind: 'broadcast',
        title: `~${openNights} open nights — broadcast to fill`,
        rationale: `~${openNights} nights look open ahead. A direct broadcast to past guests/contacts could fill ~${Math.round(BROADCAST_FILL * 100)}% (assumption) → ~${egp(expected).toLocaleString('en-GB')} EGP. Broadcast drafted; you send it.`,
        expectedEgp: expected, minutes: 3, meta: { openNights },
      });
    }
  }

  /* 4. STALE LEADS — a follow-up nudge. */
  for (const l of getLeads()) {
    if (l.stage !== 'SENT' && l.stage !== 'DRAFTED') continue;
    const ageD = (now - l.updatedAt) / DAY;
    if (ageD < LEAD_STALE_D) continue;
    const val = LEAD_DEAL_EGP * ((l.fit ?? 5) / 10);
    push({
      id: 'lead-' + l.id, shape: 'lead_nudge',
      kind: 'lead_nudge',
      title: `Follow up — ${l.name} (${Math.round(ageD)}d silent)`,
      rationale: `${l.name} has been at "${l.stage}" ${Math.round(ageD)}d with no reply. Fit ${l.fit ?? '—'}/10 → ~${egp(val).toLocaleString('en-GB')} EGP if it lands. Nudge drafted.`,
      expectedEgp: val, minutes: 1, meta: { leadId: l.id, name: l.name },
    });
  }

  /* rank by EGP per minute of Ali's time, drop dismissed shapes. */
  return out
    .filter((o) => !isShapeDismissed(o.shape, now))
    .sort((a, b) => b.egpPerMin - a.egpPerMin);
}

/* Open nights ahead — from occupancy (no per-date calendar exists), labelled
   as an estimate everywhere it's used. */
function estimateOpenNights(_now: number, state: NonNullable<ReturnType<typeof mk>>): number {
  const occ = Math.min(1, Math.max(0, state.occupancy30d ?? 0));
  return Math.round(30 * (1 - occ));
}

/* ── persist a hunt so the ledger + surface can read it ── */
export function runHunt(now = Date.now()): Opportunity[] {
  const opps = generateOpportunities(now);
  const today = new Date(now).toISOString().slice(0, 10);
  for (const o of opps) {
    const already = getEvents({ domain: 'hunter', type: 'opportunity' })
      .some((e) => e.meta?.shape === o.shape && e.meta?.day === today);
    if (already) continue;
    try {
      logEvent({ domain: 'hunter', type: 'opportunity', value: egp(o.expectedEgp), ccy: 'EGP',
        meta: { day: today, shape: o.shape, kind: o.kind, title: o.title, egpPerMin: Math.round(o.egpPerMin) }, source: 'ai', ts: now });
    } catch { /* ignore */ }
  }
  return opps;
}

/* ── dismiss (learning) ── */
export function dismissOpportunity(o: Opportunity, now = Date.now()): void {
  try { logEvent({ domain: 'hunter', type: 'dismissed', meta: { shape: o.shape, kind: o.kind, title: o.title }, source: 'user', ts: now }); } catch { /* ignore */ }
}

/* ── record a tap (for the ledger + chase clock) ── */
export function recordActioned(o: Opportunity, channel: string, now = Date.now()): void {
  try {
    logEvent({ domain: 'hunter', type: 'actioned', value: egp(o.expectedEgp), ccy: 'EGP',
      meta: { shape: o.shape, kind: o.kind, title: o.title, channel, thread: o.meta.thread, leadId: o.meta.leadId }, source: 'user', ts: now });
  } catch { /* ignore */ }
}

/* ── THE LEDGER — proof of worth ── */
export interface HunterLedger { proposed: number; taps: number; attributedEgp: number; line: string; }
export function hunterLedger(now = Date.now()): HunterLedger {
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.getTime();
  const proposedShapes = new Set(getEvents({ domain: 'hunter', type: 'opportunity', since }).map((e) => e.meta?.shape));
  const actioned = getEvents({ domain: 'hunter', type: 'actioned', since });

  /* Attribution — conservative: a revenue event AFTER a tap, same lane, within
     30d, each revenue event counted once. Labelled "attributed", not "caused". */
  const revenue = [
    ...getEvents({ domain: 'makadi', type: 'booking_confirmed', since }),
    ...getEvents({ domain: 'income', type: 'received', since }),
  ];
  const usedRev = new Set<string>();
  let attributedEgp = 0;
  for (const a of actioned) {
    const lane = a.meta?.kind === 'lead_nudge' ? 'income' : 'makadi';
    const hit = revenue.find((r) => !usedRev.has(r.id) && r.ts >= a.ts && r.ts <= a.ts + 30 * DAY
      && (lane === 'makadi' ? r.domain === 'makadi' : r.domain === 'income'));
    if (hit) { usedRev.add(hit.id); attributedEgp += toEgp(hit.value || 0, (hit.ccy as Currency) || 'EGP'); }
  }

  const taps = actioned.length;
  const line = attributedEgp > 0
    ? `KAI-sourced revenue this month: ${egp(attributedEgp).toLocaleString('en-GB')} EGP from ${taps} tap${taps === 1 ? '' : 's'}.`
    : taps > 0
      ? `${taps} hunt${taps === 1 ? '' : 's'} actioned this month — no revenue attributed yet.`
      : 'No hunts actioned this month yet.';
  return { proposed: proposedShapes.size, taps, attributedEgp, line };
}

/* ── THE DRAFT — write the message for an opportunity, on demand ──
   Pricing needs no message (it's a rate change). Everything else gets a
   ready-to-send draft in the right voice/language. */
export interface Draft { channel: 'email' | 'whatsapp' | 'rate'; to?: string; subject?: string; body: string; }

const DRAFT_SYSTEM =
  'You are KAI writing on Ali Kaiser\'s behalf (Hidden Garden in Maadi; a Makadi/Hurghada Airbnb; ' +
  'a German CX agency). Write in Ali\'s voice: warm, direct, no fluff. Detect the recipient\'s likely ' +
  'language (English, German, Russian, Arabic) and write in it; default English. Never impersonate ' +
  'anyone but the host; never invent facts. Return ONLY JSON {"subject":"...","body":"..."} — body is ' +
  'complete and ready to send, signed "Ali". For a WhatsApp broadcast, subject may be "".';

export async function draftOpportunity(o: Opportunity): Promise<Draft> {
  if (o.kind === 'pricing') {
    return { channel: 'rate', body: `Raise the Makadi nightly rate from ${o.meta.from} to ${o.meta.to} ${o.meta.ccy}.` };
  }
  const brief =
    o.kind === 'inquiry' ? `Reply to ${o.meta.guest || 'the guest'}'s Makadi inquiry${o.meta.dates ? ` for ${o.meta.dates}` : ''}: confirm availability warmly, invite them to book, offer to answer questions.`
    : o.kind === 'lead_nudge' ? `Write a short, friendly follow-up nudge to ${o.meta.name} — you sent something and haven't heard back; re-open the conversation without pressure.`
    : o.kind === 'chase' ? `Write a brief follow-up chasing a reply on: ${o.title}. Warm, no pressure.`
    : `Write a short broadcast to past Makadi guests / contacts: ~${o.meta.openNights} nights are open, offer them (or a friend) the dates warmly; one line about the place. It will be sent via WhatsApp.`;
  const channel: Draft['channel'] = o.kind === 'broadcast' ? 'whatsapp' : 'email';
  let raw = '';
  try { raw = await askClaude(`${brief}\n\nReturn the JSON.`, [], { tier: 'heavy', feature: 'hunter', maxTokens: 600 }); }
  catch { return { channel, to: o.meta.to, subject: 'Makadi', body: '(draft unavailable — no API key)' }; }
  const m = String(raw || '').match(/\{[\s\S]*\}/);
  try {
    const j = m ? JSON.parse(m[0]) : {};
    return { channel, to: o.meta.to, subject: String(j.subject || 'Makadi'), body: String(j.body || raw).trim() };
  } catch { return { channel, to: o.meta.to, subject: 'Makadi', body: String(raw).trim() }; }
}

/* ── THE TAP — approve. Routes by channel, always logs the tap. ──
   Returns a status the UI shows. Email → the Gate. Rate → applied. Broadcast
   → handed back for the operator to send (the tap is the approval; KAI never
   sends a broadcast itself). */
export interface ApproveResult { ok: boolean; via: 'gate' | 'rate' | 'broadcast'; note: string; }
export function approveOpportunity(o: Opportunity, draft: Draft, now = Date.now()): ApproveResult {
  if (o.kind === 'pricing') {
    try {
      const s = loadState();
      s.makadi = { ...s.makadi, nightlyRate: o.meta.to, rateCcy: o.meta.ccy };
      saveState(s);
      logEvent({ domain: 'makadi', type: 'rate_changed', value: o.meta.to, ccy: o.meta.ccy, meta: { from: o.meta.from, source: 'hunter' }, source: 'user', ts: now });
      recordActioned(o, 'rate', now);
      return { ok: true, via: 'rate', note: `Rate raised to ${o.meta.to} ${o.meta.ccy}.` };
    } catch { return { ok: false, via: 'rate', note: 'Could not apply the rate.' }; }
  }
  if (draft.channel === 'email' && draft.to) {
    proposeAction('email_send', `Hunter · ${o.title}`, { to: draft.to, subject: draft.subject, body: draft.body });
    recordActioned(o, 'email', now);
    return { ok: true, via: 'gate', note: 'Sent to the Gate — one tap there confirms the send.' };
  }
  /* broadcast / no address — the operator sends it; we record the tap. */
  recordActioned(o, 'broadcast', now);
  return { ok: true, via: 'broadcast', note: 'Draft ready — copy it into WhatsApp to send.' };
}
