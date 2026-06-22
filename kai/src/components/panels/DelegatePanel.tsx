/* ============================================================
   DelegatePanel — standing approval rules. Auto-approves
   bypass your tap. Read the rule before you flip it on.
   ============================================================ */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, ShieldOff, Plus, Trash2, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import Panel from '../Panel';
import { useKaiVersion } from '../../lib/kai/mirror';
import {
  getDelegate, setKillSwitch, setRuleEnabled, addRule, removeRule,
  type DelegateRule,
} from '../../lib/kai/delegate';
import type { PendingKind } from '../../lib/kai/pending';
import { sfx } from '../../lib/sound';
import { toast } from '../../hooks/useToasts';

const KIND_OPTS: PendingKind[] = ['email_send', 'sms_send', 'ig_publish', 'site_commit'];
/* site_deploy intentionally absent — never auto-approvable. */

export default function DelegatePanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const s = getDelegate();
  const enabled = s.rules.filter(r => r.enabled).length;
  const tag = s.killed ? 'killed' : enabled === 0 ? 'all off' : `${enabled} on`;
  const [adding, setAdding] = useState(false);

  return (
    <Panel num="21" title="The Delegate" tag={tag} delay={delay}>
      <div className="space-y-3">

        {/* Kill switch */}
        <button
          onClick={() => { sfx.click(); setKillSwitch(!s.killed); }}
          className={
            'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded border ' +
            (s.killed
              ? 'border-danger/55 bg-danger/[0.08] text-danger'
              : 'border-emerald/40 bg-emerald/[0.05] text-emerald hover:bg-emerald/10')
          }
        >
          {s.killed ? <ShieldOff size={12} /> : <ShieldCheck size={12} />}
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase">
            {s.killed ? 'kill switch on · no rules fire' : 'kill switch off · rules active'}
          </span>
        </button>

        {/* Warning */}
        <div className="px-3 py-2 border border-amber/20 rounded bg-amber/[0.04] text-bone/85 text-[10.5px] leading-relaxed flex items-start gap-2">
          <AlertTriangle size={11} className="text-amber mt-0.5 shrink-0" />
          <span>
            Auto-approves bypass your tap. Use only for narrow safe lanes you can audit later in the Spine. <span className="text-danger/90">site_deploy is never auto-approvable.</span>
          </span>
        </div>

        {/* Rules */}
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {s.rules.map(r => <RuleRow key={r.id} r={r} />)}
          </AnimatePresence>
        </ul>

        {/* Add */}
        {adding ? (
          <NewRuleForm onCancel={() => setAdding(false)} onSave={() => { setAdding(false); }} />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-steel/30 text-steel hover:text-bone hover:border-steel text-[10px] tracking-[0.18em] uppercase"
          >
            <Plus size={11} /> Add rule
          </button>
        )}
      </div>
    </Panel>
  );
}

function RuleRow({ r }: { r: DelegateRule }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className={'group px-3 py-2 border rounded ' + (r.enabled ? 'border-amber/30 bg-amber/[0.04]' : 'border-amber/10')}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => { sfx.click(); setRuleEnabled(r.id, !r.enabled); }}
          className={r.enabled ? 'text-emerald' : 'text-steel/55'}
          title={r.enabled ? 'Disable' : 'Enable'}
        >
          {r.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
        </button>
        <span className="font-sans text-bone text-[12.5px] truncate flex-1 min-w-0">{r.name}</span>
        <span className="font-mono text-[9.5px] text-steel/65 shrink-0">
          {r.firedToday}/{r.dailyCap} today · {r.fires} all-time
        </span>
        <button
          onClick={() => {
            if (!confirm('Remove this rule?')) return;
            removeRule(r.id);
            toast.ok('Rule removed.', 'DELEGATE', 2200);
          }}
          className="opacity-0 group-hover:opacity-100 text-steel/55 hover:text-danger p-1 transition"
          title="Remove"
        >
          <Trash2 size={11} />
        </button>
      </div>
      <div className="font-mono text-[10px] text-steel/80 leading-relaxed mt-0.5">{r.lane}</div>
      <div className="font-mono text-[9.5px] text-steel/60 mt-0.5">
        kind = <span className="text-amber/80">{r.kind}</span>
        {r.summary_regex ? <> · summary ~ <span className="text-cyan/80">/{r.summary_regex}/i</span></> : null}
        {' · '}
        action = <span className="text-emerald/90">{r.action}</span>
      </div>
    </motion.li>
  );
}

function NewRuleForm({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  const [name, setName] = useState('');
  const [lane, setLane] = useState('');
  const [kind, setKind] = useState<PendingKind>('email_send');
  const [summary, setSummary] = useState('');
  const [cap, setCap] = useState(5);

  function save() {
    if (!name.trim() || !lane.trim()) return;
    addRule({
      name: name.trim(),
      lane: lane.trim(),
      kind,
      summary_regex: summary.trim() || undefined,
      action: 'auto_approve',
      enabled: false,    // off by default; user toggles after reading
      dailyCap: Math.max(1, Math.min(50, cap)),
    });
    sfx.confirm();
    toast.ok(`Rule "${name.trim()}" added — disabled by default.`, 'DELEGATE', 4000);
    onSave();
  }

  return (
    <div className="space-y-2 px-3 py-3 border border-amber/20 rounded bg-ink2/30">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">new rule</div>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Rule name"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-bone text-[12.5px] outline-none"
      />
      <input
        value={lane}
        onChange={e => setLane(e.target.value)}
        placeholder="Lane (what's safe to auto-handle)"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-bone text-[11.5px] outline-none"
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select
          value={kind}
          onChange={e => setKind(e.target.value as PendingKind)}
          className="bg-ink2 border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone text-[11.5px] outline-none"
        >
          {KIND_OPTS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <input
          type="number"
          min={1}
          max={50}
          value={cap}
          onChange={e => setCap(parseInt(e.target.value) || 1)}
          className="w-[68px] bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone tabular-nums text-[11.5px] outline-none"
          title="Daily cap"
        />
      </div>
      <input
        value={summary}
        onChange={e => setSummary(e.target.value)}
        placeholder="Summary regex (optional, e.g. makadi.*book)"
        className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-cyan/90 font-mono text-[11px] outline-none"
      />
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onCancel} className="ml-auto px-3 py-1.5 border border-steel/30 text-steel hover:text-bone hover:border-steel rounded text-[10px] tracking-[0.16em] uppercase">
          Cancel
        </button>
        <button onClick={save} className="px-3 py-1.5 border border-amber text-amber rounded hover:bg-amber/10 text-[10px] tracking-[0.16em] uppercase">
          Add (disabled)
        </button>
      </div>
    </div>
  );
}
