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

  /* ── the dispatch: KAI's ONE line — the single most important thing, in
     his voice, or silence. Not a briefing. One sentence. Ranked. ──── */
  let dispatch: string | null = null;
  const worst = escalations.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])[0];
  const cashEv = events.filter((e) => e.domain === 'system' && e.type === 'cash_on_hand').sort((a, b) => a.ts - b.ts).slice(-1)[0];
  const cashVal = cashEv && typeof cashEv.value === 'number' ? cashEv.value : null;
  const repliedThreads = new Set(events.filter((e) => (e.domain === 'makadi' || e.domain === 'leads') && e.type === 'booking_replied').map((e) => String(e.meta?.thread)));
  const openInquiry = events.filter((e) => (e.domain === 'makadi' || e.domain === 'leads') && e.type === 'booking_inquiry'
    && !repliedThreads.has(String(e.meta?.thread)) && now - e.ts > 2 * HOUR && now - e.ts < 48 * HOUR).sort((a, b) => a.ts - b.ts)[0];
  const recentBooking = events.filter((e) => e.domain === 'makadi' && e.type === 'booking_confirmed' && now - e.ts < 24 * HOUR).sort((a, b) => a.ts - b.ts).slice(-1)[0];

  if (cashVal !== null && cashVal > 0 && cashVal < CASH_CRITICAL) {
    dispatch = `Cash is down to ${Math.round(cashVal).toLocaleString()} EGP — that's the one thing today.`;
  } else if (worst && worst.tier === 'overdue') {
    dispatch = `${worst.text} is overdue — clear it before anything else.`;
  } else if (openInquiry) {
    dispatch = `A booking inquiry has been waiting ${Math.round((now - openInquiry.ts) / HOUR)}h. Answer it.`;
  } else if (recentBooking) {
    dispatch = `${String(recentBooking.meta?.guest || 'A guest')} booked Makadi. First light — now go get the next one.`;
  } else if (worst && worst.tier === 'dominant') {
    dispatch = `${worst.text} is due tomorrow.`;
  } else if (anomalies > 0) {
    dispatch = `${String(newEvents.find((e) => e.domain === 'anomaly')?.meta?.detail || 'Something moved')} — worth a look.`;
  } else if (worst) {
    dispatch = `${worst.days} days out: ${worst.text}.`;
  }
  /* else → null: nothing matters enough to push. Silence. */

  return { newEvents, dispatch, pushes: pulsePushes(events, now, dispatch), summary: { escalations: escalations.length, anomalies } };
}

/* ============================================================
   §23.1 THE METABOLISM — a real circadian cycle, server-side. The daily
   heartbeat becomes FIVE phases, each computing from the operator's synced
   Spine so KAI thinks whether or not the app is open. All phases are
   deterministic and idempotent; each writes a marker so a re-fire is a
   no-op. Silence is always valid. Nothing ambient — this reads the Spine
   the operator's own watchers filled, within their authorized perimeter.
   ============================================================ */
export type PulsePhase = 'wake' | 'speak' | 'midday' | 'evening' | 'dream';

const EMPTY = { escalations: 0, anomalies: 0 };
function firedToday(events: PulseEvent[], type: string, now: number): boolean {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return events.some((e) => e.domain === 'system' && e.type === type && e.ts >= start.getTime());
}

export function runPulsePhase(events: PulseEvent[], now: number, phase: PulsePhase): PulseResult {
  switch (phase) {
    case 'speak':   return speakPhase(events, now);                // 07:35 — the day's one line
    case 'wake':    return wakePhase(events, now);                 // 06:00 — read what landed overnight
    case 'midday':  return middayPhase(events, now);               // 13:00 — quiet urgent-only scan
    case 'evening': return eveningPhase(events, now);              // 21:00 — intake nudge if unlogged
    case 'dream':   return dreamPhase(events, now);                // 02:00 — re-read, find patterns
    default:        return runPulseCore(events, now);
  }
}

/* 07:35 SPEAK — the day's one line. §25.2: the morning dispatch is the best
   output of ALL engines, not just this scan — so if the Council's 02:00
   synthesis found a cross-domain pattern last night, THAT is what KAI says
   (nothing else it computes can outrank a pattern nobody asked for). Falls
   back to the ranked scan, and to silence. */
function speakPhase(events: PulseEvent[], now: number): PulseResult {
  const core = runPulseCore(events, now);
  const synth = events
    .filter((e) => e.domain === 'system' && e.type === 'insight' && e.meta?.source === 'council' && now - e.ts < 36 * HOUR)
    .sort((a, b) => a.ts - b.ts).slice(-1)[0];
  const line = synth?.meta?.text ? String(synth.meta.text) : core.dispatch;
  if (!line || line === core.dispatch) return core;
  /* Replace only the morning message; true alarms keep their own wording. */
  const pushes = core.pushes.map((p) => (p.tag === 'morning' ? { ...p, body: line } : p));
  if (!pushes.some((p) => p.tag === 'morning')) pushes.push({ title: 'KAI', body: line, tag: 'morning', priority: 2 });
  return { ...core, dispatch: line, pushes: pushes.slice(0, 3) };
}

/* 06:00 WAKE — summarise what changed overnight (operator-sourced writes in
   the last ~9h). No push; it primes the morning. */
function wakePhase(events: PulseEvent[], now: number): PulseResult {
  if (firedToday(events, 'wake', now)) return { newEvents: [], dispatch: null, pushes: [], summary: EMPTY };
  const overnight = events.filter((e) => e.ts >= now - 9 * HOUR && e.source !== 'auto');
  const byDomain: Record<string, number> = {};
  for (const e of overnight) byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  const summary = Object.entries(byDomain).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d}:${n}`).join(' ') || 'quiet';
  return {
    newEvents: [{ ts: now, domain: 'system', type: 'wake', value: overnight.length, meta: { summary, changed: overnight.length }, source: 'auto' }],
    dispatch: null, pushes: [], summary: EMPTY,
  };
}

/* 13:00 MIDDAY — a quiet scan. Push ONLY a true interrupt (cash-critical,
   overdue, an inquiry aging past 2h) — never the morning line again. */
function middayPhase(events: PulseEvent[], now: number): PulseResult {
  const core = runPulseCore(events, now);
  const interrupts = core.pushes.filter((p) => p.tag !== 'morning');   // drop the daily dispatch line
  return {
    newEvents: [...core.newEvents, { ts: now, domain: 'system', type: 'midday', value: interrupts.length, meta: {}, source: 'auto' }],
    dispatch: null, pushes: interrupts, summary: core.summary,
  };
}

/* 21:00 EVENING — the intake nudge, once, only if nothing was logged today. */
function eveningPhase(events: PulseEvent[], now: number): PulseResult {
  if (firedToday(events, 'evening', now)) return { newEvents: [], dispatch: null, pushes: [], summary: EMPTY };
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const loggedToday = events.some((e) => e.domain === 'expense' && e.ts >= start.getTime());
  const pushes: PushMsg[] = loggedToday ? [] : [{ title: 'KAI', body: 'Anything spent today? One tap to log it.', tag: 'intake', priority: 1 }];
  return {
    newEvents: [{ ts: now, domain: 'system', type: 'evening', value: loggedToday ? 1 : 0, meta: { loggedToday }, source: 'auto' }],
    dispatch: null, pushes, summary: EMPTY,
  };
}

/* 02:00 DREAM — re-read the whole Spine and write patterns nobody asked for,
   as system/insight events the morning can surface. Deterministic; deduped by
   text within 24h so a re-fire doesn't duplicate. */
function dreamPhase(events: PulseEvent[], now: number): PulseResult {
  if (firedToday(events, 'dream', now)) return { newEvents: [], dispatch: null, pushes: [], summary: EMPTY };
  const insights = dreamInsights(events, now);
  const recent = new Set(events.filter((e) => e.domain === 'system' && e.type === 'insight' && e.ts >= now - DAY).map((e) => String(e.meta?.text)));
  const fresh = insights.filter((t) => !recent.has(t));
  const newEvents: Omit<PulseEvent, 'id'>[] = fresh.map((text) => ({ ts: now, domain: 'system', type: 'insight', meta: { text, phase: 'dream' }, source: 'auto' }));
  newEvents.push({ ts: now, domain: 'system', type: 'dream', value: fresh.length, meta: { count: fresh.length }, source: 'auto' });
  return { newEvents, dispatch: null, pushes: [], summary: EMPTY };
}

/* Deterministic overnight patterns, from EVENTS alone (works off the synced
   Spine, no client store needed). Only emits what the data supports. */
function dreamInsights(events: PulseEvent[], now: number): string[] {
  const out: string[] = [];

  /* 1. reward-spend reflex — expense in the 3 days after a win vs baseline. */
  const isWin = (e: PulseEvent) => (e.domain === 'money' && e.type === 'milestone') || (e.domain === 'makadi' && e.type === 'booking_confirmed') || (e.domain === 'commitment' && e.type === 'commitment_kept');
  const wins = events.filter(isWin).sort((a, b) => a.ts - b.ts);
  const expenses = events.filter((e) => e.domain === 'expense' && typeof e.value === 'number');
  if (wins.length >= 2 && expenses.length >= 5) {
    const win3 = (ts: number) => expenses.filter((e) => e.ts > ts && e.ts <= ts + 3 * DAY).reduce((s, e) => s + (e.value || 0), 0);
    const postWin = wins.reduce((s, w) => s + win3(w.ts), 0) / (wins.length * 3);
    const inWin = (ts: number) => wins.some((w) => ts > w.ts && ts <= w.ts + 3 * DAY);
    const baseEx = expenses.filter((e) => !inWin(e.ts));
    const span = Math.max(1, (now - events[0].ts) / DAY - wins.length * 3);
    const base = baseEx.reduce((s, e) => s + (e.value || 0), 0) / span;
    if (base > 0 && postWin / base >= 1.4) out.push(`After a win you spend ${(postWin / base).toFixed(1)}× your usual — the reward reflex. Watch the days after money lands.`);
  }

  /* 2. a domain that used to be active and has gone silent (14d). */
  for (const dom of ['garden', 'content', 'instagram', 'makadi', 'leads']) {
    const evs = events.filter((e) => e.domain === dom).sort((a, b) => a.ts - b.ts);
    if (evs.length < 4) continue;
    const lastDaysAgo = Math.floor((now - evs[evs.length - 1].ts) / DAY);
    if (lastDaysAgo >= 14 && lastDaysAgo <= 60) { out.push(`${dom} has gone quiet — ${lastDaysAgo} days since the last move. You had momentum there.`); break; }
  }

  /* 3. commitment reliability, from kept/broken events. */
  const kept = events.filter((e) => e.domain === 'commitment' && e.type === 'commitment_kept').length;
  const broke = events.filter((e) => e.domain === 'commitment' && e.type === 'commitment_broken').length;
  if (kept + broke >= 3) out.push(`You've kept ${kept} of ${kept + broke} commitments on record (${Math.round((kept / (kept + broke)) * 100)}%). ${broke > kept ? 'The vague ones are where you slip.' : 'Hold that line.'}`);

  return out.slice(0, 3);
}
