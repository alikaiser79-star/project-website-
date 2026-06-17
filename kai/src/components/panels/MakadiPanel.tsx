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
    <Panel num="04" title="Makadi Airbnb" tag="STR" delay={delay}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">nightly</div>
          <div className="font-mono text-amber text-2xl tabular-nums drop-shadow-[0_0_8px_rgba(255,179,0,0.35)]">{fmt(rate)}<span className="text-amber/60 text-xs ml-1">EGP</span></div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">occupancy · 30d</div>
          <div className="font-mono text-cyan text-2xl tabular-nums">{occ}%</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="rounded border border-amber/15 p-3">
          <div className="flex items-center gap-2 text-amber/80 text-[10px] tracking-[0.22em] uppercase font-mono">
            <Bed size={12} /> Next Booking
          </div>
          <div className="font-mono text-bone text-sm mt-1">{nextLabel}</div>
        </div>
        <div className="rounded border border-amber/15 p-3">
          <div className="flex items-center gap-2 text-amber/80 text-[10px] tracking-[0.22em] uppercase font-mono">
            <Star size={12} /> Rating
          </div>
          <div className="font-mono text-amber text-xl tabular-nums">{rating}</div>
        </div>
      </div>
      {m?.fixLock && (
        <div className="mt-4 flex items-center gap-2 p-3 border border-danger/40 bg-danger/5 rounded">
          <AlertTriangle size={16} className="text-danger shrink-0" />
          <div className="text-[12px] text-bone">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-danger">flag</div>
            Door lock needs repair — book locksmith.
          </div>
        </div>
      )}
    </Panel>
  );
}
