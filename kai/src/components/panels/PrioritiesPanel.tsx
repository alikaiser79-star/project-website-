import Panel from '../Panel';
import { useState } from 'react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Trash2, GripVertical } from 'lucide-react';
import { loadState, saveState } from '../../lib/store';
import type { Priority } from '../../types';
import { sfx } from '../../lib/sound';

export default function PrioritiesPanel({ delay = 0 }: { delay?: number }) {
  const [items, setItems] = useState<Priority[]>(() => loadState().priorities);
  const [adding, setAdding] = useState('');

  function persist(next: Priority[]) {
    const s = loadState(); s.priorities = next; saveState(s);
    setItems(next);
  }
  function toggle(id: string) {
    const next = items.map(p => p.id === id ? { ...p, done: !p.done } : p);
    persist(next);
    const it = next.find(p => p.id === id);
    if (it?.done) sfx.confirm(); else sfx.click();
  }
  function add() {
    const text = adding.trim();
    if (!text) return;
    persist([{ id: 'p-' + Date.now(), text, done: false }, ...items]);
    setAdding(''); sfx.click();
  }
  function remove(id: string) {
    persist(items.filter(p => p.id !== id));
    sfx.click();
  }
  function reorder(next: Priority[]) {
    persist(next);
  }

  const open = items.filter(p => !p.done).length;

  return (
    <Panel num="06" title="Priorities" tag={`${open} OPEN`} delay={delay}>
      <div className="flex gap-2 mb-3">
        <input
          value={adding}
          onChange={e => setAdding(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a priority…"
          className="flex-1 bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-bone text-sm outline-none font-sans"
        />
        <button onClick={add} onMouseEnter={() => sfx.hover()}
          className="px-2.5 rounded border border-amber/40 text-amber hover:border-amber hover:shadow-glow-amber">
          <Plus size={14} />
        </button>
      </div>
      <Reorder.Group axis="y" values={items} onReorder={reorder} className="space-y-1.5 overflow-y-auto flex-1">
        <AnimatePresence initial={false}>
          {items.map(p => (
            <Reorder.Item
              key={p.id}
              value={p}
              as="li"
              whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,179,0,0.4)' }}
              className="group flex items-center gap-2.5 p-2 rounded border border-amber/10 hover:border-amber/30 bg-ink2/40 cursor-grab active:cursor-grabbing"
            >
              <motion.span
                onMouseEnter={() => sfx.hover()}
                className="text-steel/60 group-hover:text-amber/70 cursor-grab"
              >
                <GripVertical size={12} />
              </motion.span>
              <button
                onClick={() => toggle(p.id)}
                className={'w-5 h-5 rounded-sm border flex items-center justify-center transition ' +
                  (p.done
                    ? 'bg-amber/15 border-amber text-amber shadow-glow-amber'
                    : 'border-amber/30 hover:border-amber text-transparent')
                }
              >
                <Check size={12} />
              </button>
              <span className={'relative font-sans text-[13px] flex-1 strike ' + (p.done ? 'on text-steel' : 'text-bone')}>
                {p.text}
              </span>
              <button onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 text-steel hover:text-danger transition">
                <Trash2 size={12} />
              </button>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <div className="mt-2 pt-2 border-t border-amber/10 font-mono text-[10px] tracking-[0.18em] uppercase text-steel">
        drag to reorder
      </div>
    </Panel>
  );
}
