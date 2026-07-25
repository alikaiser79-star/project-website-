/* ============================================================
   §22.1 EARS — the push-to-talk button. Hold it, speak, release. The mic
   opens only while held (consent-bound). The finished utterance is fed into
   the SAME ⌘K intent pipeline as typed input, so KAI acts or answers.

   Where SpeechRecognition is unsupported (iOS Safari), a tap opens ⌘K so the
   operator can dictate with the keyboard mic into the same pipeline.
   ============================================================ */

import { useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { startPTT, stopPTT, isPTTSupported } from '../lib/pushToTalk';
import { emitAction } from '../lib/actions';
import { sfx } from '../lib/sound';

export default function PushToTalk() {
  const supported = isPTTSupported();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const activeRef = useRef(false);

  function begin(e: React.PointerEvent) {
    e.preventDefault();
    if (activeRef.current) return;
    if (!supported) {
      /* iOS / no Web Speech — hand off to ⌘K + the keyboard's own dictation. */
      sfx.click();
      emitAction({ type: 'open-cmd' });
      return;
    }
    setErr(null); setText(''); activeRef.current = true;
    try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    sfx.click();
    const ok = startPTT({
      onInterim: (t) => setText(t),
      onError: (x) => { setErr(x === 'not-allowed' ? 'mic blocked' : x === 'no-speech' ? 'heard nothing' : 'voice error'); },
      onFinal: (t) => {
        activeRef.current = false; setListening(false);
        const clean = t.trim();
        setText('');
        if (clean) emitAction({ type: 'open-cmd', prefill: clean, submit: true });
      },
    });
    if (ok) setListening(true); else activeRef.current = false;
  }

  function end(e: React.PointerEvent) {
    e.preventDefault();
    if (!activeRef.current) return;
    stopPTT();   // → onFinal fires with the full utterance
  }

  return (
    <div className="ptt-wrap" aria-live="polite">
      {listening && (
        <div className="ptt-bubble">
          <span className="ptt-eq"><i /><i /><i /></span>
          <span className="ptt-text">{text || 'listening…'}</span>
        </div>
      )}
      {err && !listening && <div className="ptt-bubble ptt-err">{err}</div>}
      <button
        className={'ptt-btn' + (listening ? ' is-live' : '') + (supported ? '' : ' is-fallback')}
        onPointerDown={begin}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        title={supported ? 'Hold to speak' : 'Tap to dictate (keyboard mic)'}
        aria-label={supported ? 'Hold to speak to KAI' : 'Open command bar to dictate'}
      >
        <Mic size={22} />
      </button>
    </div>
  );
}
