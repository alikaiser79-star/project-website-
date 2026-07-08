/* ============================================================
   THE NIGHT LEDGER (§14.4) — "while you were away". On first open of
   the day, a small strip reports what the pulse did and what changed
   since the last visit, three lines max. Reads only the Spine events
   the heartbeat wrote (system.pulse, deadline.escalated,
   anomaly.detected). "Nothing moved" is a valid, honest report.
   ============================================================ */

import { getEvents } from './events';

const DAY = 86_400_000;
const SEEN = 'kai.nightledger.seen';

export function lastSeen(): number { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } }
export function markSeen(now = Date.now()): void { try { localStorage.setItem(SEEN, String(now)); } catch { /* ignore */ } }

export interface NightReport { lines: string[]; pulseRan: boolean; sinceMs: number; }

export function nightLedger(now = Date.now()): NightReport {
  const since = lastSeen() || now - 2 * DAY;
  const evs = getEvents({ since });
  const pulses = evs.filter((e) => e.domain === 'system' && e.type === 'pulse');
  const escal = evs.filter((e) => e.domain === 'deadline' && e.type === 'escalated');
  const anom = evs.filter((e) => e.domain === 'anomaly' && e.type === 'detected');

  const lines: string[] = [];
  for (const e of escal.slice(-2)) {
    const tier = e.meta?.tier;
    const text = String(e.meta?.text || 'a deadline');
    lines.push(tier === 'overdue' ? `Overdue: ${text}` : tier === 'dominant' ? `Tomorrow: ${text}` : `${e.meta?.days}d out: ${text}`);
  }
  for (const e of anom.slice(-1)) lines.push(String(e.meta?.detail || 'Anomaly detected'));

  const pulseRan = pulses.length > 0;
  if (pulseRan && !lines.length) lines.push('Nothing moved overnight.');

  return { lines: lines.slice(0, 3), pulseRan, sinceMs: since };
}

/* Show the strip only on the first open of a new day (and only when the
   pulse actually ran or something changed). */
export function shouldShowNightLedger(now = Date.now()): boolean {
  const seen = lastSeen();
  if (seen && new Date(seen).toDateString() === new Date(now).toDateString()) return false;
  const r = nightLedger(now);
  return r.pulseRan && r.lines.length > 0;
}
