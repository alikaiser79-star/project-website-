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
    if (provider) provider(text, opts, onEnd);          // premium voice (upgrade seam)
    else voice.speak(text, opts, onEnd);                // browser speechSynthesis (default)
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
