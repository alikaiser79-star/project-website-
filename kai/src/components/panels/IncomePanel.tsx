import Panel from '../Panel';
import { useState, useEffect } from 'react';
import { useCounter } from '../../hooks/useCounter';
import { monthlyTotalEGP, operator } from '../../kaiConfig';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { loadState } from '../../lib/store';
import type { IncomeOverride } from '../../types';
import Sparkline from '../Sparkline';
import { seriesFor, trend } from '../../lib/history';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

function Row({ s }: { s: IncomeOverride }) {
  const v = useCounter(s.amount, { duration: 1.4 });
  const trend = s.trend ?? 0;
  const Arrow = trend > 0.3 ? ArrowUpRight : trend < -0.3 ? ArrowDownRight : Minus;
  const trendColor = trend > 0.3 ? 'text-ok/85' : trend < -0.3 ? 'text-danger/85' : 'text-steel/70';
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-3 border-b border-white/[0.04] last:border-0">
      <div className="min-w-0">
        <div className="text-bone/90 text-sm truncate">{s.label}</div>
        <div className="font-mono text-[10px] text-steel/70 mt-0.5 truncate">{s.note}</div>
      </div>
      <div className="font-mono text-bone/90 text-[14px] tabular-nums">
        {fmt(v)}<span className="text-steel/65 text-[11px] ml-1">{s.ccy}{s.cadence === 'nightly' ? '/n' : ''}</span>
      </div>
      <div className={'flex items-center gap-1 font-mono text-[11px] tabular-nums ' + trendColor}>
        <Arrow size={11} /> {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
      </div>
    </div>
  );
}

export default function IncomePanel({ delay = 0 }: { delay?: number }) {
  const [streams, setStreams] = useState<IncomeOverride[]>(() => loadState().income);
  const [fx, setFx] = useState<number>(() => loadState().fxEgpPerEur);
  /* Refresh from store on visibility — picks up edits made in the
     settings drawer without needing a global event bus. */
  useEffect(() => {
    const sync = () => {
      const s = loadState();
      setStreams(s.income);
      setFx(s.fxEgpPerEur);
    };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    const t = setInterval(sync, 4000);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      clearInterval(t);
    };
  }, []);

  const total = monthlyTotalEGP(streams, fx);
  const animatedTotal = useCounter(total, { duration: 1.8 });
  const eur = total / fx;
  const incomeSeries = seriesFor('incomeMonthly', 14);
  const incomeTrend = trend('incomeMonthly', 14);

  return (
    <Panel num="01" title="Income" tag="Monthly" delay={delay}>
      <div className="mb-5 pb-5 border-b border-white/[0.05]">
        <div className="font-mono text-[10px] tracking-[0.18em] text-steel/65 uppercase">Projected total</div>
        <div className="flex items-baseline gap-3 mt-2">
          <div className="font-sans text-amber text-4xl sm:text-[42px] leading-none font-extralight tabular-nums">
            {fmt(animatedTotal)}
          </div>
          <span className="font-mono text-steel/70 text-xs">EGP</span>
          <span className="font-mono text-steel/55 text-[11px] ml-auto tabular-nums">≈ €{fmt(eur)}</span>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Sparkline values={incomeSeries} width={140} height={20} color="#FFB300" />
          {incomeTrend && (
            <span className={'font-mono text-[10px] tabular-nums ml-auto ' + (incomeTrend.delta >= 0 ? 'text-ok/85' : 'text-danger/85')}>
              {incomeTrend.delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(incomeTrend.pct)).toFixed(0)}% · {incomeTrend.samples}d
            </span>
          )}
        </div>
      </div>
      <div>
        {streams.map(s => <Row key={s.id} s={s} />)}
      </div>
    </Panel>
  );
}
