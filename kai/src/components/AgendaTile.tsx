import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { operator } from '../kaiConfig';
import { getGarden, getMakadi } from '../lib/store';
import { listReminders } from '../lib/reminders';

type Item = { when: Date; label: string; tag: string; tone: 'amber' | 'cyan' | 'warn' };

export default function AgendaTile({ delay = 0 }: { delay?: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const g = getGarden(); const m = getMakadi();
    const gEv = new Date(g.nextEvent.when);
    if (!Number.isNaN(+gEv)) out.push({ when: gEv, label: g.nextEvent.title, tag: 'GARDEN', tone: 'amber' });
    const mNext = new Date(m.nextBooking);
    if (!Number.isNaN(+mNext)) out.push({ when: mNext, label: 'Makadi check-in', tag: 'MAKADI', tone: 'cyan' });
    for (const r of listReminders()) {
      out.push({ when: new Date(r.at), label: r.text, tag: 'REMIND', tone: 'warn' });
    }
    const now = Date.now();
    return out
      .filter(i => +i.when > now - 60_000)
      .sort((a, b) => +a.when - +b.when)
      .slice(0, 4);
  }, []);

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-md px-3 py-2.5 flex-1 min-w-[280px]"
    >
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Agenda · next</span>
        <span className="ml-auto font-mono text-[10px] text-steel">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="mt-1 space-y-1">
        {items.length === 0 && (
          <li className="font-mono text-[11px] text-steel">Calendar clear.</li>
        )}
        {items.map((i, n) => {
          const days = Math.ceil((+i.when - Date.now()) / 86_400_000);
          const rel = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d`;
          const color =
            i.tone === 'warn' ? 'text-amber2' :
            i.tone === 'cyan' ? 'text-cyan'   :
            'text-amber';
          return (
            <li key={n} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-2 font-mono text-[11.5px]">
              <span className={'tracking-[0.14em] uppercase ' + color}>{i.tag}</span>
              <span className="text-bone truncate">{i.label}</span>
              <span className="text-steel tabular-nums">
                {i.when.toLocaleDateString(operator.locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: operator.timezone })} · {rel}
              </span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
