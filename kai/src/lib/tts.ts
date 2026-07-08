/* ============================================================
   VOICE OUT (§6.6) — speechSynthesis TTS, gated by the speakEnabled
   setting (off by default). Used by Ask-KAI answers, ONE THING mode,
   and the briefing. Wraps the existing speech engine so rate/pitch/
   voice follow the operator's settings.
   ============================================================ */

import { voice } from './speech';
import { loadState } from './store';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
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
export function speakNow(text: string): void {
  if (!speechSupported() || !text) return;
  try {
    const s = loadState().settings;
    voice.speak(text, { rate: s.voiceRate, pitch: s.voicePitch, voiceName: s.voiceName });
  } catch { /* ignore */ }
}

export function cancelSpeak(): void {
  try { if (speechSupported()) speechSynthesis.cancel(); } catch { /* ignore */ }
}
