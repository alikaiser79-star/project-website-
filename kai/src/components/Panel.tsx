import { motion } from 'framer-motion';
import { ReactNode } from 'react';

type Props = {
  num: string;
  title: string;
  tag?: string;
  delay?: number;
  children: ReactNode;
  className?: string;
};

/* Calm card. No corner brackets, no border glow, no hover transform.
   Just a quiet surface with a near-invisible border and generous
   internal padding. The panel num is plain text — not a chip. */
export default function Panel({ num, title, tag, delay = 0, children, className = '' }: Props) {
  return (
    <motion.section
      data-panel={num}
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] } }}
      className={'glass rounded-lg p-5 sm:p-6 ' + className}
    >
      <header className="flex items-baseline gap-3 mb-5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-steel/55">{num}</span>
        <h3 className="font-sans text-bone text-[15px] font-medium tracking-tight flex-1 truncate">{title}</h3>
        {tag && (
          <span className="font-mono text-[9px] tracking-[0.18em] text-steel/55 uppercase">{tag}</span>
        )}
      </header>
      <div className="min-w-0">{children}</div>
    </motion.section>
  );
}
