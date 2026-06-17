import Panel from '../Panel';
import { useEffect, useState } from 'react';
import { AlertTriangle, Bed, Star } from 'lucide-react';
import { operator } from '../../kaiConfig';
import { useCounter } from '../../hooks/useCounter';
import { getMakadi } from '../../lib/store';
import type { MakadiState } from '../../types';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

export default function MakadiPanel({ delay = 0 }: { delay?: number }) {
  const [m, setM] = useState<MakadiState>(() => getMakadi());

  useEffect(() => {
    const sync = () => setM(getMakadi());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    const t = setInterval(sync, 4000);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      clearInterval(t);
    };
  }, []);

  const rate   = useCounter(Number(m?.nightlyRate) || 0, { duration: 1.6 });
  const occ    = useCounter((Number(m?.occupancy30d) || 0) * 100, { decimals: 0, duration: 1.6 });
  const rating = useCounter(Number(m?.rating) || 0, { decimals: 2, duration: 1.4 });
  const next   = m?.nextBooking ? new Date(m.nextBooking) : new Date(NaN);
  const nextLabel = Number.isNaN(+next)
    ? '—'
    : next.toLocaleDateString(operator.locale, { weekday: 'long', day: '2-digit', month: 'short' });

  return (
    <Panel num="04" title="Makadi Airbnb" tag="Short-term" delay={delay}>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel/65">Nightly</div>
          <div className="font-sans text-amber text-3xl font-extralight tabular-nums mt-1">
            {fmt(rate)}<span className="font-mono text-steel/65 text-xs ml-2">EGP</span>
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel/65">Occupancy · 30d</div>
          <div className="font-sans text-cyan/90 text-3xl font-extralight tabular-nums mt-1">{occ}<span className="text-base">%</span></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mt-6 pt-5 border-t border-white/[0.04]">
        <div>
          <div className="flex items-center gap-2 text-steel/65 text-[10px] tracking-[0.18em] uppercase font-mono">
            <Bed size={11} /> Next booking
          </div>
          <div className="font-sans text-bone/90 text-[14px] mt-1.5 truncate">{nextLabel}</div>
        </div>
        <div>
          <div className="flex items-center gap-2 text-steel/65 text-[10px] tracking-[0.18em] uppercase font-mono">
            <Star size={11} /> Rating
          </div>
          <div className="font-sans text-bone/90 text-2xl font-light tabular-nums mt-1">{rating}</div>
        </div>
      </div>
      {m?.fixLock && (
        <div className="mt-5 flex items-center gap-3 p-3 rounded border border-danger/30 bg-danger/[0.05]">
          <AlertTriangle size={14} className="text-danger/90 shrink-0" />
          <div className="text-[13px] text-bone/85 leading-snug">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-danger/85 mb-0.5">Flag</div>
            Door lock needs repair — book locksmith.
          </div>
        </div>
      )}
    </Panel>
  );
}
