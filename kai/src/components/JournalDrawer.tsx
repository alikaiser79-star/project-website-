import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, NotebookPen, Trash2, Search } from 'lucide-react';
import { listJournal, addJournal, removeJournal } from '../lib/journal';
import { sfx } from '../lib/sound';
import { toast } from '../hooks/useToasts';

export default function JournalDrawer({ open, onClose, focusEntryId }: { open: boolean; onClose: () => void; focusEntryId?: string | null }) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState(() => listJournal());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e => e.text.toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
      setEntries(listJournal());
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* When the drawer is opened from Spotlight with an entry id, scroll
     to that entry. The pulse glow comes from the motion.div above. */
  useEffect(() => {
    if (!open || !focusEntryId) return;
    const id = setTimeout(() => {
      const el = document.getElementById('journal-entry-' + focusEntryId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 240);
    return () => clearTimeout(id);
  }, [open, focusEntryId]);

  function save() {
    const t = text.trim();
    if (!t) return;
    const e = addJournal(t);
    setEntries(es => [e, ...es]);
    setText('');
    sfx.confirm();
    toast.ok('Journal captured.', 'JOURNAL', 2400);
  }
  function del(id: string) {
    removeJournal(id);
    setEntries(es => es.filter(e => e.id !== id));
    sfx.click();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[320] flex items-start justify-center pt-[10vh] px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
            <header className="flex items-center justify-between px-4 py-3 border-b border-amber/15">
              <div className="flex items-center gap-2 text-amber/90">
                <NotebookPen size={14} />
                <h3 className="font-sans text-bone text-sm tracking-wide">Journal · quick capture</h3>
              </div>
              <button onClick={onClose} className="text-steel hover:text-amber"><X size={14} /></button>
            </header>

            <div className="p-4">
              <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}
                placeholder="What's on your mind? ⌘↵ to save"
                rows={3}
                className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone text-sm outline-none font-sans resize-none"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={save}
                  className="px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase border border-amber text-amber bg-amber/10 rounded hover:shadow-glow-amber"
                >Save</button>
                <span className="font-mono text-[10px] text-steel ml-auto">{entries.length} entries</span>
              </div>
            </div>

            {entries.length > 0 && (
              <div className="px-4 pb-2 flex items-center gap-2">
                <Search size={12} className="text-amber/70" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search entries…"
                  className="flex-1 bg-transparent border-b border-amber/20 focus:border-amber py-1 text-bone text-sm outline-none font-sans"
                />
                <span className="font-mono text-[10px] text-steel tabular-nums">{visible.length}/{entries.length}</span>
              </div>
            )}

            <div className="max-h-[50vh] overflow-y-auto px-4 pb-4 space-y-2">
              {entries.length === 0 && (
                <div className="font-mono text-[12px] text-steel py-2">No entries yet. Type one above, or say "Kai, note that…"</div>
              )}
              {entries.length > 0 && visible.length === 0 && (
                <div className="font-mono text-[12px] text-steel py-2">No matches.</div>
              )}
              <AnimatePresence initial={false}>
                {visible.map(e => (
                  <motion.div
                    key={e.id}
                    id={'journal-entry-' + e.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{
                      opacity: 1, y: 0,
                      boxShadow: focusEntryId === e.id
                        ? '0 0 0 1px #FFB300, 0 0 18px rgba(255,179,0,0.45)'
                        : 'none',
                    }}
                    exit={{ opacity: 0, x: 10, transition: { duration: 0.18 } }}
                    className="group p-3 border border-amber/15 hover:border-amber/40 rounded bg-ink2/40"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-bone text-[13px] leading-snug whitespace-pre-wrap">{e.text}</div>
                      <button onClick={() => del(e.id)} className="opacity-0 group-hover:opacity-100 text-steel hover:text-danger transition">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-steel mt-1">
                      {new Date(e.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <footer className="flex justify-between px-4 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.18em] uppercase text-steel">
              <span><kbd>⌘</kbd><kbd>↵</kbd> save</span>
              <span><kbd>Esc</kbd> close</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
