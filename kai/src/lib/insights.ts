/* Compute KAI's proactive observations from live state. Returns short,
   confident one-liners. Pure read; no side effects. */

import { loadState } from './store';
import { debt, monthlyTotalEGP, debtClearedPct, currency, garden, makadi } from '../kaiConfig';
import { streak } from './habits';
import { trend } from './history';

export type Insight = { id: string; tone: 'ok' | 'warn' | 'note'; text: string };

export function computeInsights(): Insight[] {
  const s = loadState();
  const out: Insight[] = [];

  const total = monthlyTotalEGP();
  const cleared = debtClearedPct();
  const remaining = Math.max(0, s.debtCurrent);
  const monthsToZero = remaining / Math.max(debt.minPayment, 1);

  if (cleared >= 75) out.push({ id: 'd75', tone: 'ok',   text: `Credit card ${cleared.toFixed(0)}% cleared — final stretch.` });
  else if (cleared >= 50) out.push({ id: 'd50', tone: 'ok',   text: `Past the halfway mark on debt — keep the pace.` });
  else out.push({ id: 'd-est', tone: 'note', text: `At minimum payment, debt clears in ~${monthsToZero.toFixed(1)} months.` });

  const open = s.priorities.filter(p => !p.done).length;
  if (open === 0) out.push({ id: 'p0', tone: 'ok', text: `Priority list clear — rare territory.` });
  else if (open >= 5) out.push({ id: 'p5', tone: 'warn', text: `${open} open priorities — consider triaging.` });

  const eur = total / currency.egpPerEur;
  out.push({ id: 'inc', tone: 'note', text: `Income runway holding at €${Math.round(eur).toLocaleString('en-GB')} / month.` });

  if (makadi.fixLock) out.push({ id: 'lock', tone: 'warn', text: `Makadi door lock still flagged — booking the locksmith would un-block guests.` });

  const ev = new Date(garden.nextEvent.when);
  const days = Math.max(0, Math.ceil((+ev - Date.now()) / 86_400_000));
  if (days <= 3) out.push({ id: 'ev', tone: 'warn', text: `Hidden Garden event in ${days} day${days === 1 ? '' : 's'} — finalise guest list.` });

  const best = [...s.habits].sort((a, b) => streak(b) - streak(a))[0];
  if (best && streak(best) >= 3) out.push({ id: 'hab', tone: 'ok', text: `Habit streak: “${best.label}” · ${streak(best)} day${streak(best) === 1 ? '' : 's'}.` });

  /* Trend-driven insights from the 14-day snapshot history. */
  const debtTrend = trend('debt', 14);
  if (debtTrend.delta < -1000) {
    out.push({ id: 'd-trend', tone: 'ok', text: `Cleared ${Math.abs(Math.round(debtTrend.delta)).toLocaleString('en-GB')} EGP of debt in the last 14 days.` });
  } else if (debtTrend.delta > 1000) {
    out.push({ id: 'd-trend', tone: 'warn', text: `Debt edged up ${Math.round(debtTrend.delta).toLocaleString('en-GB')} EGP in 14 days — worth checking.` });
  }

  const incTrend = trend('incomeMonthly', 14);
  if (Math.abs(incTrend.pct) > 1) {
    out.push({
      id: 'i-trend',
      tone: incTrend.delta >= 0 ? 'ok' : 'warn',
      text: `Income projection ${incTrend.delta >= 0 ? 'up' : 'down'} ${Math.abs(incTrend.pct).toFixed(0)}% over 14 days.`,
    });
  }

  return out;
}
