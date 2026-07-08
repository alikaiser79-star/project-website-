/* ============================================================
   PROTOCOL (§6.3) — the ADHD operating system. ONE THING focus,
   the morning DAY COMPILE, the evening SHUTDOWN ritual, and an
   ENERGY flag KAI plans with. All client-side, Spine-logged.
   ============================================================ */

import { logEvent } from './events';
import { getCommitments } from './commitments';
import { activeDeadlines, tierOf } from './deadlines';
import { loadState } from '../store';

const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

/* ── ONE THING — the single most important action right now ── */
export interface OneThing { text: string; source: string; }
export function oneThingSuggestion(now = Date.now(), energy: Energy = getEnergy()): OneThing {
  /* deadline dominance first */
  const dls = activeDeadlines(now);
  const hot = dls.find(d => { const t = tierOf(d, now); return t === 'overdue' || t === 'dominant'; }) || dls.find(d => tierOf(d, now) === 'calling');
  if (hot) return { text: hot.text, source: 'deadline' };
  /* then an overdue / soonest open commitment */
  const open = getCommitments().filter(c => c.status === 'open').sort((a, b) => a.deadline - b.deadline);
  if (open[0]) return { text: open[0].text, source: 'commitment' };
  /* then a priority, tuned to today's energy */
  const prios = (loadState().priorities || []).filter(p => !p.done);
  if (prios.length) {
    const pick = energy === 'high' ? prios[0] : (prios[prios.length - 1] || prios[0]);
    return { text: pick.text, source: energy === 'high' ? 'deep-work' : 'admin' };
  }
  return { text: 'Choose one thing and finish it.', source: 'default' };
}

export function logFocus(minutes: number, text: string): void {
  try { logEvent({ domain: 'system', type: 'focus', value: Math.round(minutes), meta: { text }, source: 'user' }); } catch { /* ignore */ }
}

/* ── ENERGY flag — high / normal, per day, Ali's call ── */
export type Energy = 'high' | 'normal';
export function getEnergy(now = Date.now()): Energy {
  try { return (localStorage.getItem('kai.energy.' + dayKey(now)) as Energy) || 'normal'; } catch { return 'normal'; }
}
export function setEnergy(e: Energy, now = Date.now()): void {
  try { localStorage.setItem('kai.energy.' + dayKey(now), e); } catch { /* ignore */ }
}

/* ── DAY COMPILE / SHUTDOWN gating (once each per day) ── */
export function isEvening(now = Date.now()): boolean { return new Date(now).getHours() >= 21; }

export function shouldDayCompile(now = Date.now()): boolean {
  if (isEvening(now)) return false;
  try { return localStorage.getItem('kai.daycompile.' + dayKey(now)) !== '1'; } catch { return false; }
}
export function markDayCompiled(now = Date.now()): void { try { localStorage.setItem('kai.daycompile.' + dayKey(now), '1'); } catch { /* ignore */ } }

export function shouldShutdown(now = Date.now()): boolean {
  if (!isEvening(now)) return false;
  try { return localStorage.getItem('kai.shutdown.' + dayKey(now)) !== '1'; } catch { return false; }
}
export function markShutdown(now = Date.now()): void { try { localStorage.setItem('kai.shutdown.' + dayKey(now), '1'); } catch { /* ignore */ } }

/* Tomorrow's one thing, stored by the shutdown ritual → read by the
   next morning's compile. */
export function setTomorrowOneThing(text: string, now = Date.now()): void {
  try { localStorage.setItem('kai.onething.' + dayKey(now + 86_400_000), text); } catch { /* ignore */ }
}
export function getPlannedOneThing(now = Date.now()): string | null {
  try { return localStorage.getItem('kai.onething.' + dayKey(now)); } catch { return null; }
}
