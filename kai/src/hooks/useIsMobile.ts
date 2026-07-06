import { useEffect, useState } from 'react';

/* True when the viewport is a phone (< 768px). Drives the Command
   view's mobile layout swap. SSR-safe and listener-cleaned. The
   breakpoint matches Tailwind's md- boundary so desktop chrome and
   the mobile river never both mount. */
export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia(query);
    const onChange = () => setIsMobile(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
