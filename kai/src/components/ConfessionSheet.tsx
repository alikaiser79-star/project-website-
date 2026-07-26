/* ============================================================
   §26 DIE BEICHTE — the confirm surface.

   TWO modes, one law: nothing enters the Spine unconfirmed.

     facts       — what KAI heard, one card per fact: "cash → 12,000 — yes?"
                   Tap ✓/✕, or say "yes". Misheard numbers die here.
     correction  — the guided pass (§26.2). KAI reads each headline number
                   aloud with its age, listens, and takes either a "yes" or
                   the real number. Five minutes and every headline is true.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { Check, X, Mic, ChevronRight } from 'lucide-react';
import {
  applyFact, correctionSteps, parseCorrection, ageLabel, truthAges,
  type Fact, type CorrectionStep,
} from '../lib/kai/confession';
import { startPTT, stopPTT, isPTTSupported } from '../lib/pushToTalk';
import { speakNow } from '../lib/tts';
import { emit } from '../lib/kai/store';
import { toast } from '../hooks/useToasts';

export type ConfessionMode = { kind: 'facts'; facts: Fact[] } | { kind: 'correction' };

interface Props { mode: ConfessionMode | null; onClose: () => void; }

export default function ConfessionSheet({ mode, onClose }: Props) {
  if (!mode) return null;
  return mode.kind === 'facts'
    ? <FactConfirm facts={mode.facts} onClose={onClose} />
    : <CorrectionPass onClose={onClose} />;
}

/* ── §26.3 CONFIRM BEFORE COMMIT ─────────────────────────────── */
function FactConfirm({ facts, onClose }: { facts: Fact[]; onClose: () => void }) {
  const [pending, setPending] = useState<Fact[]>(facts);
  const acceptedRef = useRef(0);

  function accept(f: Fact) {
    try { applyFact(f); emit(); acceptedRef.current++; } catch { /* ignore */ }
    advance(f);
  }
  function reject(f: Fact) { advance(f); }
  function advance(f: Fact) {
    const rest = pending.filter((x) => x !== f);
    setPending(rest);
    if (rest.length) return;
    const n = acceptedRef.current;
    toast.ok(n ? `${n} fact${n === 1 ? '' : 's'} recorded.` : 'Nothing recorded.', 'BEICHTE', 2600);
    onClose();
  }

  return (
    <div className="conf-scrim" onClick={onClose}>
      <div className="conf" role="dialog" aria-label="Confirm facts" onClick={(e) => e.stopPropagation()}>
        <div className="conf-head">
          <span className="conf-title">I HEARD</span>
          <button className="conf-x" onClick={onClose} aria-label="close"><X size={14} /></button>
        </div>
        <div className="conf-body">
          {pending.map((f, i) => (
            <div key={i} className="conf-fact">
              <div className="conf-fact-label">{f.label}{f.detail ? <span className="conf-fact-detail"> · {f.detail}</span> : null}</div>
              <div className="conf-fact-raw">“{f.raw.trim()}”</div>
              <div className="conf-fact-actions">
                <button className="conf-yes" onClick={() => accept(f)}><Check size={14} /> yes</button>
                <button className="conf-no" onClick={() => reject(f)}><X size={13} /> no</button>
              </div>
            </div>
          ))}
        </div>
        <div className="conf-foot">Nothing is recorded until you confirm it.</div>
      </div>
    </div>
  );
}

/* ── §26.2 THE CORRECTION PASS ───────────────────────────────── */
function CorrectionPass({ onClose }: { onClose: () => void }) {
  const [steps] = useState<CorrectionStep[]>(() => correctionSteps());
  const [i, setI] = useState(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [fixed, setFixed] = useState(0);
  const ages = truthAges();
  const step = steps[i];
  const spokenRef = useRef(-1);

  /* KAI reads the number aloud when the step arrives (one utterance each). */
  useEffect(() => {
    if (!step || spokenRef.current === i) return;
    spokenRef.current = i;
    try { speakNow(step.spoken); } catch { /* ignore */ }
  }, [i, step]);

  function next() { setHeard(''); if (i + 1 >= steps.length) { finish(); } else setI(i + 1); }
  function finish() {
    toast.ok(fixed ? `${fixed} number${fixed === 1 ? '' : 's'} corrected — headline is true.` : 'Nothing changed — all confirmed.', 'BEICHTE', 3200);
    onClose();
  }

  function hold() {
    if (!isPTTSupported()) return;
    setListening(true);
    startPTT({
      onInterim: setHeard,
      onFinal: (t) => {
        setListening(false);
        if (!t.trim() || !step) return;
        const r = parseCorrection(t, step);
        if ('fact' in r) { try { applyFact(r.fact); emit(); setFixed((f) => f + 1); } catch { /* ignore */ } }
        next();
      },
      onError: () => setListening(false),
    });
  }
  function release() { if (listening) stopPTT(); }

  if (!step) return null;

  return (
    <div className="conf-scrim" onClick={onClose}>
      <div className="conf" role="dialog" aria-label="Correction pass" onClick={(e) => e.stopPropagation()}>
        <div className="conf-head">
          <span className="conf-title">THE CORRECTION · {i + 1}/{steps.length}</span>
          <button className="conf-x" onClick={onClose} aria-label="close"><X size={14} /></button>
        </div>
        <div className="conf-body">
          <div className="conf-step">{step.prompt}</div>
          {heard && <div className="conf-heard">“{heard}”</div>}
          <button
            className={'conf-mic' + (listening ? ' live' : '')}
            onPointerDown={hold} onPointerUp={release} onPointerLeave={release}
          >
            <Mic size={16} /> {listening ? 'listening — release when done' : 'hold to answer'}
          </button>
          <div className="conf-quick">
            <button className="conf-yes" onClick={next}><Check size={14} /> correct</button>
            <button className="conf-skip" onClick={next}>skip <ChevronRight size={13} /></button>
          </div>
          <div className="conf-age">
            last set {ageLabel(ages[step.key === 'makadi_rate' ? 'makadi' : step.key])}
          </div>
        </div>
        <div className="conf-foot">Say “yes”, or just say the real number.</div>
      </div>
    </div>
  );
}
