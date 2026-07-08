/* ============================================================
   DEBRIEF (Academy 8.3) — the Sunday review. Once a week, one Claude
   call writes the week from the Spine: commitments kept vs broken
   (flat, no softening), the week's best decision, the week's most
   expensive mistake, and ONE lesson pulled from Ali's own behaviour.
   Rendered like the Witness — typed, gold, full attention.

   Shows once per week, on Sunday (Cairo), first open. One call MAX,
   cached by ISO week. Boot-safe; 503 → offline (skips, no overlay).
   ============================================================ */

import { askClaude } from '../claude';
import { buildKaiContext } from './context';
import { mirrorScore } from './commitments';

export interface Debrief { kept: string; broke: string; best: string; mistake: string; lesson: string; raw?: string; }

/* ISO week key (Cairo). Weeks are stable so "once per week" holds. */
export function weekKey(now = Date.now()): string {
  const cairo = new Date(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now)) + 'T00:00:00Z');
  const d = new Date(Date.UTC(cairo.getUTCFullYear(), cairo.getUTCMonth(), cairo.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;                   // Mon=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3);                // nearest Thursday
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function isSundayCairo(now = Date.now()): boolean {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'short' }).format(new Date(now));
  return wd === 'Sun';
}

const CACHE = (w: string) => `kai.debrief.${w}`;
const SHOWN = 'kai.debrief.shown';

export function shouldShowDebrief(now = Date.now()): boolean {
  try { return isSundayCairo(now) && localStorage.getItem(SHOWN) !== weekKey(now); } catch { return false; }
}
export function markDebriefShown(now = Date.now()): void {
  try { localStorage.setItem(SHOWN, weekKey(now)); } catch { /* ignore */ }
}

function parse(raw: string): Debrief {
  const grab = (label: string) => {
    const m = raw.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im'));
    return m ? m[1].trim() : '';
  };
  const kept = grab('KEPT'), broke = grab('BROKE'), best = grab('BEST'), mistake = grab('MISTAKE'), lesson = grab('LESSON');
  if (lesson && (kept || broke)) return { kept, broke, best, mistake, lesson };
  return { kept: '', broke: '', best: '', mistake: '', lesson: '', raw };
}

export async function ensureDebrief(now = Date.now()): Promise<Debrief> {
  const w = weekKey(now);
  try {
    const cached = localStorage.getItem(CACHE(w));
    if (cached) return JSON.parse(cached);
  } catch { /* regenerate */ }

  const ms = mirrorScore(now, 7);
  const prompt =
    'You are KAI writing Ali\'s weekly debrief from HIS data. Flat, unsoftened; this is ' +
    'where the system teaches him about himself. Five labelled lines, each one sentence:\n' +
    'KEPT: <commitments kept this week, with the count>\n' +
    'BROKE: <commitments broken this week — name them, no cushion>\n' +
    'BEST: <the week\'s best decision, from the events>\n' +
    'MISTAKE: <the week\'s most expensive mistake, from the events>\n' +
    'LESSON: <one lesson pulled from HIS behaviour this week>\n\n' +
    `MIRROR THIS WEEK: kept ${ms.kept}, broken ${ms.broken}.\n\nCONTEXT:\n${buildKaiContext(now)}`;

  const raw = await askClaude(prompt, []);      // throws on 503 → caller skips
  const d = parse(String(raw || '').trim());
  try { localStorage.setItem(CACHE(w), JSON.stringify(d)); } catch { /* ignore */ }
  return d;
}
