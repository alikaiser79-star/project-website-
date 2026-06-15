import { useEffect, useRef, useState } from 'react';
import { audioMeter } from '../lib/audioMeter';
import { useKaiPulse } from '../hooks/useKaiPulse';
import type { Accent } from '../types';

const HEX: Record<Accent, string> = {
  amber: '#FFB300',
  cyan:  '#5FE3FF',
  emerald: '#7AE6A8',
};

/* A halo of vertical bars circling the orb. While listening: real mic
   spectrum. While speaking: synthesised wave. Otherwise: idle ripple. */
export default function OrbAudio({ accent = 'amber' as Accent }: { accent?: Accent }) {
  const { listening, speaking } = useKaiPulse();
  const [bars, setBars] = useState<number[]>(() => Array(40).fill(0));
  const tRef = useRef(0);
  const idleRaf = useRef(0);

  useEffect(() => {
    if (!listening) return;
    const off = audioMeter.subscribe(({ bars: arr }) => {
      const out: number[] = [];
      const N = 40;
      for (let i = 0; i < N; i++) {
        const src = Math.floor((i / N) * arr.length);
        out.push(arr[src] || 0);
      }
      setBars(out);
    });
    return off;
  }, [listening]);

  useEffect(() => {
    if (listening) return;
    cancelAnimationFrame(idleRaf.current);
    const tick = () => {
      tRef.current += 0.06;
      const N = 40;
      const out = new Array(N).fill(0).map((_, i) => {
        const phase = (i / N) * Math.PI * 4;
        if (speaking) {
          return 0.35 + 0.55 * Math.abs(Math.sin(tRef.current * 3 + phase));
        }
        return 0.07 + 0.10 * Math.abs(Math.sin(tRef.current * 0.6 + phase));
      });
      setBars(out);
      idleRaf.current = requestAnimationFrame(tick);
    };
    idleRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(idleRaf.current);
  }, [listening, speaking]);

  const color = listening ? HEX.cyan : HEX[accent];
  const radius = 195;
  const cx = 210, cy = 210;

  return (
    <svg
      viewBox="0 0 420 420"
      width="100%" height="100%"
      className="absolute inset-0 pointer-events-none"
      style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }}
    >
      {bars.map((v, i) => {
        const angle = (i / bars.length) * Math.PI * 2 - Math.PI / 2;
        const len = 4 + v * 22;
        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const x2 = cx + Math.cos(angle) * (radius + len);
        const y2 = cy + Math.sin(angle) * (radius + len);
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={1.6}
            opacity={0.45 + v * 0.55}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
