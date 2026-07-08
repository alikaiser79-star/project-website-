/* ============================================================
   THE ANALYST (AI 7.3) — the daily brief, upgraded. Builds on the
   Spine-truth briefing: once per day (first open after 05:00 Cairo)
   one Claude call turns the last-30-day Spine + the Mirror into a
   five-line brief — what moved, what broke, today's single most
   important move, one risk, one number to watch. Flat tone, no
   praise. Cached until the next day.

   One call per day MAX (cached by the Cairo "analyst day", which
   rolls at 05:00). Boot-from-empty safe; 503 → offline.
   ============================================================ */

import { askClaude } from '../claude';
import { buildKaiContext } from './context';

export interface AnalystBrief {
  moved: string; broke: string; move: string; risk: string; watch: string;
  raw?: string;
}

/* The "analyst day" rolls at 05:00 Cairo — before then, still
   yesterday's brief. Timezone-correct via Intl, no libraries. */
export function analystDayKey(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(new Date(now));
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  let y = +get('year'), m = +get('month'), d = +get('day');
  const h = +get('hour');
  if (h < 5) {                                   /* before 05:00 → previous day */
    const prev = new Date(Date.UTC(y, m - 1, d));
    prev.setUTCDate(prev.getUTCDate() - 1);
    y = prev.getUTCFullYear(); m = prev.getUTCMonth() + 1; d = prev.getUTCDate();
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const CACHE = (k: string) => `kai.analyst.${k}`;

function parse(raw: string): AnalystBrief {
  const grab = (label: string) => {
    const m = raw.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im'));
    return m ? m[1].trim() : '';
  };
  const moved = grab('MOVED'), broke = grab('BROKE'), move = grab('MOVE'), risk = grab('RISK'), watch = grab('WATCH');
  if (moved && move) return { moved, broke, move, risk, watch };
  return { moved: '', broke: '', move: '', risk: '', watch: '', raw };
}

/* Return today's brief. Cached; generates once via Claude if missing. */
export async function ensureAnalystBrief(now = Date.now()): Promise<AnalystBrief> {
  const key = analystDayKey(now);
  try {
    const cached = localStorage.getItem(CACHE(key));
    if (cached) return JSON.parse(cached);
  } catch { /* regenerate */ }

  const prompt =
    'You are KAI, Ali\'s analyst. From HIS data below, write the daily brief as EXACTLY ' +
    'five labelled lines. Flat, direct; no praise, no padding. If a commitment broke, say ' +
    'so plainly. Each line one sentence:\n' +
    'MOVED: <what changed in the numbers, last day or two>\n' +
    'BROKE: <a broken/overdue commitment, or "nothing broke">\n' +
    'MOVE: <today\'s single most important action>\n' +
    'RISK: <the one risk to watch>\n' +
    'WATCH: <the one number to watch, with its value>\n\n' +
    'CONTEXT:\n' + buildKaiContext(now);

  const raw = await askClaude(prompt, [], { tier: 'heavy', feature: 'analyst', maxTokens: 700 });   // throws on 503 → caller handles offline
  const brief = parse(String(raw || '').trim());
  try { localStorage.setItem(CACHE(key), JSON.stringify(brief)); } catch { /* ignore */ }
  return brief;
}
