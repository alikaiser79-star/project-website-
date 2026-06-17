import Panel from '../Panel';
import { useEffect, useState } from 'react';
import { Leaf, CalendarClock } from 'lucide-react';
import { operator } from '../../kaiConfig';
import { useCounter } from '../../hooks/useCounter';
import { getGarden } from '../../lib/store';
import type { GardenState } from '../../types';

function countdownTo(iso: string) {
  const diff = +new Date(iso) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return { d: 0, h: 0, m: 0 };
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff / 3_600_000) % 24),
    m: Math.floor((diff / 60_000) % 60),
  };
}

export default function GardenPanel({ delay = 0 }: { delay?: number }) {
  const [g, setG] = useState<GardenState>(() => getGarden());

  /* Live sync — same polling/visibility pattern as IncomePanel. */
  useEffect(() => {
    const sync = () => setG(getGarden());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    const t = setInterval(sync, 4000);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      clearInterval(t);
    };
  }, []);

  const eventWhen = g?.nextEvent?.when ?? '';
  const [cd, setCd] = useState(() => countdownTo(eventWhen));
  useEffect(() => {
    setCd(countdownTo(eventWhen));
    const t = setInterval(() => setCd(countdownTo(eventWhen)), 30_000);
    return () => clearInterval(t);
  }, [eventWhen]);

  const plants  = useCounter(Number(g?.plantCount)   || 0, { duration: 1.6 });
  const species = useCounter(Number(g?.speciesCount) || 0);
  const evDate  = new Date(eventWhen);
  const evLabel = Number.isNaN(+evDate)
    ? '—'
    : evDate.toLocaleString(operator.locale, {
        weekday: 'long', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', timeZone: operator.timezone,
      });
  const tasks = Array.isArray(g?.todayTasks) ? g.todayTasks : [];

  return (
    <Panel num="03" title="Hidden Garden" tag="Live" delay={delay}>
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div>
          <div className="flex items-center gap-2 text-steel/65 text-[10px] tracking-[0.18em] uppercase font-mono">
            <Leaf size={11} /> Plants
          </div>
          <div className="font-sans text-amber text-3xl font-extralight tabular-nums mt-1">{plants}</div>
          <div className="font-mono text-steel/60 text-[11px] mt-0.5">{species} species</div>
        </div>
        <div>
          <div className="flex items-center gap-2 text-steel/65 text-[10px] tracking-[0.18em] uppercase font-mono">
            <CalendarClock size={11} /> Next event
          </div>
          <div className="font-sans text-bone text-[15px] leading-tight mt-1.5 truncate">{g?.nextEvent?.title || '—'}</div>
          <div className="font-mono text-cyan/85 text-[11px] tabular-nums mt-0.5">{cd.d}d · {cd.h}h · {cd.m}m</div>
        </div>
      </div>
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel/65 mb-3">Today’s tasks</div>
      <ul className="space-y-2 text-[13px] text-bone/85">
        {tasks.length === 0 && (
          <li className="font-mono text-steel/55 text-[12px]">No tasks set. Edit in Settings → Garden.</li>
        )}
        {tasks.map((t, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-[7px] w-1 h-1 rounded-full bg-amber/85 shrink-0" />
            <span className="truncate">{t}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 pt-4 border-t border-white/[0.04] text-[10px] font-mono text-steel/55">{evLabel}</div>
    </Panel>
  );
}
