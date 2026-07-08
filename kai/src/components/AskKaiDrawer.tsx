/* ============================================================
   ASK KAI — the conversational core. A right-side drawer, toggled
   with A (and closable with Esc). Every question is packed with
   buildKaiContext() so Claude answers from Ali's real numbers and
   shows the math — flat tone, no praise. Streams. History (last 12
   turns) lives in localStorage only. role=dialog + [data-noswipe]
   so the sovereign swipe-nav never fires inside it.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { askClaudeStream } from '../lib/claude';
import { buildKaiContext } from '../lib/kai/context';
import { suggestChips, fireChip, type ProposeChip } from '../lib/kai/propose';
import { Mail, Target, CalendarClock } from 'lucide-react';
import type { ChatTurn } from '../types';

const HKEY = 'kai.ask.history';

function loadHistory(): ChatTurn[] {
  try { return (JSON.parse(localStorage.getItem(HKEY) || '[]') as ChatTurn[]).slice(-12); } catch { return []; }
}
function saveHistory(h: ChatTurn[]) {
  try { localStorage.setItem(HKEY, JSON.stringify(h.slice(-12))); } catch { /* ignore */ }
}

interface Props { open: boolean; onClose: () => void; }

export default function AskKaiDrawer({ open, onClose }: Props) {
  const [history, setHistory] = useState<ChatTurn[]>(() => loadHistory());
  const [q, setQ] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [chips, setChips] = useState<ProposeChip[]>([]);
  const [chipMsg, setChipMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, streaming]);

  async function ask() {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true); setErr(null); setStreaming(''); setQ(''); setChips([]); setChipMsg(null);
    const preamble =
      'You are KAI, Ali\'s command core. Answer ONLY from the CONTEXT below — his real ' +
      'numbers. Show the math when it applies. Flat, direct tone; no praise, no padding; ' +
      'under 160 words. If the context does not contain the answer, say so plainly.';
    const prompt = `${preamble}\n\nCONTEXT:\n${buildKaiContext()}\n\nQUESTION: ${question}`;
    let acc = '';
    try {
      await askClaudeStream(prompt, history, (chunk) => { acc += chunk; setStreaming(acc); });
      const next: ChatTurn[] = [...history, { you: question, kai: acc, at: new Date().toISOString() }].slice(-12);
      setHistory(next); saveHistory(next); setStreaming('');
      /* Propose Mode (7.5): offer up to 3 follow-up chips. */
      suggestChips(question, acc).then(setChips).catch(() => {});
    } catch (e: any) {
      const msg = String(e?.message || e);
      setErr(msg.includes('NO_API_KEY') ? 'No API key wired on the server — Ask KAI is offline.' : 'KAI could not answer just now.');
      setStreaming('');
    } finally { setBusy(false); setTimeout(() => inputRef.current?.focus(), 30); }
  }

  async function tapChip(c: ProposeChip) {
    setChips(cs => cs.filter(x => x !== c));
    const msg = await fireChip(c);
    setChipMsg(msg);
  }

  const ChipIcon = (k: ProposeChip['kind']) => k === 'email' ? Mail : k === 'commitment' ? Target : CalendarClock;

  if (!open) return null;

  return (
    <div className="ask-kai-scrim" data-noswipe onClick={onClose}>
      <div
        className="ask-kai"
        role="dialog"
        aria-label="Ask KAI"
        data-noswipe
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ask-kai-head">
          <span className="ask-kai-title">ASK KAI</span>
          <button className="ask-kai-x" onClick={onClose} aria-label="close">✕</button>
        </div>

        <div className="ask-kai-body" ref={scrollRef}>
          {history.length === 0 && !streaming && !err && (
            <div className="ask-kai-hint">Ask anything about your numbers. "why is burn up?", "can I afford the FRISCH fit-out?"</div>
          )}
          {history.map((t, i) => (
            <div key={i} className="ask-kai-turn">
              <div className="ask-kai-you">{t.you}</div>
              <div className="ask-kai-ans">{t.kai}</div>
            </div>
          ))}
          {streaming && (
            <div className="ask-kai-turn">
              <div className="ask-kai-ans">{streaming}<span className="ask-kai-caret" /></div>
            </div>
          )}
          {err && <div className="ask-kai-err">{err}</div>}

          {chips.length > 0 && (
            <div className="ask-kai-chips">
              {chips.map((c, i) => {
                const Icon = ChipIcon(c.kind);
                return (
                  <button key={i} className="ask-kai-chip" onClick={() => tapChip(c)} title={c.detail}>
                    <Icon size={12} /> {c.label}
                  </button>
                );
              })}
            </div>
          )}
          {chipMsg && <div className="ask-kai-chipmsg">{chipMsg}</div>}
        </div>

        <form className="ask-kai-foot" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input
            ref={inputRef}
            className="ask-kai-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={busy ? 'thinking…' : 'ask KAI…'}
            disabled={busy}
          />
          <button className="ask-kai-send" type="submit" disabled={busy || !q.trim()}>→</button>
        </form>
      </div>
    </div>
  );
}
