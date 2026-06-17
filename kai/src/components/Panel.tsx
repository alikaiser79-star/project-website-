import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { sfx } from '../lib/sound';

type Props = {
  num: string;
  title: string;
  tag?: string;
  delay?: number;
  children: ReactNode;
  className?: string;
};

export default function Panel({ num, title, tag, delay = 0, children, className = '' }: Props) {
  return (
    <motion.section
      data-panel={num}
      initial={{ y: 20, opacity: 0, scale: 0.985 }}
      animate={{ y: 0, opacity: 1, scale: 1, transition: { delay, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } }}
      onMouseEnter={() => sfx.hover()}
      className={'glass rounded-md p-3 sm:p-4 flex flex-col ' + className}
    >
      <header className="flex items-center gap-3 pb-2 mb-2 sm:pb-3 sm:mb-3 border-b border-amber/10">
        <span className="font-mono text-[10px] tracking-[0.18em] text-amber border border-amber/40 px-1.5 py-0.5">{num}</span>
        <h3 className="font-sans text-bone text-[14px] sm:text-[15px] font-medium tracking-wide flex-1 truncate">{title}</h3>
        {tag && (
          <span className="font-mono text-[10px] tracking-[0.18em] text-amber/80 uppercase">{tag}</span>
        )}
      </header>
      <div className="min-w-0">{children}</div>
    </motion.section>
  );
}
