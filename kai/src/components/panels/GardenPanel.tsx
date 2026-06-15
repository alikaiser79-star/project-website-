import Panel from '../Panel';
import { useEffect, useState } from 'react';
import { Leaf, CalendarClock } from 'lucide-react';
import { garden, operator } from '../../kaiConfig';
import { useCounter } from '../../hooks/useCounter';

function countdownTo(iso: string) {
  const diff = +new Date(iso) - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0 };
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff / 3_600_000) % 24),
    m: Math.floor((diff / 60_000) % 60),
  };
}

export default function GardenPanel({ delay = 0 }: { delay?: number }) {
  const [cd, setCd] = useState(() => countdownTo(garden.nextEvent.when));
  useEffect(() => {
    const t = setInterval(() => setCd(countdownTo(garden.nextEvent.when)), 30_000);
    return () => clearInterval(t);
  }, []);
  const plants = useCounter(garden.plantCount, { duration: 1.6 });
  const species = useCounter(garden.speciesCount);

  return (
    <Panel num="03" title="Hidden Garden" tag="LIVE" delay={delay}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded border border-amber/15 p-3">
          <div className="flex items-center gap-2 text-amber/80 text-[10px] tracking-[0.22em] uppercase font-mono">
            <Leaf size={12} /> Plants
          </div>
          <div className="font-mono text-amber text-2xl tabular-nums drop-shadow-[0_0_8px_rgba(255,179,0,0.35)]">{plants}</div>
          <div className="font-mono text-steel text-[11px]">{species} species</div>
        </div>
        <div className="rounded border border-amber/15 p-3">
          <div className="flex items-center gap-2 text-cyan text-[10px] tracking-[0.22em] uppercase font-mono">
            <CalendarClock size={12} /> Next Event
          </div>
          <div className="font-mono text-bone text-sm leading-tight mt-1">{garden.nextEvent.title}</div>
          <div className="font-mono text-cyan text-[11px] tabular-nums">{cd.d}d · {cd.h}h · {cd.m}m</div>
        </div>
      </div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-steel mb-2">today’s tasks</div>
      <ul className="space-y-1.5 font-mono text-[12px] overflow-y-auto">
        {garden.todayTasks.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-bone">
            <span className="text-amber mt-1.5 w-1.5 h-1.5 rounded-full bg-amber shadow-[0_0_6px_rgba(255,179,0,0.6)] shrink-0" />
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2 text-[10px] font-mono text-steel">
        {new Date(garden.nextEvent.when).toLocaleString(operator.locale, { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: operator.timezone })}
      </div>
    </Panel>
  );
}
