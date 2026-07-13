/* ============================================================
   DER FELDZUG (§18) — the campaign pipeline (Comms view). Targets as a
   kanban across scouted → contacted → replied → won / dead. Per target:
   DRAFT queues a personalised email (in their language) at the Gate —
   nothing sends here. Tap a card to advance its status; add new targets.
   ============================================================ */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Loader2, Plus, PenLine } from 'lucide-react';
import { useKaiVersion } from '../../lib/kai/mirror';
import {
  listTargets, addTarget, setTargetStatus, draftOutreach, seedTargets, isTargetsSeeded,
  TARGET_STATUSES, type Target, type TargetStatus, type TargetLang,
} from '../../lib/kai/campaign';
import { toast } from '../../hooks/useToasts';

const STATUS_COLOR: Record<TargetStatus, string> = {
  scouted: 'text-steel/70', contacted: 'text-amber/80', replied: 'text-violet-300',
  won: 'text-emerald-400', dead: 'text-steel/40',
};
const LANGS: TargetLang[] = ['en', 'de', 'ru', 'ar'];

export default function FeldzugPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const [drafting, setDrafting] = useState<string | null>(null);
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [offer, setOffer] = useState('');
  const [lang, setLang] = useState<TargetLang>('en');

  useEffect(() => { if (!isTargetsSeeded()) seedTargets(); }, []);

  const targets = listTargets();

  function advance(t: Target) {
    const i = TARGET_STATUSES.indexOf(t.status);
    if (i < TARGET_STATUSES.length - 1) setTargetStatus(t.id, TARGET_STATUSES[i + 1]);
  }

  async function draft(t: Target) {
    setDrafting(t.id);
    try {
      const r = await draftOutreach(t.id);
      if (r.ok && r.noRecipient) { toast.warn(`Draft for ${t.name} ready — add an email to send it.`, 'FELDZUG', 3600); setOpenDraft(t.id); }
      else if (r.ok) { toast.ok(`Draft for ${t.name} queued at the Gate — approve to send.`, 'FELDZUG', 3200); setOpenDraft(t.id); }
      else toast.err(r.reason === 'no_key' ? 'Needs a server key to draft.' : 'Draft failed.', 'FELDZUG', 3000);
    } catch { toast.err('Draft failed.', 'FELDZUG', 3000); }
    setDrafting(null);
  }

  function submitTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addTarget({ name: name.trim(), email: email.trim() || undefined, offer: offer.trim() || undefined, lang });
    setName(''); setEmail(''); setOffer(''); setLang('en'); setAdding(false);
  }

  const counts = TARGET_STATUSES.map((s) => [s, targets.filter((t) => t.status === s).length] as [TargetStatus, number]);

  return (
    <motion.div
      data-panel="28"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Swords size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">Feldzug</span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-steel/50 uppercase ml-auto">{targets.length} targets</span>
      </div>

      {/* pipeline counters */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {counts.map(([s, n]) => (
          <div key={s} className="text-center">
            <div className={'font-mono text-[13px] ' + STATUS_COLOR[s]}>{n}</div>
            <div className="font-mono text-[7px] tracking-[0.1em] text-steel/40 uppercase mt-0.5">{s.slice(0, 4)}</div>
          </div>
        ))}
      </div>

      {/* target cards */}
      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {targets.length === 0 && <div className="font-mono text-[11px] text-steel/50">No targets yet.</div>}
        {targets.map((t) => (
          <div key={t.id} className="border border-white/[0.06] rounded px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => advance(t)} title="tap to advance status" className="text-left min-w-0 flex-1">
                <span className="font-mono text-[12px] text-bone/90 truncate block">{t.name}</span>
              </button>
              <span className="font-mono text-[8px] tracking-[0.12em] uppercase text-steel/40 shrink-0">{t.lang}</span>
              <span className={'font-mono text-[9px] tracking-[0.15em] uppercase shrink-0 ' + STATUS_COLOR[t.status]}>{t.status}</span>
              <button
                onClick={() => draft(t)}
                disabled={drafting === t.id}
                title="draft outreach → Gate"
                className="text-steel/60 hover:text-amber disabled:opacity-40 shrink-0"
              >
                {drafting === t.id ? <Loader2 size={13} className="animate-spin" /> : <PenLine size={13} />}
              </button>
            </div>
            {t.offer && <div className="font-mono text-[10px] text-steel/50 mt-0.5 truncate">{t.offer}</div>}
            <div className="flex items-center gap-2 mt-0.5">
              {!t.email && <span className="font-mono text-[9px] text-amber/60">no email — add to send</span>}
              {t.lastDraft && (
                <button onClick={() => setOpenDraft(openDraft === t.id ? null : t.id)} className="font-mono text-[9px] tracking-[0.1em] uppercase text-steel/50 hover:text-amber">
                  {openDraft === t.id ? 'hide draft' : 'view draft'}
                </button>
              )}
            </div>
            {openDraft === t.id && t.lastDraft && (
              <div className="mt-1.5 border-t border-white/[0.06] pt-1.5">
                <div className="font-mono text-[10px] text-bone/80">{t.lastDraft.subject}</div>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-steel/70 leading-snug">{t.lastDraft.body}</pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* add target */}
      {adding ? (
        <form onSubmit={submitTarget} className="mt-3 flex flex-col gap-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="target name" className="bg-black/30 border border-white/[0.08] rounded px-2.5 py-1.5 text-bone/90 font-mono text-[11px] outline-none focus:border-amber/40" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact email (optional)" className="bg-black/30 border border-white/[0.08] rounded px-2.5 py-1.5 text-bone/90 font-mono text-[11px] outline-none focus:border-amber/40" />
          <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="the offer…" className="bg-black/30 border border-white/[0.08] rounded px-2.5 py-1.5 text-bone/90 font-mono text-[11px] outline-none focus:border-amber/40" />
          <div className="flex gap-1.5 items-center">
            {LANGS.map((l) => (
              <button type="button" key={l} onClick={() => setLang(l)} className={'font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded border ' + (lang === l ? 'border-amber/50 text-amber' : 'border-white/10 text-steel/50')}>{l}</button>
            ))}
            <button type="submit" disabled={!name.trim()} className="ml-auto px-3 rounded border border-amber/30 text-amber font-mono text-[11px] disabled:opacity-40">add</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1 font-mono text-[10px] tracking-[0.15em] uppercase text-steel/50 hover:text-amber transition">
          <Plus size={11} /> add target
        </button>
      )}
    </motion.div>
  );
}
