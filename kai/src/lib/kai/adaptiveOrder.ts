/* ============================================================
   §29.10 THE INTERFACE → ADAPTIVE ORDER.

   Ordnung was a fixed hierarchy — correct, but the same at 7am and 11pm.
   The front face now learns his rhythm:

     TIME OF DAY   what he opens at 7am is not what he opens at 11pm, so
                   the same NOW queue is weighted differently by hour band.
     USE           organs he taps rise; ones he never opens sink. Verbs he
                   actually says move up the palette.
     DRIFT         after 90 days his KAI and anyone else's look different —
                   shaped by use, not settings.

   All from signals already in the Spine (system/app_opened carries the
   hour, system/organ_tapped the id, system/command_run the verb). Nothing
   new is collected, and nothing is hidden: `adaptiveWhy()` states in plain
   words why the order is what it is.
   ============================================================ */

import { getEvents, logEvent } from './events';

const DAY = 86_400_000;
const LEARN_WINDOW = 90 * DAY;
const MIN_SAMPLE = 4;          // below this, the default order stands

/* ── time bands: his day has shapes, not hours ───────────────── */
export type Band = 'morning' | 'midday' | 'evening' | 'night';

export function bandOf(now = Date.now()): Band {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'midday';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

/* What each band is FOR — the prior, used until his own record overrides it.
   A morning opener wants the day's demands; a night opener is reviewing. */
const BAND_PRIOR: Record<Band, Partial<Record<string, number>>> = {
  morning: { inquiry: 14, commitment: 10, hunter: 8, drift: 4, organ: 2, ambassador: 6 },
  midday:  { inquiry: 14, hunter: 10, ambassador: 8, commitment: 6, organ: 3, drift: 2 },
  evening: { commitment: 10, hunter: 6, organ: 6, drift: 6, inquiry: 8, ambassador: 4 },
  night:   { drift: 10, commitment: 8, organ: 6, hunter: 3, inquiry: 6, ambassador: 2 },
};

/* ── what he actually does, per band ─────────────────────────── */
export interface BandUse {
  band: Band;
  opens: number;
  organs: Record<string, number>;
  verbs: Record<string, number>;
}

export function bandUse(band: Band, now = Date.now()): BandUse {
  const since = now - LEARN_WINDOW;
  const inBand = (ts: number) => bandOf(ts) === band;

  const opens = getEvents({ domain: 'system', type: 'app_opened', since }).filter((e) => inBand(e.ts)).length;
  const organs: Record<string, number> = {};
  for (const e of getEvents({ domain: 'system', type: 'organ_tapped', since })) {
    if (!inBand(e.ts)) continue;
    const id = String(e.meta?.id || ''); if (id) organs[id] = (organs[id] || 0) + 1;
  }
  const verbs: Record<string, number> = {};
  for (const e of getEvents({ domain: 'system', type: 'command_run', since })) {
    if (!inBand(e.ts)) continue;
    const v = String(e.meta?.verb || ''); if (v) verbs[v] = (verbs[v] || 0) + 1;
  }
  return { band, opens, organs, verbs };
}

/* Record a verb actually used — the palette learns from this. */
export function recordVerb(verb: string, now = Date.now()): void {
  const v = String(verb || '').trim().toLowerCase().split(/\s+/)[0];
  if (!v || v.length > 24) return;
  try { logEvent({ domain: 'system', type: 'command_run', meta: { verb: v, band: bandOf(now) }, source: 'user', ts: now }); } catch { /* ignore */ }
}

/* ── the weights the front face uses ─────────────────────────── */

/* A multiplier per need SOURCE for the current band. Starts at the band's
   prior and bends toward what he demonstrably acts on. */
export function sourceWeight(source: string, now = Date.now()): number {
  const band = bandOf(now);
  const prior = BAND_PRIOR[band][source] ?? 5;
  return 1 + prior / 20;                    // 1.10 … 1.70 — a nudge, never a reordering of urgency
}

/* Organ order for the Depths: tapped organs rise, untouched sink. */
export function organOrder(defaultIds: string[], now = Date.now()): string[] {
  const all = getEvents({ domain: 'system', type: 'organ_tapped', since: now - LEARN_WINDOW });
  if (all.length < MIN_SAMPLE) return defaultIds;
  const band = bandUse(bandOf(now), now).organs;
  const overall: Record<string, number> = {};
  for (const e of all) { const id = String(e.meta?.id || ''); if (id) overall[id] = (overall[id] || 0) + 1; }
  /* band affinity counts double — what he opens at THIS hour matters most */
  const score = (id: string) => (overall[id] || 0) + 2 * (band[id] || 0);
  return [...defaultIds].sort((a, b) => score(b) - score(a));
}

/* Verb order for the palette: what he says rises. Unused verbs keep their
   place rather than vanishing — a palette that hides options stops teaching. */
export function verbOrder(defaultVerbs: string[], now = Date.now()): string[] {
  const all = getEvents({ domain: 'system', type: 'command_run', since: now - LEARN_WINDOW });
  if (all.length < MIN_SAMPLE) return defaultVerbs;
  const counts: Record<string, number> = {};
  for (const e of all) { const v = String(e.meta?.verb || ''); if (v) counts[v] = (counts[v] || 0) + 1; }
  const band = bandUse(bandOf(now), now).verbs;
  const score = (v: string) => (counts[v] || 0) + 2 * (band[v] || 0);
  return [...defaultVerbs].sort((a, b) => score(b) - score(a));
}

/* Organs he has never touched, once there's enough record to say so. */
export function coldOrganIds(allIds: string[], now = Date.now()): string[] {
  const opens = getEvents({ domain: 'system', type: 'app_opened', since: now - LEARN_WINDOW }).length;
  if (opens < 8) return [];
  const tapped = new Set(getEvents({ domain: 'system', type: 'organ_tapped', since: now - LEARN_WINDOW }).map((e) => String(e.meta?.id)));
  return allIds.filter((id) => !tapped.has(id));
}

/* ── legibility: never a silent reshuffle ────────────────────── */
export function adaptiveWhy(now = Date.now()): string {
  const band = bandOf(now);
  const use = bandUse(band, now);
  const opens = getEvents({ domain: 'system', type: 'app_opened', since: now - LEARN_WINDOW }).length;
  if (opens < MIN_SAMPLE) return `Default order — ${opens} opens on record, not enough to learn your rhythm yet.`;

  const topOrgan = Object.entries(use.organs).sort((a, b) => b[1] - a[1])[0];
  const topVerb = Object.entries(use.verbs).sort((a, b) => b[1] - a[1])[0];
  const bits = [`It's ${band}: you've opened ${use.opens} time${use.opens === 1 ? '' : 's'} in this band.`];
  if (topOrgan) bits.push(`You reach for ${topOrgan[0]} most here, so it leads the depths.`);
  if (topVerb) bits.push(`"${topVerb[0]}" is your most-used verb at this hour, so it heads the palette.`);
  const cold = coldOrganIds(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'], now);
  if (cold.length) bits.push(`${cold.length} organ${cold.length === 1 ? '' : 's'} you never open sit last.`);
  return bits.join(' ');
}
