/* ============================================================
   DRILL (Academy 8.2) — prove yesterday's lesson stuck. The day
   after a Lektion, before the new one, one multiple-choice question
   about it. Tap to answer, instant verdict. A gold streak of correct
   answers; a wrong answer re-queues that lesson three days out
   (minimal spaced repetition — a client-side queue, no libraries).

   One Claude call to write the question, cached per lesson so it is
   generated at most once. Boot-safe; offline → no drill.
   ============================================================ */

import { askClaude } from '../claude';

export interface DrillQ { question: string; options: string[]; correct: number; }

const DAY = 86_400_000;
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const LESSON = (d: string) => `kai.lektion.${d}`;
const QCACHE = (d: string) => `kai.drill.q.${d}`;
const ANSWERED = (d: string) => `kai.drill.answered.${d}`;   // per drill-day
const COOLDOWN = (lessonDate: string) => `kai.drill.cooldown.${lessonDate}`;
const STREAK = 'kai.drill.streak';

function lessonText(date: string): string | null {
  try {
    const raw = localStorage.getItem(LESSON(date));
    if (!raw) return null;
    const l = JSON.parse(raw);
    if (l.raw) return String(l.raw);
    return `NUMBER: ${l.number}\nPRINCIPLE: ${l.principle}\nMOVE: ${l.move}\nBEGRIFF: ${l.begriff}`;
  } catch { return null; }
}

/* Which lesson (by date) should be drilled right now, or null.
   Yesterday's lesson, if it exists, today's drill isn't answered yet,
   and it's not inside a re-queue cooldown. */
export function pendingDrillDate(now = Date.now()): string | null {
  try {
    if (localStorage.getItem(ANSWERED(dayKey(now)))) return null;   // already drilled today
    const yesterday = dayKey(now - DAY);
    if (!lessonText(yesterday)) return null;
    const cd = localStorage.getItem(COOLDOWN(yesterday));
    if (cd && cd > dayKey(now)) return null;                        // still cooling down
    return yesterday;
  } catch { return null; }
}

/* Get (cached) or generate the MC question for a lesson date. */
export async function ensureDrillQuestion(lessonDate: string): Promise<DrillQ | null> {
  try {
    const cached = localStorage.getItem(QCACHE(lessonDate));
    if (cached) return JSON.parse(cached);
  } catch { /* regenerate */ }
  const text = lessonText(lessonDate);
  if (!text) return null;

  const prompt =
    'From this lesson, write ONE multiple-choice question that tests whether the operator ' +
    'grasped its key idea. Exactly 3 options, one correct. Return ONLY JSON, no prose:\n' +
    '{"question":"...","options":["...","...","..."],"correct":<0-2>}\n\nLESSON:\n' + text;
  try {
    const raw = await askClaude(prompt, []);
    const m = String(raw || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const obj = JSON.parse(m[0]);
    if (!obj.question || !Array.isArray(obj.options) || obj.options.length !== 3) return null;
    const q: DrillQ = { question: String(obj.question), options: obj.options.map(String), correct: Math.max(0, Math.min(2, obj.correct | 0)) };
    try { localStorage.setItem(QCACHE(lessonDate), JSON.stringify(q)); } catch { /* ignore */ }
    return q;
  } catch { return null; }
}

export function getDrillStreak(): number {
  try { return JSON.parse(localStorage.getItem(STREAK) || '{}').count || 0; } catch { return 0; }
}

/* Record an answer. Correct → mark today drilled, bump the streak.
   Wrong → mark today drilled, reset the streak, re-queue the lesson
   3 days out. Returns the new streak. */
export function recordDrillAnswer(lessonDate: string, correct: boolean, now = Date.now()): number {
  try {
    localStorage.setItem(ANSWERED(dayKey(now)), '1');
    let streak = 0;
    if (correct) {
      const prev = JSON.parse(localStorage.getItem(STREAK) || '{}');
      streak = (prev.count || 0) + 1;
      localStorage.setItem(STREAK, JSON.stringify({ count: streak, lastDate: dayKey(now) }));
    } else {
      localStorage.setItem(STREAK, JSON.stringify({ count: 0, lastDate: dayKey(now) }));
      localStorage.setItem(COOLDOWN(lessonDate), dayKey(now + 3 * DAY));   // re-queue in 3 days
    }
    return streak;
  } catch { return 0; }
}
