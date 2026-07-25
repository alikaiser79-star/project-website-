/* ============================================================
   THE MORNING PLAN — KAI reads the whole Spine at the start of the day
   and hands Ali ONE screen: the 3 highest-leverage moves for today and a
   single ruling, grounded in real data (deadlines, commitments, money,
   the calling organs, radar). The action-facing sibling of the Night
   Ledger ("while you were away") and The Counsel (a verdict) — this one
   says "here is today."

   One heavy Claude call, cached per Cairo day. Shows on first open of the
   day; summonable any time ("plan"). Boot-safe; 503 → skips cleanly.
   Edge/Spine only — no Node routes, so it works while gmail is down.
   ============================================================ */

import { askClaude } from '../claude';
import { buildKaiContext } from './context';
import { computeRunway } from './runway';
import { mirrorBriefing } from './commitments';
import { operator } from '../../kaiConfig';

export interface MorningPlan { moves: string[]; ruling: string; money: string; day: string; raw?: string; }

/* Cairo calendar day — stable "once per day" key. */
export function dayKey(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: operator.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

const CACHE = (d: string) => `kai.plan.${d}`;
const SHOWN = 'kai.plan.shown';

export function shouldShowMorningPlan(now = Date.now()): boolean {
  try { return localStorage.getItem(SHOWN) !== dayKey(now); } catch { return false; }
}
export function markPlanShown(now = Date.now()): void {
  try { localStorage.setItem(SHOWN, dayKey(now)); } catch { /* ignore */ }
}

/* A deterministic money one-liner — never invented, always from the data. */
export function moneyLine(now = Date.now()): string {
  try {
    const r = computeRunway(now);
    if (r.runwayDays == null) return 'Runway: set liquid cash in the Tollgate to price the day.';
    return `Runway ${Math.floor(r.runwayDays)} days · ${Math.round(r.liquidCash).toLocaleString()} EGP liquid · ${Math.round(r.dailyBurn).toLocaleString()}/day burn.`;
  } catch { return ''; }
}

function parse(raw: string): { moves: string[]; ruling: string } {
  const moves: string[] = [];
  let ruling = '';
  for (const ln of String(raw || '').split('\n')) {
    const mv = ln.match(/^\s*(?:MOVE|move)\s*\d*\s*[:\-]\s*(.+)$/);
    if (mv) { moves.push(mv[1].trim()); continue; }
    const rl = ln.match(/^\s*(?:RULING|ruling)\s*[:\-]\s*(.+)$/);
    if (rl) ruling = rl[1].trim();
  }
  return { moves: moves.slice(0, 3), ruling };
}

export async function ensureMorningPlan(now = Date.now()): Promise<MorningPlan> {
  const d = dayKey(now);
  try { const c = localStorage.getItem(CACHE(d)); if (c) return JSON.parse(c); } catch { /* regenerate */ }

  const money = moneyLine(now);
  const mirror = mirrorBriefing(now).join('; ') || 'no open commitments near deadline';
  const prompt =
    'You are KAI writing Ali\'s plan for TODAY from HIS real data. Not a summary — a plan. ' +
    'Give the 3 highest-leverage moves he should make today and ONE ruling. Each move is a ' +
    'concrete action he can start today (not "review" or "consider"), drawn from the deadlines, ' +
    'commitments, money state, calling organs, leads/inquiries and radar in the context. Order ' +
    'by leverage. Cite the driver in the move itself. Hard format, nothing else:\n' +
    'MOVE: <one concrete action>\nMOVE: <one concrete action>\nMOVE: <one concrete action>\n' +
    'RULING: <one decisive sentence — the single thing that matters most today>\n\n' +
    `MONEY: ${money}\nMIRROR: ${mirror}\n\nCONTEXT:\n${buildKaiContext(now)}`;

  const raw = await askClaude(prompt, [], { tier: 'heavy', feature: 'morning-plan', maxTokens: 500 });
  const { moves, ruling } = parse(String(raw || '').trim());
  const plan: MorningPlan = {
    moves: moves.length ? moves : ['Open the Command view and pick the loudest organ.'],
    ruling: ruling || 'Hold the line — one move at a time.',
    money, day: d,
  };
  try { localStorage.setItem(CACHE(d), JSON.stringify(plan)); } catch { /* ignore */ }
  return plan;
}
