/* ============================================================
   Content panel — one-tap reel-hook generator.

   Pick an account (@alikaiser1 or @hiddengarden.eg), optionally
   give a topic / mood, hit Generate. Claude searches the web,
   returns exactly 3 hook objects, we render them as copyable
   cards.

   Routes through /api/claude — no key on the client. Robust
   parse + retry; null-safe; ErrorBoundary upstream still wraps.
   ============================================================ */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, Copy, Check, RefreshCw, AtSign, Loader2, Globe, AlertTriangle } from 'lucide-react';
import { generateReelHooks, type Account, type Hook } from '../lib/content';
import { sfx } from '../lib/sound';
import { toast } from '../hooks/useToasts';

type Props = { open: boolean; onClose: () => void };

const STORAGE = 'kai.content.v1';
type Persisted = { account: Account; topic: string };

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return { account: 'ali', topic: '' };
    const p = JSON.parse(raw);
    const account: Account = p?.account === 'garden' ? 'garden' : 'ali';
    const topic = typeof p?.topic === 'string' ? p.topic : '';
    return { account, topic };
  } catch {
    return { account: 'ali', topic: '' };
  }
}

function savePersisted(p: Persisted) {
  try { localStorage.setItem(STORAGE, JSON.stringify(p)); } catch {}
}

export default function ContentPanel({ open, onClose }: Props) {
  const initial = loadPersisted();
  const [account, setAccount] = useState<Account>(initial.account);
  const [topic,   setTopic]   = useState<string>(initial.topic);

  const [busy, setBusy]    = useState(false);
  const [hooks, setHooks]  = useState<Hook[] | null>(null);
  const [err, setErr]      = useState<string | null>(null);

  useEffect(() => { savePersisted({ account, topic }); }, [account, topic]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function run() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    sfx.whoosh();
    try {
      const out = await generateReelHooks(account, topic);
      setHooks(out);
      sfx.confirm();
    } catch (e: any) {
      const msg = String(e?.message || 'unknown');
      if (msg === 'NO_API_KEY') {
        setErr("No Anthropic key on the server. Set ANTHROPIC_API_KEY in Vercel and try again.");
      } else if (msg.startsWith('PARSE_')) {
        setErr("KAI's reply didn't parse cleanly. Try again — model usually nails it second pass.");
      } else if (msg.startsWith('API_ERROR')) {
        setErr('Upstream API error — ' + msg.slice(11, 160));
      } else {
        setErr(msg.slice(0, 200));
      }
      sfx.error();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="content-shell"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[320] flex items-start justify-center pt-[8vh] px-4 pb-8"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{ background: 'rgba(10,14,20,0.7)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ y: -10, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass w-full max-w-[720px] rounded-md overflow-hidden flex flex-col max-h-[84vh]"
          >
            <header className="flex items-center gap-2 px-5 py-4 border-b border-amber/15">
              <Sparkles size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
              <h3 className="font-sans text-bone text-sm tracking-wide">Content · Reel Hooks</h3>
              <span className="ml-auto font-mono text-[10px] tracking-[0.22em] uppercase text-steel flex items-center gap-1.5">
                <Globe size={11} /> web-aware
              </span>
              <button onClick={onClose} className="text-steel hover:text-amber ml-3" title="Close (Esc)">
                <X size={14} />
              </button>
            </header>

            {/* Controls */}
            <div className="px-5 py-4 space-y-4 border-b border-amber/10">
              <div>
                <label className="block text-[10px] tracking-[0.18em] text-steel uppercase mb-2">Account</label>
                <div className="grid grid-cols-2 gap-2">
                  <AccountPill
                    selected={account === 'ali'}
                    onClick={() => { sfx.click(); setAccount('ali'); }}
                    handle="@alikaiser1"
                    sub="personal brand · bold"
                  />
                  <AccountPill
                    selected={account === 'garden'}
                    onClick={() => { sfx.click(); setAccount('garden'); }}
                    handle="@hiddengarden.eg"
                    sub="garden · eco-luxury"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-[0.18em] text-steel uppercase mb-2">
                  Topic or mood <span className="normal-case tracking-normal text-steel/60">(optional)</span>
                </label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value.slice(0, 240))}
                  onKeyDown={e => { if (e.key === 'Enter') run(); }}
                  placeholder={account === 'ali'
                    ? 'e.g. discipline, Cairo nights, German routine, identity'
                    : 'e.g. monsteras, golden hour, sunset listening, mint'}
                  className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone font-sans text-[13px] outline-none"
                />
              </div>

              <button
                onClick={run}
                disabled={busy}
                className={
                  'w-full flex items-center justify-center gap-2 px-3 py-3 rounded border ' +
                  'border-amber/50 text-amber hover:bg-amber/10 hover:shadow-glow-amber transition ' +
                  'disabled:opacity-60 disabled:cursor-not-allowed'
                }
              >
                {busy
                  ? <><Loader2 size={14} className="animate-spin" /> Searching the web & generating…</>
                  : <><Sparkles size={14} /> Generate 3 reel hooks</>}
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!hooks && !err && !busy && (
                <EmptyState />
              )}

              {busy && (
                <BusyState />
              )}

              {err && (
                <ErrorState message={err} onRetry={run} />
              )}

              {hooks && !busy && !err && (
                <div className="space-y-3">
                  {hooks.map((h, i) => (
                    <HookCard key={i} index={i} hook={h} />
                  ))}
                  <button
                    onClick={run}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 rounded border border-steel/30 text-steel hover:text-bone hover:border-steel text-[11px] tracking-[0.16em] uppercase"
                  >
                    <RefreshCw size={12} /> Generate 3 more
                  </button>
                </div>
              )}
            </div>

            <footer className="px-5 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.18em] uppercase text-steel flex justify-between">
              <span>kai · content engine</span>
              <span><kbd>Esc</kbd> close</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AccountPill({
  selected, onClick, handle, sub,
}: { selected: boolean; onClick: () => void; handle: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={
        'flex flex-col items-start gap-1 px-3 py-2.5 rounded border transition text-left ' +
        (selected
          ? 'border-amber bg-amber/10 shadow-glow-amber'
          : 'border-amber/20 hover:border-amber/60')
      }
    >
      <span className="flex items-center gap-1.5 font-sans text-bone text-[13px]">
        <AtSign size={11} className={selected ? 'text-amber' : 'text-steel'} />
        {handle.replace(/^@/, '')}
      </span>
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-steel">{sub}</span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Sparkles size={26} className="text-amber/60 mb-3" />
      <p className="font-sans text-bone/85 text-[14px] max-w-[420px] leading-relaxed">
        Pick an account, drop an optional mood, hit Generate.
      </p>
      <p className="font-mono text-[11px] text-steel mt-3 max-w-[420px] leading-relaxed">
        KAI searches what's trending right now, then writes 3 on-brand
        reel hooks with caption + hashtags. One tap, web-aware.
      </p>
    </div>
  );
}

function BusyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-amber/20 blur-xl animate-pulse-soft" />
        <div className="relative w-12 h-12 rounded-full border border-amber/40 grid place-items-center bg-ink2/40">
          <Globe size={22} className="text-amber animate-pulse-soft" />
        </div>
      </div>
      <p className="mt-4 font-mono text-[11px] tracking-[0.18em] uppercase text-steel">
        scanning the web · drafting hooks
      </p>
      <p className="mt-1 font-mono text-[10px] text-steel/70">this takes 10-20 s</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <AlertTriangle size={22} className="text-danger mb-3" />
      <p className="font-sans text-bone/90 text-[13px] leading-relaxed max-w-[420px]">
        {message}
      </p>
      <button
        onClick={onRetry}
        className="mt-4 flex items-center gap-2 px-3 py-2 rounded border border-amber/40 text-amber hover:border-amber hover:bg-amber/10 text-[11px] tracking-[0.16em] uppercase"
      >
        <RefreshCw size={12} /> Try again
      </button>
    </div>
  );
}

function HookCard({ index, hook }: { index: number; hook: Hook }) {
  const [copiedHook, setCopiedHook]       = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  async function copy(text: string, which: 'hook' | 'caption') {
    try {
      await navigator.clipboard.writeText(text);
      sfx.confirm();
      if (which === 'hook')    { setCopiedHook(true);    setTimeout(() => setCopiedHook(false), 1400); }
      else                     { setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 1400); }
      toast.ok(which === 'hook' ? 'Hook copied.' : 'Caption copied.', 'CLIPBOARD', 2000);
    } catch {
      toast.err('Clipboard blocked by browser.');
    }
  }

  return (
    <div className="rounded-md border border-amber/20 bg-ink2/30 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">hook {index + 1}</span>
        <span className="ml-auto" />
        <button
          onClick={() => copy(hook.hook, 'hook')}
          className="flex items-center gap-1 px-2 py-1 rounded border border-amber/30 text-amber hover:border-amber hover:bg-amber/10 text-[10px] tracking-[0.14em] uppercase"
          title="Copy hook"
        >
          {copiedHook ? <><Check size={10} /> copied</> : <><Copy size={10} /> hook</>}
        </button>
        <button
          onClick={() => copy(hook.caption + (hook.hashtags?.length ? '\n\n' + hook.hashtags.join(' ') : ''), 'caption')}
          className="flex items-center gap-1 px-2 py-1 rounded border border-amber/30 text-amber hover:border-amber hover:bg-amber/10 text-[10px] tracking-[0.14em] uppercase"
          title="Copy caption + hashtags"
        >
          {copiedCaption ? <><Check size={10} /> copied</> : <><Copy size={10} /> caption</>}
        </button>
      </div>

      <div>
        <div className="font-sans text-bone text-[15px] leading-snug">"{hook.hook}"</div>
      </div>

      <div className="border-t border-amber/10 pt-2.5 space-y-2">
        <Row label="Concept" value={hook.concept} mono />
        <Row label="Caption" value={hook.caption} />
        {hook.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {hook.hashtags.map((t, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded border border-cyan/30 text-cyan/90 font-mono text-[10px]">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-steel/80 mb-0.5">{label}</div>
      <div className={(mono ? 'font-mono text-[12px] ' : 'font-sans text-[13px] ') + 'text-bone/90 leading-relaxed'}>
        {value}
      </div>
    </div>
  );
}
