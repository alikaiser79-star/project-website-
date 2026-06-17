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

  /* Per-status pill — always show when calendar isn't OK so empty
     and broken look different. Hidden only when status === 'ok'. */
  const calStatus = (() => {
    if (cal.status === 'ok') return null;
    if (cal.status === 'idle') return null;        /* before first fetch */
    if (cal.status === 'no-key') {
      return { label: 'CAL · NOT CONFIGURED', cls: 'text-amber2/90 border border-amber2/40' };
    }
    if (cal.status === 'fetch-error') {
      return { label: 'CAL · OFFLINE', cls: 'text-danger/90 border border-danger/40' };
    }
    if (cal.status === 'parse-error') {
      return { label: 'CAL · PARSE ERROR', cls: 'text-danger/90 border border-danger/40' };
    }
    if (cal.status.startsWith('http-')) {
      return { label: 'CAL · ' + cal.status.toUpperCase(), cls: 'text-danger/90 border border-danger/40' };
    }
    return { label: 'CAL · ' + cal.status.toUpperCase(), cls: 'text-danger/90 border border-danger/40' };
  })();

  /* Empty-state copy — distinguish three reasons no calendar items
     are listed. */
  const emptyCopy = (() => {
    if (items.length > 0) return null;
    if (cal.status === 'no-key') {
      return 'No upcoming items. Calendar isn’t configured on the server (GOOGLE_CALENDAR_ICAL_URL).';
    }
    if (cal.status === 'fetch-error' || cal.status === 'parse-error' || cal.status.startsWith('http-')) {
      return 'No upcoming items. Calendar is offline; showing local agenda only.';
    }
    if (cal.status === 'idle') return 'Loading…';
    return 'Calendar clear.';
  })();

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg px-4 py-4"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays size={13} className="text-steel/70" />
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel/65">Agenda · next</span>
        <span className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {calStatus && (
            <span
              className={'font-mono text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded ' + calStatus.cls}
              title={cal.message || cal.status}
            >
              {calStatus.label}
            </span>
          )}
          <span className="font-mono text-[10px] text-steel/55">
            {items.length} item{items.length === 1 ? '' : 's'}
          </span>
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {items.length === 0 && emptyCopy && (
          <li className="font-mono text-[11px] text-steel/55">{emptyCopy}</li>
        )}
        {items.map((i, n) => {
          const days = Math.ceil((+i.when - Date.now()) / 86_400_000);
          const rel  = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d`;
          const color =
            i.tone === 'warn'   ? 'text-amber2/85' :
            i.tone === 'makadi' ? 'text-cyan/85'   :
            i.tone === 'garden' ? 'text-amber/85'  :
            /* cal */             'text-ok/85';
          return (
            <li key={n} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 font-mono text-[11.5px]">
              <span className={'tracking-[0.14em] uppercase text-[10px] ' + color}>{i.tag}</span>
              <span className="text-bone/85 truncate">{i.label}</span>
              <span className="text-steel/55 tabular-nums text-[11px]">
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
