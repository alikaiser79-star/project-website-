/* ============================================================
   §22.3 — THE EYE. A floating capture→ask surface. Tap the eye,
   point the camera (glasses / phone / upload), ask in your own
   words, and KAI reads the image with full Spine context and
   answers — spoken aloud via Phase-2 TTS so the reply lands "in
   your ear".

   Self-contained: renders its own trigger + modal. Nothing is
   captured until Ali points the lens and picks a shot. No ambient
   vision, ever — consent-bound by doctrine.
   ============================================================ */

import { useRef, useState } from 'react';
import { Eye, Camera, Image as ImageIcon, Volume2 } from 'lucide-react';
import { compressImage, type Compressed } from '../lib/receipts';
import { askKaiEye } from '../lib/kai/eye';
import { speakNow, speechSupported } from '../lib/tts';

type Phase = 'idle' | 'ready' | 'thinking' | 'answered';

export default function KaiEye() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [img, setImg] = useState<Compressed | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPhase('idle'); setPreview(null); setImg(null);
    setQuestion(''); setAnswer(''); setErr(null);
  }
  function close() { setOpen(false); reset(); }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setErr(null); setAnswer('');
    try {
      const c = await compressImage(file);
      setImg(c);
      setPreview(`data:${c.mime};base64,${c.b64}`);
      setPhase('ready');
    } catch {
      setErr("That didn't read as an image. Try another shot.");
      setPhase('idle');
    }
  }

  async function ask() {
    if (!img || phase === 'thinking') return;
    setPhase('thinking'); setErr(null); setAnswer('');
    try {
      const reply = await askKaiEye(img, question, Date.now());
      setAnswer(reply);
      setPhase('answered');
      if (speechSupported()) speakNow(reply);
    } catch (e: any) {
      const m = String(e?.message || e);
      setErr(m.includes('NO_API_KEY') ? 'No API key wired on the server — the Eye is offline.' : 'The Eye could not read that just now.');
      setPhase('ready');
    }
  }

  return (
    <>
      <button className="kai-eye-fab" onClick={() => setOpen(true)} aria-label="KAI Eye" title="KAI Eye — capture and ask">
        <Eye size={18} />
      </button>

      {open && (
        <div className="kai-eye-scrim" onClick={close}>
          <div className="kai-eye" role="dialog" aria-label="KAI Eye" onClick={(e) => e.stopPropagation()}>
            <div className="kai-eye-head">
              <span className="kai-eye-title">THE EYE</span>
              <button className="kai-eye-x" onClick={close} aria-label="close">✕</button>
            </div>

            <div className="kai-eye-body">
              {!preview && (
                <div className="kai-eye-hint">
                  Point the lens and capture — a plant, a document, the apartment. KAI reads it
                  with your live numbers and answers aloud.
                </div>
              )}

              {preview && <img className="kai-eye-preview" src={preview} alt="captured" />}

              {err && <div className="kai-eye-err">{err}</div>}

              {answer && (
                <div className="kai-eye-answer">
                  {answer}
                  {speechSupported() && (
                    <button className="kai-eye-speak" onClick={() => speakNow(answer)} title="Speak again">
                      <Volume2 size={11} /> speak
                    </button>
                  )}
                </div>
              )}

              <div className="kai-eye-capture">
                <button className="kai-eye-src" onClick={() => camRef.current?.click()}>
                  <Camera size={14} /> Camera
                </button>
                <button className="kai-eye-src" onClick={() => fileRef.current?.click()}>
                  <ImageIcon size={14} /> Upload
                </button>
              </div>
            </div>

            <form className="kai-eye-foot" onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <input
                className="kai-eye-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={preview ? 'ask about what you see…' : 'capture first, then ask…'}
                disabled={phase === 'thinking'}
              />
              <button className="kai-eye-ask" type="submit" disabled={!img || phase === 'thinking'}>
                {phase === 'thinking' ? '…' : '→'}
              </button>
            </form>
          </div>
        </div>
      )}

      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
    </>
  );
}
