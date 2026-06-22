import Panel from '../Panel';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { debt, operator } from '../../kaiConfig';
import { loadState, saveState, applyDebtPayment } from '../../lib/store';
import { useCounter } from '../../hooks/useCounter';
import { celebrate } from '../../lib/celebrate';
import Sparkline from '../Sparkline';
import { seriesFor, trend } from '../../lib/history';
import { toast } from '../../hooks/useToasts';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

export default function DebtPanel({ delay = 0 }: { delay?: number }) {
  const [current, setCurrent] = useState(() => loadState().debtCurrent);

  /* Quick-pay: actual card payment. Fires Spine events so the
     Mirror can resolve "pay down to X" commitments. */
  function pay(amount: number) {
    const wasNonZero = current > 0;
    const next = applyDebtPayment(amount);
    setCurrent(next);
    toast.ok(`-${fmt(amount)} EGP applied. Balance ${fmt(next)} EGP.`, 'DEBT', 3200);
    if (wasNonZero && next === 0) celebrate();
  }

  /* Reset is a UI undo, NOT a payment — no Spine event. */
  function reset() {
    const s = loadState();
    s.debtCurrent = debt.current;
    saveState(s);
    setCurrent(debt.current);
  }

  const cleared = Math.max(0, debt.original - current);
  const pct = Math.min(100, (cleared / debt.original) * 100);
  const animPct = useCounter(pct, { decimals: 1, duration: 1.6 });
  const animCleared = useCounter(cleared, { duration: 1.6 });

  const r = 70;
  const C = 2 * Math.PI * r;
  const dash = (animPct / 100) * C;

  return (
    <Panel num="02" title="Credit Paydown" tag={debt.label} delay={delay}>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative shrink-0">
          <svg viewBox="0 0 180 180" width="160" height="160">
            <defs>
              <linearGradient id="dg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%"  stopColor="#FFB300" />
                <stop offset="100%" stopColor="#FFC94A" />
              </linearGradient>
            </defs>
            <circle cx="90" cy="90" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="5" fill="none" />
            <motion.circle
              cx="90" cy="90" r={r}
              stroke="url(#dg)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              transform="rotate(-90 90 90)"
            />
            <text x="90" y="86" textAnchor="middle" fill="#FFB300" fontFamily="Inter, system-ui, sans-serif" fontSize="30" fontWeight="200" letterSpacing="-1">
              {animPct.toFixed(0)}%
            </text>
            <text x="90" y="108" textAnchor="middle" fill="#7C8794" fontFamily="JetBrains Mono" fontSize="9" letterSpacing="3">
              CLEARED
            </text>
          </svg>
        </div>
        <div className="flex-1 w-full space-y-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-steel/65 uppercase">Balance</div>
            <div className="font-sans text-bone text-2xl font-extralight tabular-nums mt-1">
              {fmt(current)} <span className="font-mono text-steel/70 text-xs">EGP</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-steel/65 uppercase">Cleared</div>
            <div className="font-sans text-bone/85 text-lg font-light tabular-nums mt-1">
              {fmt(animCleared)} <span className="font-mono text-steel/70 text-xs">EGP</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => pay(2000)}
              className="px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase rounded border border-white/[0.08] text-bone/80 hover:border-white/15 hover:text-bone transition"
            >−2k</button>
            <button
              onClick={() => pay(5000)}
              className="px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase rounded border border-white/[0.08] text-bone/80 hover:border-white/15 hover:text-bone transition"
            >−5k</button>
            <button
              onClick={reset}
              className="px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase rounded text-steel/60 hover:text-bone/80 transition"
            >reset</button>
          </div>
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel/65">Trend</span>
              {(() => {
                const t = trend('debt', 14);
                if (!t) return <span className="font-mono text-[10px] text-steel/55">—</span>;
                const up = t.delta > 0;
                return (
                  <span className={'font-mono text-[10px] tabular-nums ' + (up ? 'text-danger/80' : 'text-ok/85')}>
                    {up ? '+' : ''}{Math.round(t.delta).toLocaleString('en-GB')} EGP · {t.samples}d
                  </span>
                );
              })()}
            </div>
            <Sparkline values={seriesFor('debt', 14)} width={200} height={22} color="#FFB300" invert />
          </div>
          <div className="font-mono text-[10px] text-steel/55 leading-relaxed">
            target zero · min {fmt(debt.minPayment)} EGP · APR {debt.apr}%
          </div>
        </div>
      </div>
    </Panel>
  );
}
