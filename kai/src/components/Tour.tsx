import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X, Sparkles } from 'lucide-react';
import { sfx } from '../lib/sound';

type Step = {
  selector: string;
  title: string;
  body: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

/* Highlights a real DOM node and floats a description card next to it.
   Falls back gracefully when a selector misses (orb, intel-strip tiles
   can be off-screen at small widths). */
const STEPS: Step[] = [
  { selector: '.kai-core-wrap',
    title: 'The KAI Core',
    body: 'KAI’s presence. It pulses when commands run, distorts when speaking, and lights up in real time when listening.' },
  { selector: '[data-panel="01"]',
    title: 'Income, debt, garden, makadi…',
    body: 'Six glass panels report on your operations. Each counter animates with GSAP and persists state where it matters.',
    side: 'right' },
  { selector: '#tour-cmdk',
    title: '⌘K — Command bar',
    body: 'Type a command or ask a question. Built-ins answer instantly; Claude responds in streamed sentences if a key is wired.',
    side: 'left' },
  { selector: '#tour-voice',
    title: 'Voice (V)',
    body: 'Speech recognition + replies. Toggle wake-word in settings to only respond to "Hey KAI".',
    side: 'left' },
  { selector: '#tour-spotlight',
    title: '⌘/ — Spotlight',
    body: 'Search across priorities, journal, habits, history, reminders and commands. Enter runs the result.' },
  { selector: '.intel-strip-anchor',
    title: 'Live intel strip',
    body: 'Weather, markets, focus timer, insights, habits, holdings map, agenda, goals — all live, all glanceable.',
    side: 'top' },
];

type Props = { open: boolean; onClose: () => void };

export default function Tour({ open, onClose }: Props) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = STEPS[i];

  useEffect(() => {
    if (!open) return;
    function measure() {
      const el = document.querySelector(step.selector);
      if (el) setRect(el.getBoundingClientRect());
      else setRect(null);
    }
    measure();
    const ro = new ResizeObserver(measure);
    document.body && ro.observe(document.body);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [open, i, step.selector]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function next() {
    sfx.click();
    if (i < STEPS.length - 1) setI(i + 1);
    else { sfx.confirm(); onClose(); }
  }
  function prev() {
    sfx.click();
    setI(Math.max(0, i - 1));
  }

  if (!open) return null;

  const PAD = 10;
  const hl = rect
    ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  // Place card next to highlight, clamped to viewport.
  const card = (() => {
    if (!hl) return { left: 24, top: 24 };
    const W = 320, H = 130;
    const side = step.side ?? 'bottom';
    let left = hl.left + hl.width / 2 - W / 2;
    let top = hl.top + hl.height + 12;
    if (side === 'top')    { top = hl.top - H - 12; }
    if (side === 'left')   { left = hl.left - W - 12; top = hl.top + hl.height / 2 - H / 2; }
    if (side === 'right')  { left = hl.left + hl.width + 12; top = hl.top + hl.height / 2 - H / 2; }
    left = Math.max(12, Math.min(window.innerWidth  - W - 12, left));
    top  = Math.max(12, Math.min(window.innerHeight - H - 12, top));
    return { left, top };
  })();

  return (
    <AnimatePresence>
      <motion.div
        key="tour-bg"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[460] pointer-events-auto"
        onClick={onClose}
      >
        {/* Dim everything except the highlighted rect */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <mask id="tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {hl && (
                <rect
                  x={hl.left} y={hl.top}
                  width={hl.width} height={hl.height}
                  rx="6" ry="6" fill="black"
                />
              )}
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(7,10,15,0.78)" mask="url(#tour-mask)" />
        </svg>

        {/* Glowing border ring around the highlight */}
        {hl && (
          <motion.div
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute pointer-events-none rounded-md"
            style={{
              left: hl.left, top: hl.top, width: hl.width, height: hl.height,
              border: '1px solid #FFB300',
              boxShadow: '0 0 0 4px rgba(255,179,0,0.18), 0 0 24px rgba(255,179,0,0.45)',
            }}
          />
        )}

        {/* Description card */}
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="glass absolute rounded-md w-[320px] p-4 z-[461]"
          style={{ left: card.left, top: card.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Tour · {i + 1}/{STEPS.length}</span>
            <button onClick={onClose} className="ml-auto text-steel hover:text-amber"><X size={12} /></button>
          </div>
          <div className="font-sans text-bone text-[14px] font-medium">{step.title}</div>
          <div className="font-mono text-[11.5px] text-steel mt-1 leading-relaxed">{step.body}</div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={prev}
              disabled={i === 0}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel hover:text-amber disabled:opacity-30 disabled:hover:text-steel"
            >back</button>
            <span className="ml-auto flex gap-1.5">
              {STEPS.map((_, n) => (
                <span key={n} className={'w-1 h-1 rounded-full ' + (n === i ? 'bg-amber' : 'bg-amber/30')} />
              ))}
            </span>
            <button
              onClick={next}
              className="ml-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 border border-amber text-amber rounded hover:bg-amber/10"
            >
              {i === STEPS.length - 1 ? 'Done' : 'Next'} <ArrowRight size={10} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
