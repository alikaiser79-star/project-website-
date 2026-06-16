import Panel from '../Panel';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { debt, operator } from '../../kaiConfig';
import { loadState, saveState } from '../../lib/store';
import { useCounter } from '../../hooks/useCounter';
import { celebrate } from '../../lib/celebrate';
import Sparkline from '../Sparkline';
import { withBackfill, trend } from '../../lib/history';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

export default function DebtPanel({ delay = 0 }: { delay?: number }) {
  const [current, setCurrent] = useState(() => loadState().debtCurrent);
  useEffect(() => {
    const s = loadState();
    const wasNonZero = s.debtCurrent > 0;
    s.debtCurrent = current; saveState(s);
    if (wasNonZero && current === 0) celebrate();
  }, [current]);

  const cleared = Math.max(0, debt.original - current);
  const pct = Math.min(100, (cleared / debt.original) * 100);
  const animPct = useCounter(pct, { decimals: 1, duration: 1.6 });
  const animCleared = useCounter(cleared, { duration: 1.6 });

  const r = 70;
  const C = 2 * Math.PI * r;
  const dash = (animPct / 100) * C;

  return (
    <Panel num="02" title="Credit Paydown" tag={debt.label} delay={delay}>
      <div className="flex items-center gap-6 h-full">
        <div className="relative shrink-0">
          <svg viewBox="0 0 180 180" width="180" height="180">
            <defs>
              <linearGradient id="dg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%"  stopColor="#FFB300" />
                <stop offset="100%" stopColor="#FFC94A" />
              </linearGradient>
              <filter id="dglow"><feGaussianBlur stdDeviation="3" /></filter>
            </defs>
            <circle cx="90" cy="90" r={r} stroke="rgba(255,179,0,0.10)" strokeWidth="6" fill="none" />
            <motion.circle
              cx="90" cy="90" r={r}
              stroke="url(#dg)"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              transform="rotate(-90 90 90)"
              filter="url(#dglow)"
            />
            <text x="90" y="86" textAnchor="middle" fill="#FFB300" fontFamily="JetBrains Mono" fontSize="26" fontWeight="500">
              {animPct.toFixed(1)}%
            </text>
            <text x="90" y="106" textAnchor="middle" fill="#7C8794" fontFamily="JetBrains Mono" fontSize="10" letterSpacing="2">
              CLEARED
            </text>
          </svg>
        </div>
        <div className="flex-1 space-y-3 font-mono text-sm">
          <div>
            <div className="text-[10px] tracking-[0.22em] text-steel uppercase">balance</div>
            <div className="text-bone text-lg tabular-nums">{fmt(current)} <span className="text-amber/70 text-xs">EGP</span></div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.22em] text-steel uppercase">cleared</div>
            <div className="text-amber text-lg tabular-nums drop-shadow-[0_0_6px_rgba(255,179,0,0.4)]">
              {fmt(animCleared)} <span className="text-amber/70 text-xs">EGP</span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setCurrent(c => Math.max(0, c - 2000))}
              className="px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase border border-amber/40 hover:border-amber hover:bg-amber/10 text-amber"
            >−2k</button>
            <button
              onClick={() => setCurrent(c => Math.max(0, c - 5000))}
              className="px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase border border-amber/40 hover:border-amber hover:bg-amber/10 text-amber"
            >−5k</button>
            <button
              onClick={() => setCurrent(debt.current)}
              className="px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase border border-amber/15 text-steel hover:text-amber hover:border-amber/40"
            >reset</button>
          </div>
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel">14d trend</span>
              {(() => {
                const t = trend('debt', 14);
                const up = t.delta > 0;
                return (
                  <span className={'font-mono text-[10px] tabular-nums ' + (up ? 'text-danger' : 'text-ok')}>
                    {up ? '+' : ''}{Math.round(t.delta).toLocaleString('en-GB')} EGP
                  </span>
                );
              })()}
            </div>
            <Sparkline
              values={withBackfill(14).map(s => s.debt)}
              width={200} height={28} color="#FFB300" invert
            />
          </div>
          <div className="text-[10px] text-steel pt-2 leading-relaxed">
            target zero · min payment {fmt(debt.minPayment)} EGP · APR {debt.apr}%
          </div>
        </div>
      </div>
    </Panel>
  );
}
