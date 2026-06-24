/* ============================================================
   Cinematic panel.

   Replaces the dated mono "01 · 02 · 03" prefix with:
   - A short vertical accent stripe on the left edge, colour-coded
     to the view this panel lives on. The stripe carries a soft
     glow so panels feel physically anchored to their view.
   - A subtle top-edge accent gradient (4 px hairline) that picks
     up the same colour — so each card has its own light source.
   - A more elegant title in extralight, with letter-spacing
     pulled tighter.
   - The tag becomes a quiet capsule pill instead of bare mono
     text.
   - Optional `live` prop drops a breathing dot next to the title
     for panels showing real-time data.

   No layout change — same data-panel hook, same padding.
   ============================================================ */

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

type Props = {
  num: string;
  title: string;
  tag?: string;
  delay?: number;
  children: ReactNode;
  className?: string;
  /* When true, a breathing dot next to the title signals "live". */
  live?: boolean;
};

/* Panel num → accent (rgb triple + hex). Mirrors VIEW_ACCENT so
   the colour temperature is consistent: panels on the Money view
   glow emerald, panels on Growth glow violet, etc. Defaults to
   amber for any future panel we add without registering. */
const PANEL_ACCENT: Record<string, { hex: string; rgb: string }> = {
  /* Command */
  '17': { hex: '#FFB300', rgb: '255,179,0'   },
  '09': { hex: '#FFB300', rgb: '255,179,0'   },
  '06': { hex: '#FFB300', rgb: '255,179,0'   },
  '18': { hex: '#FFB300', rgb: '255,179,0'   },
  /* Money */
  '10': { hex: '#7AE6A8', rgb: '122,230,168' },
  '01': { hex: '#7AE6A8', rgb: '122,230,168' },
  '02': { hex: '#7AE6A8', rgb: '122,230,168' },
  '07': { hex: '#7AE6A8', rgb: '122,230,168' },
  /* Growth */
  '12': { hex: '#C792EA', rgb: '199,146,234' },
  '08': { hex: '#C792EA', rgb: '199,146,234' },
  '05': { hex: '#C792EA', rgb: '199,146,234' },
  '15': { hex: '#C792EA', rgb: '199,146,234' },
  '19': { hex: '#C792EA', rgb: '199,146,234' },
  /* Operations */
  '03': { hex: '#FFC94A', rgb: '255,201,74'  },
  '04': { hex: '#FFC94A', rgb: '255,201,74'  },
  '11': { hex: '#FFC94A', rgb: '255,201,74'  },
  /* Comms */
  '13': { hex: '#7FCBFF', rgb: '127,203,255' },
  '14': { hex: '#7FCBFF', rgb: '127,203,255' },
  '16': { hex: '#7FCBFF', rgb: '127,203,255' },
  '20': { hex: '#7FCBFF', rgb: '127,203,255' },
  '21': { hex: '#7FCBFF', rgb: '127,203,255' },
};

const DEFAULT = { hex: '#FFB300', rgb: '255,179,0' };

export default function Panel({
  num, title, tag, delay = 0, children, className = '', live = false,
}: Props) {
  const a = PANEL_ACCENT[num] || DEFAULT;

  return (
    <motion.section
      data-panel={num}
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] } }}
      className={'glass rounded-lg p-5 sm:p-6 relative overflow-hidden ' + className}
    >
      {/* Top-edge accent hairline — each card has its own light source.
          Sits inside .glass overflow-hidden so corners stay clean. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${a.rgb},0.7), transparent)`,
        }}
      />
      {/* Full-height left accent rail — strong, glowing, undeniable. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-3 bottom-3 w-[3px] rounded-r-sm"
        style={{
          background: a.hex,
          boxShadow:  `0 0 12px rgba(${a.rgb},0.65), 0 0 3px rgba(${a.rgb},0.95)`,
        }}
      />

      <header className="flex items-baseline gap-3 mb-5 relative">

        {/* Title — extralight, tighter tracking, refined. */}
        <h3
          className="font-sans text-bone text-[15.5px] font-light tracking-tight flex-1 truncate"
          style={{ letterSpacing: '-0.005em' }}
        >
          {title}
        </h3>

        {/* Live indicator — breathing dot for real-time panels. */}
        {live && (
          <span
            aria-hidden
            className="relative shrink-0 inline-flex items-center"
            title="live"
          >
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: a.hex, opacity: 0.5 }}
            />
            <span
              className="relative w-1.5 h-1.5 rounded-full"
              style={{ background: a.hex, boxShadow: `0 0 6px ${a.hex}` }}
            />
          </span>
        )}

        {/* Tag — refined capsule, tinted to the accent. */}
        {tag && (
          <span
            className="font-mono text-[9.5px] tracking-[0.16em] uppercase px-2 py-0.5 rounded-full border bg-ink2/40 shrink-0"
            style={{
              color: a.hex,
              borderColor: `rgba(${a.rgb}, 0.25)`,
            }}
          >
            {tag}
          </span>
        )}
      </header>

      <div className="min-w-0">{children}</div>
    </motion.section>
  );
}
