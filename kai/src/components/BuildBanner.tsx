/* ============================================================
   BuildBanner — undeniable, time-limited "what build is this"
   indicator. Pops once per build (keyed on __BUILD_ID__), sits
   top-centre for 5 s, then fades out and never shows again
   until a new build replaces it.

   Purpose: when "nothing changed" complaints come in, the user
   can see at-a-glance whether they're on a fresh bundle or a
   cached one — without scrolling to the footer or opening
   devtools.
   ============================================================ */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

const SEEN_KEY = 'kai.build.seen';

export default function BuildBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      if (seen === __BUILD_ID__) return;          // already shown for this build
      setShow(true);
      const t = setTimeout(() => setShow(false), 5500);
      try { localStorage.setItem(SEEN_KEY, __BUILD_ID__); } catch { /* ignore */ }
      return () => clearTimeout(t);
    } catch { /* ignore */ }
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
          /* Centred with margin-inline, NOT with -translate-x-1/2.
             Framer Motion writes `transform` inline to run the y/scale
             animation, which overrides the Tailwind translate class — so the
             banner stayed at left:50% at full width and pushed the page
             563px wide on a 375px screen. Every mobile view scrolled
             sideways because of the build banner. */
          className="fixed top-3 z-[90] glass rounded-full pl-3 pr-2 py-1.5 flex items-center gap-2 border border-amber/55"
          style={{
            left: 0, right: 0, marginInline: 'auto', width: 'max-content', maxWidth: '92vw',
            boxShadow: '0 0 22px rgba(255,179,0,0.30), 0 0 4px rgba(255,179,0,0.6)',
          }}
        >
          <Sparkles size={12} className="text-amber" />
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-amber">
            new build · {__BUILD_ID__}
          </span>
          <button
            onClick={() => setShow(false)}
            className="text-amber/70 hover:text-amber p-0.5"
            aria-label="Dismiss"
          >
            <X size={11} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
