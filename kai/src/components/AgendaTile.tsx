import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { operator } from '../kaiConfig';
import { getGarden, getMakadi } from '../lib/store';
import { listReminders } from '../lib/reminders';
import {
  fetchCalendar, getCalendarCached, onCalendarUpdate,
  type CalResult,
} from '../lib/calendar';

type Item = {
  when: Date;
  label: string;
  tag: string;
  tone: 'cal' | 'garden' | 'makadi' | 'warn';
};

export default function AgendaTile({ delay = 0 }: { delay?: number }) {
  const [tick, setTick] = useState(0);
  const [cal, setCal]   = useState<CalResult>(() => getCalendarCached());

  useEffect(() => {
    const ti = setInterval(() => setTick(x => x + 1), 60_000);
    fetchCalendar().catch(() => {});
    const off = onCalendarUpdate(setCal);
    const onFocus = () => { fetchCalendar().catch(() => {}); };
    window.addEventListener('focus', onFocus);
    const re = setInterval(() => { fetchCalendar().catch(() => {}); }, 5 * 60_000);
    return () => {
      clearInterval(ti); clearInterval(re); off();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];

    /* 1 — Real Google Calendar events take priority. */
    for (const e of cal.events ?? []) {
      const w = new Date(e.start);
      if (!Number.isNaN(+w)) out.push({ when: w, label: e.title, tag: 'CAL', tone: 'cal' });
    }
    /* 2 — Garden + Makadi from the live store, if their dates parse. */
    try {
      const g = getGarden();
      if (g?.nextEvent?.when && g?.nextEvent?.title) {
        const d = new Date(g.nextEvent.when);
        if (!Number.isNaN(+d)) out.push({ when: d, label: g.nextEvent.title, tag: 'GARDEN', tone: 'garden' });
      }
      const m = getMakadi();
      if (m?.nextBooking) {
        const d = new Date(m.nextBooking);
        if (!Number.isNaN(+d)) out.push({ when: d, label: 'Makadi check-in', tag: 'MAKADI', tone: 'makadi' });
      }
    } catch {}
    /* 3 — Pending reminders. */
    try {
      for (const r of listReminders()) {
        const d = new Date(r.at);
        if (!Number.isNaN(+d)) out.push({ when: d, label: r.text, tag: 'REMIND', tone: 'warn' });
      }
    } catch {}

    const now = Date.now();
    return out
      .filter(i => +i.when > now - 60_000)
      .sort((a, b) => +a.when - +b.when)
      .slice(0, 6);
    /* tick keeps countdowns live; cal triggers on calendar refresh. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, cal]);

  /* Tiny status pill — visible only when something needs attention. */
  const statusPill =
    cal.status === 'fetch-error' || cal.status === 'parse-error'
      ? <span className="font-mono text-[9px] text-danger/70 tracking-[0.16em] uppercase">cal · offline</span>
      : null;

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-md px-3 py-2.5 flex-1 min-w-[280px]"
    >
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Agenda · next</span>
        <span className="ml-auto flex items-center gap-2">
          {statusPill}
          <span className="font-mono text-[10px] text-steel">
            {items.length} item{items.length === 1 ? '' : 's'}
          </span>
        </span>
      </div>
      <ul className="mt-1 space-y-1">
        {items.length === 0 && (
          <li className="font-mono text-[11px] text-steel">Calendar clear.</li>
        )}
        {items.map((i, n) => {
          const days = Math.ceil((+i.when - Date.now()) / 86_400_000);
          const rel  = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d`;
          const color =
            i.tone === 'warn'   ? 'text-amber2' :
            i.tone === 'makadi' ? 'text-cyan'   :
            i.tone === 'garden' ? 'text-amber'  :
            /* cal */             'text-ok';
          return (
            <li key={n} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-2 font-mono text-[11.5px]">
              <span className={'tracking-[0.14em] uppercase ' + color}>{i.tag}</span>
              <span className="text-bone truncate">{i.label}</span>
              <span className="text-steel tabular-nums">
                {i.when.toLocaleDateString(operator.locale, {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  timeZone: operator.timezone,
                })} · {rel}
              </span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
