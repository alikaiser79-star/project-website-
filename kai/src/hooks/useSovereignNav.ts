import { useEffect, useRef } from 'react';
import { VIEWS, type ViewKey } from '../components/ViewNav';
import { sfx } from '../lib/sound';

/* ============================================================
   Sovereign navigation — walk the five views with a horizontal
   swipe (touch) or the Arrow keys (desktop), wrapping around.

   Guards so the gesture never fights normal use:
   - Arrow keys ignored while typing in an input/textarea/select or
     a contenteditable, or when a modifier is held.
   - Swipes ignored if they start on an interactive control, inside a
     [role=dialog], or inside any [data-noswipe] region, and must be a
     decisive, dominantly-horizontal flick (so vertical scroll wins).
   ============================================================ */

interface Opts { view: ViewKey; setView: (v: ViewKey) => void; enabled?: boolean; }

const NOSWIPE = 'input, textarea, select, button, a, [role="dialog"], [contenteditable="true"], [data-noswipe]';

export function useSovereignNav({ view, setView, enabled = true }: Opts) {
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (!enabled) return;

    const step = (dir: 1 | -1) => {
      const list = VIEWS.map(v => v.key);
      const i = list.indexOf(viewRef.current);
      if (i < 0) return;
      const next = list[(i + dir + list.length) % list.length];
      if (next !== viewRef.current) { sfx.whoosh(); setView(next); }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest(NOSWIPE)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };

    let sx = 0, sy = 0, tracking = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { tracking = false; return; }
      const t = e.target as HTMLElement | null;
      if (t && t.closest(NOSWIPE)) { tracking = false; return; }
      tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      /* decisive + dominantly horizontal */
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.7) step(dx < 0 ? 1 : -1);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [enabled, setView]);
}
