/* ============================================================
   CALENDAR OF WAR (§6.2) — hard dates with escalating behaviour.
   T-7d: the item appears. T-3d: its organ starts calling. T-1d: it
   dominates the briefing. Past-due: crimson, and it stays. Missing a
   date must be structurally impossible. Seed via ⌘K:
     "deadline: 2026-08-01 FRISCH listing go-live"
   ============================================================ */

import { logEvent } from './events';

const DAY = 86_400_000;

export interface Deadline { id: string; text: string; date: number; createdAt: number; }
export type DeadlineTier = 'far' | 'appear' | 'calling' | 'dominant' | 'overdue';

const KEY = 'kai.deadlines';

export function getDeadlines(): Deadline[] {
  try { return (JSON.parse(localStorage.getItem(KEY) || '[]') as Deadline[]).sort((a, b) => a.date - b.date); } catch { return []; }
}
function save(list: Deadline[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }

export function addDeadline(text: string, date: number): Deadline {
  const d: Deadline = { id: 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: text.trim(), date, createdAt: Date.now() };
  const list = getDeadlines(); list.push(d); save(list);
  try { logEvent({ domain: 'deadline', type: 'set', meta: { id: d.id, text: d.text, date }, source: 'user' }); } catch { /* ignore */ }
  return d;
}
export function removeDeadline(id: string): void { save(getDeadlines().filter(d => d.id !== id)); }

export function tierOf(d: Deadline, now = Date.now()): DeadlineTier {
  const days = (d.date - now) / DAY;
  if (days < 0) return 'overdue';
  if (days <= 1) return 'dominant';
  if (days <= 3) return 'calling';
  if (days <= 7) return 'appear';
  return 'far';
}

/* Deadlines that are on the board now (T-7 and in), soonest first. */
export function activeDeadlines(now = Date.now()): Deadline[] {
  return getDeadlines().filter(d => tierOf(d, now) !== 'far');
}

/* Any deadline at T-3d or past → the sentinel organ should call. */
export function deadlineCalling(now = Date.now()): boolean {
  return getDeadlines().some(d => { const t = tierOf(d, now); return t === 'calling' || t === 'dominant' || t === 'overdue'; });
}

/* Briefing lines — T-1d and overdue dominate; T-3d warns. */
export function deadlineBriefing(now = Date.now()): string[] {
  const out: string[] = [];
  for (const d of activeDeadlines(now)) {
    const t = tierOf(d, now);
    const days = Math.round((d.date - now) / DAY);
    if (t === 'overdue') out.push(`OVERDUE ${-days}d: ${d.text}.`);
    else if (t === 'dominant') out.push(`TOMORROW: ${d.text}.`);
    else if (t === 'calling') out.push(`${days}d out: ${d.text}.`);
  }
  return out.slice(0, 4);
}

/* Parse a ⌘K "deadline: <date> <text>" command. Returns null if it
   isn't a deadline command or the date won't parse. */
export function parseDeadlineCommand(cmd: string): { text: string; date: number } | null {
  const m = cmd.match(/^\s*deadline:?\s+(\S+)\s+(.+)$/i);
  if (!m) return null;
  const raw = m[1], text = m[2].trim();
  let date = Date.parse(raw);
  if (Number.isNaN(date)) {
    /* try "<text> on <date>" style fallback: parse the whole tail */
    date = Date.parse(m[1] + ' ' + text.split(' ').slice(0, 2).join(' '));
  }
  if (Number.isNaN(date)) return null;
  return { text, date };
}
