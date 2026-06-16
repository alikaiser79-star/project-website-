/* Tiny pomodoro state machine. Persists end-time to localStorage so
   refresh doesn't lose the countdown. */

import { sfx } from './sound';
import { voice } from './speech';
import { toast } from '../hooks/useToasts';
import { loadState } from './store';

const KEY = 'kai.focus.v1';

export type FocusKind = 'focus' | 'break';
export type FocusState = {
  running: boolean;
  kind: FocusKind;
  endAt: number;          // epoch ms
  totalMs: number;
};

type Listener = (s: FocusState) => void;
const listeners = new Set<Listener>();

let state: FocusState = read();
let timer: number | null = null;

function read(): FocusState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { running: false, kind: 'focus', endAt: 0, totalMs: 25 * 60_000 };
}
function write() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
function emit() { listeners.forEach(fn => fn(state)); }

function tick() {
  if (!state.running) return;
  const left = state.endAt - Date.now();
  if (left <= 0) {
    state.running = false;
    write(); emit();
    const wasFocus = state.kind === 'focus';
    sfx.confirm();
    toast.ok(wasFocus ? 'Focus block complete. Take a breather.' : 'Break over. Back in.', 'FOCUS', 6000);
    const s = loadState().settings;
    if (s.voiceEnabled) {
      voice.speak(
        wasFocus ? 'Focus block complete.' : 'Break complete. Back to work.',
        { rate: s.voiceRate, pitch: s.voicePitch, voiceName: s.voiceName },
      );
    }
    timer = null;
    return;
  }
  timer = window.setTimeout(tick, Math.min(1000, left));
}

export const focusTimer = {
  get(): FocusState { return { ...state }; },
  subscribe(fn: Listener) {
    listeners.add(fn);
    fn(state);
    if (state.running && timer === null) tick();
    return () => { listeners.delete(fn); };
  },
  start(minutes: number, kind: FocusKind = 'focus') {
    const ms = Math.round(minutes * 60_000);
    state = { running: true, kind, endAt: Date.now() + ms, totalMs: ms };
    write(); emit();
    if (timer !== null) clearTimeout(timer);
    tick();
    sfx.click();
    toast.ok(`${kind === 'focus' ? 'Focus' : 'Break'} block · ${minutes} min`, 'FOCUS START', 3500);
  },
  stop() {
    if (!state.running) return;
    state.running = false; write(); emit();
    if (timer !== null) { clearTimeout(timer); timer = null; }
    sfx.click();
    toast.warn('Focus block stopped.', 'FOCUS', 3000);
  },
  reset() {
    state = { running: false, kind: 'focus', endAt: 0, totalMs: 25 * 60_000 };
    write(); emit();
  },
};
