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
  neutral: 'border-white/[0.08] text-bone/85',
  accent:  'border-cyan/35    text-cyan',
};

interface Props {
  title: string;
  hint: string;
  chips: ViewChip[];
  /* Optional accent — the per-view colour. When set, the title
     gets a soft underline glow and the hint a thin accent dot. */
  accent?: { hex: string; rgb: string };
  /* Optional hero metric — one big number that anchors the view. */
  hero?: { label: string; value: string; sub?: string };
}

export default function ViewHeader({ title, hint, chips, accent, hero }: Props) {
  return (
    <div className="flex flex-col gap-3 px-1">
      {/* Heading row */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2
          className="font-sans text-bone text-2xl sm:text-[28px] font-extralight tracking-tight relative"
          style={accent ? {
            textShadow: `0 0 22px rgba(${accent.rgb}, 0.18)`,
          } : undefined}
        >
          {title}
          {accent && (
            <span
              aria-hidden
              className="absolute left-0 -bottom-1 h-[2px] w-10"
              style={{
                background: `linear-gradient(90deg, ${accent.hex}, transparent)`,
                boxShadow:  `0 0 12px rgba(${accent.rgb}, 0.5)`,
              }}
            />
          )}
        </h2>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-steel/65">
          {accent && (
            <span
              aria-hidden
              className="w-1 h-1 rounded-full"
              style={{ background: accent.hex, boxShadow: `0 0 6px ${accent.hex}` }}
            />
          )}
          {hint}
        </span>

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

      {/* Optional hero metric — one number anchors the view. */}
      {hero && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.05 }}
          className="flex items-baseline gap-3"
        >
          <div className="flex flex-col">
            <span className="font-mono text-[9.5px] tracking-[0.24em] uppercase text-steel/60">
              {hero.label}
            </span>
            <span
              className="font-sans text-bone tabular-nums leading-none"
              style={{
                fontSize: 'clamp(40px, 8vw, 64px)',
                fontWeight: 200,
                letterSpacing: '-0.02em',
                color: accent?.hex,
                textShadow: accent ? `0 0 32px rgba(${accent.rgb}, 0.28)` : undefined,
              }}
            >
              {hero.value}
            </span>
          </div>
          {hero.sub && (
            <span className="font-mono text-[11px] text-steel/75 leading-tight max-w-[260px]">
              {hero.sub}
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
}
