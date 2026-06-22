/* ============================================================
   Content Queue panel.

   Shows every item saved by the week planner (and any
   future manual additions). Each card:
   - account chip + format chip + slot label
   - status pill — tap to advance idea → shot → posted → idea
   - hook (with copy button)
   - shot list
   - caption + hashtags (with copy button)
   - edit + delete

   Counter line: "X of Y still to shoot".
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Pencil, Trash2, ListVideo } from 'lucide-react';
import Panel from '../Panel';
import {
  listQueue, queueCount,
  advanceStatus, updateQueueItem, deleteQueueItem,
} from '../../lib/content';
import { sfx } from '../../lib/sound';
import { toast } from '../../hooks/useToasts';
import type { ContentItem, ContentStatus, ContentFormat, ContentAccount } from '../../types';

const ACCOUNT_LABEL: Record<ContentAccount, string> = {
  ali:    '@alikaiser1',
  garden: '@hiddengarden.eg',
};
const ACCOUNT_COLOR: Record<ContentAccount, string> = {
  ali:    '#FFB300',
  garden: '#7AE6A8',
};
const FORMAT_COLOR: Record<ContentFormat, string> = {
  reel:     '#5FE3FF',
  carousel: '#C792EA',
  story:    '#FFB300',
};
const STATUS_LABEL: Record<ContentStatus, string> = {
  idea:   'idea',
  shot:   'shot',
  posted: 'posted',
};
const STATUS_STYLE: Record<ContentStatus, string> = {
  idea:   'border-steel/50 text-steel',
  shot:   'border-cyan/50 text-cyan bg-cyan/10',
  posted: 'border-emerald/50 text-emerald bg-emerald/10',
};

export default function ContentQueuePanel({ delay = 0 }: { delay?: number }) {
  const [items, setItems] = useState<ContentItem[]>(() => listQueue());
  const [editing, setEditing] = useState<string | null>(null);

  function refresh() { setItems(listQueue()); }

  const counts = queueCount();
  const stillToShoot = counts.idea;

  function cycle(c: ContentItem) {
    advanceStatus(c.id);
    sfx.click();
    refresh();
  }
  function remove(c: ContentItem) {
    if (!confirm(`Delete "${c.hook}"?`)) return;
    deleteQueueItem(c.id);
    toast.ok('Item removed.', 'CONTENT', 2200);
    refresh();
  }
  function saveEdit(id: string, patch: Partial<ContentItem>) {
    updateQueueItem(id, patch);
    refresh();
  }

  return (
    <Panel num="08" title="Content Queue" tag={items.length ? `${stillToShoot} of ${counts.total} still to shoot` : 'empty'} delay={delay}>
      {items.length === 0 ? (
        <EmptyQueue />
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map(c => (
              <li key={c.id} className="list-none">
                <Card
                  c={c}
                  editing={editing === c.id}
                  onEdit={() => setEditing(editing === c.id ? null : c.id)}
                  onCycle={() => cycle(c)}
                  onDelete={() => remove(c)}
                  onSave={(patch) => { saveEdit(c.id, patch); setEditing(null); }}
                />
              </li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  );
}

function EmptyQueue() {
  return (
    <div className="px-4 py-8 border border-amber/15 rounded text-center">
      <ListVideo size={22} className="text-amber/60 mx-auto mb-2" />
      <p className="text-bone/90 text-[13px]">Queue is empty.</p>
      <p className="text-steel text-[11px] mt-1 max-w-[320px] mx-auto leading-relaxed">
        Open <span className="text-amber">Content</span> in the top bar and hit
        <span className="text-cyan"> Plan a week</span> — KAI will fill this in.
      </p>
    </div>
  );
}

function Card({
  c, editing, onEdit, onCycle, onDelete, onSave,
}: {
  c: ContentItem;
  editing: boolean;
  onEdit: () => void;
  onCycle: () => void;
  onDelete: () => void;
  onSave: (patch: Partial<ContentItem>) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
      className="rounded-md border border-amber/15 bg-ink2/30 px-4 py-3 space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip color={ACCOUNT_COLOR[c.account]} label={ACCOUNT_LABEL[c.account]} />
        <Chip color={FORMAT_COLOR[c.format]} label={c.format} />
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel">{c.slot}</span>

        <button
          onClick={onCycle}
          className={
            'ml-auto px-2 py-0.5 rounded border font-mono text-[10px] tracking-[0.18em] uppercase transition ' +
            STATUS_STYLE[c.status]
          }
          title="Tap to advance idea → shot → posted"
        >
          {STATUS_LABEL[c.status]}
        </button>
        <button onClick={onEdit} className="text-steel hover:text-amber p-1" title="Edit">
          <Pencil size={11} />
        </button>
        <button onClick={onDelete} className="text-steel hover:text-danger p-1" title="Delete">
          <Trash2 size={11} />
        </button>
      </div>

      {editing ? (
        <Editor c={c} onSave={onSave} onCancel={onEdit} />
      ) : (
        <View c={c} />
      )}
    </motion.div>
  );
}

function View({ c }: { c: ContentItem }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="flex-1 font-sans text-bone text-[14px] leading-snug">
          "{c.hook}"
        </div>
        <CopyBtn text={c.hook} label="hook" />
      </div>

      <div>
        <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-steel/80 mb-1">shot list</div>
        <ul className="space-y-0.5">
          {c.shotlist.map((s, i) => (
            <li key={i} className="font-mono text-[11.5px] text-bone/85 leading-snug">· {s}</li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center mb-1">
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-steel/80">caption</span>
          <span className="ml-auto">
            <CopyBtn
              text={c.caption + (c.hashtags?.length ? '\n\n' + c.hashtags.join(' ') : '')}
              label="caption"
            />
          </span>
        </div>
        <div className="font-sans text-bone/90 text-[12.5px] leading-relaxed">{c.caption}</div>
        {c.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1.5">
            {c.hashtags.map((t, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded border border-cyan/30 text-cyan/90 font-mono text-[10px]">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Editor({
  c, onSave, onCancel,
}: { c: ContentItem; onSave: (patch: Partial<ContentItem>) => void; onCancel: () => void }) {
  const [slot,     setSlot]     = useState(c.slot);
  const [format,   setFormat]   = useState<ContentFormat>(c.format);
  const [hook,     setHook]     = useState(c.hook);
  const [shotList, setShotList] = useState(c.shotlist.join('\n'));
  const [caption,  setCaption]  = useState(c.caption);
  const [tags,     setTags]     = useState(c.hashtags.join(' '));

  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          value={slot}
          onChange={e => setSlot(e.target.value)}
          placeholder="Slot"
          className="bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone text-[12px] outline-none"
        />
        <select
          value={format}
          onChange={e => setFormat(e.target.value as ContentFormat)}
          className="bg-ink2 border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone text-[12px] outline-none"
        >
          <option value="reel">reel</option>
          <option value="carousel">carousel</option>
          <option value="story">story</option>
        </select>
      </div>
      <textarea
        value={hook} onChange={e => setHook(e.target.value)} rows={2}
        placeholder="Hook"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone font-sans text-[13px] outline-none resize-none"
      />
      <textarea
        value={shotList}
        onChange={e => setShotList(e.target.value)}
        rows={4}
        placeholder="Shot list — one line per shot"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone font-mono text-[11.5px] outline-none resize-none"
      />
      <textarea
        value={caption} onChange={e => setCaption(e.target.value)} rows={3}
        placeholder="Caption"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone font-sans text-[12.5px] outline-none resize-none"
      />
      <input
        value={tags} onChange={e => setTags(e.target.value)}
        placeholder="#tag1 #tag2 #tag3"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-cyan font-mono text-[11px] outline-none"
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="ml-auto px-3 py-1.5 border border-steel/30 text-steel rounded hover:text-bone hover:border-steel text-[10px] tracking-[0.16em] uppercase"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({
            slot, format, hook, caption,
            shotlist: shotList.split('\n').map(s => s.trim()).filter(Boolean),
            hashtags: tags.split(/\s+/).map(t => t.trim()).filter(Boolean),
          })}
          className="px-3 py-1.5 border border-amber text-amber rounded hover:bg-amber/10 text-[10px] tracking-[0.16em] uppercase"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded border font-mono text-[10px] tracking-[0.1em] uppercase"
      style={{ borderColor: color + '66', color, background: color + '14' }}
    >
      {label}
    </span>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);

  async function go() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      sfx.confirm();
      toast.ok(label === 'hook' ? 'Hook copied.' : 'Caption copied.', 'CLIPBOARD', 1800);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.err('Clipboard blocked by browser.');
    }
  }
  return (
    <button
      onClick={go}
      className="flex items-center gap-1 px-2 py-0.5 rounded border border-amber/30 text-amber hover:border-amber hover:bg-amber/10 font-mono text-[10px] tracking-[0.16em] uppercase"
      title={`Copy ${label}`}
    >
      {copied ? <><Check size={10} /> copied</> : <><Copy size={10} /> {label}</>}
    </button>
  );
}

