/* ============================================================
   THE WEEKLY RECKONING — the Sunday accounting, upgraded from the Debrief.
   Once a week KAI closes the books on the week from the Spine: the money
   delta (what the card and runway actually did), commitments kept vs
   broken, the week's real wins, and next week's ONE focus. Flat, unsoftened
   — this is where the system tells Ali the truth about his week.

   One heavy Claude call, cached per ISO week (shares weekKey with the
   Debrief so "once a week" holds). Deterministic money/mirror numbers are
   computed here and handed to the model so it can never invent them.
   Edge/Spine only. Boot-safe; 503 → skips.
   ============================================================ */

import { askClaude } from '../claude';
import { buildKaiContext } from './context';
import { mirrorScore } from './commitments';
import { weeklyDrifts } from './patterns';
import { computeRunway } from './runway';
import { getEvents } from './events';
import { weekKey } from './debrief';

const DAY = 86_400_000;

export interface Reckoning {
  grade: string; money: string; kept: string; broke: string; wins: string; focus: string;
  week: string; raw?: string;
}

const CACHE = (w: string) => `kai.reckoning.${w}`;
const SHOWN = 'kai.reckoning.shown';

function isSundayCairo(now: number): boolean {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'short' }).format(new Date(now)) === 'Sun';
}
export function shouldShowReckoning(now = Date.now()): boolean {
  try { return isSundayCairo(now) && localStorage.getItem(SHOWN) !== weekKey(now); } catch { return false; }
}
export function markReckoningShown(now = Date.now()): void {
  try { localStorage.setItem(SHOWN, weekKey(now)); } catch { /* ignore */ }
}

/* Deterministic money delta for the week — paid down, earned, runway now. */
function moneyDelta(now: number): string {
  const since = now - 7 * DAY;
  const paid = getEvents({ domain: 'debt', type: 'payment_logged', since }).reduce((s, e) => s + (e.value || 0), 0);
  const earned = getEvents({ domain: 'income', since }).reduce((s, e) => s + (e.value || 0), 0);
  const r = computeRunway(now);
  const runway = r.runwayDays == null ? 'runway n/a' : `${Math.floor(r.runwayDays)}d runway`;
  return `paid down ${Math.round(paid).toLocaleString()} EGP, income ${Math.round(earned).toLocaleString()} EGP, ${runway}`;
}

function parse(raw: string): Omit<Reckoning, 'week'> {
  const grab = (label: string) => {
    const m = raw.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im'));
    return m ? m[1].trim() : '';
  };
  const grade = grab('GRADE'), money = grab('MONEY'), kept = grab('KEPT'),
    broke = grab('BROKE'), wins = grab('WINS'), focus = grab('FOCUS');
  if (focus && (kept || money)) return { grade, money, kept, broke, wins, focus };
  return { grade: '', money: '', kept: '', broke: '', wins: '', focus: '', raw };
}

export async function ensureReckoning(now = Date.now()): Promise<Reckoning> {
  const w = weekKey(now);
  try { const c = localStorage.getItem(CACHE(w)); if (c) return JSON.parse(c); } catch { /* regenerate */ }

  const ms = mirrorScore(now, 7);
  const money = moneyDelta(now);
  const drifts = weeklyDrifts(now).join('; ') || 'no notable week-over-week drift';
  const prompt =
    'You are KAI writing Ali\'s WEEKLY RECKONING from HIS data — the Sunday accounting. Flat, ' +
    'unsoftened, specific. Six labelled lines, each ONE sentence, nothing else:\n' +
    'GRADE: <a letter grade A–F for the week, with 3 words why>\n' +
    'MONEY: <what the money actually did this week, using the real numbers>\n' +
    'KEPT: <commitments kept this week, with the count>\n' +
    'BROKE: <commitments broken — name them, no cushion>\n' +
    'WINS: <the week\'s real wins from the events (bookings, plants, content, paydown)>\n' +
    'FOCUS: <the ONE focus for next week, drawn from what this week exposed>\n\n' +
    `MIRROR: kept ${ms.kept}, broken ${ms.broken} (${ms.score ?? '—'}%).\nMONEY DELTA: ${money}\nDRIFT: ${drifts}\n\nCONTEXT:\n${buildKaiContext(now)}`;

  const raw = await askClaude(prompt, [], { tier: 'heavy', feature: 'reckoning', maxTokens: 600 });
  const parsed = parse(String(raw || '').trim());
  const rk: Reckoning = { ...parsed, week: w };
  try { localStorage.setItem(CACHE(w), JSON.stringify(rk)); } catch { /* ignore */ }
  return rk;
}
