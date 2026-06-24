/* ============================================================
   ViewNav — top-level dashboard navigation.

   The dashboard used to be 21 panels stacked into one infinite
   3-column wall. This rail breaks them into 5 focused views so
   the operator sees 3-5 relevant panels at a time, not all 21.

   Sticky under the top bar. The active view is amber-accented.
   Each pill carries a live badge count when its domain has
   something pending (gate proposals on Comms, watchtower alerts
   on Command).
   ============================================================ */

import { motion } from 'framer-motion';
import {
  Gauge, Wallet, TrendingUp, Building2, Radio,
  type LucideIcon,
} from 'lucide-react';
import { sfx } from '../lib/sound';

export type ViewKey = 'command' | 'money' | 'growth' | 'ops' | 'comms';

export interface ViewMeta {
  key: ViewKey;
  label: string;
  hint: string;
  Icon: LucideIcon;
}

export const VIEWS: ViewMeta[] = [
  { key: 'command', label: 'Command',    hint: 'Today\'s moves, the loop, the gate', Icon: Gauge },
  { key: 'money',   label: 'Money',      hint: 'Runway, income, debt, spend',         Icon: Wallet },
  { key: 'growth',  label: 'Growth',     hint: 'Content, Instagram, the legend',      Icon: TrendingUp },
  { key: 'ops',     label: 'Operations', hint: 'Garden, Makadi, the Ledger',          Icon: Building2 },
  { key: 'comms',   label: 'Comms',      hint: 'Inbox, phone, sites, voice',          Icon: Radio },
];

export const VIEW_LABEL: Record<ViewKey, ViewMeta> =
  Object.fromEntries(VIEWS.map(v => [v.key, v])) as Record<ViewKey, ViewMeta>;

/* Per-view accent colour. Each view shifts the ambient backdrop
   AND its active rail pill, ViewHeader chips, and signature
   numbers to its own colour temperature. Identity stays amber. */
export const VIEW_ACCENT: Record<ViewKey, { hex: string; rgb: string; name: string }> = {
  command: { hex: '#FFB300', rgb: '255,179,0',   name: 'amber'   },
  money:   { hex: '#7AE6A8', rgb: '122,230,168', name: 'emerald' },
  growth:  { hex: '#C792EA', rgb: '199,146,234', name: 'violet'  },
  ops:     { hex: '#FFC94A', rgb: '255,201,74',  name: 'amber2'  },
  comms:   { hex: '#7FCBFF', rgb: '127,203,255', name: 'cyan'    },
};

type Props = {
  active: ViewKey;
  onChange: (v: ViewKey) => void;
  /* Optional per-view badge counts (e.g. pending gate actions). */
  badges?: Partial<Record<ViewKey, number>>;
};

export default function ViewNav({ active, onChange, badges }: Props) {
  return (
    <nav
      data-viewnav
      className="glass rounded-lg px-1.5 py-1.5 flex items-center gap-1 overflow-x-auto sticky top-2 sm:top-3 z-30"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      {VIEWS.map((v, idx) => {
        const isActive = v.key === active;
        const badge = badges?.[v.key] || 0;
        const Icon = v.Icon;
        const accent = VIEW_ACCENT[v.key];
        return (
          <button
            key={v.key}
            onClick={() => { if (!isActive) { sfx.whoosh(); onChange(v.key); } }}
            title={`${v.hint} · press ${idx + 1}`}
            className={
              'relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md transition shrink-0 ' +
              (isActive
                ? 'text-bone'
                : 'text-steel hover:text-bone/85')
            }
          >
            {isActive && (
              <motion.span
                layoutId="viewnav-active"
                className="absolute inset-0 rounded-md"
                style={{
                  background: `rgba(${accent.rgb}, 0.12)`,
                  border:     `1px solid rgba(${accent.rgb}, 0.42)`,
                  boxShadow:  `0 0 18px rgba(${accent.rgb}, 0.18), inset 0 1px 0 rgba(255,255,255,0.07)`,
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <Icon
              size={14}
              className="relative z-10"
              style={isActive ? { color: accent.hex } : undefined}
            />
            <span
              className="relative z-10 font-mono text-[11px] tracking-[0.16em] uppercase hidden sm:inline"
              style={isActive ? { color: '#E6E1D7' } : undefined}
            >
              {v.label}
            </span>
            {badge > 0 && (
              <span
                className="relative z-10 min-w-[16px] h-4 px-1 grid place-items-center rounded-full font-mono text-[9px] font-bold tabular-nums"
                style={{ background: accent.hex, color: '#0A0E14' }}
              >
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
