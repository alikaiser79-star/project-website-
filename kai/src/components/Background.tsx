/* ============================================================
   Atmospheric backdrop.

   Three layers stacked behind the content:
   1. A big soft radial gradient whose origin AND HUE shift with
      the active view — each view gets its own colour temperature.
      Command = amber, Money = emerald, Growth = violet,
      Operations = sky, Comms = rose.
   2. A faint dot grid for spatial reference (replaces the
      featureless void without becoming busy).
   3. A second cool radial in the opposite corner for depth.

   Transitions are slow (1.4 s) so view-switches feel like a
   colour-temperature shift, not a flash. Honours prefers-reduced-
   motion: instant change instead of cross-fade.
   ============================================================ */

import { useEffect, useState } from 'react';

type ViewKey = 'command' | 'money' | 'growth' | 'ops' | 'comms';

interface Props { view?: ViewKey }

const VIEW_HUE: Record<ViewKey, { warm: string; cool: string; origin: string }> = {
  command: { warm: '255,179,0',   cool: '127,203,255', origin: '50% 22%' },
  money:   { warm: '122,230,168', cool: '127,203,255', origin: '32% 18%' },
  growth:  { warm: '199,146,234', cool: '127,203,255', origin: '68% 22%' },
  ops:     { warm: '255,201,74',  cool: '122,230,168', origin: '50% 32%' },
  comms:   { warm: '127,203,255', cool: '199,146,234', origin: '50% 18%' },
};

export default function Background({ view = 'command' }: Props) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const onChange = () => setReduced(m.matches);
    m.addEventListener?.('change', onChange);
    return () => m.removeEventListener?.('change', onChange);
  }, []);

  const v = VIEW_HUE[view];
  const transition = reduced ? 'none' : 'background 1.4s ease, opacity 1.4s ease';

  return (
    <>
      {/* Base ink colour — Tailwind's `bg-ink` is on <body>; this is
          a pure-black floor under our atmosphere so dark areas read
          truly dark, not muddy. */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: '#070A10' }}
      />

      {/* Warm radial — origin + hue per view. Stronger now so the
          colour-temperature shift between views is undeniable on a
          phone screen. */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            `radial-gradient(1400px 800px at ${v.origin}, rgba(${v.warm},0.18), transparent 62%)`,
          transition,
        }}
      />
      {/* Cool radial bottom-right — adds depth */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            `radial-gradient(1000px 700px at 82% 88%, rgba(${v.cool},0.10), transparent 60%)`,
          transition,
        }}
      />
      {/* Subtle dot grid — spatial reference without being busy */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(ellipse 80% 70% at 50% 30%, black 50%, transparent 90%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 70% at 50% 30%, black 50%, transparent 90%)',
        }}
      />
      {/* Top vignette — focuses attention on the orb / hero */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 18%)',
        }}
      />
    </>
  );
}
