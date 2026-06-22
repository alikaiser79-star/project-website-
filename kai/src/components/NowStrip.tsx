/* ============================================================
   NowStrip — the cockpit sidebar on the Command view.

   Quiet card that sits next to the orb and answers "what's
   the state of things right now" in one glance. Each row is a
   single number with a one-line label. Tap a row to jump to
   the panel that owns it (ping-panel action).

   Live via useKaiVersion.
   ============================================================ */

import { motion } from 'framer-motion';
import { Wallet, ShieldCheck, Crown as CrownIcon, Users, ListChecks, Eye } from 'lucide-react';
import { useKaiVersion } from '../lib/kai/mirror';
import { mirrorScore } from '../lib/kai/commitments';
import { computeRunway } from '../lib/kai/runway';
import { listPeople, reliabilityFor } from '../lib/kai/ledger';
import { liveBeats } from '../lib/kai/crown';
import { getWatchtower } from '../lib/kai/watchtower';
import { loadState } from '../lib/store';
import { emitAction } from '../lib/actions';
import { sfx } from '../lib/sound';

interface Row {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'danger' | 'neutral';
  Icon: any;
  panel?: string;
}

export default function NowStrip() {
  useKaiVersion();

  const rows: Row[] = [];

  /* Mirror */
  const ms = mirrorScore();
  rows.push({
    label: 'Mirror · 30d',
    value: ms.score === null ? '—' : `${ms.score}%`,
    tone: ms.score === null ? 'neutral' : ms.score >= 80 ? 'good' : ms.score >= 50 ? 'warn' : 'danger',
    Icon: ShieldCheck,
    panel: '09',
  });

  /* Tollgate */
  const r = computeRunway();
  rows.push({
    label: 'Runway',
    value: r.runwayDays === null ? 'set up' : `${Math.floor(r.runwayDays)}d`,
    tone: r.runwayDays === null ? 'neutral'
        : r.runwayDays < 7  ? 'danger'
        : r.runwayDays < 14 ? 'warn'
        : 'good',
    Icon: Wallet,
    panel: '10',
  });

  /* Open priorities */
  const open = (loadState().priorities || []).filter(p => !p.done).length;
  rows.push({
    label: 'Open priorities',
    value: String(open),
    tone: open === 0 ? 'good' : open >= 5 ? 'warn' : 'neutral',
    Icon: ListChecks,
    panel: '06',
  });

  /* Ledger — worst reliability */
  const people = listPeople();
  let worst: { name: string; score: number } | null = null;
  for (const p of people) {
    const rel = reliabilityFor(p.id);
    if (rel.score === null) continue;
    if (!worst || rel.score < worst.score) worst = { name: p.name, score: rel.score };
  }
  if (worst) {
    rows.push({
      label: `Ledger · ${worst.name.slice(0, 12)}`,
      value: `${worst.score}%`,
      tone: worst.score >= 80 ? 'good' : worst.score >= 50 ? 'warn' : 'danger',
      Icon: Users,
      panel: '11',
    });
  }

  /* Crown new beats */
  const newBeats = liveBeats().filter(b => b.status === 'new').length;
  if (newBeats > 0) {
    rows.push({
      label: 'Legend · new',
      value: String(newBeats),
      tone: 'good',
      Icon: CrownIcon,
      panel: '12',
    });
  }

  /* Watchtower */
  const alerts = getWatchtower().alerts.length;
  rows.push({
    label: 'Watchtower',
    value: alerts === 0 ? 'quiet' : `${alerts} alert${alerts === 1 ? '' : 's'}`,
    tone: alerts === 0 ? 'good' : 'warn',
    Icon: Eye,
    panel: '18',
  });

  function jump(panel?: string) {
    if (!panel) return;
    sfx.click();
    emitAction({ type: 'ping-panel', panel });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.2, duration: 0.6 } }}
      className="glass rounded-lg px-4 py-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Now</span>
        <span className="font-mono text-[9.5px] text-steel/60 ml-auto">{nowLabel()}</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.label + i}>
            <button
              onClick={() => jump(r.panel)}
              disabled={!r.panel}
              className="group w-full flex items-center gap-2 px-2.5 py-1.5 rounded border border-amber/10 hover:border-amber/35 transition disabled:cursor-default disabled:hover:border-amber/10 text-left"
            >
              <r.Icon size={11} className={
                'shrink-0 ' +
                (r.tone === 'good' ? 'text-emerald'
                 : r.tone === 'warn' ? 'text-amber'
                 : r.tone === 'danger' ? 'text-danger'
                 : 'text-steel/85')
              } />
              <span className="font-sans text-bone/90 text-[12px] truncate flex-1 min-w-0">{r.label}</span>
              <span className={
                'font-mono text-[12px] tabular-nums shrink-0 ' +
                (r.tone === 'good' ? 'text-emerald'
                 : r.tone === 'warn' ? 'text-amber'
                 : r.tone === 'danger' ? 'text-danger'
                 : 'text-bone/95')
              }>
                {r.value}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function nowLabel(): string {
  try {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
