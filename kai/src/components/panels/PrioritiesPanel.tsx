import Panel from '../Panel';
import { useState } from 'react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Trash2, GripVertical } from 'lucide-react';
import { loadState, saveState } from '../../lib/store';
import type { Priority } from '../../types';
import { sfx } from '../../lib/sound';
import { celebrate } from '../../lib/celebrate';
import { logEvent } from '../../lib/kai/events';

export default function PrioritiesPanel({ delay = 0 }: { delay?: number }) {
  const [items, setItems] = useState<Priority[]>(() => loadState().priorities);
  const [adding, setAdding] = useState('');

  function persist(next: Priority[]) {
    const s = loadState(); s.priorities = next; saveState(s);
    setItems(next);
  }
  function toggle(id: string, ev?: React.MouseEvent) {
    const next = items.map(p => p.id === id ? { ...p, done: !p.done } : p);
    persist(next);
    const it = next.find(p => p.id === id);
    if (it?.done) {
      sfx.confirm();
      if (ev) celebrate(ev.clientX, ev.clientY);
      else    celebrate();
      /* Spine — task closed by the user from the panel. */
      logEvent({ domain: 'priorities', type: 'task_done', value: 1, meta: { text: it.text }, source: 'user' });
    } else {
      sfx.click();
    }
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
    <Panel num="06" title="Priorities" tag={`${open} open`} delay={delay}>
      <div className="flex gap-2 mb-4">
        <input
          value={adding}
          onChange={e => setAdding(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a priority…"
          className="flex-1 bg-transparent border border-white/[0.08] focus:border-white/20 rounded px-3 py-2 text-bone/90 text-sm outline-none font-sans transition"
        />
        <button onClick={add}
          className="px-3 rounded border border-white/[0.08] text-steel hover:text-bone hover:border-white/20 transition">
          <Plus size={14} />
        </button>
      </div>
      <Reorder.Group axis="y" values={items} onReorder={reorder} className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map(p => (
            <Reorder.Item
              key={p.id}
              value={p}
              as="li"
              whileDrag={{ scale: 1.01, boxShadow: '0 12px 30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10)' }}
              className="group flex items-center gap-3 px-3 py-2.5 rounded border border-white/[0.04] hover:border-white/[0.10] bg-ink2/40 cursor-grab active:cursor-grabbing"
            >
              <motion.span className="text-steel/40 group-hover:text-steel/70 cursor-grab transition">
                <GripVertical size={12} />
              </motion.span>
              <button
                onClick={(ev) => toggle(p.id, ev)}
                className={'w-4 h-4 rounded-sm border flex items-center justify-center transition ' +
                  (p.done
                    ? 'bg-amber/15 border-amber/70 text-amber'
                    : 'border-white/15 hover:border-white/35 text-transparent')
                }
              >
                <Check size={10} />
              </button>
              <span className={'relative font-sans text-[13.5px] flex-1 strike ' + (p.done ? 'on text-steel/55' : 'text-bone/90')}>
                {p.text}
              </span>
              <button onClick={() => remove(p.id)} className="opacity-0 group-hover:opacity-100 text-steel/55 hover:text-danger/90 transition">
                <Trash2 size={11} />
              </button>
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <div className="mt-4 pt-3 border-t border-white/[0.04] font-mono text-[10px] tracking-[0.18em] uppercase text-steel/45">
        Drag to reorder
      </div>
    </Panel>
  );
}
