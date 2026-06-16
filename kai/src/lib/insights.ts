/* Compute KAI's proactive observations from live state. Returns short,
   confident one-liners. Pure read; no side effects. Never references
   synthesised data — trend observations are gated on real coverage. */

import { loadState } from './store';
import { debt, debtClearedPct, monthlyTotalEGP } from '../kaiConfig';
import { streak } from './habits';
import { trend, coverage } from './history';

export type Insight = { id: string; tone: 'ok' | 'warn' | 'note'; text: string };

export function computeInsights(): Insight[] {
  const s = loadState();
  const out: Insight[] = [];

  const total = monthlyTotalEGP(s.income, s.fxEgpPerEur);
  const cleared = debtClearedPct();
  const remaining = Math.max(0, s.debtCurrent);
  const monthsToZero = remaining / Math.max(debt.minPayment, 1);

  if (cleared >= 75) out.push({ id: 'd75', tone: 'ok',   text: `Credit card ${cleared.toFixed(0)}% cleared — final stretch.` });
  else if (cleared >= 50) out.push({ id: 'd50', tone: 'ok',   text: `Past the halfway mark on debt — keep the pace.` });
  else out.push({ id: 'd-est', tone: 'note', text: `At minimum payment, debt clears in ~${monthsToZero.toFixed(1)} months.` });

  const open = s.priorities.filter(p => !p.done).length;
  if (open === 0) out.push({ id: 'p0', tone: 'ok', text: `Priority list clear — rare territory.` });
  else if (open >= 5) out.push({ id: 'p5', tone: 'warn', text: `${open} open priorities — consider triaging.` });

  const eur = total / (s.fxEgpPerEur || 1);
  out.push({ id: 'inc', tone: 'note', text: `Income runway holding at €${Math.round(eur).toLocaleString('en-GB')} / month.` });

  if (s.makadi.fixLock) out.push({ id: 'lock', tone: 'warn', text: `Makadi door lock still flagged — booking the locksmith would un-block guests.` });

  const ev = new Date(s.garden.nextEvent.when);
  if (!Number.isNaN(+ev)) {
    const days = Math.max(0, Math.ceil((+ev - Date.now()) / 86_400_000));
    if (days <= 3) out.push({ id: 'ev', tone: 'warn', text: `Hidden Garden event in ${days} day${days === 1 ? '' : 's'} — finalise guest list.` });
  }

  const best = [...s.habits].sort((a, b) => streak(b) - streak(a))[0];
  if (best && streak(best) >= 3) out.push({ id: 'hab', tone: 'ok', text: `Habit streak: “${best.label}” · ${streak(best)} day${streak(best) === 1 ? '' : 's'}.` });

  /* Trend insights — only fire when we have ≥2 real captures. The
     `trend()` helper returns null otherwise so we never claim a
     direction we can't see. */
  const days = coverage();
  if (days < 2) {
    out.push({
      id: 'trend-warm',
      tone: 'note',
      text: `Building history · day ${Math.max(1, days)}. Trends unlock after a few captures.`,
    });
  } else {
    const dt = trend('debt', 14);
    if (dt && dt.delta < -1000) {
      out.push({ id: 'd-trend', tone: 'ok', text: `Cleared ${Math.abs(Math.round(dt.delta)).toLocaleString('en-GB')} EGP of debt over the last ${dt.samples} captured day${dt.samples === 1 ? '' : 's'}.` });
    } else if (dt && dt.delta > 1000) {
      out.push({ id: 'd-trend', tone: 'warn', text: `Debt edged up ${Math.round(dt.delta).toLocaleString('en-GB')} EGP over the last ${dt.samples} captured days — worth checking.` });
    }
    const it = trend('incomeMonthly', 14);
    if (it && Math.abs(it.pct) > 1) {
      out.push({
        id: 'i-trend',
        tone: it.delta >= 0 ? 'ok' : 'warn',
        text: `Income projection ${it.delta >= 0 ? 'up' : 'down'} ${Math.abs(it.pct).toFixed(0)}% across ${it.samples} captured days.`,
      });
    }
  }

  return out;
}
