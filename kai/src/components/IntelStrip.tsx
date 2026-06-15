import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Sun, Moon, Wind, Cloud, CloudRain, CloudFog, CloudLightning, CloudSnow } from 'lucide-react';
import { fetchWeather, fetchMarkets, WeatherSnap, MarketTick } from '../lib/external';
import { operator } from '../kaiConfig';
import FocusTile from './FocusTile';
import NewsTicker from './NewsTicker';
import MapTile from './MapTile';
import InsightsTile from './InsightsTile';
import HabitsTile from './HabitsTile';
import AgendaTile from './AgendaTile';

function iconForCode(code: number, isDay: boolean) {
  if ([0, 1].includes(code)) return isDay ? Sun : Moon;
  if ([2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return CloudRain;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  if ([71, 73, 75].includes(code)) return CloudSnow;
  return Cloud;
}

function Tile({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-md px-3 py-2.5 flex-1 min-w-[180px]"
    >
      {children}
    </motion.div>
  );
}

export default function IntelStrip({ delay = 0 }: { delay?: number }) {
  const [w, setW] = useState<WeatherSnap | null>(null);
  const [m, setM] = useState<MarketTick[]>([]);
  const [wErr, setWErr] = useState<string | null>(null);
  const [mErr, setMErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const loadW = () => fetchWeather(operator.lat, operator.lon)
      .then(s => { if (alive) { setW(s); setWErr(null); } })
      .catch(e => alive && setWErr(e.message));
    const loadM = () => fetchMarkets()
      .then(s => { if (alive) { setM(s); setMErr(null); } })
      .catch(e => alive && setMErr(e.message));
    loadW(); loadM();
    const tw = setInterval(loadW, 10 * 60_000);
    const tm = setInterval(loadM, 60_000);
    return () => { alive = false; clearInterval(tw); clearInterval(tm); };
  }, []);

  const WeatherIcon = w ? iconForCode(w.code, w.isDay) : Cloud;
  const localTime = new Date().toLocaleTimeString(operator.locale, {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: operator.timezone,
  });

  return (
    <div className="flex gap-3 flex-wrap">
      {/* Weather */}
      <Tile delay={delay}>
        <div className="flex items-center gap-2">
          <WeatherIcon size={16} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">{operator.cityLabel} · {localTime}</span>
        </div>
        {w ? (
          <div className="flex items-baseline gap-3 mt-1">
            <span className="font-mono text-amber text-xl tabular-nums">{Math.round(w.tempC)}°</span>
            <span className="text-bone text-[11px] capitalize">{w.label}</span>
            <span className="ml-auto font-mono text-[10px] text-steel flex items-center gap-1">
              <Wind size={10} /> {Math.round(w.wind)} km/h
            </span>
          </div>
        ) : wErr ? (
          <div className="font-mono text-[11px] text-danger/80">weather offline</div>
        ) : (
          <div className="font-mono text-[11px] text-steel">linking up…</div>
        )}
      </Tile>

      {/* Markets */}
      <Tile delay={delay + 0.05}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Markets · 24h</span>
          <span className="ml-auto font-mono text-[10px] text-steel">USD</span>
        </div>
        {m.length ? (
          <div className="flex items-baseline gap-4 mt-1 flex-wrap">
            {m.map(t => {
              const up = t.change24 >= 0;
              const Arr = up ? ArrowUp : ArrowDown;
              return (
                <div key={t.id} className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-bone text-[12px]">{t.symbol}</span>
                  <span className="text-amber text-[13px] tabular-nums">
                    {t.price >= 1000 ? t.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : t.price.toFixed(2)}
                  </span>
                  <span className={'flex items-center gap-0.5 text-[10px] ' + (up ? 'text-ok' : 'text-danger')}>
                    <Arr size={10} /> {Math.abs(t.change24).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : mErr ? (
          <div className="font-mono text-[11px] text-danger/80">markets offline</div>
        ) : (
          <div className="font-mono text-[11px] text-steel">linking up…</div>
        )}
      </Tile>

      {/* Focus / Pomodoro */}
      <FocusTile delay={delay + 0.10} />

      {/* AI-style insights */}
      <InsightsTile delay={delay + 0.15} />

      {/* Habit streaks */}
      <HabitsTile delay={delay + 0.20} />

      {/* Holdings map */}
      <MapTile delay={delay + 0.25} />

      {/* Agenda — next events + reminders */}
      <AgendaTile delay={delay + 0.30} />

      {/* KAI uptime */}
      <Tile delay={delay + 0.35}>
        <UptimeBlock />
      </Tile>
    </div>
  );
}

export function NewsRow() { return <NewsTicker />; }

function UptimeBlock() {
  const [boot] = useState<number>(() => {
    const raw = sessionStorage.getItem('kai.boot');
    if (raw) return parseInt(raw);
    const now = Date.now();
    sessionStorage.setItem('kai.boot', String(now));
    return now;
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.floor((now - boot) / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Session uptime</div>
      <div className="flex items-baseline gap-3 mt-1">
        <span className="font-mono text-amber text-xl tabular-nums">{hh}:{mm}:{ss}</span>
        <span className="font-mono text-[10px] text-steel ml-auto">core stable</span>
      </div>
    </div>
  );
}
