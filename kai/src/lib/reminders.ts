import { loadState, saveState } from './store';
import { sfx } from './sound';
import { voice } from './speech';
import { toast } from '../hooks/useToasts';
import type { Reminder } from '../types';

const timers = new Map<string, number>();

export function listReminders(): Reminder[] {
  return loadState().reminders.filter(r => !r.fired).sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

export function addReminder(text: string, atIso: string): Reminder {
  const r: Reminder = { id: 'r-' + Date.now() + Math.random().toString(36).slice(2, 6), text: text.trim(), at: atIso };
  const s = loadState();
  s.reminders = [...s.reminders, r];
  saveState(s);
  schedule(r);
  return r;
}

export function cancelReminder(id: string) {
  const t = timers.get(id);
  if (t !== undefined) { clearTimeout(t); timers.delete(id); }
  const s = loadState();
  s.reminders = s.reminders.filter(r => r.id !== id);
  saveState(s);
}

function fire(r: Reminder) {
  const settings = loadState().settings;
  sfx.boot();
  toast.warn(r.text, 'REMINDER', 9000);
  if (settings.voiceEnabled) {
    voice.speak(
      `Reminder. ${r.text}.`,
      { rate: settings.voiceRate, pitch: settings.voicePitch, voiceName: settings.voiceName },
    );
  }
  const s = loadState();
  s.reminders = s.reminders.map(x => x.id === r.id ? { ...x, fired: true } : x);
  saveState(s);
}

function schedule(r: Reminder) {
  if (r.fired) return;
  const ms = +new Date(r.at) - Date.now();
  if (ms <= 0) { fire(r); return; }
  const id = window.setTimeout(() => { timers.delete(r.id); fire(r); }, ms);
  timers.set(r.id, id);
}

export function resumeReminders() {
  const s = loadState();
  for (const r of s.reminders) {
    if (r.fired) continue;
    schedule(r);
  }
}

/* ── Parse a natural duration: "30 minutes", "1h", "5 mins", "2 hours" ── */
export function parseDuration(s: string): number | null {
  if (!s) return null;
  let total = 0; let matched = false;
  s.toLowerCase().replace(/(\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?)/g, (_, n, u) => {
    matched = true;
    const num = parseFloat(n);
    if (u.startsWith('h')) total += num * 3_600_000;
    else if (u.startsWith('m')) total += num * 60_000;
    else total += num * 1000;
    return '';
  });
  if (!matched) {
    const bare = parseInt(s);
    if (!isNaN(bare)) total = bare * 60_000; // bare number → minutes
  }
  return total > 0 ? total : null;
}
