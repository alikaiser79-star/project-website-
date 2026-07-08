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
        health: 'thriving',
      },
      { name: 'Bird-of-Paradise Row', species: 'Strelitzia reginae', speciesConfidence: 'high', zone: 'South border', health: 'thriving' },
      { name: 'Lemon Tree', species: 'Citrus limon', speciesConfidence: 'high', zone: 'South side', health: 'watch', notes: 'Pruning due — south side.' },
      { name: 'The Four Monsteras', species: 'Monstera deliciosa', speciesConfidence: 'high', zone: 'Nursery', health: 'thriving', notes: 'Recently repotted (4 new).' },
    ];
    for (const s of seeds) addPlant(s);
    try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
    return { ran: true, count: seeds.length };
  } catch { return { ran: false }; }
}

export const HEALTH_META: Record<PlantHealth, { dot: string; label: string }> = {
  thriving: { dot: '#7AE6A8', label: 'Thriving' },
  watch:    { dot: '#FFB300', label: 'Watch' },
  ailing:   { dot: '#E0503A', label: 'Ailing' },
  unknown:  { dot: '#7d7d7d', label: 'Unknown' },
};
