import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Loader2, X, Trash2, Download } from 'lucide-react';
import Markdown from './Markdown';
import { runBuiltin } from '../lib/commands';
import { askClaude, askClaudeStream } from '../lib/claude';
import { extractCommitment } from '../lib/kai/ai';
import { addCommitment } from '../lib/kai/commitments';
import { counsel } from '../lib/kai/counsel';
import { findTarget, draftOutreach } from '../lib/kai/campaign';
import { toast } from '../hooks/useToasts';
import { sfx } from '../lib/sound';
import { voice } from '../lib/speech';
import { claudeConfig } from '../kaiConfig';
import { emit } from '../hooks/useKaiPulse';
import { loadState, saveState } from '../lib/store';
import { onAction } from '../lib/actions';
import { verbOrder, recordVerb } from '../lib/kai/adaptiveOrder';
import type { ChatTurn, KaiSettings } from '../types';

/* §24 — the visible verb palette. Every summonable surface, shown, so the
   operator never has to remember a command. Grouped, tappable. */
const PALETTE: Array<{ group: string; verbs: Array<{ cmd: string; desc: string }> }> = [
  { group: 'Summon', verbs: [
    { cmd: 'hunter',    desc: 'revenue moves, ranked' },
    { cmd: 'twin',      desc: 'your behavioral model' },
    { cmd: 'plan',      desc: "today's plan" },
    { cmd: 'reckon',    desc: 'the week in review' },
    { cmd: 'ambassador',desc: 'Makadi auto-replies' },
    { cmd: 'doctrine',  desc: 'who KAI is' },
  ] },
  { group: 'Ask', verbs: [
    { cmd: 'status',  desc: 'the whole picture' },
    { cmd: 'runway',  desc: 'days of freedom' },
    { cmd: 'debt',    desc: 'the card' },
    { cmd: 'makadi',  desc: 'the apartment' },
    { cmd: 'counsel', desc: 'rule on a decision' },
  ] },
];

type Props = { open: boolean; onClose: () => void; settings: KaiSettings };

/* §29.10 — the palette reorders by what he actually uses at this hour.
   Nothing is hidden: a verb he has never said keeps its place, just lower. */
function orderVerbs<T extends { cmd: string }>(verbs: T[]): T[] {
  try {
    const order = verbOrder(verbs.map((v) => v.cmd));
    return order.map((c) => verbs.find((v) => v.cmd === c)!).filter(Boolean);
  } catch { return verbs; }
}

export default function CommandBar({ open, onClose, settings }: Props) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ChatTurn[]>(() => loadState().history || []);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // persist + autoscroll
  useEffect(() => {
    const s = loadState(); s.history = history.slice(-30); saveState(s);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  /* External callers (App's voice handler, Spotlight) can ask the
     command bar to open with a prefilled prompt and optionally run
     submit() immediately. Keeps voice and typed input on the SAME
     pipeline: runBuiltin → fall through to streaming Claude. */
  useEffect(() => {
    const off = onAction((a) => {
      if (a.type !== 'open-cmd') return;
      if (a.prefill) setInput(a.prefill);
      if (a.submit && a.prefill) {
        /* Defer so the open animation can mount before we start. */
        setTimeout(() => submit(a.prefill!), 60);
      }
    });
    return off;
  }, [history, thinking, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(rawText?: string) {
    const text = (rawText ?? input).trim();
    if (!text || thinking) return;
    try { recordVerb(text); } catch { /* never block a command */ }
    setInput('');
    emit('command');

    /* Commitment intent — extract via /api/claude into the Spine's
       vocab, then save into the Mirror. If extraction returns null,
       fall through to the rest of the pipeline so the user still
       gets an answer. */
    if (/\b(i commit|i'?ll|i will|promise|by next|by friday|by monday|by tuesday|by wednesday|by thursday|by saturday|by sunday)\b/i.test(text)) {
      setThinking(true);
      pushTurn(text, '');
      try {
        const draft = await extractCommitment(text);
        if (draft) {
          const c = addCommitment({ ...draft, source: 'kai' });
          const dl = new Date(c.deadline).toDateString();
          replaceLast(`Logged. ${c.text} — by ${dl}. I'll hold you to it.`);
          return;
        }
        /* No measurable commitment — let normal pipeline take over,
           replacing the empty turn rather than leaving a dead row. */
        setHistory(h => h.slice(0, -1));
      } catch { /* fall through */ }
      finally { setThinking(false); }
    }

    /* THE COUNSEL (§15) — "/counsel" reads the whole Spine and returns
       ONE ruling. Async, so it's handled before the sync built-ins. */
    if (/^\/?counsel\b/i.test(text)) {
      setThinking(true);
      pushTurn(text, '');
      try {
        const r = await counsel();
        replaceLast(r.lines.join('\n'));
      } catch (e: any) {
        replaceLast(e?.message === 'NO_API_KEY' ? 'The Counsel needs a server key to rule.' : 'The Counsel is unavailable right now.');
      } finally { setThinking(false); }
      return;
    }

    /* DER FELDZUG (§18) — "draft outreach for <target>" writes a
       personalised email in the target's language and queues it at the
       Gate. Async, so handled before the sync built-ins. */
    const draftM = text.match(/^draft\s+(?:outreach|email|a\s+draft)\s+(?:for|to)\s+(.+)$/i);
    if (draftM) {
      const t = findTarget(draftM[1]);
      if (!t) { pushTurn(text, `No target matches “${draftM[1].trim()}”. Add it in the Feldzug panel first.`); return; }
      setThinking(true);
      pushTurn(text, '');
      try {
        const r = await draftOutreach(t.id);
        replaceLast(
          r.ok && r.noRecipient
            ? `Drafted outreach to ${t.name} in ${t.lang.toUpperCase()}. No email on file — add one in the Feldzug panel, then it queues at the Gate.`
            : r.ok
              ? `Drafted outreach to ${t.name} in ${t.lang.toUpperCase()} — queued at the Gate. Approve to send.`
              : r.reason === 'no_key' ? 'The draft engine needs a server key.' : 'Draft failed — try again.');
      } catch { replaceLast('Draft failed — try again.'); }
      finally { setThinking(false); }
      return;
    }

    const built = runBuiltin(text);
    if (built) {
      pushTurn(text, built);
      return;
    }

    setThinking(true);
    pushTurn(text, '');
    try {
      // Streaming path: KAI talks sentence-by-sentence as deltas arrive.
      if (settings.voiceEnabled) emit('speak-start');
      let acc = '';
      let speechBuf = '';
      const flushSpeech = (force = false) => {
        if (!settings.voiceEnabled) return;
        // Speak whenever the buffer ends with sentence punctuation,
        // or when forced (end of stream).
        const m = force
          ? [speechBuf]
          : speechBuf.match(/[^.!?\n]+[.!?]+["')\]]?/g);
        if (!m) return;
        for (const piece of m) {
          const trimmed = piece.trim();
          if (!trimmed) continue;
          voice.enqueue(trimmed, {
            rate: settings.voiceRate, pitch: settings.voicePitch, voiceName: settings.voiceName,
          });
          speechBuf = speechBuf.replace(piece, '');
        }
        if (force) speechBuf = '';
      };

      const reply = await askClaudeStream(text, history, (chunk) => {
        acc += chunk;
        speechBuf += chunk;
        setHistory(h => h.map((t, i) => i === h.length - 1 ? { ...t, kai: acc, streamed: true } : t));
        flushSpeech(false);
      }, (call) => {
        // Surface tool calls inline so the user sees what KAI actually did.
        const marker = `\n\n_◊ ${call.name}(${JSON.stringify(call.input).slice(0, 60)})_\n\n`;
        acc += marker;
        setHistory(h => h.map((t, i) => i === h.length - 1 ? { ...t, kai: acc, streamed: true } : t));
      });
      flushSpeech(true);
      setHistory(h => h.map((t, i) => i === h.length - 1 ? { ...t, kai: reply || acc, streamed: true } : t));
      /* §22.2 voice-out: if reading aloud is on but live recognition isn't
         (so nothing spoke progressively), speak the finished answer once. */
      if (settings.speakEnabled && !settings.voiceEnabled) speakIfOn(reply || acc);

      // When the synthesis queue drains, emit speak-end.
      if (settings.voiceEnabled) {
        const watch = setInterval(() => {
          if (!('speechSynthesis' in window) || (!speechSynthesis.speaking && !speechSynthesis.pending)) {
            clearInterval(watch);
            emit('speak-end');
          }
        }, 250);
      }
    } catch (e: any) {
      if (e?.message === 'NO_API_KEY') {
        replaceLast(
          "I don't have a key on the server. Try built-ins: status, debt, income, tasks, garden, makadi, instagram. Or set ANTHROPIC_API_KEY in the Vercel project and I'll think it through.",
        );
      } else {
        replaceLast('API trouble — ' + (e?.message?.slice(0, 100) || 'unknown'));
        sfx.error();
      }
      if (settings.voiceEnabled) emit('speak-end');
    } finally {
      setThinking(false);
    }
  }

  function pushTurn(you: string, kai: string) {
    setHistory(h => [...h, { you, kai, at: new Date().toISOString() }]);
    if (kai) speakIfOn(kai);
  }
  function replaceLast(kai: string, skipSpeak = false) {
    setHistory(h => h.map((t, i) => i === h.length - 1 ? { ...t, kai } : t));
    if (!skipSpeak) speakIfOn(kai);
  }
  function speakIfOn(text: string) {
    if (!settings.voiceEnabled && !settings.speakEnabled) return;   // §22.2 voice-out
    emit('speak-start');
    sfx.speak();
    voice.speak(
      text,
      { rate: settings.voiceRate, pitch: settings.voicePitch, voiceName: settings.voiceName },
      () => emit('speak-end'),
    );
  }
  function clearChat() {
    setHistory([]);
    sfx.click();
  }
  function exportChat() {
    if (!history.length) return;
    const md = history.map(t => {
      const ts = new Date(t.at).toLocaleString('en-GB');
      return `### ${ts}\n\n**You:** ${t.you}\n\n**KAI:** ${t.kai}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([`# KAI conversation\n\n${md}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kai-chat-${new Date().toISOString().slice(0,10)}.md`;
    a.click(); URL.revokeObjectURL(url);
    sfx.confirm();
    toast.ok('Chat exported.', 'EXPORT', 2400);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cmd"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[300] flex items-start justify-center pt-[12vh] px-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{ background: 'rgba(10,14,20,0.7)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ y: -10, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass w-full max-w-[680px] rounded-md overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-amber/15">
              <ChevronRight size={16} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="ask KAI anything — try “status”, “debt”, “tasks”…"
                className="flex-1 bg-transparent outline-none font-mono text-bone text-[15px] tracking-wide placeholder:text-steel"
              />
              {thinking && <Loader2 size={14} className="animate-spin text-amber" />}
              {history.length > 0 && (
                <>
                  <button onClick={exportChat} className="text-steel hover:text-amber" title="Export chat as markdown">
                    <Download size={13} />
                  </button>
                  <button onClick={clearChat} className="text-steel hover:text-danger" title="Clear chat">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              <button onClick={onClose} className="text-steel hover:text-amber"><X size={14} /></button>
            </div>

            {history.length === 0 && (
              <div className="p-4 max-h-[58vh] overflow-y-auto">
                {PALETTE.map((sec) => ({ ...sec, verbs: orderVerbs(sec.verbs) })).map((sec) => (
                  <div key={sec.group} className="mb-4">
                    <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-2">{sec.group}</div>
                    <div className="flex flex-col gap-1">
                      {sec.verbs.map((v) => (
                        <button
                          key={v.cmd}
                          onClick={() => submit(v.cmd)}
                          onMouseEnter={() => sfx.hover()}
                          className="flex items-baseline gap-3 text-left px-2.5 py-2 rounded border border-transparent hover:border-amber/30 hover:bg-amber/5"
                        >
                          <span className="font-mono text-[13px] tracking-[0.08em] text-amber w-[92px] shrink-0">{v.cmd}</span>
                          <span className="font-mono text-[11px] text-steel">{v.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-1 font-mono text-[10px] text-steel/70 leading-relaxed">
                  …or ask anything in plain words.
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div ref={scrollRef} className="max-h-[55vh] overflow-y-auto p-4 space-y-4">
                {history.map((t, i) => (
                  <div key={i} className="font-mono text-[13px] leading-relaxed">
                    <div className="text-cyan/80"><span className="text-cyan">›</span> {t.you}</div>
                    <div className="text-amber mt-1.5 pl-3 border-l border-amber/40">
                      {t.kai
                        ? (t.streamed
                            ? <span><Markdown text={t.kai} />{i === history.length - 1 && thinking && <span className="opacity-50 animate-pulse-soft">▍</span>}</span>
                            : i === history.length - 1 && !thinking
                              ? <Typed text={t.kai} />
                              : <span><Markdown text={t.kai} /></span>)
                        : <span className="text-amber/60">thinking<span className="animate-pulse-soft">…</span></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between px-4 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.16em] uppercase text-steel">
              <span><kbd>↵</kbd> send</span>
              <span>{history.length} turn{history.length === 1 ? '' : 's'} · <kbd>Esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Typed({ text }: { text: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 14);
    return () => clearInterval(id);
  }, [text]);
  return <span>{shown}<span className="opacity-50 animate-pulse-soft">▍</span></span>;
}
