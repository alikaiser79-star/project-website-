/* ============================================================
   ViewHeader — the orientation strip at the top of each view.

   Title + hint (the rail tells you where you are; this confirms
   it) + a small row of contextual metric chips so each view
   answers its own central question without a scroll. The chips
   are derived live from the existing Spine + stores — no new
   data.
   ============================================================ */

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface ViewChip {
  label: string;
  value: string | number;
  tone?: 'good' | 'warn' | 'danger' | 'neutral' | 'accent';
  Icon?: LucideIcon;
}

const TONE: Record<NonNullable<ViewChip['tone']>, string> = {
  good:    'border-emerald/35 text-emerald',
  warn:    'border-amber/40   text-amber',
  danger:  'border-danger/45  text-danger',
  neutral: 'border-amber/15   text-bone/85',
  accent:  'border-cyan/35    text-cyan',
};

export default function ViewHeader({
  title, hint, chips,
}: { title: string; hint: string; chips: ViewChip[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 px-1">
      <h2 className="font-sans text-bone text-lg font-light tracking-tight">{title}</h2>
      <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-steel/60">{hint}</span>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {chips.map((c, i) => (
            <motion.span
              key={c.label + i}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 * i }}
              className={
                'flex items-center gap-1.5 px-2 py-0.5 rounded-full border bg-ink2/40 ' +
                'font-mono text-[10px] tracking-[0.08em] ' +
                TONE[c.tone || 'neutral']
              }
            >
              {c.Icon && <c.Icon size={9} />}
              <span className="opacity-65 uppercase tracking-[0.16em] text-[9px]">{c.label}</span>
              <span className="tabular-nums">{c.value}</span>
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}
