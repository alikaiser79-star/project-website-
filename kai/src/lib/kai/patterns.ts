/* ============================================================
   PROACTIVE KAI (§13.3b) — pattern memory. Compares this week to the
   trailing 8 weeks and names real drifts ("watering compliance down
   40%", "no outreach events in 12 days"). Flat, once, in the briefing —
   no nagging, no fabrication: a drift only surfaces when the numbers
   actually moved.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/* Activities we track for drift. `key` matches domain.type. */
const TRACKED: Array<{ key: string; label: string; goodUp: boolean }> = [
  { key: 'garden.watered',       label: 'watering',        goodUp: true },
  { key: 'debt.payment_logged',  label: 'card payments',   goodUp: true },
  { key: 'content.reel_posted',  label: 'content posts',   goodUp: true },
  { key: 'leads.outreach',       label: 'outreach',        goodUp: true },
  { key: 'expense.expense_logged', label: 'logged spend',  goodUp: false },
];

function countInWindow(evs: KaiEvent[], key: string, from: number, to: number): number {
  const [domain, type] = key.split('.');
  return evs.filter((e) => e.domain === domain && e.type === type && e.ts >= from && e.ts < to).length;
}
function lastSeen(evs: KaiEvent[], key: string): number | null {
  const [domain, type] = key.split('.');
  const hit = evs.filter((e) => e.domain === domain && e.type === type).sort((a, b) => b.ts - a.ts)[0];
  return hit ? hit.ts : null;
}

/* Up to `max` drift lines. A drift needs a real baseline (the activity
   happened in the trailing 8 weeks) and a meaningful move (±40%), or a
   tracked activity that's gone silent for 10+ days after being active. */
export function weeklyDrifts(now = Date.now(), max = 2): string[] {
  const evs = getEvents({ since: now - 9 * WEEK });
  const out: Array<{ line: string; mag: number }> = [];

  for (const t of TRACKED) {
    const thisWeek = countInWindow(evs, t.key, now - WEEK, now);
    const prior8 = countInWindow(evs, t.key, now - 9 * WEEK, now - WEEK);
    const baseline = prior8 / 8;                              // avg per week over the prior 8

    if (baseline >= 0.5) {
      const delta = (thisWeek - baseline) / baseline;         // signed fractional change
      if (Math.abs(delta) >= 0.4) {
        const dir = delta < 0 ? 'down' : 'up';
        out.push({ line: `Pattern: ${t.label} ${dir} ${Math.round(Math.abs(delta) * 100)}% vs your 8-week norm.`, mag: Math.abs(delta) });
      }
    }

    const seen = lastSeen(evs, t.key);
    if (t.goodUp && baseline >= 0.5 && seen && now - seen >= 10 * DAY) {
      out.push({ line: `Pattern: no ${t.label} in ${Math.round((now - seen) / DAY)} days — that's a break from your norm.`, mag: 1 + (now - seen) / DAY / 30 });
    }
  }

  return out.sort((a, b) => b.mag - a.mag).slice(0, max).map((o) => o.line);
}
