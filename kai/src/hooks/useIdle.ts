import { useEffect, useState } from 'react';

/* Fire `idle = true` after `ms` of no mouse/key activity. */
export function useIdle(ms = 5 * 60_000) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer: number;
    const reset = () => {
      if (idle) setIdle(false);
      clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), ms);
    };
    reset();
    const events: (keyof DocumentEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'];
    events.forEach(e => document.addEventListener(e, reset, { passive: true }));
    return () => {
      events.forEach(e => document.removeEventListener(e, reset));
      clearTimeout(timer);
    };
  }, [ms, idle]);

  return idle;
}
