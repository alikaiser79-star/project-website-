/* ============================================================
   THE COUNSEL (§15) — the seed of the Twin. On demand (/counsel) or
   auto-triggered by the pulse, KAI reads the WHOLE Spine and returns ONE
   ruling: a VERDICT plus terse reasoning, max 5 lines, each citing the
   Spine events that drive it. Not a chat — a judgment. It advises; it
   never acts (no Gate, no send).

   Auto-trigger: once/day, on foreground after a night where the pulse
   escalated something or the radar surfaced a big move — the moment a
   ruling is actually worth reading.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { getCommitments } from './commitments';
import { getLeads } from './leads';
import { computeRunway } from './runway';
import { askClaude } from '../claude';

const DAY = 86_400_000;
const LAST_AUTO = 'kai.counsel.autoDay';

export interface Ruling { verdict: string; lines: string[]; at: number; }

/* Build a compact, cited Spine digest for the ruling. */
function digest(now: number): string {
  const evs = getEvents({ since: now - 30 * DAY });
  const open = getCommitments().filter((c) => c.status === 'open');
  const broken = getCommitments().filter((c) => c.status === 'broken');
  const leads = getLeads();
  const r = computeRunway(now);

  const escal = evs.filter((e) => e.domain === 'deadline' && e.type === 'escalated').slice(-4);
  const anom = evs.filter((e) => e.domain === 'anomaly' && e.type === 'detected').slice(-3);
  const bigRadar = evs.filter((e) => e.domain === 'radar' && e.type === 'finding' && e.meta?.big).slice(-3);
  const recos = evs.filter((e) => e.domain === 'radar' && e.type === 'recommendation').slice(-3);
  const inquiries = evs.filter((e) => e.domain === 'leads' && e.type === 'booking_inquiry').slice(-3);

  const L: string[] = [];
  L.push(`RUNWAY: ${r.runwayDays == null ? 'n/a (no burn signal)' : Math.floor(r.runwayDays) + ' days'} · liquid ${Math.round(r.liquidCash)} EGP · burn ${Math.round(r.dailyBurn)}/day`);
  L.push(`COMMITMENTS: ${open.length} open, ${broken.length} broken` + (open.length ? ' — ' + open.slice(0, 4).map((c) => `“${c.text}” by ${new Date(c.deadline).toLocaleDateString('en-GB')}`).join('; ') : ''));
  L.push(`LEADS: ${leads.length} in pipeline (${leads.filter((l) => l.stage === 'FOUND' || l.stage === 'RESEARCHED').length} early)`);
  if (inquiries.length) L.push('INQUIRIES: ' + inquiries.map((e) => String(e.meta?.summary || e.meta?.subject)).join('; '));
  if (escal.length) L.push('DEADLINES: ' + escal.map((e) => `${e.meta?.text} (${e.meta?.tier || e.meta?.days + 'd'})`).join('; '));
  if (anom.length) L.push('ANOMALIES: ' + anom.map((e) => String(e.meta?.detail)).join('; '));
  if (bigRadar.length) L.push('RADAR(big): ' + bigRadar.map((e) => String(e.meta?.summary)).join('; '));
  if (recos.length) L.push('RADAR(recs): ' + recos.map((e) => String(e.meta?.title)).join('; '));
  return L.join('\n');
}

const SYSTEM =
  'You are THE COUNSEL — KAI\'s judgment, working for Ali Kaiser (Cairo — Hidden Garden, ' +
  'Makadi Airbnb, a German CX agency, Von Kaiser Farms; clearing debt, building runway). ' +
  'Read his whole Spine and deliver ONE ruling, not a conversation. Be decisive and calm, ' +
  'no hedging, no flattery. Name the single most important move. Cite the Spine facts that ' +
  'drive each line (use their real numbers/names). Hard format:\n' +
  'Line 1 — "VERDICT: <one sentence, the ruling>".\n' +
  'Then AT MOST 4 more lines of reasoning, each ONE sentence citing a Spine fact.\n' +
  'Never exceed 5 lines total. Never invent facts not in the digest.';

/* Produce a ruling. Reads the Spine, calls the heavy model, logs a
   counsel/ruling event so the ledger keeps the judgment. */
export async function counsel(now = Date.now()): Promise<Ruling> {
  const raw = await askClaude(`SPINE DIGEST:\n${digest(now)}\n\nDeliver the ruling.`, [], {
    tier: 'heavy', feature: 'counsel', maxTokens: 400,
  });
  const allLines = String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5);
  const verdict = (allLines[0] || 'VERDICT: hold the line.').replace(/^VERDICT:\s*/i, '');
  const ruling: Ruling = { verdict, lines: allLines, at: now };
  try {
    logEvent({ domain: 'counsel', type: 'ruling', meta: { verdict: verdict.slice(0, 200), lines: allLines }, source: 'ai', ts: now });
  } catch { /* ignore */ }
  return ruling;
}

/* Auto-trigger gate: once per day, only when the night actually produced
   something worth a ruling (an escalation, anomaly, big radar move, or an
   open inquiry). Returns the ruling, or null when nothing warrants it. */
export async function maybeAutoCounsel(now = Date.now()): Promise<Ruling | null> {
  const today = new Date(now).toISOString().slice(0, 10);
  try { if (localStorage.getItem(LAST_AUTO) === today) return null; } catch { /* ignore */ }

  const recent = getEvents({ since: now - 2 * DAY });
  const worthy =
    recent.some((e) => e.domain === 'deadline' && e.type === 'escalated') ||
    recent.some((e) => e.domain === 'anomaly' && e.type === 'detected') ||
    recent.some((e) => e.domain === 'radar' && e.type === 'finding' && e.meta?.big) ||
    recent.some((e) => e.domain === 'leads' && e.type === 'booking_inquiry');
  if (!worthy) return null;

  try {
    const ruling = await counsel(now);
    try { localStorage.setItem(LAST_AUTO, today); } catch { /* ignore */ }
    return ruling;
  } catch { return null; }
}

/* The latest ruling on record, for surfaces. */
export function lastRuling(now = Date.now()): Ruling | null {
  const evs = getEvents({ domain: 'counsel', type: 'ruling', since: now - 3 * DAY });
  const e = evs[evs.length - 1];
  if (!e) return null;
  return { verdict: String(e.meta?.verdict || ''), lines: (e.meta?.lines as string[]) || [], at: e.ts };
}
