import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Loader2, Sparkles, X, Trash2 } from 'lucide-react';
import { runBuiltin } from '../lib/commands';
import { askClaude, askClaudeStream } from '../lib/claude';
import { sfx } from '../lib/sound';
import { voice } from '../lib/speech';
import { claudeConfig } from '../kaiConfig';
import { emit } from '../hooks/useKaiPulse';
import { loadState, saveState } from '../lib/store';
import type { ChatTurn, KaiSettings } from '../types';

const suggestions = ['status', 'debt', 'income', 'tasks', 'garden', 'makadi', 'instagram'];

type Props = { open: boolean; onClose: () => void; settings: KaiSettings };

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

  async function submit(rawText?: string) {
    const text = (rawText ?? input).trim();
    if (!text || thinking) return;
    setInput('');
    emit('command');

    const built = runBuiltin(text);
    if (built) {
      pushTurn(text, built);
      return;
    }

    if (!claudeConfig.apiKey) {
      pushTurn(
        text,
        "I don't have an API key wired. Try: status, debt, income, tasks, garden, makadi, instagram. Or add VITE_ANTHROPIC_API_KEY to .env.local and I'll think it through.",
      );
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
      });
      flushSpeech(true);
      setHistory(h => h.map((t, i) => i === h.length - 1 ? { ...t, kai: reply || acc, streamed: true } : t));

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
      replaceLast('API trouble — ' + (e?.message?.slice(0, 100) || 'unknown'));
      sfx.error();
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
    if (!settings.voiceEnabled) return;
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
                <button onClick={clearChat} className="text-steel hover:text-danger" title="Clear chat">
                  <Trash2 size={13} />
                </button>
              )}
              <button onClick={onClose} className="text-steel hover:text-amber"><X size={14} /></button>
            </div>

            {history.length === 0 && (
              <div className="p-4">
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-2">suggested</div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      onMouseEnter={() => sfx.hover()}
                      className="font-mono text-[11px] tracking-[0.15em] uppercase px-2.5 py-1 border border-amber/25 hover:border-amber hover:bg-amber/10 text-amber rounded"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {!claudeConfig.apiKey && (
                  <div className="mt-4 font-mono text-[11px] text-steel leading-relaxed flex gap-2">
                    <Sparkles size={12} className="text-cyan mt-0.5 shrink-0" />
                    Wire an Anthropic key in <span className="text-amber">.env.local</span> as <span className="text-amber">VITE_ANTHROPIC_API_KEY</span> and KAI will answer freely beyond these built-ins.
                  </div>
                )}
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
                            ? <span>{t.kai}{i === history.length - 1 && thinking && <span className="opacity-50 animate-pulse-soft">▍</span>}</span>
                            : i === history.length - 1 && !thinking
                              ? <Typed text={t.kai} />
                              : <span>{t.kai}</span>)
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
