/* ============================================================
   PULSE CORE (§14.1) — the heartbeat's brain, PURE. Runs server-side
   on the daily cron against the synced Spine (event log only — that's
   what §8 syncs). Given the events and `now`, it recomputes what should
   have changed overnight and returns NEW events to append plus a single
   dispatch line (or null — silence is a valid dispatch).

   Kept dependency-free so it compiles inside the Edge/Node route AND is
   unit-testable in isolation. No localStorage, no DOM, no imports.
   ============================================================ */

const DAY = 86_400_000;

export interface PulseEvent {
  id: string;
  ts: number;
  domain: string;
  type: string;
  value?: number;
  ccy?: string;
  meta?: Record<string, unknown>;
  source: string;
}

export interface PulseResult {
  newEvents: Omit<PulseEvent, 'id'>[];   // route stamps ids
  dispatch: string | null;               // one line for the morning push, or null
  summary: { escalations: number; anomalies: number };
}

type Tier = 'calling' | 'dominant' | 'overdue';
function deadlineTier(date: number, now: number): Tier | null {
  const days = (date - now) / DAY;
  if (days < 0) return 'overdue';
  if (days <= 1) return 'dominant';
  if (days <= 3) return 'calling';
  return null;
}
const TIER_RANK: Record<Tier, number> = { calling: 1, dominant: 2, overdue: 3 };

export function runPulseCore(events: PulseEvent[], now: number): PulseResult {
  const newEvents: Omit<PulseEvent, 'id'>[] = [];

  /* ── deadline escalation ─────────────────────────────────
     For every deadline that has crossed into T-3/T-1/overdue and hasn't
     already been escalated to that tier (or higher), emit an escalation
     event. Idempotent across pulses via the prior escalation events. */
  const deadlines = events.filter((e) => e.domain === 'deadline' && e.type === 'set');
  const escalatedAt: Record<string, number> = {};   // id → highest tier rank already escalated
  for (const e of events) {
    if (e.domain === 'deadline' && e.type === 'escalated') {
      const id = String(e.meta?.id || '');
      const rank = TIER_RANK[(e.meta?.tier as Tier)] || 0;
      if (rank > (escalatedAt[id] || 0)) escalatedAt[id] = rank;
    }
  }

  const escalations: Array<{ text: string; tier: Tier; days: number }> = [];
  for (const d of deadlines) {
    const id = String(d.meta?.id || '');
    const date = Number(d.meta?.date);
    const text = String(d.meta?.text || 'deadline');
    if (!id || !isFinite(date)) continue;
    const tier = deadlineTier(date, now);
    if (!tier) continue;
    if ((escalatedAt[id] || 0) >= TIER_RANK[tier]) continue;   // already escalated to this tier
    const days = Math.round((date - now) / DAY);
    newEvents.push({ ts: now, domain: 'deadline', type: 'escalated', meta: { id, text, tier, days }, source: 'auto' });
    escalations.push({ text, tier, days });
  }

  /* ── anomaly: debt moved the WRONG way ───────────────────
     If the two most recent balance_updated events show the balance
     rising, flag it once per pulse (the operator should know overnight). */
  let anomalies = 0;
  const bals = events.filter((e) => e.domain === 'debt' && e.type === 'balance_updated').sort((a, b) => a.ts - b.ts);
  if (bals.length >= 2) {
    const prev = bals[bals.length - 2].value ?? 0;
    const last = bals[bals.length - 1].value ?? 0;
    const alreadyFlagged = events.some((e) => e.domain === 'anomaly' && e.meta?.of === 'debt' && e.ts >= now - DAY);
    if (last > prev && !alreadyFlagged) {
      newEvents.push({ ts: now, domain: 'anomaly', type: 'detected', value: last - prev, ccy: 'EGP', meta: { of: 'debt', detail: `Debt rose ${Math.round(last - prev).toLocaleString()} EGP` }, source: 'auto' });
      anomalies++;
    }
  }

  /* ── the pulse ran — a heartbeat marker, always ──────────── */
  newEvents.push({ ts: now, domain: 'system', type: 'pulse', value: newEvents.length, meta: { escalations: escalations.length, anomalies }, source: 'auto' });

  /* ── the dispatch: one line, most urgent, or silence ─────── */
  let dispatch: string | null = null;
  const worst = escalations.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])[0];
  if (worst) {
    dispatch = worst.tier === 'overdue' ? `OVERDUE: ${worst.text}`
      : worst.tier === 'dominant' ? `Tomorrow: ${worst.text}`
      : `${worst.days}d out: ${worst.text}`;
  } else if (anomalies > 0) {
    dispatch = String(newEvents.find((e) => e.domain === 'anomaly')?.meta?.detail || null) || null;
  }

  return { newEvents, dispatch, summary: { escalations: escalations.length, anomalies } };
}
