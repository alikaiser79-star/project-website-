/* ============================================================
   VOICE OUT (§6.6) — speechSynthesis TTS, gated by the speakEnabled
   setting (off by default). Used by Ask-KAI answers, ONE THING mode,
   and the briefing. Wraps the existing speech engine so rate/pitch/
   voice follow the operator's settings.
   ============================================================ */

import { voice } from './speech';
import { loadState } from './store';

/* ── §22.2 VOICE — the upgrade seam ────────────────────────────
   All spoken output routes through `speakNow`, which delegates to the
   PROVIDER below. The default provider is the browser's speechSynthesis
   (free, offline, on-device). To upgrade to a premium voice (ElevenLabs,
   OpenAI TTS, etc.) later, call setSpeakProvider() ONCE at boot with a
   function that fetches + plays the audio — no caller changes. Keep it
   Edge/fetch-based to stay within the deployment discipline. */
export type SpeakProvider = (text: string, opts: { rate?: number; pitch?: number; voiceName?: string }, onEnd?: () => void) => void;
let provider: SpeakProvider | null = null;
export function setSpeakProvider(p: SpeakProvider | null): void { provider = p; }

export function speechSupported(): boolean {
  return (typeof window !== 'undefined' && 'speechSynthesis' in window) || !!provider;
}

/* ── THE GESTURE LOCK (iOS Safari) ─────────────────────────────
   Safari only unlocks speechSynthesis inside a real user gesture. Any
   speak() from a boot effect or an async callback (a streamed answer
   finishing, the morning dispatch) is silently dropped — no error, no
   sound, forever. Two defences:

     1. PRIME on the operator's first interaction with a zero-volume
        utterance, which unlocks the engine for every later call.
     2. VERIFY each attempt actually started; if nothing does, flag
        BLOCKED so the UI can say so instead of failing invisibly
        (CORE-V4: no invisible operations).
   ============================================================ */
let primed = false;
let blocked = false;
const blockedListeners = new Set<(b: boolean) => void>();

export function speechPrimed(): boolean { return primed; }
export function speechBlocked(): boolean { return blocked; }
export function onSpeechBlocked(cb: (b: boolean) => void): () => void {
  blockedListeners.add(cb);
  return () => { blockedListeners.delete(cb); };
}
function setBlocked(b: boolean) {
  if (blocked === b) return;
  blocked = b;
  blockedListeners.forEach((l) => { try { l(b); } catch { /* ignore */ } });
}

/* Unlock the engine. MUST be called synchronously inside a user gesture. */
export function primeSpeech(): void {
  if (provider) { primed = true; setBlocked(false); return; }   // premium path needs no unlock
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.resume();                 // Safari can leave the queue paused
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;                             // inaudible — this is a key, not a message
    speechSynthesis.speak(u);
    primed = true;
    setBlocked(false);
  } catch { /* ignore */ }
}

/* Install a one-shot primer on the first real interaction, anywhere. */
export function installSpeechPrimer(): () => void {
  if (typeof window === 'undefined') return () => {};
  const fire = () => { primeSpeech(); off(); };
  const evts: Array<keyof WindowEventMap> = ['pointerdown', 'touchend', 'keydown'];
  const off = () => evts.forEach((e) => window.removeEventListener(e, fire));
  evts.forEach((e) => window.addEventListener(e, fire, { once: false, passive: true }));
  return off;
}

/* Did the utterance actually begin? Polls briefly; if the engine never
   reports speaking/pending, the platform swallowed it. */
function verifyStarted(): void {
  if (provider) return;                        // premium provider reports its own errors
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  let started = false, ticks = 0;
  const iv = setInterval(() => {
    ticks++;
    try { if (speechSynthesis.speaking || speechSynthesis.pending) started = true; } catch { /* ignore */ }
    if (started || ticks >= 6) {               // ~720ms
      clearInterval(iv);
      setBlocked(!started);
    }
  }, 120);
}

export function ttsEnabled(): boolean {
  try { return !!loadState().settings.speakEnabled; } catch { return false; }
}

export function speak(text: string): void {
  if (!ttsEnabled() || !speechSupported() || !text) return;
  speakNow(text);
}

/* Explicit, operator-initiated speech — tapping the "speak" button
   on an answer. The tap IS the consent, so this deliberately bypasses
   the speakEnabled auto-speak gate (that setting governs proactive
   speech, not a manual request). Still no-ops when the platform has
   no synthesiser. Without this, tapping speak while auto-speak was
   off did nothing — a dead, silent button. */
export function speakNow(text: string, onEnd?: () => void): void {
  if (!speechSupported() || !text) return;
  try {
    const s = loadState().settings;
    const opts = { rate: s.voiceRate, pitch: s.voicePitch, voiceName: s.voiceName };
    if (provider) { provider(text, opts, onEnd); return; }   // premium voice (upgrade seam)
    /* Safari parks the queue when the tab backgrounds; resume before speaking
       or the utterance sits forever. */
    try { speechSynthesis.resume(); } catch { /* ignore */ }
    voice.speak(text, opts, onEnd);                          // browser speechSynthesis (default)
    verifyStarted();                                         // …and prove it made a sound
  } catch { onEnd?.(); }
}

/* Auto-speak — used by answer surfaces to read KAI aloud ONLY when the
   operator has voice-out on (speakEnabled). Hands-free while driving or
   in the garden. Silent otherwise. */
export function autoSpeak(text: string): void {
  if (ttsEnabled() && text) speakNow(text);
}

export function cancelSpeak(): void {
  try { if (speechSupported()) speechSynthesis.cancel(); } catch { /* ignore */ }
}
