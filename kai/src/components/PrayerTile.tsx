import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon } from 'lucide-react';
import { fetchPrayer, PrayerSnap } from '../lib/external';
import { operator } from '../kaiConfig';

const SHORT: Record<string, string> = {
  Fajr: 'Fajr', Sunrise: 'Sunr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Magh', Isha: 'Isha',
};

export default function PrayerTile({ delay = 0 }: { delay?: number }) {
  const [snap, setSnap] = useState<PrayerSnap | null>(null);
  const [err, setErr]   = useState<string | null>(null);
  const [now, setNow]   = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const load = () => fetchPrayer(operator.lat, operator.lon)
      .then(s => { if (alive) { setSnap(s); setErr(null); } })
      .catch(e => alive && setErr(e.message));
    load();
    const t = setInterval(load, 60 * 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-md px-3 py-2.5 flex-1 min-w-[260px]"
    >
      <div className="flex items-center gap-2">
        <Moon size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Prayer · {operator.cityLabel}</span>
        {snap && (
          <span className="ml-auto font-mono text-[10px] text-amber">
            next · {snap.nextName} {snap.nextAt.toLocaleTimeString(operator.locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {snap ? (
        <>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {Object.entries(snap.byName).map(([k, v]) => {
              const isNext = k === snap.nextName;
              return (
                <div
                  key={k}
                  className={'flex flex-col items-center px-2 py-1 rounded border text-[10px] font-mono ' +
                    (isNext
                      ? 'border-amber bg-amber/10 text-amber shadow-glow-amber'
                      : 'border-amber/15 text-bone')}
                >
                  <span className="tracking-[0.12em] uppercase opacity-80">{SHORT[k] || k}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 font-mono text-[10px] text-steel">
            {(() => {
              const mins = Math.max(0, Math.round((+snap.nextAt - now) / 60_000));
              if (mins < 60) return `in ${mins} min`;
              return `in ${Math.floor(mins/60)}h ${mins % 60}m`;
            })()}
          </div>
        </>
      ) : err ? (
        <div className="font-mono text-[11px] text-danger/80 mt-1">prayer offline</div>
      ) : (
        <div className="font-mono text-[11px] text-steel mt-1">linking up…</div>
      )}
    </motion.div>
  );
}
