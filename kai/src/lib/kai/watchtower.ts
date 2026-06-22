/* ============================================================
   The Watchtower — ambient triggers.

   Polls the Spine + connectors at intervals. When a trigger
   matches, fires a toast and (if granted) a native browser
   Notification. Each trigger has its own cooldown so it doesn't
   spam — the rule of thumb is once per condition per 6h.

   Default triggers cover the loudest "something needs you"
   surfaces:
     - mirror_due_soon       — open commitment within 24h
     - ledger_overdue        — someone overdue on a promise
     - tollgate_low_runway   — runway < 14 days
     - token_broken          — recent token_warning on the Spine
     - proposals_stale       — pending action sitting > 6h

   Web Push (VAPID) is intentionally deferred per the brief
   (fiddly). The Notifications API works in an installed PWA on
   iOS 16.4+ and Android — no server keys required.
   ============================================================ */

import { read, write, emit } from './store';
import { getEvents } from './events';
import { getCommitments } from './commitments';
import { listPeople, listPromises } from './ledger';
import { computeRunway } from './runway';
import { getPending } from './pending';
import { toast } from '../../hooks/useToasts';

const KEY = 'kai.watchtower';
const DAY = 86_400_000;
const HOUR = 3_600_000;

export type TriggerKind =
  | 'mirror_due_soon'
  | 'ledger_overdue'
  | 'tollgate_low_runway'
  | 'token_broken'
  | 'proposals_stale';

export interface TriggerConfig {
  kind: TriggerKind;
  label: string;
  hint: string;
  cooldownMs: number;
}

export const TRIGGERS: TriggerConfig[] = [
  { kind: 'mirror_due_soon',     label: 'Mirror · due soon',  hint: 'Open commitment with deadline ≤ 24h', cooldownMs: 6 * HOUR },
  { kind: 'ledger_overdue',      label: 'Ledger · overdue',   hint: 'Someone overdue on a promise',         cooldownMs: 6 * HOUR },
  { kind: 'tollgate_low_runway', label: 'Tollgate · low',     hint: 'Runway under 14 days',                 cooldownMs: 24 * HOUR },
  { kind: 'token_broken',        label: 'Connector · broken', hint: 'Token warning in last 24h',            cooldownMs: 6 * HOUR },
  { kind: 'proposals_stale',     label: 'Gate · stale',       hint: 'Pending action sitting > 6h',          cooldownMs: 6 * HOUR },
];

export interface Alert {
  kind: TriggerKind;
  title: string;
  body: string;
  ts: number;
}

interface State {
  enabled: Record<TriggerKind, boolean>;
  lastFired: Partial<Record<TriggerKind, number>>;
  alerts: Alert[];
  notifications: 'unknown' | 'denied' | 'granted' | 'default';
}

function defaults(): State {
  return {
    enabled: Object.fromEntries(TRIGGERS.map(t => [t.kind, true])) as Record<TriggerKind, boolean>,
    lastFired: {},
    alerts: [],
    notifications: 'unknown',
  };
}

export function getWatchtower(): State {
  const s = read<State>(KEY, defaults());
  /* Fill in any new triggers that didn't exist when the saved
     state was written. */
  for (const t of TRIGGERS) if (!(t.kind in s.enabled)) s.enabled[t.kind] = true;
  return s;
}
function saveState(s: State): void { write(KEY, s); emit(); }

export function setTriggerEnabled(kind: TriggerKind, enabled: boolean): void {
  const s = getWatchtower();
  s.enabled[kind] = enabled;
  saveState(s);
}

export async function requestNotificationsPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  const perm = await Notification.requestPermission();
  const s = getWatchtower();
  s.notifications = perm;
  saveState(s);
  return perm;
}

export function notificationsPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

/* ── Checkers ──────────────────────────────────────────── */

function checkAll(now: number = Date.now()): Alert[] {
  const out: Alert[] = [];
  const s = getWatchtower();

  /* mirror_due_soon */
  if (s.enabled.mirror_due_soon) {
    const due = getCommitments()
      .filter(c => c.status === 'open' && c.deadline - now < DAY && c.deadline > now - DAY)
      .sort((a, b) => a.deadline - b.deadline)[0];
    if (due) {
      const hrs = Math.max(0, Math.ceil((due.deadline - now) / HOUR));
      out.push({
        kind: 'mirror_due_soon', ts: now,
        title: 'Commitment due',
        body: `${due.text} · ${hrs <= 0 ? 'overdue' : hrs + 'h left'}`,
      });
    }
  }

  /* ledger_overdue */
  if (s.enabled.ledger_overdue) {
    const overdue = listPromises().find(p => p.status === 'open' && p.deadline < now);
    if (overdue) {
      const person = listPeople().find(p => p.id === overdue.personId);
      out.push({
        kind: 'ledger_overdue', ts: now,
        title: 'Promise overdue',
        body: `${person?.name ?? 'Someone'} — ${overdue.text}`,
      });
    }
  }

  /* tollgate_low_runway */
  if (s.enabled.tollgate_low_runway) {
    const r = computeRunway(now);
    if (r.runwayDays !== null && r.runwayDays < 14) {
      out.push({
        kind: 'tollgate_low_runway', ts: now,
        title: 'Runway low',
        body: `${Math.floor(r.runwayDays)} days of freedom left at current burn.`,
      });
    }
  }

  /* token_broken — any token_warning in last 24h */
  if (s.enabled.token_broken) {
    const ev = getEvents({ domain: 'system', type: 'token_warning', since: now - DAY }).slice(-1)[0];
    if (ev) {
      out.push({
        kind: 'token_broken', ts: now,
        title: 'Connector token',
        body: `${(ev.meta?.handle as string) || 'a connector'} — ${(ev.meta?.message as string) || 'token warning'}`,
      });
    }
  }

  /* proposals_stale */
  if (s.enabled.proposals_stale) {
    const stale = getPending().find(p => now - p.createdAt > 6 * HOUR);
    if (stale) {
      const n = getPending().length;
      out.push({
        kind: 'proposals_stale', ts: now,
        title: 'Approvals waiting',
        body: `${n} pending action${n === 1 ? '' : 's'} — oldest sitting > 6h.`,
      });
    }
  }

  return out;
}

/* Fire any due alerts. Cooldowns honoured. Persists fired alerts
   so the panel can show recent ones. */
export function tick(now: number = Date.now()): Alert[] {
  const s = getWatchtower();
  const fired: Alert[] = [];

  for (const alert of checkAll(now)) {
    const last = s.lastFired[alert.kind] || 0;
    const cool = TRIGGERS.find(t => t.kind === alert.kind)?.cooldownMs || 6 * HOUR;
    if (now - last < cool) continue;

    /* Fire */
    s.lastFired[alert.kind] = now;
    s.alerts = [alert, ...s.alerts].slice(0, 12);
    fired.push(alert);
    surface(alert);
  }

  if (fired.length) saveState(s);
  return fired;
}

function surface(a: Alert): void {
  toast.warn(a.body, 'WATCHTOWER · ' + a.title.toUpperCase(), 7000);
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`KAI · ${a.title}`, {
        body: a.body,
        tag: a.kind,                 // collapses duplicates
        icon: '/icon.svg',
        badge: '/icon.svg',
      });
    }
  } catch { /* tolerated */ }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/* Call once at App boot. Ticks immediately, then every 5 min
   while the tab is visible. Pauses when hidden. */
export function startWatchtower(): () => void {
  tick();
  const start = () => {
    if (intervalHandle) return;
    intervalHandle = setInterval(() => { tick(); }, 5 * 60 * 1000);
  };
  const stop = () => {
    if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
  };
  start();
  const onVis = () => {
    if (document.visibilityState === 'visible') { tick(); start(); } else stop();
  };
  document.addEventListener('visibilitychange', onVis);
  return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
}

export function clearAlerts(): void {
  const s = getWatchtower();
  s.alerts = [];
  saveState(s);
}
