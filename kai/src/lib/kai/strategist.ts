/* ============================================================
   §28.4 THE HUNTER → THE STRATEGIST.

   The Hunter found single moves. The Strategist plans a CAMPAIGN: a
   sequence of 3–5 moves that compound, ordered by dependency, with a total
   value and a date on the end of it.

     "August plan: raise the rate → broadcast the open nights → 3 direct
      bookings → 12 nights. Break-even 4 Sept."

   Dependency is the point: raising the rate BEFORE the broadcast means
   every night the broadcast fills is worth more. A campaign is armed with
   one tap, then tracked to done from real Spine events — each step
   completes when the event that proves it lands, never by self-report.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { makadiProfit } from './makadiProfit';
import { loadState } from '../store';
import { toEgp } from './money';
import type { CouncilContext } from './council';
import type { Currency } from '../../types';

const DAY = 86_400_000;

export type StepKind = 'rate' | 'broadcast' | 'bookings' | 'nights' | 'lead' | 'payment';

export interface CampaignStep {
  kind: StepKind;
  text: string;
  valueEgp: number;            // what THIS step adds
  dependsOn?: StepKind;        // must land after this one to be worth full value
  /* proof: the step is done when the Spine says so, not when he says so */
  proof: { domain: string; type: string; count?: number; minValue?: number };
  done?: boolean;
  progress?: string;
}

export interface Campaign {
  id: string;
  title: string;
  steps: CampaignStep[];
  totalEgp: number;
  targetAt: number;            // when the sequence completes if worked
  targetLabel: string;
  verdict: string;             // the one line: what it achieves
  armedAt?: number;
}

const CAMPAIGN_KEY = 'campaign';

/* ── build the campaign from the Council's live context ──────── */
export function buildCampaign(ctx: CouncilContext, now = Date.now()): Campaign | null {
  const s = safeState();
  const profit = safeProfit(now);
  const steps: CampaignStep[] = [];

  const rate = s?.makadi?.nightlyRate ?? 0;
  const ccy = (s?.makadi?.rateCcy ?? 'USD') as Currency;
  const nightlyEgp = toEgp(rate, ccy);
  const occ = Math.min(1, Math.max(0, s?.makadi?.occupancy30d ?? 0));
  const openNights = Math.round(30 * (1 - occ));

  /* 1. RATE FIRST — it multiplies everything after it. Only when the Radar
     actually shows a higher comp; never invented. */
  const comp = compFromRadar(ctx, now);
  if (comp != null && comp > rate && rate > 0) {
    const lift = toEgp(comp - rate, ccy) * Math.max(1, openNights);
    steps.push({
      kind: 'rate', text: `Raise the rate ${rate} → ${comp} ${ccy}`, valueEgp: lift,
      proof: { domain: 'makadi', type: 'rate_changed', minValue: comp },
    });
  }

  /* 2. BROADCAST — worth more once the rate is up, hence the dependency. */
  if (openNights >= 5 && nightlyEgp > 0) {
    const effectiveNightly = comp != null && comp > rate ? toEgp(comp, ccy) : nightlyEgp;
    const fill = 0.20;                                   // stated assumption
    steps.push({
      kind: 'broadcast', text: `Broadcast the ~${openNights} open nights`,
      valueEgp: openNights * effectiveNightly * fill,
      dependsOn: 'rate',
      proof: { domain: 'hunter', type: 'actioned' },
    });
  }

  /* 3. BOOKINGS — the broadcast's actual yield, tracked as real events. */
  const targetBookings = 3;
  if (nightlyEgp > 0) {
    steps.push({
      kind: 'bookings', text: `Land ${targetBookings} direct bookings`,
      valueEgp: 0,                                       // value counted in nights, not double
      dependsOn: 'broadcast',
      proof: { domain: 'makadi', type: 'booking_confirmed', count: targetBookings },
    });
  }

  /* 4. NIGHTS — the number that actually moves the Profit Line. */
  const needNights = profit ? Math.max(0, profit.nightsToBreakEven) : 0;
  if (needNights > 0 && nightlyEgp > 0) {
    const target = Math.min(needNights, 12);
    steps.push({
      kind: 'nights', text: `Book ${target} nights`, valueEgp: target * nightlyEgp,
      dependsOn: 'bookings',
      proof: { domain: 'makadi', type: 'nights_booked', minValue: target },
    });
  }

  if (steps.length < 2) return null;                     // not a campaign, just a move

  const totalEgp = steps.reduce((a, b) => a + b.valueEgp, 0);
  /* One week per step is his own observed cadence for this kind of work. */
  const targetAt = now + steps.length * 7 * DAY;
  const targetLabel = new Date(targetAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const month = new Date(now).toLocaleDateString('en-GB', { month: 'long' });

  const breakEven = profit && profit.net < 0 && needNights > 0
    ? ` Break-even ${new Date(targetAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`
    : '';

  return {
    id: 'camp-' + new Date(now).toISOString().slice(0, 7),
    title: `${month} plan`,
    steps,
    totalEgp,
    targetAt,
    targetLabel,
    verdict: `${steps.length} moves, ~${Math.round(totalEgp).toLocaleString('en-GB')} EGP by ${targetLabel}.${breakEven}`,
  };
}

/* Radar comp, same discipline as the Hunter: only a number that's literally there. */
function compFromRadar(ctx: CouncilContext, now: number): number | null {
  let best: number | null = null;
  for (const e of ctx.radar) {
    const text = `${e.meta?.title || ''} ${e.meta?.why || ''} ${e.meta?.summary || ''} ${e.meta?.detail || ''}`;
    const m = text.match(/\$\s?(\d{2,4})|(\d{2,4})\s?(?:usd|\$)/i);
    const n = m ? parseInt(m[1] || m[2], 10) : NaN;
    if (isFinite(n) && (best == null || n > best)) best = n;
  }
  return best;
}

/* ── arm it ──────────────────────────────────────────────────── */
export function armCampaign(c: Campaign, now = Date.now()): void {
  try {
    logEvent({
      domain: 'campaign', type: 'armed', value: Math.round(c.totalEgp), ccy: 'EGP',
      meta: { id: c.id, title: c.title, steps: c.steps.map((s) => ({ kind: s.kind, text: s.text, value: Math.round(s.valueEgp) })), targetAt: c.targetAt },
      source: 'user', ts: now,
    });
  } catch { /* ignore */ }
}

export function armedCampaign(now = Date.now()): Campaign | null {
  const ev = getEvents({ domain: 'campaign', type: 'armed' }).sort((a, b) => a.ts - b.ts).slice(-1)[0];
  if (!ev) return null;
  const targetAt = Number(ev.meta?.targetAt) || ev.ts + 28 * DAY;
  if (now > targetAt + 14 * DAY) return null;            // expired campaigns stop nagging
  const steps = ((ev.meta?.steps as any[]) || []).map((s) => ({
    kind: s.kind as StepKind, text: String(s.text), valueEgp: Number(s.value) || 0,
    proof: proofFor(s.kind as StepKind),
  })) as CampaignStep[];
  return {
    id: String(ev.meta?.id || ev.id), title: String(ev.meta?.title || 'Campaign'),
    steps, totalEgp: Number(ev.value) || 0, targetAt,
    targetLabel: new Date(targetAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    verdict: '', armedAt: ev.ts,
  };
}

function proofFor(kind: StepKind): CampaignStep['proof'] {
  switch (kind) {
    case 'rate': return { domain: 'makadi', type: 'rate_changed' };
    case 'broadcast': return { domain: 'hunter', type: 'actioned' };
    case 'bookings': return { domain: 'makadi', type: 'booking_confirmed', count: 3 };
    case 'nights': return { domain: 'makadi', type: 'nights_booked' };
    case 'lead': return { domain: 'leads', type: 'stage_changed' };
    default: return { domain: 'debt', type: 'payment_logged' };
  }
}

/* ── track it to done, from real events only ─────────────────── */
export interface CampaignProgress { campaign: Campaign; doneCount: number; pct: number; line: string }

export function trackCampaign(now = Date.now()): CampaignProgress | null {
  const c = armedCampaign(now);
  if (!c || !c.armedAt) return null;
  let done = 0;
  for (const step of c.steps) {
    const evs = getEvents({ domain: step.proof.domain as any, type: step.proof.type, since: c.armedAt });
    const count = step.proof.count ?? 1;
    const hits = step.proof.minValue != null
      ? evs.filter((e) => (e.value ?? 0) >= step.proof.minValue!).length
      : evs.length;
    step.done = hits >= count;
    step.progress = `${Math.min(hits, count)}/${count}`;
    if (step.done) done++;
  }
  const pct = c.steps.length ? Math.round((done / c.steps.length) * 100) : 0;
  const daysLeft = Math.ceil((c.targetAt - now) / DAY);
  const line = done === c.steps.length
    ? `${c.title} complete — all ${c.steps.length} moves landed.`
    : `${c.title}: ${done}/${c.steps.length} done${daysLeft >= 0 ? `, ${daysLeft}d to ${c.targetLabel}` : `, ${-daysLeft}d past ${c.targetLabel}`}.`;
  return { campaign: c, doneCount: done, pct, line };
}

function safeState() { try { return loadState(); } catch { return null; } }
function safeProfit(now: number) { try { return makadiProfit(now); } catch { return null; } }
export const CAMPAIGN_DOMAIN = CAMPAIGN_KEY;
