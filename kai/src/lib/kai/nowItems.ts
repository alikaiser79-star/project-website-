/* ============================================================
   §24 DIE ORDNUNG — ZONE 1: NOW. The single most important computation on
   the front face: what needs Ali TODAY, at most three lines, ranked by
   urgency. If nothing needs him, it says so in one honest line.

   Sources (most urgent first):
     1. an unanswered booking inquiry (money, time-critical)
     2. an overdue commitment (a broken promise forming)
     3. the Hunter's top revenue move (money on the table)
     4. a calling organ (a domain genuinely needs him — from the Spine)

   Deterministic, capped at three, deduped by lane. Boot-from-empty safe.
   ============================================================ */

import { getEvents } from './events';
import { getCommitments } from './commitments';
import { getCommandSignals } from './commandSignals';
import { generateOpportunities } from './hunter';
import { makadiProfit } from './makadiProfit';
import { computeRunway } from './runway';
import type { KaiAction } from '../actions';

const HOUR = 3_600_000;
export type NowTone = 'crimson' | 'gold' | 'amber';
export interface NowItem { id: string; text: string; tone: NowTone; action?: KaiAction; }

const ORGAN_LABEL: Record<string, string> = {
  '01': 'Income', '02': 'Debt', '03': 'Garden', '04': 'Makadi', '05': 'Instagram',
  '06': 'Priorities', '07': 'Expenses', '08': 'Content', '09': 'Mirror', '10': 'Ledger',
  '11': 'Tollgate', '12': 'Inbox',
};
const ORGAN_VIEW: Record<string, string> = {
  '01': 'money', '02': 'money', '07': 'money', '10': 'money', '11': 'ops',
  '03': 'ops', '04': 'ops', '09': 'ops', '06': 'ops',
  '12': 'growth', '08': 'growth', '05': 'growth',
};

export interface NowResult {
  items: NowItem[];        // the top 3, shown
  calm: string | null;
  total: number;           // EVERYTHING that needs him (pre-cap) — drives the heart
  overflow: number;        // total - shown, surfaced as "+N more"
}

export function buildNow(now = Date.now()): NowResult {
  /* Collect every candidate (deduped by lane) BEFORE capping, so the caller
     knows the true count. The heart's arousal reads `total`; capping at three
     is a display decision, never a hidden one (CORE-V4: no invisible state). */
  const all: NowItem[] = [];
  const lanes = new Set<string>();
  const add = (lane: string, it: NowItem) => { if (lanes.has(lane)) return; lanes.add(lane); all.push(it); };
  const items = all;   // aliased for the collection block below

  /* 1. unanswered inquiry — the most expensive silence. */
  try {
    const replied = new Set(getEvents({ domain: 'makadi', type: 'booking_replied' }).map((e) => String(e.meta?.thread)));
    const confirmed = new Set(getEvents({ domain: 'makadi', type: 'booking_confirmed' }).map((e) => String(e.meta?.thread)));
    const inq = getEvents({ domain: 'makadi', type: 'booking_inquiry' })
      .filter((e) => { const t = String(e.meta?.thread || e.id); return !replied.has(t) && !confirmed.has(t) && now - e.ts > 2 * HOUR; })
      .sort((a, b) => a.ts - b.ts)[0];
    if (inq) add('inquiry', { id: 'now-inq', tone: 'crimson', text: `Answer ${inq.meta?.guest || 'a guest'}'s inquiry — waiting ${Math.round((now - inq.ts) / HOUR)}h.`, action: { type: 'open-hunter' } });
  } catch { /* ignore */ }

  /* 2. overdue commitment — a promise going red. */
  try {
    const overdue = getCommitments().filter((c) => c.status === 'open' && c.deadline < now).sort((a, b) => a.deadline - b.deadline)[0];
    if (overdue) add('overdue', { id: 'now-overdue', tone: 'crimson', text: `Overdue: "${(overdue.text || '').slice(0, 44)}".`, action: { type: 'ping-panel', panel: '09' } });
  } catch { /* ignore */ }

  /* 3. the Hunter's top TIME-SENSITIVE move — money on the table, worth your
     minute. A standing broadcast is never "today"; the inquiry is already
     covered above, so exclude both to avoid a duplicate/perpetual line. */
  try {
    const top = generateOpportunities(now).find((o) => o.kind !== 'broadcast' && o.kind !== 'inquiry');
    if (top && top.expectedEgp >= 1000) add('hunter', { id: 'now-hunt', tone: 'gold', text: `${top.title} · +${Math.round(top.expectedEgp).toLocaleString('en-GB')} EGP`, action: { type: 'open-hunter' } });
  } catch { /* ignore */ }

  /* 4. a calling organ — a domain that genuinely needs him now. */
  try {
    const sig = getCommandSignals();
    const calling = Object.keys(sig).filter((id) => sig[id]?.calling);
    for (const id of calling) {
      add('organ-' + id, { id: 'now-organ-' + id, tone: 'amber', text: `${ORGAN_LABEL[id] || id} needs you — ${sig[id]?.formatted ?? ''}.`.trim(), action: { type: 'ping-panel', panel: ORGAN_VIEW[id] ? id : id } });
    }
  } catch { /* ignore */ }

  if (all.length) {
    return { items: all.slice(0, 3), calm: null, total: all.length, overflow: Math.max(0, all.length - 3) };
  }

  /* nothing needs him — one honest, grounding line. */
  return { items: [], calm: calmLine(now), total: 0, overflow: 0 };
}

/* Diagnostic — exactly which organs are calling and why the heart is where it
   is. Surfaced on window so a BPM reading is never a mystery. */
export function callingReport(now = Date.now()): { calling: Array<{ id: string; label: string; value: string }>; total: number; bpm: number } {
  let calling: Array<{ id: string; label: string; value: string }> = [];
  try {
    const sig = getCommandSignals();
    calling = Object.keys(sig).filter((id) => sig[id]?.calling)
      .map((id) => ({ id, label: ORGAN_LABEL[id] || id, value: String(sig[id]?.formatted ?? '') }));
  } catch { /* ignore */ }
  const total = buildNow(now).total;
  return { calling, total, bpm: bpmFor(total) };
}

/* The single source of truth for the heart's rate — derived from what NOW
   actually found, so the body can never be aroused by something the face
   doesn't name. */
export function bpmFor(total: number): number {
  return Math.min(96, 58 + total * 7);
}

function calmLine(now: number): string {
  try {
    const p = makadiProfit(now);
    if (p.nightsBooked > 0) return `Nothing needs you. Makadi has ${p.nightsBooked} night${p.nightsBooked === 1 ? '' : 's'} booked.`;
    const r = computeRunway(now);
    if (r.runwayDays != null && isFinite(r.runwayDays)) return `Nothing needs you. ${Math.floor(r.runwayDays)} days of runway.`;
  } catch { /* ignore */ }
  return 'Nothing needs you. Rest easy.';
}
