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

type Props = {
  active: ViewKey;
  onChange: (v: ViewKey) => void;
  /* Optional per-view badge counts (e.g. pending gate actions). */
  badges?: Partial<Record<ViewKey, number>>;
};

export default function ViewNav({ active, onChange, badges }: Props) {
  return (
    <nav
      className="glass rounded-lg px-1.5 py-1.5 flex items-center gap-1 overflow-x-auto"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      {VIEWS.map(v => {
        const isActive = v.key === active;
        const badge = badges?.[v.key] || 0;
        const Icon = v.Icon;
        return (
          <button
            key={v.key}
            onClick={() => { if (!isActive) { sfx.whoosh(); onChange(v.key); } }}
            title={v.hint}
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
                className="absolute inset-0 rounded-md bg-amber/12 border border-amber/40"
                style={{ boxShadow: '0 0 16px rgba(255,179,0,0.10)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <Icon size={14} className={'relative z-10 ' + (isActive ? 'text-amber' : '')} />
            <span className="relative z-10 font-mono text-[11px] tracking-[0.16em] uppercase hidden sm:inline">
              {v.label}
            </span>
            {badge > 0 && (
              <span className="relative z-10 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-amber text-ink font-mono text-[9px] font-bold tabular-nums">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
