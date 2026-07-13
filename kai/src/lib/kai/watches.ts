/* ============================================================
   DAS RADAR (§19) + THE WATCHERS (§14.3) — the watch framework.
   Continuous, READ-ONLY eyes on the live world. A configurable set of
   WATCHES, each = { name, query, domain, cadence, extractRule }. The
   SWEEP runs each DUE watch through the existing agent (one search per
   watch — the one-search-cap), logs findings to the Spine as cited
   radar/finding events, then the RECOMMENDER reads findings against the
   Spine and issues ≤3 gate-proposed actions. Every action stays
   gate-proposed — recommendations propose, Kaiser disposes.

   §14.3's Makadi market-watcher and Gmail lead-watcher are just watches
   in this framework (domains 'makadi' and 'leads').
   ============================================================ */

import { read, write, emit } from './store';
import { getEvents, logEvent } from './events';

const KEY = 'kai.watches';
const SEED_FLAG = 'kai.watches.seeded.v1';
const DAY = 86_400_000;

export type WatchCadence = 'daily' | 'weekly' | 'monthly';
export type WatchDomain = 'makadi' | 'expat' | 'content' | 'competitor' | 'fx' | 'leads' | 'custom';

export interface Watch {
  id: string;
  name: string;
  query: string;            // search query or URL
  domain: WatchDomain;
  cadence: WatchCadence;
  extractRule?: string;     // what to pull from results (guides the agent)
  alertRule?: string;       // when a change is worth surfacing (e.g. ">15% move")
  enabled: boolean;
  lastRun?: number;
  lastFinding?: string;
}

const CADENCE_MS: Record<WatchCadence, number> = { daily: DAY, weekly: 7 * DAY, monthly: 30 * DAY };

export function listWatches(): Watch[] { return read<Watch[]>(KEY, []); }
function writeAll(list: Watch[]) { write(KEY, list); emit(); }

export function addWatch(input: Partial<Watch> & { name: string; query: string }): Watch {
  const w: Watch = {
    id: 'w-' + Math.random().toString(36).slice(2, 9),
    name: input.name, query: input.query,
    domain: input.domain || 'custom',
    cadence: input.cadence || 'weekly',
    extractRule: input.extractRule,
    alertRule: input.alertRule,
    enabled: input.enabled ?? true,
  };
  writeAll([...listWatches(), w]);
  try { logEvent({ domain: 'radar', type: 'watch_added', meta: { id: w.id, name: w.name, cadence: w.cadence }, source: 'user' }); } catch { /* ignore */ }
  return w;
}
export function updateWatch(id: string, patch: Partial<Watch>): void {
  writeAll(listWatches().map((w) => (w.id === id ? { ...w, ...patch } : w)));
}
export function removeWatch(id: string): void { writeAll(listWatches().filter((w) => w.id !== id)); }

/* Watches whose cadence has elapsed (or never run) and are enabled. */
export function dueWatches(now = Date.now()): Watch[] {
  return listWatches().filter((w) => w.enabled && (!w.lastRun || now - w.lastRun >= CADENCE_MS[w.cadence]));
}

/* Record a finding: a cited radar event + touch the watch. Findings ALWAYS
   carry their source URL (or note the absence). changed=false is valid —
   "checked, unchanged" is honest signal. */
export interface Finding { watchId: string; summary: string; sourceUrl?: string; changed: boolean; big?: boolean; }
export function logFinding(f: Finding, now = Date.now()): void {
  updateWatch(f.watchId, { lastRun: now, lastFinding: f.summary });
  try {
    logEvent({ domain: 'radar', type: 'finding', value: f.changed ? 1 : 0,
      meta: { watchId: f.watchId, summary: f.summary, source: f.sourceUrl || null, big: !!f.big }, source: 'ai', ts: now });
  } catch { /* ignore */ }
}

export function recentFindings(sinceDays = 7, now = Date.now()) {
  return getEvents({ domain: 'radar', type: 'finding', since: now - sinceDays * DAY });
}

/* Sweep summary for the surfaces: "Checked 14, 11 unchanged, 3 need you." */
export function sweepSummary(now = Date.now()): { checked: number; changed: number; big: number } {
  const f = recentFindings(1, now);
  return { checked: f.length, changed: f.filter((e) => (e.value ?? 0) > 0).length, big: f.filter((e) => e.meta?.big).length };
}

/* ── the SWEEP ─────────────────────────────────────────────
   For each due watch, run ONE search (searchFn = the agent's web_search,
   one-search-cap) and record a finding. searchFn is injected so the sweep
   is testable and can run client-side (on app foreground) or be driven by
   the server pulse. Returns the findings logged this sweep. */
export type SearchFn = (query: string, extractRule?: string) => Promise<{ summary: string; sourceUrl?: string; changed: boolean; big?: boolean }>;

export async function runSweep(searchFn: SearchFn, now = Date.now()): Promise<Finding[]> {
  const due = dueWatches(now);
  const out: Finding[] = [];
  for (const w of due) {
    try {
      const r = await searchFn(w.query, w.extractRule);
      const f: Finding = { watchId: w.id, summary: r.summary, sourceUrl: r.sourceUrl, changed: r.changed, big: r.big };
      logFinding(f, now);
      out.push(f);
    } catch {
      /* a failing watch shouldn't abort the sweep; mark it ran so it doesn't hammer. */
      updateWatch(w.id, { lastRun: now });
    }
  }
  return out;
}

/* ── seed: the launch watches (§14.3 + §19) ────────────────── */
export function isWatchesSeeded(): boolean { try { return localStorage.getItem(SEED_FLAG) === '1'; } catch { return false; } }
export function seedWatches(force = false): { ran: boolean; count?: number } {
  try {
    if (!force && isWatchesSeeded()) return { ran: false };
    const seeds: Array<Partial<Watch> & { name: string; query: string }> = [
      { name: 'Makadi market', domain: 'makadi', cadence: 'weekly',
        query: 'comparable Makadi Heights / Hurghada 1BR nightly rates on Booking and Airbnb',
        extractRule: 'median comparable nightly rate in USD, and whether it moved > 15% vs the operator\'s $55',
        alertRule: '>15% market move' },
      { name: 'Expat pulse', domain: 'expat', cadence: 'weekly',
        query: 'CSA Cairo Friday market, BCA events, Maadi expat community days this week',
        extractRule: 'upcoming markets/bazaars/community days = selling opportunities for Von Kaiser Farms / Katie' },
      { name: 'Content radar', domain: 'content', cadence: 'weekly',
        query: 'trending reel formats and audio for street / lifestyle content in MENA this week',
        extractRule: 'trending formats/audio matched to the operator\'s proven street-content style' },
      { name: 'Competitor eye', domain: 'competitor', cadence: 'monthly',
        query: 'Maadi garden venues and event spaces pricing and new offers',
        extractRule: 'pricing and new offers from comparable Maadi garden/event venues' },
      { name: 'FX + rates', domain: 'fx', cadence: 'daily',
        query: 'EUR/EGP and USD/EGP exchange rate today',
        extractRule: 'EUR/EGP and USD/EGP; flag any single-day move over 2%',
        alertRule: '>2% single-day move' },
    ];
    for (const s of seeds) addWatch(s);
    try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
    return { ran: true, count: seeds.length };
  } catch { return { ran: false }; }
}
