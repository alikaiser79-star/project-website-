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

export interface PushMsg { title: string; body: string; tag: string; priority: number; }

export interface PulseResult {
  newEvents: Omit<PulseEvent, 'id'>[];   // route stamps ids
  dispatch: string | null;               // one line for the morning push, or null
  pushes: PushMsg[];                     // §14.2 — ranked push candidates (route caps at 3/day)
  summary: { escalations: number; anomalies: number };
}

const HOUR = 3_600_000;
const CASH_CRITICAL = 5_000;             // EGP — cash_on_hand below this is an alarm

/* §14.2 — true-alarm interrupts + the morning dispatch, ranked. The
   route sends the top N within the day's 3-push cap. Alarms (priority 3)
   beat the morning summary (priority 2); silence sends nothing. */
export function pulsePushes(events: PulseEvent[], now: number, dispatch: string | null): PushMsg[] {
  const out: PushMsg[] = [];

  /* ALARM — cash on hand critical (latest cash_on_hand < threshold). */
  const cash = events.filter((e) => e.domain === 'system' && e.type === 'cash_on_hand').sort((a, b) => a.ts - b.ts).slice(-1)[0];
  if (cash && typeof cash.value === 'number' && cash.value > 0 && cash.value < CASH_CRITICAL) {
    out.push({ title: 'KAI · ALARM', body: `Cash on hand critical: ${Math.round(cash.value).toLocaleString()} EGP`, tag: 'cash-critical', priority: 3 });
  }

  /* ALARM — a deadline (or committed money metric) < 48h away. */
  const deadlines = events.filter((e) => e.domain === 'deadline' && e.type === 'set');
  const commitDeadlines = events.filter((e) => e.domain === 'commitment' && e.type === 'commitment_made' && typeof e.meta?.deadline === 'number');
  for (const d of [...deadlines, ...commitDeadlines]) {
    const date = Number(d.meta?.date ?? d.meta?.deadline);
    const text = String(d.meta?.text || 'a commitment');
    if (!isFinite(date)) continue;
    const hrs = (date - now) / HOUR;
    if (hrs > 0 && hrs <= 48) out.push({ title: 'KAI · ALARM', body: `${text} — due in ${Math.round(hrs)}h`, tag: 'due-' + (d.meta?.id || text), priority: 3 });
  }

  /* CELEBRATION — a confirmed Makadi booking (the booking-watcher, §14.3).
     The client fires this the instant it detects the email; this is the
     pulse-side FALLBACK for when the app wasn't open. Only recent (<24h)
     confirmations, deduped by thread tag, so old bookings never re-notify. */
  const confirmed = events.filter((e) => e.domain === 'makadi' && e.type === 'booking_confirmed');
  for (const b of confirmed) {
    if (now - b.ts >= 24 * HOUR) continue;
    const thread = String(b.meta?.thread || b.id);
    const guest = String(b.meta?.guest || 'A guest');
    const when = b.meta?.dates ? ` — ${b.meta.dates}` : '';
    out.push({ title: 'KAI · BOOKING', body: `${guest} booked Makadi${when}. First light. 🌅`, tag: 'booking-' + thread, priority: 3 });
  }

  /* ALARM — a booking inquiry unanswered > 2h (the Gmail booking-watcher,
     §14.3; domains leads OR makadi). Answered when a later booking_replied
     for the same thread exists. Nudges for up to 48h, then goes quiet. */
  const inquiries = events.filter((e) => (e.domain === 'leads' || e.domain === 'makadi') && e.type === 'booking_inquiry');
  for (const q of inquiries) {
    const thread = String(q.meta?.thread || q.id);
    const answered = events.some((e) => (e.domain === 'leads' || e.domain === 'makadi') && e.type === 'booking_replied' && String(e.meta?.thread) === thread);
    const age = now - q.ts;
    if (!answered && age > 2 * HOUR && age < 48 * HOUR) out.push({ title: 'KAI · ALARM', body: `Booking inquiry still unanswered (${Math.round(age / HOUR)}h)`, tag: 'inquiry-' + thread, priority: 3 });
  }

  /* MORNING dispatch — the day's one line, if anything needs him. */
  if (dispatch) out.push({ title: 'KAI', body: dispatch, tag: 'morning', priority: 2 });

  /* dedupe by tag, highest priority first, cap the raw list. */
  const seen = new Set<string>();
  return out.sort((a, b) => b.priority - a.priority).filter((p) => (seen.has(p.tag) ? false : (seen.add(p.tag), true))).slice(0, 3);
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

  return { newEvents, dispatch, pushes: pulsePushes(events, now, dispatch), summary: { escalations: escalations.length, anomalies } };
}
