/* ============================================================
   LEADS — the pipeline board (Ops view). FOUND → RESEARCHED →
   DRAFTED → SENT → REPLIED → WON/DEAD. The agent moves cards to
   DRAFTED at most; SENT only happens after Ali approves the Gmail
   draft at the Gate. Ali can drag a card forward manually too.
   ============================================================ */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { getLeads, moveLead, LEAD_STAGES, type Lead, type LeadStage } from '../../lib/kai/leads';
import { useKaiVersion } from '../../lib/kai/mirror';

const STAGE_COLOR: Record<LeadStage, string> = {
  FOUND: 'text-steel/70', RESEARCHED: 'text-amber/80', DRAFTED: 'text-violet-300',
  SENT: 'text-sky-300', REPLIED: 'text-emerald-300', WON: 'text-emerald-400', DEAD: 'text-steel/40',
};

export default function LeadsPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();                    // re-render when the Spine bus fires
  const [, force] = useState(0);
  const leads = getLeads();

  function advance(l: Lead) {
    const i = LEAD_STAGES.indexOf(l.stage);
    if (i < LEAD_STAGES.length - 2) { moveLead(l.id, LEAD_STAGES[i + 1]); force(n => n + 1); }
  }

  const counts = LEAD_STAGES.map(s => [s, leads.filter(l => l.stage === s).length] as [LeadStage, number]);

  return (
    <motion.div
      data-panel="25"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">Leads</span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-steel/50 uppercase ml-auto">{leads.length} in pipeline</span>
      </div>

      {/* stage counters */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {counts.map(([s, n]) => (
          <div key={s} className="text-center">
            <div className={'font-mono text-[13px] ' + STAGE_COLOR[s]}>{n}</div>
            <div className="font-mono text-[7px] tracking-[0.1em] text-steel/40 uppercase mt-0.5">{s.slice(0, 4)}</div>
          </div>
        ))}
      </div>

      {leads.length === 0 && (
        <div className="font-mono text-[11px] text-steel/50">No leads yet. Launch a PROSPECTOR mission.</div>
      )}

      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
        {leads.slice(0, 12).map(l => (
          <button
            key={l.id}
            onClick={() => advance(l)}
            title="tap to advance stage"
            className="text-left border border-white/[0.06] rounded px-3 py-2 hover:border-amber/30 transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] text-bone/90 truncate">{l.name}</span>
              <span className={'font-mono text-[9px] tracking-[0.15em] uppercase shrink-0 ml-2 ' + STAGE_COLOR[l.stage]}>{l.stage}</span>
            </div>
            {typeof l.fit === 'number' && <div className="font-mono text-[10px] text-steel/50 mt-0.5">fit {l.fit}/10{l.source ? ' · sourced' : ''}</div>}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
