import { loadState } from './store';
import { listReminders } from './reminders';

export type SearchHit = {
  id: string;
  kind: 'priority' | 'journal' | 'habit' | 'history' | 'reminder' | 'command';
  label: string;
  meta?: string;
  score: number;
  action: () => void;
};

const BUILTIN_COMMANDS = [
  'status', 'briefing', 'debt', 'income', 'tasks',
  'garden', 'makadi', 'instagram', 'time', 'focus 25', 'break',
  'help', 'convert 1000 eur',
];

function score(text: string, q: string): number {
  if (!q) return 1;
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx < 0) return 0;
  return 100 - idx + (text.length < 60 ? 5 : 0);
}

export function searchAll(query: string, runCommand: (q: string) => void): SearchHit[] {
  const q = query.trim().toLowerCase();
  const s = loadState();
  const out: SearchHit[] = [];

  for (const p of s.priorities) {
    const sc = score(p.text, q);
    if (sc) out.push({ id: 'p-' + p.id, kind: 'priority', label: p.text, meta: p.done ? 'done' : 'open', score: sc, action: () => runCommand('tasks') });
  }
  for (const e of s.journal) {
    const sc = score(e.text, q);
    if (sc) out.push({ id: 'j-' + e.id, kind: 'journal', label: e.text, meta: new Date(e.at).toLocaleString('en-GB', { day: '2-digit', month: 'short' }), score: sc, action: () => {} });
  }
  for (const h of s.habits) {
    const sc = score(h.label, q);
    if (sc) out.push({ id: 'h-' + h.id, kind: 'habit', label: h.label, meta: 'habit', score: sc, action: () => {} });
  }
  for (const r of listReminders()) {
    const sc = score(r.text, q);
    if (sc) out.push({ id: r.id, kind: 'reminder', label: r.text, meta: 'at ' + new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), score: sc, action: () => {} });
  }
  for (const t of s.history.slice(-30)) {
    const sc = Math.max(score(t.you, q), score(t.kai, q));
    if (sc) out.push({ id: 'ch-' + t.at, kind: 'history', label: t.you, meta: t.kai.slice(0, 50), score: sc * 0.7, action: () => {} });
  }
  for (const c of BUILTIN_COMMANDS) {
    const sc = score(c, q);
    if (sc) out.push({ id: 'cmd-' + c, kind: 'command', label: c, meta: 'run command', score: sc + 5, action: () => runCommand(c) });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 18);
}
