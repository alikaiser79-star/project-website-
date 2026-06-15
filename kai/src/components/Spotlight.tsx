import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, ListTodo, NotebookPen, Flame, Clock, MessageCircle, Terminal } from 'lucide-react';
import { searchAll, SearchHit } from '../lib/search';
import { sfx } from '../lib/sound';

const ICONS = {
  priority: ListTodo, journal: NotebookPen, habit: Flame,
  reminder: Clock, history: MessageCircle, command: Terminal,
};

type Props = { open: boolean; onClose: () => void; runCommand: (q: string) => void };

export default function Spotlight({ open, onClose, runCommand }: Props) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ(''); setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const hits = useMemo<SearchHit[]>(() => open ? searchAll(q, runCommand) : [], [q, open, runCommand]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(hits.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const h = hits[idx];
        if (h) { sfx.confirm(); h.action(); onClose(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hits, idx, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[320] flex items-start justify-center pt-[12vh] px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{ background: 'rgba(10,14,20,0.72)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ y: -10, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass w-full max-w-[640px] rounded-md overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-amber/15">
              <Search size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => { setQ(e.target.value); setIdx(0); }}
                placeholder="search priorities, journal, habits, commands…"
                className="flex-1 bg-transparent outline-none font-mono text-bone text-[15px] tracking-wide placeholder:text-steel"
              />
              <button onClick={onClose} className="text-steel hover:text-amber"><X size={14} /></button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {hits.length === 0 && (
                <div className="px-4 py-6 font-mono text-[12px] text-steel">
                  {q ? 'No matches.' : 'Type to search across everything KAI knows.'}
                </div>
              )}
              {hits.map((h, i) => {
                const Icon = ICONS[h.kind];
                return (
                  <button
                    key={h.id}
                    onMouseEnter={() => { setIdx(i); sfx.hover(); }}
                    onClick={() => { sfx.confirm(); h.action(); onClose(); }}
                    className={'w-full text-left px-4 py-2.5 flex items-center gap-3 border-l-2 ' +
                      (i === idx
                        ? 'bg-amber/8 border-amber'
                        : 'border-transparent hover:bg-amber/4')
                    }
                  >
                    <Icon size={14} className={i === idx ? 'text-amber' : 'text-amber/70'} />
                    <div className="flex-1 min-w-0">
                      <div className="font-sans text-bone text-[13px] truncate">{h.label}</div>
                      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-steel">{h.kind} · {h.meta}</div>
                    </div>
                    {i === idx && <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-amber">↵ open</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between px-4 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.18em] uppercase text-steel">
              <span><kbd>↑</kbd><kbd>↓</kbd> nav · <kbd>↵</kbd> open</span>
              <span>{hits.length} result{hits.length === 1 ? '' : 's'} · <kbd>Esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
