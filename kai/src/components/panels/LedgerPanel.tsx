/* ============================================================
   The Ledger — people you depend on, scored by what they
   actually did. Reuses the Spine + the same shape as the Mirror.

   Each person row shows reliability (delivered ÷ resolved over
   6 months), their open / overdue count, and expands to their
   active promises. Inline forms for adding people and promises.
   Auto-resolution runs on boot, every 6h, and on visibility
   change (wired in App.tsx via startLedger).
   ============================================================ */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, Plus, X, Trash2, Check, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import Panel from '../Panel';
import { useKaiVersion } from '../../lib/kai/mirror';
import {
  listPeople, addPerson, removePerson,
  listPromises, addPromise, removePromise,
  reliabilityFor, type LedgerPromise, type PromiseMetric,
} from '../../lib/kai/ledger';
import type { Domain } from '../../lib/kai/events';
import { logEvent } from '../../lib/kai/events';
import { sfx } from '../../lib/sound';
import { toast } from '../../hooks/useToasts';

const DAY = 86_400_000;

export default function LedgerPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const people = listPeople();
  const promises = listPromises();

  const [addingPerson, setAddingPerson] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addingPromiseFor, setAddingPromiseFor] = useState<string | null>(null);

  const tag = people.length === 0
    ? 'empty'
    : `${people.length} ${people.length === 1 ? 'person' : 'people'}`;

  return (
    <Panel num="11" title="The Ledger" tag={tag} delay={delay}>
      <div className="space-y-4">

        {people.length === 0 ? (
          <div className="px-4 py-6 border border-amber/15 rounded text-center">
            <Users size={20} className="text-amber/60 mx-auto mb-2" />
            <p className="text-bone/85 text-[12.5px]">Nobody on the Ledger yet.</p>
            <p className="text-steel text-[10.5px] mt-1 max-w-[300px] mx-auto leading-relaxed">
              Add the people you depend on — renter, contractor, court ally. KAI grades them on what they actually do.
            </p>
            <button
              onClick={() => setAddingPerson(true)}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-amber/40 text-amber rounded hover:bg-amber/10 text-[11px] tracking-[0.16em] uppercase"
            >
              <Plus size={11} /> Add first person
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {people.map(person => {
                const r = reliabilityFor(person.id);
                const personPromises = promises
                  .filter(p => p.personId === person.id)
                  .sort((a, b) => a.deadline - b.deadline);
                const open = personPromises.filter(p => p.status === 'open');
                const isExpanded = expanded === person.id;
                const flake = r.score !== null && r.score < 50 && r.flaked >= 2;

                return (
                  <motion.li
                    key={person.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border border-amber/15 rounded overflow-hidden"
                  >
                    {/* Header */}
                    <div
                      className="group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-amber/[0.04] transition"
                      onClick={() => setExpanded(isExpanded ? null : person.id)}
                    >
                      {isExpanded
                        ? <ChevronDown size={11} className="text-steel shrink-0" />
                        : <ChevronRight size={11} className="text-steel shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="font-sans text-bone text-[13px] truncate">{person.name}</div>
                        <div className="font-mono text-[10px] text-steel/85 tracking-[0.06em] truncate">
                          {person.role}{r.openCount > 0 ? ` · ${r.openCount} open` : ''}
                          {r.overdueCount > 0 ? ` · ${r.overdueCount} overdue` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={'font-sans tabular-nums text-[15px] ' + scoreColor(r.score)}>
                          {r.score === null ? '—' : `${r.score}%`}
                        </div>
                        <div className="font-mono text-[9px] text-steel/70 tracking-[0.06em]">
                          {r.total > 0 ? `${r.delivered}/${r.total} · 6mo` : 'no record'}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm(`Remove ${person.name} from the Ledger?`)) return;
                          removePerson(person.id);
                          toast.ok(`${person.name} removed.`, 'LEDGER', 2200);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-steel/55 hover:text-danger p-1 shrink-0 transition"
                        title="Remove"
                      >
                        <X size={11} />
                      </button>
                    </div>

                    {/* Flake warning strip */}
                    {flake && open.length > 0 && (
                      <div className="px-3 py-1.5 border-t border-danger/20 bg-danger/[0.05] flex items-center gap-1.5">
                        <AlertTriangle size={10} className="text-danger" />
                        <span className="font-mono text-[10px] text-danger/90">
                          Flaked {r.flaked} of last {r.total}. Get insurance up front.
                        </span>
                      </div>
                    )}

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="px-3 py-2.5 border-t border-amber/10 space-y-2 bg-ink2/20">
                        {open.length === 0 && personPromises.length === 0 && (
                          <p className="font-mono text-[10.5px] text-steel/75 leading-relaxed">
                            No promises logged. Add one below — KAI will resolve it from the Spine when the time comes.
                          </p>
                        )}
                        {personPromises.length > 0 && (
                          <ul className="space-y-1">
                            {personPromises.slice(0, 8).map(pr => (
                              <PromiseRow key={pr.id} pr={pr} onRemove={() => removePromise(pr.id)} />
                            ))}
                          </ul>
                        )}
                        {addingPromiseFor === person.id ? (
                          <NewPromiseForm
                            onCancel={() => setAddingPromiseFor(null)}
                            onSave={(input) => {
                              addPromise({ ...input, personId: person.id });
                              setAddingPromiseFor(null);
                              sfx.confirm();
                              toast.ok(`Promise logged: ${input.text}`, 'LEDGER', 2800);
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => setAddingPromiseFor(person.id)}
                            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 border border-amber/25 text-amber rounded hover:bg-amber/10 text-[10px] tracking-[0.18em] uppercase"
                          >
                            <Plus size={10} /> Add promise
                          </button>
                        )}
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {people.length > 0 && !addingPerson && (
          <button
            onClick={() => setAddingPerson(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-steel/30 text-steel rounded hover:text-bone hover:border-steel text-[10px] tracking-[0.18em] uppercase"
          >
            <Plus size={11} /> Add person
          </button>
        )}

        {addingPerson && (
          <NewPersonForm
            onCancel={() => setAddingPerson(false)}
            onSave={(name, role) => {
              const p = addPerson({ name, role });
              setAddingPerson(false);
              setExpanded(p.id);
              sfx.confirm();
              toast.ok(`${p.name} added to the Ledger.`, 'LEDGER', 2400);
            }}
          />
        )}
      </div>
    </Panel>
  );
}

function scoreColor(pct: number | null): string {
  if (pct === null) return 'text-steel';
  if (pct >= 80) return 'text-emerald';
  if (pct >= 50) return 'text-amber';
  return 'text-danger';
}

function PromiseRow({ pr, onRemove }: { pr: LedgerPromise; onRemove: () => void }) {
  const days = Math.ceil((pr.deadline - Date.now()) / DAY);
  const overdue = pr.status === 'open' && days < 0;
  const close   = pr.status === 'open' && days >= 0 && days <= 2;

  const statusBadge =
    pr.status === 'delivered'
      ? <span className="px-1.5 py-0.5 rounded border border-emerald/50 bg-emerald/10 text-emerald font-mono text-[9px] tracking-[0.18em] uppercase">delivered</span>
      : pr.status === 'flaked'
        ? <span className="px-1.5 py-0.5 rounded border border-danger/50 bg-danger/10 text-danger font-mono text-[9px] tracking-[0.18em] uppercase">flaked</span>
        : overdue
          ? <span className="px-1.5 py-0.5 rounded border border-danger/50 text-danger font-mono text-[9px] tracking-[0.18em] uppercase">overdue</span>
          : close
            ? <span className="px-1.5 py-0.5 rounded border border-amber/50 text-amber font-mono text-[9px] tracking-[0.18em] uppercase">{days}d</span>
            : <span className="px-1.5 py-0.5 rounded border border-cyan/40 text-cyan font-mono text-[9px] tracking-[0.18em] uppercase">{days}d</span>;

  /* Quick "Mark received" shortcut on open promises: fires the
     matching Spine event so the resolver flips this to delivered
     on next tick. For income/expense/etc. you can also log it the
     normal way and the resolver will catch it. */
  const canMark = pr.status === 'open';

  return (
    <li className="group flex items-center gap-2 px-2 py-1.5 border border-amber/10 rounded bg-ink2/30">
      <div className="min-w-0 flex-1">
        <div className="font-sans text-bone/95 text-[12px] truncate">{pr.text}</div>
        <div className="font-mono text-[9.5px] text-steel/70 tracking-[0.04em]">
          {pr.metric.domain}.{pr.metric.event} {pr.metric.op} {pr.metric.target.toLocaleString()}
          {pr.recurringDays ? ` · every ${pr.recurringDays}d` : ''}
        </div>
      </div>
      {statusBadge}
      {canMark && (
        <button
          onClick={() => {
            /* Fire the matching event so the resolver picks it up. */
            logEvent({
              domain: pr.metric.domain,
              type: pr.metric.event,
              value: pr.metric.target,
              meta: { promiseId: pr.id },
              source: 'user',
            });
            toast.ok(`Logged. KAI will mark "${pr.text}" delivered on next tick.`, 'LEDGER', 3000);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-steel hover:text-emerald transition"
          title="Mark received"
        >
          <Check size={11} />
        </button>
      )}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 text-steel hover:text-danger transition"
        title="Drop"
      >
        <Trash2 size={11} />
      </button>
    </li>
  );
}

/* ── Forms ─────────────────────────────────────────────── */

function NewPersonForm({ onCancel, onSave }: { onCancel: () => void; onSave: (name: string, role: string) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  return (
    <div className="space-y-2 px-3 py-3 border border-amber/20 rounded bg-ink2/30">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">add person</div>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name, role); } if (e.key === 'Escape') onCancel(); }}
        placeholder="Name"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-bone text-[13px] outline-none"
      />
      <input
        value={role}
        onChange={e => setRole(e.target.value)}
        placeholder="Role · Honda renter, court ally, contractor…"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-bone text-[12px] outline-none"
      />
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="ml-auto px-3 py-1.5 border border-steel/30 text-steel hover:text-bone hover:border-steel rounded text-[10px] tracking-[0.16em] uppercase">
          Cancel
        </button>
        <button
          onClick={() => name.trim() && onSave(name, role)}
          className="px-3 py-1.5 border border-amber text-amber rounded hover:bg-amber/10 text-[10px] tracking-[0.16em] uppercase"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/* Quick presets so the user doesn't have to type a metric shape. */
const PRESETS: Array<{ label: string; metric: PromiseMetric; recurringDays?: number; defaultText: string }> = [
  { label: 'Honda rent (16k/mo)', metric: { domain: 'income',  event: 'rent_paid',         op: '>=', target: 16000 }, recurringDays: 30, defaultText: 'Pay Honda rent on time' },
  { label: 'Pay X by date',       metric: { domain: 'income',  event: 'rent_paid',         op: '>=', target: 0     }, defaultText: 'Pay …' },
  { label: 'Leave a review',      metric: { domain: 'makadi',  event: 'review_left',       op: '>=', target: 1     }, defaultText: 'Leave a review' },
  { label: 'Finish a task',       metric: { domain: 'system',  event: 'task_completed',    op: '>=', target: 1     }, defaultText: 'Finish …' },
  { label: 'Custom',              metric: { domain: 'system',  event: 'custom',            op: '>=', target: 1     }, defaultText: '' },
];

function NewPromiseForm({
  onCancel, onSave,
}: { onCancel: () => void; onSave: (input: { text: string; metric: PromiseMetric; deadline: number; recurringDays?: number }) => void }) {
  const [preset, setPreset] = useState(0);
  const [text, setText]     = useState(PRESETS[0].defaultText);
  const [target, setTarget] = useState<string>(String(PRESETS[0].metric.target));
  const [date, setDate]     = useState(() => {
    const d = new Date(Date.now() + 30 * DAY);
    return d.toISOString().slice(0, 10);
  });
  const [recurring, setRecurring] = useState<boolean>(!!PRESETS[0].recurringDays);

  function selectPreset(i: number) {
    setPreset(i);
    setText(PRESETS[i].defaultText);
    setTarget(String(PRESETS[i].metric.target));
    setRecurring(!!PRESETS[i].recurringDays);
  }

  function save() {
    if (!text.trim()) return;
    const t = parseFloat(target.replace(/[, ]/g, ''));
    if (!Number.isFinite(t) || t < 0) return;
    const p = PRESETS[preset];
    const deadline = new Date(date + 'T23:59:59').getTime();
    if (!Number.isFinite(deadline)) return;
    onSave({
      text,
      metric: { ...p.metric, target: t },
      deadline,
      recurringDays: recurring ? (p.recurringDays ?? 30) : undefined,
    });
  }

  return (
    <div className="space-y-2 px-3 py-3 border border-amber/20 rounded bg-ink2/30">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">new promise</div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => selectPreset(i)}
            className={
              'px-2 py-0.5 rounded border font-mono text-[9.5px] tracking-[0.14em] uppercase transition ' +
              (i === preset
                ? 'border-amber bg-amber/10 text-amber'
                : 'border-amber/20 text-steel hover:text-bone hover:border-amber/50')
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What did they promise?"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-bone text-[13px] outline-none"
      />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          value={target}
          onChange={e => setTarget(e.target.value.replace(/[^\d.,]/g, ''))}
          placeholder="Target (number)"
          inputMode="decimal"
          className="bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-bone tabular-nums text-[12px] outline-none"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone text-[12px] outline-none"
        />
      </div>

      <label className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] uppercase text-steel cursor-pointer">
        <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
        Recurring (auto-creates the next one)
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={onCancel} className="ml-auto px-3 py-1.5 border border-steel/30 text-steel hover:text-bone hover:border-steel rounded text-[10px] tracking-[0.16em] uppercase">
          Cancel
        </button>
        <button onClick={save} className="px-3 py-1.5 border border-amber text-amber rounded hover:bg-amber/10 text-[10px] tracking-[0.16em] uppercase">
          Log promise
        </button>
      </div>
    </div>
  );
}
