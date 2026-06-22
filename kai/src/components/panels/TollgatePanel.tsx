/* ============================================================
   The Tollgate — runway in days of freedom.

   Hero: days of runway (red under 14). Sub: liquid cash ÷
   daily burn. Payday cushion line when the calendar has one.

   Reactive to the Spine via useKaiVersion so logging an
   expense (which fires expense_logged) re-prices the runway
   live. Boot-from-empty: no burn → "set cash / log spend"
   nudge instead of Infinity.
   ============================================================ */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Pencil, Coins } from 'lucide-react';
import Panel from '../Panel';
import { useKaiVersion } from '../../lib/kai/mirror';
import { computeRunway, paydayCushion } from '../../lib/kai/runway';
import { getLiquidCash, setLiquidCash } from '../../lib/store';
import { operator } from '../../kaiConfig';
import { sfx } from '../../lib/sound';
import { toast } from '../../hooks/useToasts';

function fmtEgp(n: number) {
  return Math.round(n).toLocaleString(operator.locale) + ' EGP';
}

export default function TollgatePanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();                       // re-render when the Spine changes
  const r = computeRunway();
  const pc = paydayCushion();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function openEdit() {
    setDraft(String(getLiquidCash() || ''));
    setEditing(true);
  }
  function saveCash() {
    const n = parseFloat(draft.replace(/[, ]/g, ''));
    if (!Number.isFinite(n) || n < 0) { toast.err('Enter a number ≥ 0.'); return; }
    setLiquidCash(n);
    setEditing(false);
    sfx.confirm();
    toast.ok(`Liquid cash set to ${fmtEgp(n)}.`, 'TOLLGATE', 2600);
  }

  const days = r.runwayDays;
  const low = days !== null && days < 14;
  const heroColor =
    days === null ? 'text-steel' :
    days < 7  ? 'text-danger' :
    days < 14 ? 'text-amber' :
    'text-emerald';

  return (
    <Panel num="10" title="The Tollgate" tag={days === null ? 'set up' : `${Math.floor(days)}d free`} delay={delay}>
      <div className="space-y-5">

        {/* Hero — days of freedom */}
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-1">days of freedom</div>
          {days === null ? (
            <div className="font-sans text-steel text-[22px] leading-tight">
              No burn signal yet
            </div>
          ) : (
            <div className={'font-sans tabular-nums leading-none text-[40px] sm:text-[46px] ' + heroColor}>
              {Math.floor(days)}<span className="text-[20px] text-steel/70"> days</span>
            </div>
          )}
          <div className="font-mono text-[10px] tracking-[0.06em] text-steel/70 mt-1.5">
            {fmtEgp(r.liquidCash)} liquid ÷ {fmtEgp(r.dailyBurn)}/day
            {r.sampleCount > 0 ? ` · ${r.sampleCount} spends/30d` : ' · no spends logged'}
          </div>
        </div>

        {low && (
          <div className="px-3 py-2 border border-danger/30 rounded bg-danger/[0.05] text-danger text-[11.5px] leading-relaxed">
            Under two weeks of runway. Every discretionary spend now costs real freedom.
          </div>
        )}

        {/* Payday cushion */}
        {pc && (
          <div className="flex items-center gap-2 px-3 py-2 border border-amber/15 rounded">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel">{pdLabel(pc.payday)}</span>
            <span className={
              'ml-auto font-mono text-[11px] tabular-nums ' +
              (pc.cushionDays >= 0 ? 'text-emerald' : 'text-danger')
            }>
              {pc.cushionDays >= 0
                ? `+${Math.round(pc.cushionDays)}d cushion`
                : `${Math.round(pc.cushionDays)}d short`}
            </span>
          </div>
        )}

        {/* Liquid-cash editor */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Coins size={11} className="text-amber/75" />
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">liquid cash</span>
            {!editing && (
              <button onClick={openEdit} className="ml-auto text-steel hover:text-amber p-1" title="Set cash on hand">
                <Pencil size={11} />
              </button>
            )}
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value.replace(/[^\d., ]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') saveCash(); if (e.key === 'Escape') setEditing(false); }}
                inputMode="decimal"
                placeholder="cash on hand, EGP"
                className="flex-1 bg-transparent border border-amber/20 focus:border-amber rounded px-2.5 py-1.5 text-bone tabular-nums text-[13px] outline-none"
              />
              <button onClick={saveCash} className="px-2 py-1.5 border border-amber text-amber rounded hover:bg-amber/10" title="Save">
                <Check size={12} />
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-sans text-bone/90 text-[15px] tabular-nums"
            >
              {getLiquidCash() > 0 ? fmtEgp(getLiquidCash()) : <span className="text-steel text-[13px]">tap the pencil to set cash on hand</span>}
            </motion.div>
          )}
          <p className="mt-1.5 font-mono text-[9.5px] text-steel/60 leading-relaxed">
            Runway = cash + remaining monthly income, divided by your 30-day burn.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function pdLabel(ms: number): string {
  try {
    return 'Next payday · ' + new Date(ms).toLocaleDateString(operator.locale, { day: 'numeric', month: 'short' });
  } catch { return 'Next payday'; }
}
