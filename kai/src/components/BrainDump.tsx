/* ============================================================
   Brain Dump.

   Phase 1 — capture:
     Free-form textarea. If voice recognition is on, a Listen
     toggle pipes final transcripts straight into the textarea
     (interim text shown live below). Uses captureMode so the
     global voice handler doesn't also try to act on the dump.

   Phase 2 — review:
     Editable lists for each bucket. Every row has remove. File
     it all writes into the real stores via fileSorted() and
     emits a summary toast.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brain, X, Loader2, Mic, MicOff, Trash2, ListChecks,
  Bell, Sparkles, Receipt, NotebookPen, AlertTriangle, RefreshCw, ArrowRight, Check,
} from 'lucide-react';
import { sortDump, fileSorted, summarizeCounts, type Sorted } from '../lib/braindump';
import { voice, type VoiceState } from '../lib/speech';
import { setCapturing } from '../lib/captureMode';
import { sfx } from '../lib/sound';
import { toast } from '../hooks/useToasts';
import { loadState } from '../lib/store';

type Props = { open: boolean; onClose: () => void };

export default function BrainDump({ open, onClose }: Props) {
  const [phase, setPhase] = useState<'capture' | 'review'>('capture');
  const [text, setText]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);
  const [sorted, setSorted] = useState<Sorted | null>(null);

  const [listening, setListening]     = useState(false);
  const [interim, setInterim]         = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceState, setVoiceState]   = useState<VoiceState>(() => voice.getState());

  const textRef = useRef<HTMLTextAreaElement>(null);

  /* Reset state every time the modal opens. */
  useEffect(() => {
    if (!open) return;
    setPhase('capture');
    setText('');
    setErr(null);
    setSorted(null);
    setListening(false);
    setInterim('');
    setVoiceSupported(voice.supported());
    /* The user's persisted voiceEnabled may differ from current
       runtime — re-mirror so toggling here doesn't drift. */
    setTimeout(() => textRef.current?.focus(), 80);
    return () => {
      /* Always drop capture mode on unmount. */
      setCapturing(false);
      stopVoiceLocal();
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /* Subscribe to voice state for the chip + start the wrapper if
     listening is toggled on inside the dump. We intentionally don't
     mess with the user's persisted voiceEnabled flag — the brain
     dump is a transient capture, not a settings change. */
  useEffect(() => {
    const off = voice.onState(setVoiceState);
    return off;
  }, []);

  useEffect(() => {
    if (!listening) return;
    setCapturing(true);
    const settings = loadState().settings;
    /* If global voice was off, we still need the wrapper started.
       voice.start() is idempotent. */
    if (!voice.supported()) return;
    voice.start();
    const off = voice.onResult(({ final, text: t }) => {
      if (!t) return;
      if (!final) { setInterim(t); return; }
      setInterim('');
      setText(cur => (cur ? cur.replace(/\s+$/, '') + ' ' : '') + t.trim());
    });
    return () => {
      off();
      setCapturing(false);
      /* If the user had global voice OFF before opening the dump,
         turn the wrapper back off when capture ends. */
      if (!settings.voiceEnabled) voice.stop();
      setInterim('');
    };
  }, [listening]);

  function stopVoiceLocal() {
    setListening(false);
  }

  function close() {
    stopVoiceLocal();
    onClose();
  }

  async function sort() {
    if (busy) return;
    const dump = text.trim();
    if (!dump) { setErr('Type or dictate something first.'); return; }
    setBusy(true);
    setErr(null);
    sfx.whoosh();
    /* Pause voice while waiting — the user is done dumping. */
    if (listening) setListening(false);
    try {
      const out = await sortDump(dump);
      setSorted(out);
      setPhase('review');
      sfx.confirm();
    } catch (e: any) {
      setErr(humanize(e));
      sfx.error();
    } finally {
      setBusy(false);
    }
  }

  function file() {
    if (!sorted) return;
    const counts = fileSorted(sorted);
    const total =
      counts.priorities + counts.content_ideas + counts.reminders +
      counts.expenses + counts.notes;
    if (total === 0) {
      toast.warn('Nothing left to file — review is empty.', 'BRAIN DUMP', 3500);
      return;
    }
    sfx.confirm();
    toast.ok(summarizeCounts(counts), 'BRAIN DUMP', 5000);
    close();
  }

  /* Mutators on the review draft ────────────────────────── */

  function updateString(key: 'priorities' | 'content_ideas' | 'notes', i: number, v: string) {
    setSorted(s => s ? ({ ...s, [key]: s[key].map((x, j) => j === i ? v : x) }) : s);
  }
  function removeString(key: 'priorities' | 'content_ideas' | 'notes', i: number) {
    setSorted(s => s ? ({ ...s, [key]: s[key].filter((_, j) => j !== i) }) : s);
  }
  function updateReminder(i: number, patch: Partial<{ text: string; when_iso: string }>) {
    setSorted(s => s ? ({
      ...s,
      reminders: s.reminders.map((r, j) => j === i ? { ...r, ...patch } : r),
    }) : s);
  }
  function removeReminder(i: number) {
    setSorted(s => s ? ({ ...s, reminders: s.reminders.filter((_, j) => j !== i) }) : s);
  }
  function updateExpense(i: number, patch: Partial<{ merchant: string; amount: number; currency?: string }>) {
    setSorted(s => s ? ({
      ...s,
      expenses: s.expenses.map((e, j) => j === i ? { ...e, ...patch } : e),
    }) : s);
  }
  function removeExpense(i: number) {
    setSorted(s => s ? ({ ...s, expenses: s.expenses.filter((_, j) => j !== i) }) : s);
  }

  /* ── Render ──────────────────────────────────────────── */

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="braindump"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[325] flex items-start justify-center pt-[8vh] px-4 pb-8"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          style={{ background: 'rgba(10,14,20,0.72)', backdropFilter: 'blur(7px)' }}
        >
          <motion.div
            initial={{ y: -10, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass w-full max-w-[720px] rounded-md overflow-hidden flex flex-col max-h-[86vh]"
          >
            <header className="flex items-center gap-2 px-5 py-3.5 border-b border-amber/15">
              <Brain size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
              <h3 className="font-sans text-bone text-sm tracking-wide">
                Brain Dump · {phase === 'capture' ? 'capture' : 'review'}
              </h3>
              {phase === 'review' && (
                <button
                  onClick={() => setPhase('capture')}
                  className="ml-2 px-2 py-0.5 rounded border border-steel/30 text-steel hover:text-bone hover:border-steel font-mono text-[10px] tracking-[0.16em] uppercase"
                  title="Back to the raw dump"
                >
                  ← back
                </button>
              )}
              <button onClick={close} className="ml-auto text-steel hover:text-amber" title="Close (Esc)">
                <X size={14} />
              </button>
            </header>

            {phase === 'capture' && (
              <CaptureBody
                text={text} setText={setText}
                textRef={textRef}
                interim={interim}
                listening={listening} setListening={setListening}
                voiceSupported={voiceSupported}
                voiceState={voiceState}
                busy={busy}
                err={err}
                onSort={sort}
              />
            )}

            {phase === 'review' && sorted && (
              <ReviewBody
                sorted={sorted}
                updateString={updateString}
                removeString={removeString}
                updateReminder={updateReminder}
                removeReminder={removeReminder}
                updateExpense={updateExpense}
                removeExpense={removeExpense}
                onFile={file}
                onReSort={sort}
              />
            )}

            <footer className="px-5 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.18em] uppercase text-steel flex justify-between">
              <span>kai · brain dump</span>
              <span><kbd>Esc</kbd> close</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Phase 1: capture ────────────────────────────────────── */

function CaptureBody({
  text, setText, textRef, interim, listening, setListening,
  voiceSupported, voiceState, busy, err, onSort,
}: {
  text: string; setText: (s: string) => void;
  textRef: React.RefObject<HTMLTextAreaElement>;
  interim: string;
  listening: boolean; setListening: (b: boolean) => void;
  voiceSupported: boolean;
  voiceState: VoiceState;
  busy: boolean;
  err: string | null;
  onSort: () => void;
}) {
  const live =
    voiceState.kind === 'listening' ? 'listening' :
    voiceState.kind === 'starting'  ? 'starting…' :
    voiceState.kind === 'error'     ? `error · ${voiceState.code}` :
    voiceState.kind === 'unsupported' ? 'unsupported' :
    'idle';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="font-mono text-[11px] text-steel leading-relaxed">
          Dump everything. Tasks, ideas, reminders, money you spent, half-thoughts —
          one paragraph, ten paragraphs, any order. KAI sorts it.
        </p>
      </div>

      <div className="px-5 flex-1 overflow-y-auto">
        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={
            "e.g. need to call the locksmith about Makadi. pay 5k toward the card. " +
            "garden reel idea: golden hour with the monsteras, slow pan. " +
            "spent 220 at Spinneys yesterday. remind me to film the sunset listening intro on Friday at 5pm. " +
            "feeling stuck on the Enpal contract — should re-read it."
          }
          className="w-full min-h-[200px] bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2.5 text-bone font-sans text-[13.5px] leading-relaxed outline-none resize-y"
        />
        {interim && (
          <div className="mt-2 px-2 py-1 border border-cyan/25 rounded text-cyan/85 font-mono text-[11px] leading-snug">
            <span className="opacity-60">interim · </span>{interim}
          </div>
        )}
      </div>

      <div className="px-5 pt-3 pb-4 space-y-3 border-t border-amber/10 mt-3">
        {voiceSupported && (
          <button
            onClick={() => setListening(!listening)}
            className={
              'w-full flex items-center justify-center gap-2 px-3 py-2 rounded border transition text-[11px] tracking-[0.16em] uppercase ' +
              (listening
                ? 'border-ok/50 text-ok bg-ok/10'
                : 'border-amber/30 text-amber hover:bg-amber/10 hover:border-amber/60')
            }
          >
            {listening
              ? <><Mic size={12} /> Listening · tap to pause · <span className="opacity-70 normal-case tracking-normal font-mono">{live}</span></>
              : <><MicOff size={12} /> Start listening</>}
          </button>
        )}

        {err && (
          <div className="text-danger text-[11px] leading-relaxed flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {err}
          </div>
        )}

        <button
          onClick={onSort}
          disabled={busy || !text.trim()}
          className={
            'w-full flex items-center justify-center gap-2 px-3 py-3 rounded border ' +
            'border-amber/50 text-amber hover:bg-amber/10 hover:shadow-glow-amber transition ' +
            'disabled:opacity-50 disabled:cursor-not-allowed text-[12px] tracking-[0.16em] uppercase'
          }
        >
          {busy
            ? <><Loader2 size={13} className="animate-spin" /> Sorting…</>
            : <><Brain size={13} /> Sort it · <ArrowRight size={12} /></>}
        </button>
      </div>
    </div>
  );
}

/* ── Phase 2: review ─────────────────────────────────────── */

function ReviewBody({
  sorted,
  updateString, removeString,
  updateReminder, removeReminder,
  updateExpense, removeExpense,
  onFile, onReSort,
}: {
  sorted: Sorted;
  updateString: (k: 'priorities' | 'content_ideas' | 'notes', i: number, v: string) => void;
  removeString: (k: 'priorities' | 'content_ideas' | 'notes', i: number) => void;
  updateReminder: (i: number, patch: Partial<{ text: string; when_iso: string }>) => void;
  removeReminder: (i: number) => void;
  updateExpense: (i: number, patch: Partial<{ merchant: string; amount: number; currency?: string }>) => void;
  removeExpense: (i: number) => void;
  onFile: () => void;
  onReSort: () => void;
}) {
  const total =
    sorted.priorities.length + sorted.content_ideas.length +
    sorted.reminders.length + sorted.expenses.length + sorted.notes.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-5 flex-1">
        <Check size={26} className="text-steel mb-3" />
        <p className="font-sans text-bone/90 text-[14px]">Nothing extracted.</p>
        <p className="font-mono text-[11px] text-steel mt-2 max-w-[420px] leading-relaxed">
          Either KAI parsed nothing actionable, or the model returned an empty object.
          Edit the dump and try again.
        </p>
        <button
          onClick={onReSort}
          className="mt-4 flex items-center gap-2 px-3 py-2 rounded border border-amber/40 text-amber hover:bg-amber/10 text-[11px] tracking-[0.16em] uppercase"
        >
          <RefreshCw size={12} /> Sort again
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
      <Bucket icon={<ListChecks size={11} />} title="Priorities" count={sorted.priorities.length} color="#FFB300">
        {sorted.priorities.map((p, i) => (
          <RowText key={i} value={p}
            onChange={v => updateString('priorities', i, v)}
            onRemove={() => removeString('priorities', i)}
          />
        ))}
      </Bucket>

      <Bucket icon={<Sparkles size={11} />} title="Content ideas" count={sorted.content_ideas.length} color="#5FE3FF">
        {sorted.content_ideas.map((p, i) => (
          <RowText key={i} value={p}
            onChange={v => updateString('content_ideas', i, v)}
            onRemove={() => removeString('content_ideas', i)}
          />
        ))}
      </Bucket>

      <Bucket icon={<Bell size={11} />} title="Reminders" count={sorted.reminders.length} color="#C792EA">
        {sorted.reminders.map((r, i) => (
          <RowReminder
            key={i}
            text={r.text}
            iso={r.when_iso}
            originalWhen={r.when_text}
            onTextChange={v => updateReminder(i, { text: v })}
            onIsoChange={v => updateReminder(i, { when_iso: v })}
            onRemove={() => removeReminder(i)}
          />
        ))}
      </Bucket>

      <Bucket icon={<Receipt size={11} />} title="Expenses" count={sorted.expenses.length} color="#7AE6A8">
        {sorted.expenses.map((e, i) => (
          <RowExpense
            key={i}
            merchant={e.merchant}
            amount={e.amount}
            currency={e.currency || 'EGP'}
            onChange={(patch) => updateExpense(i, patch)}
            onRemove={() => removeExpense(i)}
          />
        ))}
      </Bucket>

      <Bucket icon={<NotebookPen size={11} />} title="Notes" count={sorted.notes.length} color="#7C8794">
        {sorted.notes.map((n, i) => (
          <RowText key={i} value={n}
            onChange={v => updateString('notes', i, v)}
            onRemove={() => removeString('notes', i)}
          />
        ))}
      </Bucket>

      <button
        onClick={onFile}
        className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded border border-amber text-amber hover:bg-amber/10 hover:shadow-glow-amber transition text-[12px] tracking-[0.16em] uppercase"
      >
        <Check size={13} /> File it all
      </button>
    </div>
  );
}

function Bucket({
  icon, title, count, color, children,
}: {
  icon: React.ReactNode; title: string; count: number; color: string; children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">{title}</span>
        <span className="ml-auto font-mono text-[10px] text-steel/60">{count}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RowText({
  value, onChange, onRemove,
}: { value: string; onChange: (v: string) => void; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 border border-amber/15 rounded">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={1}
        className="flex-1 bg-transparent text-bone font-sans text-[12.5px] leading-snug outline-none resize-none"
      />
      <button onClick={onRemove} className="text-steel hover:text-danger p-1 mt-0.5">
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function RowReminder({
  text, iso, originalWhen,
  onTextChange, onIsoChange, onRemove,
}: {
  text: string; iso: string; originalWhen?: string;
  onTextChange: (v: string) => void;
  onIsoChange: (v: string) => void;
  onRemove: () => void;
}) {
  /* Convert ISO ↔ local datetime-local string for the input. */
  const localValue = isoToLocal(iso);
  return (
    <div className="px-2 py-1.5 border border-amber/15 rounded space-y-1.5">
      <div className="flex items-start gap-2">
        <input
          value={text}
          onChange={e => onTextChange(e.target.value)}
          className="flex-1 bg-transparent text-bone font-sans text-[12.5px] outline-none border-b border-amber/15 focus:border-amber py-0.5"
        />
        <button onClick={onRemove} className="text-steel hover:text-danger p-1">
          <Trash2 size={11} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={localValue}
          onChange={e => onIsoChange(localToIso(e.target.value))}
          className="flex-1 bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone text-[11.5px] outline-none"
        />
        {originalWhen && (
          <span className="font-mono text-[9.5px] tracking-[0.06em] text-steel/70 truncate" title={originalWhen}>
            "{originalWhen}"
          </span>
        )}
      </div>
    </div>
  );
}

function RowExpense({
  merchant, amount, currency,
  onChange, onRemove,
}: {
  merchant: string; amount: number; currency: string;
  onChange: (patch: Partial<{ merchant: string; amount: number; currency?: string }>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_90px_60px_auto] items-center gap-1.5 px-2 py-1.5 border border-amber/15 rounded">
      <input
        value={merchant}
        onChange={e => onChange({ merchant: e.target.value })}
        className="bg-transparent text-bone font-sans text-[12.5px] outline-none border-b border-amber/15 focus:border-amber py-0.5"
      />
      <input
        type="number"
        value={amount}
        onChange={e => onChange({ amount: parseFloat(e.target.value) || 0 })}
        className="bg-transparent text-bone tabular-nums text-[12.5px] outline-none border-b border-amber/15 focus:border-amber py-0.5 text-right"
      />
      <input
        value={currency}
        onChange={e => onChange({ currency: e.target.value.toUpperCase().slice(0, 4) })}
        className="bg-transparent text-bone tracking-[0.16em] text-[11px] uppercase outline-none border-b border-amber/15 focus:border-amber py-0.5"
      />
      <button onClick={onRemove} className="text-steel hover:text-danger p-1">
        <Trash2 size={11} />
      </button>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function humanize(e: any): string {
  const msg = String(e?.message || 'unknown');
  if (msg === 'NO_API_KEY')        return "No Anthropic key on the server. Set ANTHROPIC_API_KEY in Vercel.";
  if (msg === 'EMPTY')             return 'Empty dump.';
  if (msg.startsWith('PARSE_'))    return "KAI's reply didn't parse. Try again — sometimes a tiny edit helps.";
  if (msg.startsWith('API_ERROR')) return 'Upstream API error — ' + msg.slice(11, 160);
  return msg.slice(0, 200);
}

function isoToLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  if (Number.isNaN(+d)) return '';
  return d.toISOString();
}

