import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain } from 'lucide-react';
import { computeInsights } from '../lib/insights';

export default function InsightsTile({ delay = 0 }: { delay?: number }) {
  const items = useMemo(() => computeInsights(), []);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setI(x => (x + 1) % items.length), 5200);
    return () => clearInterval(t);
  }, [items.length]);

  const cur = items[i];
  const dotColor =
    cur?.tone === 'ok' ? '#7AE6A8' :
    cur?.tone === 'warn' ? '#FFB300' :
    '#5FE3FF';

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg px-4 py-4"
    >
      <div className="flex items-center gap-2">
        <Brain size={14} className="text-amber/85" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Insight · KAI</span>
        <span className="ml-auto flex items-center gap-1">
          {items.map((_, idx) => (
            <span
              key={idx}
              className={'w-1 h-1 rounded-full transition ' + (idx === i ? 'bg-amber' : 'bg-amber/25')}
            />
          ))}
        </span>
      </div>

      <div className="mt-1 min-h-[34px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={cur?.id || 'none'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32 }}
            className="text-bone text-[12.5px] leading-snug flex items-center gap-2"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
            />
            {cur?.text ?? '—'}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
