/* ============================================================
   DER GÄRTNER (§10) — the Garten Codex. A per-plant registry for
   Hidden Garten: every tree and plant is a living record with its
   species, zone, age/heritage, photo history, care plan, watering,
   and health. Records live in localStorage (kai.garden.codex);
   full-resolution photos live in IndexedDB (lib/kai/photos.ts) and
   never leave the device — only a thumbnail rides in the record and
   only the frames the operator captures are sent to /api/claude for
   analysis. Meaningful changes fire garden-domain Spine events so
   the Mirror and the water scheduler can reason over history.
   ============================================================ */

import { read, write, emit, uid } from './store';
import { logEvent } from './events';
import type { Plant, PlantHealth, PlantPhoto, PlantDiagnosis } from '../../types';

const KEY = 'kai.garden.codex';
const SEED_FLAG = 'kai.garden.seeded.v1';

export function listPlants(): Plant[] {
  return read<Plant[]>(KEY, []).sort((a, b) => a.createdAt - b.createdAt);
}
export function getPlant(id: string): Plant | undefined {
  return read<Plant[]>(KEY, []).find((p) => p.id === id);
}

function writeAll(list: Plant[]) { write(KEY, list); emit(); }

export function addPlant(input: Partial<Plant> & { name: string }): Plant {
  const p: Plant = {
    id: 'pl-' + uid().slice(0, 8),
    name: input.name,
    species: input.species,
    speciesConfidence: input.speciesConfidence,
    zone: input.zone,
    plantedAt: input.plantedAt,
    ageYears: input.ageYears,
    heritage: input.heritage,
    health: input.health ?? 'unknown',
    lastWateredAt: input.lastWateredAt,
    photos: input.photos ?? [],
    diagnoses: input.diagnoses ?? [],
    carePlan: input.carePlan,
    waterEveryDays: input.waterEveryDays,
    notes: input.notes,
    createdAt: input.createdAt ?? Date.now(),
  };
  writeAll([...read<Plant[]>(KEY, []), p]);
  try { logEvent({ domain: 'garden', type: 'plant_registered', value: 1, meta: { id: p.id, name: p.name }, source: 'user' }); } catch { /* ignore */ }
  return p;
}

export function updatePlant(id: string, patch: Partial<Plant>): void {
  writeAll(read<Plant[]>(KEY, []).map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function removePlant(id: string): void {
  writeAll(read<Plant[]>(KEY, []).filter((p) => p.id !== id));
}

export function setHealth(id: string, health: PlantHealth): void {
  updatePlant(id, { health });
  try { logEvent({ domain: 'garden', type: 'health_set', meta: { id, health }, source: 'user' }); } catch { /* ignore */ }
}

/* Append a capture (thumbnail) to a plant's photo history. The full
   image blob is stored separately in IndexedDB under photo.id. */
export function addPhoto(id: string, photo: PlantPhoto): void {
  const list = read<Plant[]>(KEY, []);
  const next = list.map((p) => (p.id === id ? { ...p, photos: [...p.photos, photo].slice(-24) } : p));
  writeAll(next);
  try { logEvent({ domain: 'garden', type: 'plant_photographed', meta: { id, photoId: photo.id }, source: 'user' }); } catch { /* ignore */ }
}

/* Record an AI diagnosis and reflect its health read on the card. */
export function addDiagnosis(id: string, d: PlantDiagnosis, health?: PlantHealth): void {
  const list = read<Plant[]>(KEY, []);
  const next = list.map((p) => (p.id === id
    ? { ...p, diagnoses: [...p.diagnoses, d].slice(-24), ...(health ? { health } : {}) }
    : p));
  writeAll(next);
  try { logEvent({ domain: 'garden', type: 'plant_diagnosed', meta: { id, confidence: d.confidence }, source: 'ai' }); } catch { /* ignore */ }
}

export function logWatering(id: string): void {
  const now = Date.now();
  updatePlant(id, { lastWateredAt: now });
  try { logEvent({ domain: 'garden', type: 'watered', value: 1, meta: { id }, source: 'user' }); } catch { /* ignore */ }
}

/* Dev/console + verification hooks — parallels __kaiSeed. */
export function installGardenDevHooks(): void {
  try {
    (window as any).__kaiGarden = { listPlants, dueToday, gardenCalls, waterBriefingLine, missedCycles, effectiveInterval, isHeatwave, generateMasterplan };
  } catch { /* ignore */ }
}

export function isCodexSeeded(): boolean {
  try { return localStorage.getItem(SEED_FLAG) === '1'; } catch { return false; }
}

/* Seed the Codex with the known plants of Hidden Garten. Derived from
   the real garden (bird-of-paradise row, lemon tree, the four new
   monsteras — see kaiConfig garden tasks) plus the heritage tree. All
   are fully editable; the operator registers the rest from the UI.
   The 40+yr tree carries its provenance — planted by Horst Kaiser —
   because its photo history doubles as evidence in the مجلس الدولة case. */
export function seedCodex(force = false): { ran: boolean; count?: number } {
  try {
    if (!force && isCodexSeeded()) return { ran: false };
    const YEAR = 365 * 86_400_000;
    const now = Date.now();
    const seeds: Array<Partial<Plant> & { name: string }> = [
      {
        name: 'Horst’s Heritage Tree', species: 'Ficus (mature)', speciesConfidence: 'low',
        zone: 'Heritage row', ageYears: 42, plantedAt: now - 42 * YEAR,
        heritage: 'Planted by Horst Kaiser — 40+ years. Photo history doubles as evidence in the مجلس الدولة case.',
        health: 'thriving', waterEveryDays: 12,
      },
      { name: 'Bird-of-Paradise Row', species: 'Strelitzia reginae', speciesConfidence: 'high', zone: 'South border', health: 'thriving', waterEveryDays: 5 },
      { name: 'Lemon Tree', species: 'Citrus limon', speciesConfidence: 'high', zone: 'South side', health: 'watch', notes: 'Pruning due — south side.', waterEveryDays: 4 },
      { name: 'The Four Monsteras', species: 'Monstera deliciosa', speciesConfidence: 'high', zone: 'Nursery', health: 'thriving', notes: 'Recently repotted (4 new).', waterEveryDays: 4 },
    ];
    for (const s of seeds) addPlant(s);
    try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
    return { ran: true, count: seeds.length };
  } catch { return { ran: false }; }
}

/* ── §10.3 WATER SCHEDULER ────────────────────────────────
   Cadence per plant (waterEveryDays), tightened in a heatwave. A plant
   is "due" when it's never been watered or its interval has elapsed;
   "missed cycles" counts full intervals overdue since the last water.
   The GARDEN organ calls when any plant has missed 2+ cycles. */

const DAY = 86_400_000;
const TEMP_KEY = 'kai.weather.tempC';
const HEAT_C = 38;   // Cairo heatwave threshold — schedule tightens above this

export function cacheTempC(t: number): void { try { localStorage.setItem(TEMP_KEY, String(Math.round(t))); } catch { /* ignore */ } }
export function getCachedTempC(): number | null {
  try { const v = localStorage.getItem(TEMP_KEY); return v == null ? null : Number(v); } catch { return null; }
}
export function isHeatwave(): boolean { const t = getCachedTempC(); return t != null && t >= HEAT_C; }

/* Effective interval, tightened ~40% in a heatwave (floor 1 day). */
export function effectiveInterval(p: Plant): number | null {
  if (!p.waterEveryDays || p.waterEveryDays <= 0) return null;
  return isHeatwave() ? Math.max(1, Math.round(p.waterEveryDays * 0.6)) : p.waterEveryDays;
}

export function isDue(p: Plant, now = Date.now()): boolean {
  const iv = effectiveInterval(p);
  if (iv == null) return false;
  if (!p.lastWateredAt) return true;
  return now - p.lastWateredAt >= iv * DAY;
}

/* Full intervals overdue since the last watering. Never-watered plants
   return 0 (no baseline) so a fresh Codex can't false-fire the organ. */
export function missedCycles(p: Plant, now = Date.now()): number {
  const iv = effectiveInterval(p);
  if (iv == null || !p.lastWateredAt) return 0;
  return Math.max(0, Math.floor((now - p.lastWateredAt) / (iv * DAY)) - 1);
}

export function dueToday(now = Date.now()): Plant[] {
  return listPlants().filter((p) => isDue(p, now));
}
export function gardenCalls(now = Date.now()): boolean {
  return listPlants().some((p) => missedCycles(p, now) >= 2);
}

/* One-line watering plan for the briefing: what to water (by zone) and
   what to skip, with a heatwave note. */
export function waterBriefingLine(now = Date.now()): string | null {
  const scheduled = listPlants().filter((p) => effectiveInterval(p) != null);
  if (!scheduled.length) return null;
  const due = scheduled.filter((p) => isDue(p, now));
  const heat = isHeatwave() ? ` Heatwave (${getCachedTempC()}°C) — schedule tightened.` : '';
  if (!due.length) return `Watering: all current — nothing due today.${heat}`;
  const zones = Array.from(new Set(due.map((p) => p.zone || p.name)));
  const skip = scheduled.length - due.length;
  return `Water: ${zones.slice(0, 4).join(' + ')}${zones.length > 4 ? ' +' + (zones.length - 4) : ''}` +
    `${skip ? ` · skip the ${scheduled.length - due.length} that are current` : ''}.${heat}`;
}

export const HEALTH_META: Record<PlantHealth, { dot: string; label: string }> = {
  thriving: { dot: '#7AE6A8', label: 'Thriving' },
  watch:    { dot: '#FFB300', label: 'Watch' },
  ailing:   { dot: '#E0503A', label: 'Ailing' },
  unknown:  { dot: '#7d7d7d', label: 'Unknown' },
};

/* ── §10.3 CARE MASTERPLAN — one generation over the whole Codex ──
   KAI takes the full registry + Cairo (Maadi) climate + the season and
   returns a per-plant plan: watering cadence + a short care plan
   (feeding, pruning window, repotting). Applied to each record. */
export async function generateMasterplan(): Promise<{ ok: boolean; updated: number; reason?: string }> {
  const { claudeConfig } = await import('../../kaiConfig');
  if (!claudeConfig.enabled) return { ok: false, updated: 0, reason: 'NO_API_KEY' };
  const plants = listPlants();
  if (!plants.length) return { ok: false, updated: 0, reason: 'empty' };

  const month = new Date().toLocaleDateString('en-GB', { month: 'long' });
  const codex = plants.map((p) => `- id:${p.id} | ${p.name} | species:${p.species || 'unknown'} | zone:${p.zone || '—'} | health:${p.health}${p.ageYears ? ` | ~${p.ageYears}yr` : ''}`).join('\n');
  const system =
    `You are KAI's head gardener for Hidden Garten in Maadi, Cairo — hot arid climate, ` +
    `intense summer sun, hard alkaline water. Produce a concrete seasonal care plan per plant.`;
  const prompt =
    `Month: ${month}. Garden: Maadi, Cairo.\n\nCODEX:\n${codex}\n\n` +
    `For EACH plant return a care plan tuned to Cairo and the season: watering cadence, feeding, ` +
    `pruning window, repotting if due. Return ONLY a JSON array, one object per plant:\n` +
    `[{ "id": "<id>", "waterEveryDays": <int>, "carePlan": "<2-4 short lines: watering, feeding, pruning, repotting>" }]`;

  try {
    const res = await fetch(claudeConfig.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: claudeConfig.model, max_tokens: 1500, system, messages: [{ role: 'user', content: prompt }] }),
    });
    if (res.status === 503) return { ok: false, updated: 0, reason: 'NO_API_KEY' };
    if (!res.ok) return { ok: false, updated: 0, reason: 'api ' + res.status };
    const data = await res.json();
    const text = (data?.content?.[0]?.text || '').trim();
    let arr: any = null;
    try { arr = JSON.parse(text); } catch { const m = text.match(/\[[\s\S]*\]/); if (m) { try { arr = JSON.parse(m[0]); } catch { /* ignore */ } } }
    if (!Array.isArray(arr)) return { ok: false, updated: 0, reason: 'parse' };
    let updated = 0;
    for (const row of arr) {
      if (!row || typeof row.id !== 'string') continue;
      const patch: Partial<Plant> = {};
      if (typeof row.waterEveryDays === 'number' && row.waterEveryDays > 0) patch.waterEveryDays = Math.round(row.waterEveryDays);
      if (typeof row.carePlan === 'string') patch.carePlan = row.carePlan.trim();
      if (Object.keys(patch).length) { updatePlant(row.id, patch); updated++; }
    }
    try { logEvent({ domain: 'garden', type: 'masterplan_generated', value: updated, source: 'ai' }); } catch { /* ignore */ }
    return { ok: true, updated };
  } catch (e: any) {
    return { ok: false, updated: 0, reason: String(e?.message || e) };
  }
}
