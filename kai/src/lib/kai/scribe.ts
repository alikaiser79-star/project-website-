/* ============================================================
   The Scribe — Spine analytics.

   Pre-baked queries that turn the Spine's raw event log into
   honest patterns about how Ali actually operates. No model
   calls; just SQL-shaped math over the event stream. Functions
   return `null` when there isn't enough data — boot-from-empty
   safe.
   ============================================================ */

import { getEvents } from './events';
import { getCommitments } from './commitments';
import { listPromises } from './ledger';
import { getAutopilotState } from './autopilot';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface Insight {
  key: string;
  title: string;
  detail: string;
  value?: string | number | null;
  tone: 'good' | 'warn' | 'neutral';
}

/* ── Helpers ───────────────────────────────────────────── */

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/* ── Individual insights ──────────────────────────────── */

export function autopilotApprovalRate(now = Date.now()): Insight | null {
  const since = now - 30 * DAY;
  const runs = getEvents({ domain: 'system', type: 'autopilot_run', since });
  if (runs.length === 0) return null;
  const totalDrafted = runs.reduce((s, r) => s + (r.value || 0), 0);
  if (totalDrafted === 0) return null;
  /* Approved = email_sent + sms_sent + ig published + site_committed
     after a run. Crude — we don't link drafts back. Use it as a
     coarse "things actually shipped" signal. */
  const sent = getEvents({ since }).filter(e =>
    e.source === 'ai' && (
      e.type === 'email_sent' ||
      e.type === 'sms_sent' ||
      e.type === 'reel_posted' ||
      e.type === 'site_committed'
    )).length;
  const rate = Math.min(100, Math.round((sent / totalDrafted) * 100));
  return {
    key: 'autopilot.approval_rate',
    title: 'Autopilot approval rate',
    detail: `${sent} of ${totalDrafted} drafted moves shipped in the last 30 days.`,
    value: `${rate}%`,
    tone: rate >= 60 ? 'good' : rate >= 30 ? 'neutral' : 'warn',
  };
}

export function mirrorKeepStreak(now = Date.now()): Insight | null {
  const resolved = getCommitments()
    .filter(c => c.status !== 'open' && (c.resolvedAt ?? 0) > now - 90 * DAY)
    .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
  if (resolved.length === 0) return null;

  let streak = 0;
  for (const c of resolved) {
    if (c.status === 'kept') streak++;
    else break;
  }
  if (streak < 2) return null;
  return {
    key: 'mirror.streak',
    title: 'Mirror kept-streak',
    detail: `${streak} commitments in a row kept. Discipline compounding.`,
    value: streak,
    tone: 'good',
  };
}

export function ledgerWorstActor(): Insight | null {
  const promises = listPromises();
  const byPerson = new Map<string, { delivered: number; flaked: number; name?: string }>();
  for (const p of promises) {
    if (p.status === 'open') continue;
    const r = byPerson.get(p.personId) || { delivered: 0, flaked: 0 };
    if (p.status === 'delivered') r.delivered++;
    else if (p.status === 'flaked') r.flaked++;
    byPerson.set(p.personId, r);
  }
  let worst: { id: string; flaked: number; total: number } | null = null;
  for (const [id, r] of byPerson) {
    const total = r.delivered + r.flaked;
    if (total < 2) continue;
    if (!worst || r.flaked > worst.flaked) worst = { id, flaked: r.flaked, total };
  }
  if (!worst || worst.flaked === 0) return null;
  return {
    key: 'ledger.worst',
    title: 'Watch this person',
    detail: `Most-flaked actor: ${worst.flaked} of last ${worst.total}. Get insurance up front.`,
    tone: 'warn',
  };
}

export function spendDayOfWeek(now = Date.now()): Insight | null {
  const since = now - 60 * DAY;
  const expenses = getEvents({ domain: 'expense', type: 'expense_logged', since });
  if (expenses.length < 5) return null;
  const byDow = [0, 0, 0, 0, 0, 0, 0];
  const cntDow = [0, 0, 0, 0, 0, 0, 0];
  for (const e of expenses) {
    const dow = new Date(e.ts).getDay();
    byDow[dow] += e.value || 0;
    cntDow[dow]++;
  }
  const avgs = byDow.map((v, i) => cntDow[i] ? v / cntDow[i] : 0);
  let max = 0, maxDow = 0;
  for (let i = 0; i < 7; i++) if (avgs[i] > max) { max = avgs[i]; maxDow = i; }
  if (max === 0) return null;
  const dowName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][maxDow];
  return {
    key: 'spend.dow',
    title: 'Most expensive day',
    detail: `${dowName}s average ${Math.round(max).toLocaleString()} EGP per spend — the loudest day on your card.`,
    value: dowName,
    tone: 'neutral',
  };
}

export function postingCadence(now = Date.now()): Insight | null {
  const since = now - 30 * DAY;
  const posts = getEvents({ domain: 'content', type: 'item_posted', since });
  if (posts.length === 0) return null;
  const days = new Set(posts.map(p => dayKey(p.ts)));
  const cadence = days.size / 30;
  return {
    key: 'content.cadence',
    title: 'Posting cadence',
    detail: `${posts.length} posts on ${days.size} unique days over 30 days — ${cadence >= 0.5 ? 'consistent' : 'sparse'}.`,
    value: `${(cadence * 7).toFixed(1)}/wk`,
    tone: cadence >= 0.7 ? 'good' : cadence >= 0.3 ? 'neutral' : 'warn',
  };
}

export function debtVelocity(now = Date.now()): Insight | null {
  const since = now - 30 * DAY;
  const payments = getEvents({ domain: 'debt', type: 'payment_logged', since });
  if (payments.length === 0) return null;
  const total = payments.reduce((s, p) => s + (p.value || 0), 0);
  const perDay = total / 30;
  return {
    key: 'debt.velocity',
    title: 'Debt paydown velocity',
    detail: `${payments.length} payments totalling ${Math.round(total).toLocaleString()} EGP. ${Math.round(perDay).toLocaleString()} EGP/day average.`,
    value: `-${Math.round(total).toLocaleString()}`,
    tone: 'good',
  };
}

export function approvalLatency(now = Date.now()): Insight | null {
  const since = now - 30 * DAY;
  const proposals = getEvents({ domain: 'system', type: 'action_proposed', since });
  if (proposals.length === 0) return null;
  /* No matching id link, but approximate: average time between
     the proposal and the NEXT _sent/_posted/_committed event. */
  const sent = getEvents({ since }).filter(e =>
    /^email_sent|sms_sent|reel_posted|site_committed$/.test(e.type)
  );
  if (sent.length === 0) return null;
  const deltas: number[] = [];
  for (const p of proposals) {
    const next = sent.find(s => s.ts > p.ts);
    if (next) deltas.push(next.ts - p.ts);
  }
  if (deltas.length < 3) return null;
  const median = deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
  const hrs = median / HOUR;
  return {
    key: 'approval.latency',
    title: 'Decision latency',
    detail: `Median time from KAI proposal → your tap: ${hrs < 1 ? Math.round(median / 60_000) + ' min' : hrs.toFixed(1) + ' h'}.`,
    value: hrs < 1 ? `${Math.round(median / 60_000)}m` : `${hrs.toFixed(1)}h`,
    tone: hrs < 2 ? 'good' : hrs < 8 ? 'neutral' : 'warn',
  };
}

export function autopilotUsage(now = Date.now()): Insight | null {
  const state = getAutopilotState();
  if (!state.lastRun) return null;
  const since = now - 30 * DAY;
  const runs = getEvents({ domain: 'system', type: 'autopilot_run', since });
  if (runs.length === 0) return null;
  const days = new Set(runs.map(r => dayKey(r.ts))).size;
  const totalProposals = runs.reduce((s, r) => s + (r.value || 0), 0);
  const avgPer = totalProposals / runs.length;
  return {
    key: 'autopilot.usage',
    title: 'Autopilot habit',
    detail: `${runs.length} runs across ${days} days. ${avgPer.toFixed(1)} proposals per run on average.`,
    value: `${runs.length}/${30}`,
    tone: days >= 10 ? 'good' : days >= 3 ? 'neutral' : 'warn',
  };
}

/* ── Compose ──────────────────────────────────────────── */

export function listInsights(now = Date.now()): Insight[] {
  const all = [
    autopilotApprovalRate(now),
    mirrorKeepStreak(now),
    ledgerWorstActor(),
    spendDayOfWeek(now),
    postingCadence(now),
    debtVelocity(now),
    approvalLatency(now),
    autopilotUsage(now),
  ].filter((x): x is Insight => x !== null);
  return all;
}

export function scribeSnapshot() {
  return { insights: listInsights() };
}
