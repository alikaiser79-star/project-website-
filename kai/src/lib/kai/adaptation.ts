/* ============================================================
   §23.3 THE ADAPTATION — KAI changes from experience.

   It watches how Ali actually uses it and reshapes itself, no config:
     • shapes he DISMISSES repeatedly      → suppressed (fewer of them)
     • hunt lanes he APPROVES              → boosted (more of them)
     • the hour he actually OPENS          → the preferred dispatch hour
     • organs he NEVER taps                → marked cold (demote themselves)

   All learned from real Spine signals (hunter/dismissed, hunter/actioned,
   system/app_opened, system/organ_tapped). Deterministic; the profile is
   just a read over history. Legible by design — adaptationSummary() states
   plainly what changed, so nothing about KAI is silently different.
   ============================================================ */

import { getEvents, logEvent } from './events';

const DAY = 86_400_000;
const OPEN_DEDUP_MS = 20 * 60 * 1000;      // don't log an "open" more than once per 20 min
const SUPPRESS_AT = 2;                       // dismiss a shape this many times → suppress it
const COLD_AFTER_OPENS = 8;                  // never tapped across this many opens → cold

/* ── signal logging ─────────────────────────────────────── */
export function recordOpen(now = Date.now()): void {
  try {
    const last = getEvents({ domain: 'system', type: 'app_opened' }).slice(-1)[0];
    if (last && now - last.ts < OPEN_DEDUP_MS) return;    // same session — don't double-count
    logEvent({ domain: 'system', type: 'app_opened', meta: { hour: new Date(now).getHours() }, source: 'auto', ts: now });
  } catch { /* boot-safe */ }
}

export function recordOrganTap(id: string, now = Date.now()): void {
  try { logEvent({ domain: 'system', type: 'organ_tapped', meta: { id }, source: 'user', ts: now }); } catch { /* ignore */ }
}

/* ── the profile ─────────────────────────────────────────── */
export interface AdaptationProfile {
  openHour: number | null;
  opens: number;
  preferredLanes: Record<string, number>;
  suppressedShapes: string[];
  organTaps: Record<string, number>;
  coldOrgans: string[];
  changes: string[];
}

const ORGAN_IDS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const ORGAN_LABEL: Record<string, string> = {
  '01': 'Income', '02': 'Debt', '03': 'Garden', '04': 'Makadi', '05': 'Instagram',
  '06': 'Priorities', '07': 'Expenses', '08': 'Content', '09': 'Mirror', '10': 'Ledger',
  '11': 'Tollgate', '12': 'Inbox',
};

export function adaptationProfile(now = Date.now()): AdaptationProfile {
  /* opens → modal hour */
  const opensEv = getEvents({ domain: 'system', type: 'app_opened' });
  const hist: Record<number, number> = {};
  for (const e of opensEv) { const h = Number(e.meta?.hour); if (h >= 0 && h <= 23) hist[h] = (hist[h] || 0) + 1; }
  let openHour: number | null = null, best = 0;
  for (const [h, n] of Object.entries(hist)) if (n > best) { best = n; openHour = Number(h); }

  /* approvals → preferred lanes */
  const preferredLanes: Record<string, number> = {};
  for (const e of getEvents({ domain: 'hunter', type: 'actioned' })) {
    const k = String(e.meta?.kind || 'other'); preferredLanes[k] = (preferredLanes[k] || 0) + 1;
  }

  /* dismissals → suppressed shapes */
  const dismissCount: Record<string, number> = {};
  for (const e of getEvents({ domain: 'hunter', type: 'dismissed' })) {
    const s = String(e.meta?.shape || ''); if (s) dismissCount[s] = (dismissCount[s] || 0) + 1;
  }
  const suppressedShapes = Object.entries(dismissCount).filter(([, n]) => n >= SUPPRESS_AT).map(([s]) => s);

  /* taps → organ affinity → cold organs */
  const organTaps: Record<string, number> = {};
  for (const e of getEvents({ domain: 'system', type: 'organ_tapped' })) {
    const id = String(e.meta?.id || ''); if (id) organTaps[id] = (organTaps[id] || 0) + 1;
  }
  const opens = opensEv.length;
  const coldOrgans = opens >= COLD_AFTER_OPENS ? ORGAN_IDS.filter((id) => !organTaps[id]) : [];

  /* changes — legible, only what the data supports */
  const changes: string[] = [];
  const topLane = Object.entries(preferredLanes).sort((a, b) => b[1] - a[1])[0];
  if (topLane && topLane[1] >= 2) changes.push(`You approve ${laneLabel(topLane[0])} hunts — I rank those higher now.`);
  if (suppressedShapes.length) changes.push(`You keep dismissing ${suppressedShapes.map(shapeLabel).join(', ')} — I've backed off those.`);
  if (openHour != null && opens >= 4) changes.push(`You usually open around ${openHour}:00 — I aim the day's plan there.`);
  if (coldOrgans.length) changes.push(`You never tap ${coldOrgans.map((id) => ORGAN_LABEL[id]).join(', ')} — ${coldOrgans.length === 1 ? "it's" : "they've"} gone cold, so I keep ${coldOrgans.length === 1 ? 'it' : 'them'} out of your way.`);

  return { openHour, opens, preferredLanes, suppressedShapes, organTaps, coldOrgans, changes };
}

function laneLabel(k: string): string {
  return k === 'inquiry' ? 'inquiry-reply' : k === 'lead_nudge' ? 'lead' : k === 'pricing' ? 'pricing' : k === 'broadcast' ? 'broadcast' : k;
}
function shapeLabel(s: string): string {
  return s === 'pricing' ? 'pricing raises' : s === 'broadcast' ? 'broadcasts' : s === 'inquiry' ? 'inquiry nudges' : s.startsWith('lead') ? 'lead nudges' : s;
}

/* ── application helpers (consumed by the Hunter, Command, timing) ── */

/* A ranking multiplier for a hunt lane — approvals nudge it up. */
export function laneWeight(kind: string, now = Date.now()): number {
  const n = getEvents({ domain: 'hunter', type: 'actioned' }).filter((e) => e.meta?.kind === kind).length;
  return 1 + Math.min(0.5, n * 0.12);
}

/* Has this opportunity shape been dismissed enough to suppress persistently?
   (Complements the Hunter's 14-day cooldown with a long-run learned rule.) */
export function isShapeSuppressed(shape: string, now = Date.now()): boolean {
  const n = getEvents({ domain: 'hunter', type: 'dismissed' }).filter((e) => e.meta?.shape === shape).length;
  return n >= SUPPRESS_AT;
}

export function preferredOpenHour(now = Date.now()): number | null {
  return adaptationProfile(now).openHour;
}

export function coldOrgans(now = Date.now()): string[] {
  return adaptationProfile(now).coldOrgans;
}

/* Human-readable: what KAI has learned and changed about itself. */
export function adaptationSummary(now = Date.now()): { changes: string[]; opens: number } {
  const p = adaptationProfile(now);
  return { changes: p.changes.length ? p.changes : ['Still learning how you work — nothing changed yet.'], opens: p.opens };
}
