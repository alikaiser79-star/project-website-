import { AnimatePresence, motion } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

const rows: Array<[string[], string]> = [
  [['⌘', 'K'],  'Open command bar'],
  [['Esc'],     'Close any overlay'],
  [['V'],       'Toggle voice recognition'],
  [['M'],       'Toggle UI sound'],
  [['S'],       'Open settings'],
  [['?'],       'This cheatsheet'],
  [['↑','↓'],   'Navigate command bar'],
  [['↵'],       'Send / confirm'],
];

export default function CheatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] grid place-items-center px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{ background: 'rgba(10,14,20,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ y: -8, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="glass w-[min(540px,92vw)] rounded-md"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-amber/15">
              <div className="flex items-center gap-2 text-amber/90">
                <Keyboard size={14} />
                <h3 className="font-sans text-bone text-sm tracking-wide">Keyboard reference</h3>
              </div>
              <button onClick={onClose} className="text-steel hover:text-amber"><X size={14} /></button>
            </header>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[12px]">
              {rows.map(([keys, label]) => (
                <div key={label} className="flex items-center gap-2 py-1">
                  <span className="flex gap-1">{keys.map(k => <kbd key={k}>{k}</kbd>)}</span>
                  <span className="text-bone">{label}</span>
                </div>
              ))}
            </div>
            <footer className="px-4 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.18em] uppercase text-steel">
              tip · in the cmd bar, type <span className="text-amber">status</span>, <span className="text-amber">debt</span>, <span className="text-amber">income</span>, <span className="text-amber">tasks</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
