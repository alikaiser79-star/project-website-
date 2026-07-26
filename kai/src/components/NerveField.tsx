/* ============================================================
   §23.2 THE NERVE FIELD — the body's reaction, visible from ANY view.
   When a nerve fires (a real event landing), the screen edges pulse in the
   event's tone and a small chip names it, then fades. So a booking landing
   while you're on Money still registers as a gold surge; a broken commitment
   jolts crimson. Purely reactive, pointer-events-none, self-clearing.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { onNerve, type Nerve } from '../lib/kai/nervousSystem';

interface Flash extends Nerve { id: number }

const TONE_RGB: Record<Nerve['tone'], string> = {
  gold: '255, 190, 80',
  crimson: '255, 80, 60',
  blue: '120, 180, 255',
  green: '120, 220, 150',
};

export default function NerveField() {
  const [flash, setFlash] = useState<Flash | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    const off = onNerve((n) => {
      const id = ++idRef.current;
      setFlash({ ...n, id });
      /* clear after the animation; a newer nerve replaces it immediately. */
      const t = setTimeout(() => setFlash((cur) => (cur && cur.id === id ? null : cur)), 1500);
      return () => clearTimeout(t);
    });
    return off;
  }, []);

  if (!flash) return null;
  const rgb = TONE_RGB[flash.tone];
  const peak = 0.16 + flash.intensity * 0.34;   // stronger events glow harder

  return (
    <div className="nerve-field" aria-hidden key={flash.id}>
      <div
        className="nerve-glow"
        style={{
          // @ts-expect-error CSS custom props
          '--nerve-rgb': rgb,
          '--nerve-peak': peak,
        }}
      />
      <div className="nerve-chip" style={{ color: `rgb(${rgb})`, borderColor: `rgba(${rgb}, 0.5)` }}>
        <span className="nerve-dot" style={{ background: `rgb(${rgb})` }} />
        {flash.label}
      </div>
    </div>
  );
}
