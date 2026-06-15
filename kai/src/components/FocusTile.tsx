import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Timer } from 'lucide-react';
import { focusTimer, FocusState } from '../lib/focusTimer';

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function FocusTile({ delay = 0 }: { delay?: number }) {
  const [s, setS] = useState<FocusState>(focusTimer.get());
  const [now, setNow] = useState(Date.now());

  useEffect(() => focusTimer.subscribe(setS), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const left = s.running ? Math.max(0, s.endAt - now) : s.totalMs;
  const totalMs = s.totalMs;
  const pct = totalMs > 0 ? (1 - left / totalMs) * 100 : 0;
  const mins = Math.floor(left / 60_000);
  const secs = Math.floor((left / 1000) % 60);

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-md px-3 py-2.5 flex-1 min-w-[200px]"
    >
      <div className="flex items-center gap-2">
        <Timer size={14} className={s.running ? 'text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)] animate-pulse-soft' : 'text-amber/70'} />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">
          Focus · {s.kind === 'focus' ? 'work' : 'break'}
        </span>
        <span className="ml-auto flex gap-1">
          {!s.running ? (
            <>
              <button
                onClick={() => focusTimer.start(25, 'focus')}
                className="text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 border border-amber/30 hover:border-amber text-amber rounded"
              >25</button>
              <button
                onClick={() => focusTimer.start(5, 'break')}
                className="text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 border border-cyan/30 hover:border-cyan text-cyan rounded"
              >5b</button>
              <button
                onClick={() => focusTimer.start(50, 'focus')}
                className="text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 border border-amber/30 hover:border-amber text-amber rounded"
              >50</button>
            </>
          ) : (
            <button
              onClick={() => focusTimer.stop()}
              className="text-[10px] tracking-[0.16em] uppercase px-2 py-0.5 border border-danger/40 hover:border-danger text-danger rounded flex items-center gap-1"
            >
              <Pause size={10} /> stop
            </button>
          )}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-mono text-amber text-xl tabular-nums">
          {pad(mins)}:{pad(secs)}
        </span>
        <span className="font-mono text-[10px] text-steel">
          {s.running ? 'running' : 'idle'}
        </span>
        {!s.running && (
          <Play size={12} className="text-amber/50 ml-auto" />
        )}
      </div>

      <div className="mt-2 h-[3px] bg-ink2 border border-amber/15 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber/40 to-amber shadow-glow-amber transition-all"
          style={{ width: pct + '%' }}
        />
      </div>
    </motion.div>
  );
}
