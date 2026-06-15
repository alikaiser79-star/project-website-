import { loadState, saveState } from './store';
import type { JournalEntry } from '../types';

export function listJournal(): JournalEntry[] {
  return loadState().journal;
}
export function addJournal(text: string): JournalEntry {
  const e: JournalEntry = { id: 'j-' + Date.now(), text: text.trim(), at: new Date().toISOString() };
  const s = loadState();
  s.journal = [e, ...s.journal].slice(0, 200);
  saveState(s);
  return e;
}
export function removeJournal(id: string) {
  const s = loadState();
  s.journal = s.journal.filter(e => e.id !== id);
  saveState(s);
}
