import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { sfx } from '../lib/sound';
import { operator } from '../kaiConfig';

const lines = [
  '[BOOT]  cortex link · handshake established',
  '[OK]    INITIALIZING KAI...',
  `[OK]    LOADING ${operator.name.toUpperCase()}’S SYSTEMS...`,
  '[OK]    FINANCE LEDGER: ONLINE',
  '[OK]    HIDDEN GARDEN: ONLINE',
  '[OK]    MAKADI AIRBNB: ONLINE',
  '[OK]    INSTAGRAM MONITOR: ONLINE',
  '[OK]    PRIORITY ENGINE: READY',
  '[OK]    SPEECH SYNTHESIS: ENGAGED',
  '[KAI]   ALL SYSTEMS NOMINAL',
];

export default function Boot({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState<string[]>([]);
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    sfx.boot();
    let i = 0;
    const tick = () => {
      if (i >= lines.length) {
        setPct(100);
        gsap.to({ p: 0 }, { p: 1, duration: 0.5, onComplete: () => {
          setDone(true);
          setTimeout(onDone, 450);
        }});
        return;
      }
      setShown(s => [...s, lines[i]]);
      i++;
      setPct(Math.round((i / lines.length) * 100));
      const t = 180 + Math.random() * 220;
      setTimeout(tick, t);
    };
    setTimeout(tick, 300);
  }, [onDone]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="boot"
          className="fixed inset-0 z-[200] bg-ink grid place-items-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.55, ease: [0.25,0.46,0.45,0.94] } }}
          onClick={() => { setDone(true); setTimeout(onDone, 350); }}
        >
          <div className="w-[min(720px,90vw)] font-mono">
            <div className="flex items-baseline gap-4 pb-3 border-b border-amber/20 mb-5">
              <span className="text-amber text-3xl animate-pulse-soft drop-shadow-[0_0_18px_rgba(255,179,0,0.7)]">◊</span>
              <h1 className="text-2xl tracking-[0.32em] text-bone font-sans">KAI</h1>
              <span className="ml-auto text-[10px] tracking-[0.3em] text-steel uppercase">v3.2.1 — command core</span>
            </div>

            <div className="h-[260px] overflow-hidden text-amber/85 text-[13px] leading-relaxed">
              {shown.map((l, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={l.startsWith('[KAI]') ? 'text-amber font-bold' : l.startsWith('[OK]') ? 'text-ok' : 'text-amber/60'}
                >
                  {l}
                </motion.div>
              ))}
              <span className="text-amber inline-block animate-pulse-soft">▍</span>
            </div>

            <div className="mt-6 h-[3px] bg-ink2 border border-amber/20 overflow-hidden">
              <motion.div
                animate={{ width: pct + '%' }}
                transition={{ duration: 0.25 }}
                className="h-full bg-gradient-to-r from-amber/40 to-amber shadow-glow-amber"
              />
            </div>

            <div className="mt-2 flex justify-between text-[10px] tracking-[0.25em] uppercase text-steel">
              <span>von kaiser systems</span>
              <span className="text-amber">{pct}%</span>
              <span>click to skip</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
