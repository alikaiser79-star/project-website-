import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

/* Hand-traced simplified outline of Egypt. The two pins are positioned
   in approximate normalized coordinates: Cairo (north) and Makadi
   (Red Sea coast, south-east of Hurghada). */

export default function MapTile({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-md px-3 py-2.5 flex-1 min-w-[220px] relative overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">Holdings · EG</span>
        <span className="ml-auto font-mono text-[10px] text-steel">~390 km</span>
      </div>

      <svg viewBox="0 0 220 140" className="w-full h-[88px] mt-1" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="map-fill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,179,0,0.10)" />
            <stop offset="100%" stopColor="rgba(255,179,0,0.02)" />
          </linearGradient>
        </defs>

        {/* Simplified Egypt landmass outline */}
        <path
          d="M 28 22
             L 110 18
             L 165 22
             L 178 30
             L 188 42
             L 196 64
             L 192 84
             L 178 100
             L 168 112
             L 148 122
             L 130 128
             L 96 132
             L 70 132
             L 50 124
             L 36 110
             L 28 92
             L 24 70
             L 24 46
             Z"
          fill="url(#map-fill)"
          stroke="rgba(255,179,0,0.4)"
          strokeWidth="0.6"
        />
        {/* Sinai sketch */}
        <path
          d="M 178 30 L 192 28 L 198 38 L 192 52 L 184 50 L 178 42 Z"
          fill="rgba(255,179,0,0.06)"
          stroke="rgba(255,179,0,0.35)"
          strokeWidth="0.5"
        />
        {/* Nile */}
        <path
          d="M 80 22 Q 78 60 86 90 Q 92 118 96 130"
          fill="none"
          stroke="rgba(95,227,255,0.5)"
          strokeWidth="0.7"
          strokeDasharray="2 2"
        />

        {/* Route Cairo → Makadi */}
        <line
          x1="86" y1="36" x2="170" y2="76"
          stroke="rgba(255,179,0,0.7)"
          strokeWidth="0.8"
          strokeDasharray="3 3"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="2.5s" repeatCount="indefinite" />
        </line>

        {/* Cairo pin */}
        <g transform="translate(86,36)">
          <circle r="8" fill="rgba(255,179,0,0.10)">
            <animate attributeName="r" values="6;12;6" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="2.6s" repeatCount="indefinite" />
          </circle>
          <circle r="2.4" fill="#FFB300" />
          <text x="6" y="2" fill="#FFB300" fontFamily="JetBrains Mono" fontSize="6" letterSpacing="1">CAIRO</text>
          <text x="6" y="9" fill="#7C8794" fontFamily="JetBrains Mono" fontSize="4.4" letterSpacing="0.6">Hidden Garden</text>
        </g>

        {/* Makadi pin */}
        <g transform="translate(170,76)">
          <circle r="7" fill="rgba(95,227,255,0.10)">
            <animate attributeName="r" values="5;11;5" dur="2.6s" repeatCount="indefinite" begin="1.1s" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="2.6s" repeatCount="indefinite" begin="1.1s" />
          </circle>
          <circle r="2.2" fill="#5FE3FF" />
          <text x="-32" y="2" fill="#5FE3FF" fontFamily="JetBrains Mono" fontSize="6" letterSpacing="1">MAKADI</text>
          <text x="-32" y="9" fill="#7C8794" fontFamily="JetBrains Mono" fontSize="4.4" letterSpacing="0.6">Airbnb · STR</text>
        </g>
      </svg>
    </motion.div>
  );
}
