import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle, AlertOctagon, Sparkles } from 'lucide-react';
import { useToasts, dismissToast, Toast } from '../hooks/useToasts';

const palette: Record<Toast['level'], { border: string; text: string; glow: string; Icon: typeof Sparkles }> = {
  ok:   { border: 'border-amber/60',  text: 'text-amber',  glow: 'shadow-glow-amber', Icon: Sparkles },
  warn: { border: 'border-amber2/60', text: 'text-amber2', glow: 'shadow-glow-amber', Icon: AlertTriangle },
  err:  { border: 'border-danger/70', text: 'text-danger', glow: 'shadow-[0_0_18px_rgba(255,92,92,0.45)]', Icon: AlertOctagon },
};

export default function ToastStack() {
  const arr = useToasts();
  return (
    <div className="fixed top-[80px] right-4 z-[400] flex flex-col gap-2 max-w-[320px] pointer-events-none">
      <AnimatePresence initial={false}>
        {arr.map(t => {
          const p = palette[t.level];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.22 } }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
              onClick={() => dismissToast(t.id)}
              className={`glass pointer-events-auto px-3 py-2.5 rounded-md grid grid-cols-[auto_1fr_auto] items-start gap-2.5 ${p.border} ${p.glow} cursor-pointer`}
            >
              <p.Icon size={14} className={p.text + ' mt-0.5'} />
              <div>
                <div className={'font-mono text-[10px] tracking-[0.2em] uppercase ' + p.text}>{t.title}</div>
                <div className="text-bone text-[12px] leading-snug">{t.body}</div>
              </div>
              <X size={12} className="text-steel hover:text-bone mt-0.5" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
