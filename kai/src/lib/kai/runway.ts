/* ============================================================
   The Tollgate — money priced in days of freedom.

     dailyBurn  = trailing 30-day sum of expense events / 30
     liquidCash = cash on hand (editable) + uncommitted income
     runwayDays = liquidCash / dailyBurn

   Everything reads the Spine (expense_logged events) and the
   liquidCash store. Boot-from-empty safe: no events → burn 0 →
   runway is "unbounded" (we return null and the panel shows a
   set-up nudge instead of Infinity).

   The reframe: every spend has a cost in days. costInDays(x)
   converts an EGP amount into "days closer to broke".
   ============================================================ */

import { getEvents } from './events';
import { getLiquidCash } from '../store';
import { monthlyTotalEGP } from '../../kaiConfig';
import { loadState } from '../store';
import { getCalendarCached } from '../calendar';

const DAY = 86_400_000;
const BURN_WINDOW_DAYS = 30;

export interface Runway {
  liquidCash: number;
  dailyBurn: number;
  runwayDays: number | null;   // null when burn is 0 (can't divide)
  brokeOn: number | null;      // ms timestamp, or null
  windowDays: number;
  sampleCount: number;         // how many expense events fed the burn
}

/* Trailing 30-day average daily spend from the Spine. */
export function dailyBurn(now: number = Date.now()): { burn: number; count: number } {
  const since = now - BURN_WINDOW_DAYS * DAY;
  const evs = getEvents({ domain: 'expense', type: 'expense_logged', since });
  const total = evs.reduce((sum, e) => sum + (typeof e.value === 'number' ? e.value : 0), 0);
  return { burn: total / BURN_WINDOW_DAYS, count: evs.length };
}

/* Liquid cash = cash on hand + this-month uncommitted income.

   We approximate "uncommitted income" as the portion of the
   monthly income projection not yet elapsed — i.e. income still
   expected to land before month end. Conservative: only counts
   the remaining fraction of the month. If you keep cash at 0 and
   never set it, this still gives a real (if income-only) figure. */
export function liquidCash(now: number = Date.now()): number {
  const cash = getLiquidCash();
  const s = loadState();
  const monthIncome = monthlyTotalEGP(s.income, s.fxEgpPerEur);
  const d = new Date(now);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const dayOfMonth = d.getDate();
  const remainingFraction = Math.max(0, (daysInMonth - dayOfMonth) / daysInMonth);
  const uncommitted = Math.round(monthIncome * remainingFraction);
  return Math.max(0, cash) + uncommitted;
}

export function computeRunway(now: number = Date.now()): Runway {
  const cash = liquidCash(now);
  const { burn, count } = dailyBurn(now);
  const runwayDays = burn > 0 ? cash / burn : null;
  const brokeOn = runwayDays !== null ? now + runwayDays * DAY : null;
  return {
    liquidCash: cash,
    dailyBurn: burn,
    runwayDays,
    brokeOn,
    windowDays: BURN_WINDOW_DAYS,
    sampleCount: count,
  };
}

/* What a discretionary spend costs in days of freedom. Returns
   null when there's no burn signal to price against. */
export function costInDays(amount: number, now: number = Date.now()): number | null {
  const { burn } = dailyBurn(now);
  if (!(burn > 0) || !(amount > 0)) return null;
  return amount / burn;
}

/* Next payday from the calendar, best-effort. Scans upcoming
   events for salary / payday / Enpal cues. Returns ms or null. */
export function nextPayday(now: number = Date.now()): { at: number; title: string } | null {
  try {
    const cal = getCalendarCached();
    if (!cal.ok || !Array.isArray(cal.events)) return null;
    const re = /pay\s?day|salary|payroll|enpal|gehalt|lohn/i;
    const hits = cal.events
      .filter(ev => re.test(ev.title || ''))
      .map(ev => ({ at: +new Date(ev.start), title: ev.title }))
      .filter(h => Number.isFinite(h.at) && h.at > now)
      .sort((a, b) => a.at - b.at);
    return hits[0] || null;
  } catch { return null; }
}

/* Cushion (or shortfall) in days when you reach the next payday.
   positive = days of cash to spare on payday; negative = short. */
export function paydayCushion(now: number = Date.now()): { payday: number; title: string; cushionDays: number } | null {
  const pd = nextPayday(now);
  const r = computeRunway(now);
  if (!pd || r.runwayDays === null) return null;
  const daysToPayday = (pd.at - now) / DAY;
  return { payday: pd.at, title: pd.title, cushionDays: r.runwayDays - daysToPayday };
}

/* One-liner for the daily briefing. Quiet when there's no burn. */
export function runwayBriefing(now: number = Date.now()): string[] {
  const r = computeRunway(now);
  if (r.runwayDays === null) return [];
  const out: string[] = [];
  const days = Math.floor(r.runwayDays);
  out.push(
    days < 14
      ? `Runway: ${days} days of freedom left — tighten up.`
      : `Runway: ${days} days at current burn.`
  );
  const pc = paydayCushion(now);
  if (pc) {
    const c = Math.round(pc.cushionDays);
    out.push(c >= 0
      ? `You hit ${pdLabel(pc.payday)} with ${c} day${c === 1 ? '' : 's'} of cushion.`
      : `You're ${Math.abs(c)} day${Math.abs(c) === 1 ? '' : 's'} short of ${pdLabel(pc.payday)} — move something.`);
  }
  return out;
}

function pdLabel(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return 'payday'; }
}

/* Snapshot for the get_runway Claude tool. */
export function runwaySnapshot(now: number = Date.now()) {
  const r = computeRunway(now);
  const pc = paydayCushion(now);
  return {
    liquid_cash_egp: Math.round(r.liquidCash),
    daily_burn_egp: Math.round(r.dailyBurn),
    runway_days: r.runwayDays === null ? null : Math.round(r.runwayDays * 10) / 10,
    burn_window_days: r.windowDays,
    expense_samples: r.sampleCount,
    broke_on: r.brokeOn ? new Date(r.brokeOn).toISOString().slice(0, 10) : null,
    next_payday: pc ? {
      date: new Date(pc.payday).toISOString().slice(0, 10),
      title: pc.title,
      cushion_days: Math.round(pc.cushionDays),
    } : null,
  };
}
