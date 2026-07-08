/* ============================================================
   MODEL DISCIPLINE (§13.3d) — cost is a visible number, not a surprise.
   Every AI call logs its token usage per feature to the Spine
   (system.tokens), so spend is auditable in the same place as
   everything else. Model tiers live in kaiConfig: heavy synthesis
   (Debrief, Council, Masterplan, vision) on the strong model, cheap
   calls (Explain, chips) on the fast one.
   ============================================================ */

import { getEvents, logEvent } from './events';

const DAY = 86_400_000;

export function logTokens(feature: string, input: number, output: number, model?: string): void {
  const total = (input || 0) + (output || 0);
  if (total <= 0) return;
  try {
    logEvent({ domain: 'system', type: 'tokens', value: total, meta: { feature, in: input || 0, out: output || 0, model }, source: 'ai' });
  } catch { /* ignore */ }
}

export interface TokenTotals { total: number; byFeature: Record<string, number>; }

/* Rolling token spend over the last `days`, total and per feature. */
export function tokenTotals(days = 30, now = Date.now()): TokenTotals {
  const evs = getEvents({ domain: 'system', type: 'tokens', since: now - days * DAY });
  const byFeature: Record<string, number> = {};
  let total = 0;
  for (const e of evs) {
    const f = String(e.meta?.feature || 'other');
    byFeature[f] = (byFeature[f] || 0) + (e.value || 0);
    total += e.value || 0;
  }
  return { total, byFeature };
}
