/* ============================================================
   §22.1 EARS — push-to-talk. CONSENT-BOUND by doctrine: the mic only ever
   opens between an explicit press and release. Single utterance, NO
   continuous mode, NO auto-restart, NO ambient listening. Distinct from the
   old always-on Voice class (which the doctrine retires).

   Web Speech API where supported (Android Chrome / desktop). iOS Safari's
   SpeechRecognition is unreliable — callers detect isPTTSupported() and
   fall back to keyboard dictation into the same ⌘K intent pipeline.
   ============================================================ */

function SR(): any { try { return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; } catch { return null; } }

export function isPTTSupported(): boolean { return !!SR(); }

export interface PTTHandlers {
  onInterim?: (text: string) => void;   // live partial transcript while held
  onFinal?: (text: string) => void;     // the finished utterance on release
  onError?: (err: string) => void;
  onEnd?: () => void;
}

let rec: any = null;

/* Begin a single-utterance capture. Returns false if unsupported/failed. */
export function startPTT(h: PTTHandlers): boolean {
  const Ctor = SR();
  if (!Ctor) { h.onError?.('unsupported'); return false; }
  try { rec?.abort?.(); } catch { /* ignore */ }

  const r = new Ctor();
  r.continuous = false;        // ONE utterance — never ambient
  r.interimResults = true;
  try { r.lang = (navigator.language || 'en-US'); } catch { /* default */ }

  let finalText = '';
  r.onresult = (ev: any) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    h.onInterim?.((finalText + ' ' + interim).trim());
  };
  r.onerror = (ev: any) => { h.onError?.(String(ev?.error || 'error')); };
  r.onend = () => { rec = null; h.onFinal?.(finalText.trim()); h.onEnd?.(); };

  try { r.start(); rec = r; return true; }
  catch (e: any) { rec = null; h.onError?.(String(e?.message || e)); return false; }
}

/* Release — stop the capture; onFinal fires with the full utterance. */
export function stopPTT(): void { try { rec?.stop(); } catch { /* ignore */ } }

/* Hard cancel — discard, no final. */
export function abortPTT(): void { try { rec?.abort(); } catch { /* ignore */ } rec = null; }
