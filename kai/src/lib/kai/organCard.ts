/* ============================================================
   Organ-card data (§7.2 / §7.7) — the memory + foresight behind
   each Command card. A 7-day series and an honest ghost projection
   come from the REAL snapshot history; organs without a tracked
   field get no sparkline and no ghost (no memory, honestly shown).
   Storm ranking (§7.3) also lives here.
   ============================================================ */

import { seriesFor, trend } from '../history';
import type { Snapshot } from '../../types';

/* organ id → snapshot field (only these have memory today). */
const FIELD: Record<string, keyof Snapshot> = {
  '01': 'incomeMonthly', '02': 'debt', '06': 'prioritiesOpen', '05': 'igFollowers',
};

/* Domain weight for storm triage (§7.3): deadline > debt > income >
   makadi > rest. Maps organ ids. */
const WEIGHT: Record<string, number> = {
  '06': 100,  // priorities carries the deadline sentinel
  '02': 90,   // debt
  '01': 80,   // income
  '04': 70,   // makadi
  '11': 60, '09': 55, '10': 50, '12': 45, '07': 40, '03': 30, '08': 25, '05': 20,
};
export function organWeight(id: string): number { return WEIGHT[id] ?? 10; }

export interface OrganCardData {
  series: number[];        // up to 7 real points, oldest→newest ([] = no memory)
  delta: number | null;    // change over the window, null when <2 samples
  ghost: string | null;    // e.g. "→ 41K SEP", null when no trajectory
}

function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (a >= 1_000) return Math.round(n / 1000) + 'K';
  return String(Math.round(n));
}

export function organCardData(id: string, now = Date.now()): OrganCardData {
  const field = FIELD[id];
  if (!field) return { series: [], delta: null, ghost: null };
  const series = seriesFor(field, 7);
  const t = trend(field, 30);
  let ghost: string | null = null;
  if (t && t.samples >= 2) {
    /* project the per-day rate 30 days forward — honest linear only */
    const perDay = t.delta / t.samples;
    const projected = t.to + perDay * 30;
    if (Math.abs(projected - t.to) > Math.abs(t.to) * 0.02) {   // only if it actually moves
      const month = new Date(now + 30 * 86_400_000).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      ghost = `→ ${compact(projected)} ${month}`;
    }
  }
  return { series, delta: t ? t.delta : null, ghost };
}
