/* ============================================================
   DAS RADAR (§19) — the orchestrator. Turns the watch framework
   (watches.ts) into live intelligence:

     THE SWEEP        run each DUE watch through ONE server search
                      (/api/agent/search, the one-search-cap), log a
                      cited radar/finding event per watch.
     THE RECOMMENDER  read the CHANGED findings against the Spine and
                      issue ≤3 recommendations — surfaced, never fired.
                      "Checked 14, 3 need you." Propose; Kaiser disposes.

   HARD RULE (§19): read-only. The sweep only reads the web; the
   recommender only WRITES advisory radar/recommendation events. Nothing
   leaves the device without a human tap at the Gate.

   The sweep is throttled and runs on app foreground (and can be nudged
   by the pulse via the Night Ledger). No cron, no daemon — safe on Hobby.
   ============================================================ */

import { getEvents } from './events';
import { logEvent } from './events';
import { getCommitments } from './commitments';
import { getLeads } from './leads';
import {
  type SearchFn, runSweep, seedWatches, isWatchesSeeded,
  recentFindings, sweepSummary, listWatches,
} from './watches';
import { askClaude } from '../claude';
import { scanInbox } from './mailwatch';
import { scanBookings } from './bookingwatch';

const LAST_SWEEP = 'kai.radar.lastSweep';
const LAST_RECO = 'kai.radar.lastReco';       // YYYY-MM-DD — recommend at most once/day
const MIN_SWEEP_GAP = 3 * 60 * 60 * 1000;     // don't hammer: ≥3h between sweeps
const DAY = 86_400_000;

/* The injected search: one watch → one server search + cheap distil. */
export const radarSearchFn: SearchFn = async (query, extractRule) => {
  const watch = listWatches().find((w) => w.query === query);
  const r = await fetch('/api/agent/search', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, extractRule, alertRule: watch?.alertRule, prior: watch?.lastFinding || '' }),
  });
  if (!r.ok) throw new Error('search_' + r.status);
  const d = await r.json();
  return { summary: String(d.summary || 'Checked.'), sourceUrl: d.sourceUrl || undefined, changed: !!d.changed, big: !!d.big };
};

/* Which server keys the Radar needs are present — booleans only. Lets the
   panel warn "no web search key" without the operator curling anything. */
export interface RadarHealth { anthropic: boolean; tavily: boolean; ready: boolean; }
export async function radarHealth(): Promise<RadarHealth | null> {
  try {
    const r = await fetch('/api/agent/search?health');
    if (!r.ok) return null;
    const d = await r.json();
    return { anthropic: !!d.anthropic, tavily: !!d.tavily, ready: !!d.ready };
  } catch { return null; }
}

function lastSweepAt(): number { try { return Number(localStorage.getItem(LAST_SWEEP)) || 0; } catch { return 0; } }
function markSwept(now: number) { try { localStorage.setItem(LAST_SWEEP, String(now)); } catch { /* ignore */ } }

export interface SweepResult { ran: boolean; checked: number; changed: number; big: number; recommended: number; }

/* THE SWEEP — foreground entry point. Seeds the launch watches on first
   run, sweeps DUE watches (throttled), then recommends off what changed. */
export async function sweepNow(force = false, now = Date.now()): Promise<SweepResult> {
  if (!isWatchesSeeded()) seedWatches();
  if (!force && now - lastSweepAt() < MIN_SWEEP_GAP) {
    const s = sweepSummary(now);
    return { ran: false, checked: s.checked, changed: s.changed, big: s.big, recommended: 0 };
  }
  let findings: Awaited<ReturnType<typeof runSweep>> = [];
  try { findings = await runSweep(radarSearchFn, now); }
  catch { /* whole-sweep failure shouldn't throw into the UI */ }
  /* §14.3 — the Gmail watchers run on the same beat (own throttles). The
     booking-watcher is the priority one: it can fire the first-booking push. */
  try { await scanBookings(false, now); } catch { /* Gmail may not be wired */ }
  try { await scanInbox(false, now); } catch { /* Gmail may not be wired */ }
  markSwept(now);

  let recommended = 0;
  if (findings.some((f) => f.changed)) {
    try { recommended = await recommend(now); } catch { /* recommender is best-effort */ }
  }
  const changed = findings.filter((f) => f.changed).length;
  const big = findings.filter((f) => f.big).length;
  return { ran: true, checked: findings.length, changed, big, recommended };
}

/* THE RECOMMENDER — reads the last day's CHANGED findings against the
   Spine and issues ≤3 concrete recommendations, each stored as an
   advisory radar/recommendation event. Surfaced in the Radar panel and
   the Night Ledger; fired only when Ali taps. At most once per day. */
export async function recommend(now = Date.now()): Promise<number> {
  const today = new Date(now).toISOString().slice(0, 10);
  try { if (localStorage.getItem(LAST_RECO) === today) return 0; } catch { /* ignore */ }

  const changed = recentFindings(1, now).filter((e) => (e.value ?? 0) > 0);
  if (!changed.length) return 0;

  const findingLines = changed.slice(0, 8).map((e) => {
    const m = e.meta || {};
    return `- ${m.summary}${m.source ? ` [${m.source}]` : ''}${m.big ? ' (BIG)' : ''}`;
  }).join('\n');

  const ev = getEvents({ since: now - 7 * DAY });
  const byDomain: Record<string, number> = {};
  for (const e of ev) byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  const spineLine =
    `open commitments: ${getCommitments().filter((c: any) => c.status === 'open').length}; ` +
    `leads: ${getLeads().length}; recent: ${Object.entries(byDomain).map(([d, n]) => `${d}×${n}`).join(', ')}`;

  const prompt =
    'You are KAI\'s radar recommender for Ali Kaiser (Cairo — Hidden Garden, Makadi Airbnb, ' +
    'a German CX agency, Von Kaiser Farms). Below are TODAY\'s changed radar findings and a ' +
    'snapshot of his Spine. Propose UP TO 3 concrete actions he should consider now — one ONLY ' +
    'if a finding clearly warrants it, fewer is better, [] is fine. Each must cite the finding ' +
    'that drives it. You do NOT act; these are surfaced for his decision.\n' +
    'Return ONLY a JSON array of {"title":"<=8 words","why":"one line citing the finding",' +
    '"kind":"email"|"pricing"|"content"|"outreach"|"watch"}.\n\n' +
    `CHANGED FINDINGS:\n${findingLines}\n\nSPINE: ${spineLine}`;

  let arr: any[] = [];
  try {
    const raw = await askClaude(prompt, [], { tier: 'heavy', feature: 'radar-reco', maxTokens: 500 });
    const m = String(raw || '').match(/\[[\s\S]*\]/);
    if (m) arr = JSON.parse(m[0]);
  } catch { return 0; }
  if (!Array.isArray(arr)) return 0;

  const recos = arr.filter((r) => r && r.title).slice(0, 3);
  for (const r of recos) {
    logEvent({
      domain: 'radar', type: 'recommendation',
      meta: { title: String(r.title).slice(0, 80), why: String(r.why || '').slice(0, 160), kind: String(r.kind || 'watch') },
      source: 'ai', ts: now,
    });
  }
  if (recos.length) { try { localStorage.setItem(LAST_RECO, today); } catch { /* ignore */ } }
  return recos.length;
}

/* Open recommendations from today, for the Radar panel + Night Ledger. */
export function openRecommendations(now = Date.now()) {
  return getEvents({ domain: 'radar', type: 'recommendation', since: now - DAY });
}

/* One-line radar state for surfaces: "Checked 14 · 3 changed · 2 need you". */
export function radarLine(now = Date.now()): string | null {
  const s = sweepSummary(now);
  if (!s.checked) return null;
  const recos = openRecommendations(now).length;
  const parts = [`Checked ${s.checked}`];
  if (s.changed) parts.push(`${s.changed} changed`);
  if (recos) parts.push(`${recos} need you`);
  else parts.push('nothing needs you');
  return parts.join(' · ');
}
