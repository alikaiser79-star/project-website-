/* ============================================================
   THE ANALYST — the daily brief panel (AI 7.3). First slot on the
   Money view. Reads today's cached brief (one Claude call/day),
   renders it as five flat lines. Offline degrades cleanly.
   ============================================================ */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart } from 'lucide-react';
import { ensureAnalystBrief, type AnalystBrief } from '../../lib/kai/analyst';

const ROWS: Array<[keyof AnalystBrief, string]> = [
  ['moved', 'MOVED'], ['broke', 'BROKE'], ['move', 'MOVE'], ['risk', 'RISK'], ['watch', 'WATCH'],
];

export default function AnalystPanel({ delay = 0 }: { delay?: number }) {
  const [brief, setBrief] = useState<AnalystBrief | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'offline'>('loading');

  useEffect(() => {
    let alive = true;
    ensureAnalystBrief()
      .then(b => { if (alive) { setBrief(b); setState('ready'); } })
      .catch(() => { if (alive) setState('offline'); });
    return () => { alive = false; };
  }, []);

  return (
    <motion.div
      data-panel="23"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <LineChart size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">The Analyst</span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-steel/50 uppercase ml-auto">daily brief</span>
      </div>

      {state === 'loading' && <div className="font-mono text-xs text-steel">reading the day…</div>}
      {state === 'offline' && <div className="font-mono text-xs text-steel">Brief offline — no API key wired on the server.</div>}
      {state === 'ready' && brief && (
        brief.raw ? (
          <div className="font-mono text-[12px] leading-relaxed text-bone whitespace-pre-wrap">{brief.raw}</div>
        ) : (
          <div className="flex flex-col gap-2.5 font-mono">
            {ROWS.map(([k, label]) => (
              brief[k] ? (
                <div key={k} className="flex gap-2.5">
                  <span className={'text-[9px] tracking-[0.18em] uppercase pt-0.5 w-12 shrink-0 ' + (k === 'broke' ? 'text-danger/70' : 'text-amber/55')}>{label}</span>
                  <span className="text-[12px] leading-relaxed text-bone flex-1">{brief[k]}</span>
                </div>
              ) : null
            ))}
          </div>
        )
      )}
    </motion.div>
  );
}
