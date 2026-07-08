/* ============================================================
   PULL TO REFRESH (§13.4) — mobile. Pull down at the top of any view
   and the core's HEARTBEAT is the spinner (not a generic ring). On
   release past the threshold it re-pulls the Spine (emit → every panel
   re-reads) with a light haptic. Passive-friendly: only engages when
   the page is already scrolled to the top and the drag is downward, so
   normal scrolling is never captured.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { emit } from '../lib/kai/store';

const THRESHOLD = 72;   // px pull to trigger
const MAX = 110;

export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { start.current = null; return; }
      /* only arm at the very top, and not inside a scrollable drawer. */
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-noswipe], .ask-kai, .wc-sheet, .eye-sheet, .garten-sheet')) { start.current = null; return; }
      start.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current == null || refreshing) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0) { setPull(0); return; }
      setPull(Math.min(MAX, dy * 0.5));   // rubber-band
    };
    const onEnd = () => {
      if (start.current == null) return;
      if (pull >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        try { (navigator as any).vibrate?.(12); } catch { /* ignore */ }
        try { emit(); } catch { /* ignore */ }
        setTimeout(() => { setRefreshing(false); setPull(0); }, 900);
      } else {
        setPull(0);
      }
      start.current = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [pull, refreshing]);

  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= THRESHOLD || refreshing;

  return (
    <div className="ptr" style={{ transform: `translateY(${refreshing ? 26 : pull * 0.5}px)`, opacity: Math.min(1, pull / 40 || 1) }} aria-hidden>
      <svg className={'ptr-heart' + (ready ? ' beating' : '')} width="26" height="24" viewBox="0 0 26 24">
        <path d="M13 22 L3 12 A5.5 5.5 0 0 1 13 5 A5.5 5.5 0 0 1 23 12 Z" />
      </svg>
    </div>
  );
}
