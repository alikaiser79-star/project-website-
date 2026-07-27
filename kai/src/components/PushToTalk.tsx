/* ============================================================
   §22.1 EARS — the push-to-talk button. Hold it, speak, release. The mic
   opens only while held (consent-bound). The finished utterance is fed into
   the SAME ⌘K intent pipeline as typed input, so KAI acts or answers.

   Where SpeechRecognition is unsupported (iOS Safari), a tap opens ⌘K so the
   operator can dictate with the keyboard mic into the same pipeline.
   ============================================================ */

import { useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { startPTT, stopPTT, isPTTSupported, pttBlocker, explainPTT, pttEnvironment, type PTTProblem } from '../lib/pushToTalk';
import { emitAction } from '../lib/actions';
import { parseFacts } from '../lib/kai/confession';
import { sfx } from '../lib/sound';

export default function PushToTalk() {
  const supported = isPTTSupported();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState<PTTProblem | null>(null);
  const activeRef = useRef(false);

  function begin(e: React.PointerEvent) {
    e.preventDefault();
    if (activeRef.current) return;
    /* Say WHY before handing off, instead of silently opening ⌘K and
       leaving him to wonder whether the button is broken. */
    const blocked = pttBlocker();
    if (blocked) {
      sfx.click();
      setErr(blocked);
      emitAction({ type: 'open-cmd' });
      return;
    }
    setErr(null); setText(''); activeRef.current = true;
    try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    sfx.click();
    const ok = startPTT({
      onInterim: (t) => setText(t),
      onError: (x) => {
        /* The RAW code, named and explained. "voice error" told him
           nothing and cost an evening. */
        activeRef.current = false; setListening(false);
        setErr(explainPTT(x));
      },
      onFinal: (t) => {
        activeRef.current = false; setListening(false);
        const clean = t.trim();
        setText('');
        if (!clean) return;
        /* §26 — "the numbers are wrong" opens the guided correction pass. */
        if (/\b(numbers?|figures?)\b.*\b(wrong|off|stale|outdated)\b|أرقام.*(غلط|قديمة)/i.test(clean)) {
          emitAction({ type: 'open-confession' });
          return;
        }
        /* §26.1 — a spoken FACT becomes Spine state (after confirmation),
           not chat. Anything else falls through to the command pipeline. */
        const facts = parseFacts(clean);
        if (facts.length) { emitAction({ type: 'open-confession', facts }); return; }
        emitAction({ type: 'open-cmd', prefill: clean, submit: true });
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
      {err && !listening && (
        <div className="ptt-bubble ptt-err" role="alert">
          <div className="ptt-err-title">{err.title}</div>
          <div className="ptt-err-detail">{err.detail}</div>
          <div className="ptt-err-foot">
            <code>{err.code}</code>
            <span>{(() => { const e = pttEnvironment(); return `${e.protocol}// · ${e.secureContext ? 'secure' : 'INSECURE'} · ${e.hasApi ? 'speech API present' : 'no speech API'}${e.standalone ? ' · installed PWA' : ''}`; })()}</span>
            <button onClick={() => setErr(null)}>dismiss</button>
          </div>
        </div>
      )}
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
