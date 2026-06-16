import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export function useCounter(target: number, opts: { decimals?: number; duration?: number; delay?: number } = {}) {
  const { decimals = 0, duration = 1.2, delay = 0 } = opts;
  const [val, setVal] = useState(0);
  const ref = useRef({ v: 0 });
  useEffect(() => {
    const t = gsap.to(ref.current, {
      v: target,
      duration,
      delay,
      ease: 'power3.out',
      onUpdate: () => setVal(Number(ref.current.v.toFixed(decimals))),
    });
    return () => { t.kill(); };
  }, [target, decimals, duration, delay]);
  return val;
}
