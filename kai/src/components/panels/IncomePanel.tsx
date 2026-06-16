import Panel from '../Panel';
import { useState, useEffect } from 'react';
import { useCounter } from '../../hooks/useCounter';
import { monthlyTotalEGP, currency, operator } from '../../kaiConfig';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { loadState } from '../../lib/store';
import type { IncomeOverride } from '../../types';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

function Row({ s }: { s: IncomeOverride }) {
  const v = useCounter(s.amount, { duration: 1.4 });
  const trend = s.trend ?? 0;
  const Arrow = trend > 0.3 ? ArrowUpRight : trend < -0.3 ? ArrowDownRight : Minus;
  const trendColor = trend > 0.3 ? 'text-ok' : trend < -0.3 ? 'text-danger' : 'text-steel';
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-2.5 border-b border-amber/10 last:border-0">
      <div>
        <div className="text-bone text-sm">{s.label}</div>
        <div className="font-mono text-[10px] text-steel tracking-wide">{s.note}</div>
      </div>
      <div className="font-mono text-amber text-[15px] tabular-nums drop-shadow-[0_0_6px_rgba(255,179,0,0.3)]">
        {fmt(v)}<span className="text-amber/60 text-[11px] ml-1">{s.ccy}{s.cadence === 'nightly' ? '/n' : ''}</span>
      </div>
      <div className={'flex items-center gap-1 font-mono text-[11px] ' + trendColor}>
        <Arrow size={12} /> {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
      </div>
    </div>
  );
}

export default function IncomePanel({ delay = 0 }: { delay?: number }) {
  const [streams, setStreams] = useState<IncomeOverride[]>(() => loadState().income);
  /* Refresh from store on visibility — picks up edits made in the
     settings drawer without needing a global event bus. */
  useEffect(() => {
    const sync = () => setStreams(loadState().income);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    const t = setInterval(sync, 4000);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      clearInterval(t);
    };
  }, []);

  const total = monthlyTotalEGP(streams);
  const animatedTotal = useCounter(total, { duration: 1.8 });
  const eur = total / currency.egpPerEur;

  return (
    <Panel num="01" title="Income Streams" tag="MONTHLY" delay={delay}>
      <div className="mb-3 pb-3 border-b border-amber/15">
        <div className="font-mono text-[10px] tracking-[0.2em] text-steel uppercase">projected total</div>
        <div className="flex items-baseline gap-3">
          <div className="font-mono text-amber text-[28px] leading-none tabular-nums drop-shadow-[0_0_12px_rgba(255,179,0,0.45)]">
            {fmt(animatedTotal)}
          </div>
          <span className="font-mono text-amber/70 text-[12px]">EGP</span>
          <span className="font-mono text-steel text-[11px] ml-auto">≈ €{fmt(eur)}</span>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {streams.map(s => <Row key={s.id} s={s} />)}
      </div>
    </Panel>
  );
}
