/* ============================================================
   COMP CLASS — a median is only a price signal if it is a median of
   comparable things.

   The Radar reported a $75.55 nightly median for Makadi and the Hunter
   proposed raising a $55 rate off it. The median was pooling 2-bedrooms,
   sea-view chalets and Phase 2 new-builds with a 1-bedroom. Ali's $55 is
   correct for his class; the "37% under" was an artefact of the pool.

   This is the same defect as three others already in KAI_SCARS: the
   comparison set was drawn from the wrong population. It is worse here
   than elsewhere, because the output was a confident instruction to
   change a real price on a real listing.

   THE RULE THIS FILE ENFORCES:
     A rate move may only be derived from comps that MATCH HIS CLASS —
     same bedroom count, comparable view, comparable phase/age, and a
     review count that means the price is real rather than aspirational.
     Where the comp set is unclassified, there is NO median, no gap and
     no move — and the reason is stated rather than the surface going
     quietly empty.

   A pooled median is not a weaker signal. It is a different measurement
   that happens to be denominated in the same unit, which is exactly what
   makes it dangerous.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { read, write, emit } from './store';

const DAY = 86_400_000;
const MINE_KEY = 'kai.comps.mine';
const COMPS_KEY = 'kai.comps.list';

export type View = 'sea' | 'pool' | 'garden' | 'none';

export interface UnitClass {
  bedrooms: number;
  view: View;
  /* Free text — "Phase 1", "Phase 2", a compound name. Compared loosely. */
  phase?: string;
  ageYears?: number;
  reviews?: number;
}

export interface Comp {
  id: string;
  source: string;              // where it came from
  nightlyUsd: number;
  cls: UnitClass;
  at: number;
  url?: string;
}

/* His own unit. Unset until he states it — and while it is unset, NOTHING
   can be compared to it, which is the correct behaviour rather than a gap
   to be filled with a default. */
export function myUnit(): UnitClass | null {
  const u = read<UnitClass | null>(MINE_KEY, null);
  return u && typeof u.bedrooms === 'number' ? u : null;
}

export function setMyUnit(u: UnitClass): UnitClass {
  write(MINE_KEY, u); emit();
  try { logEvent({ domain: 'makadi', type: 'unit_class_set', meta: { ...u }, source: 'user' }); } catch { /* ignore */ }
  return u;
}

export function comps(): Comp[] { return read<Comp[]>(COMPS_KEY, []); }

export function addComp(c: Omit<Comp, 'id' | 'at'> & { at?: number }): Comp {
  const comp: Comp = { ...c, at: c.at ?? Date.now(), id: 'c-' + Math.random().toString(36).slice(2, 9) };
  write(COMPS_KEY, [...comps(), comp]); emit();
  try {
    logEvent({ domain: 'radar', type: 'comp_recorded', value: c.nightlyUsd, ccy: 'USD',
      meta: { bedrooms: c.cls.bedrooms, view: c.cls.view, phase: c.cls.phase, source: c.source }, source: 'user' });
  } catch { /* ignore */ }
  return comp;
}

export function clearComps(): void { write(COMPS_KEY, []); emit(); }

/* ── comparability ────────────────────────────────────────────
   Deliberately strict. A near-match that is wrong costs more than a
   true match that is missed, because the output is a price change. */

const MIN_REVIEWS = 3;          // below this the asking price is aspirational
const AGE_BAND = 8;             // years
const REVIEW_BAND = 10;         // ×/÷ — a 400-review listing is a different product

export interface Mismatch { field: string; mine: string; theirs: string }

export function compare(c: Comp, mine: UnitClass): Mismatch[] {
  const out: Mismatch[] = [];

  /* Bedrooms is EXACT. A 2BR is not a big 1BR; it sleeps a different party
     at a different price and is the single largest pooling error here. */
  if (c.cls.bedrooms !== mine.bedrooms) {
    out.push({ field: 'bedrooms', mine: String(mine.bedrooms), theirs: String(c.cls.bedrooms) });
  }
  /* View is a price tier of its own — a sea view is not a garden view with
     a premium, it is a different listing. */
  if (c.cls.view !== mine.view) {
    out.push({ field: 'view', mine: mine.view, theirs: c.cls.view });
  }
  if (mine.phase && c.cls.phase && norm(mine.phase) !== norm(c.cls.phase)) {
    out.push({ field: 'phase', mine: mine.phase, theirs: c.cls.phase });
  }
  if (typeof mine.ageYears === 'number' && typeof c.cls.ageYears === 'number'
      && Math.abs(mine.ageYears - c.cls.ageYears) > AGE_BAND) {
    out.push({ field: 'age', mine: `${mine.ageYears}y`, theirs: `${c.cls.ageYears}y` });
  }
  /* A price with no reviews behind it is what somebody HOPES to get. */
  if (typeof c.cls.reviews === 'number' && c.cls.reviews < MIN_REVIEWS) {
    out.push({ field: 'reviews', mine: `${mine.reviews ?? '?'}`, theirs: `${c.cls.reviews} — too few to price from` });
  }
  if (typeof mine.reviews === 'number' && mine.reviews > 0
      && typeof c.cls.reviews === 'number' && c.cls.reviews > 0) {
    const r = c.cls.reviews > mine.reviews ? c.cls.reviews / mine.reviews : mine.reviews / c.cls.reviews;
    if (r > REVIEW_BAND) out.push({ field: 'track record', mine: `${mine.reviews} reviews`, theirs: `${c.cls.reviews} reviews` });
  }
  return out;
}

function norm(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export function comparable(c: Comp, mine: UnitClass): boolean { return compare(c, mine).length === 0; }

/* ── the classed median ───────────────────────────────────────
   Returns null with a REASON whenever it cannot honestly produce one. The
   reason is the product here: a silent empty pricing surface is what let
   the pooled median through in the first place. */

const MIN_POOL = 4;             // below this it is anecdote, not a median

export interface ClassedMedian {
  medianUsd: number;
  n: number;
  low: number;
  high: number;
  cls: UnitClass;
}

export interface NotReady {
  reason: string;
  detail: string;
  matched: number;
  rejected: Array<{ nightlyUsd: number; why: string }>;
}

export function classedMedian(now = Date.now(), windowDays = 120): ClassedMedian | NotReady {
  const mine = myUnit();
  if (!mine) {
    return {
      reason: 'your own class is not on record',
      detail: 'I do not know how many bedrooms your unit has, its view, or its phase — so nothing can be compared to it. Set it once and comps become usable: "my unit 1br garden phase 1".',
      matched: 0, rejected: [],
    };
  }

  const pool = comps().filter((c) => now - c.at <= windowDays * DAY && c.nightlyUsd > 0);
  if (!pool.length) {
    return {
      reason: 'no comps recorded',
      detail: `No comparable listings are on record. The Radar's pooled median mixes bedroom counts, views and phases, so it cannot stand in for one — record ${MIN_POOL} real ${mine.bedrooms}-bedroom comps and this becomes a number you can price against.`,
      matched: 0, rejected: [],
    };
  }

  const matched: Comp[] = [];
  const rejected: NotReady['rejected'] = [];
  for (const c of pool) {
    const diffs = compare(c, mine);
    if (!diffs.length) matched.push(c);
    else rejected.push({ nightlyUsd: c.nightlyUsd, why: diffs.map((d) => `${d.field}: ${d.theirs} vs your ${d.mine}`).join(', ') });
  }

  if (matched.length < MIN_POOL) {
    return {
      reason: 'not enough comparable comps',
      detail: `${matched.length} of ${pool.length} recorded comps actually match your class (${describe(mine)}). ${MIN_POOL} are needed before a median means anything. ${rejected.length ? `The rest differ on: ${[...new Set(rejected.flatMap((r) => r.why.split(', ').map((w) => w.split(':')[0])))].join(', ')}.` : ''}`,
      matched: matched.length, rejected,
    };
  }

  const xs = matched.map((c) => c.nightlyUsd).sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  const medianUsd = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  return { medianUsd, n: xs.length, low: xs[0], high: xs[xs.length - 1], cls: mine };
}

export function isReady(r: ClassedMedian | NotReady): r is ClassedMedian {
  return (r as ClassedMedian).medianUsd !== undefined;
}

export function describe(u: UnitClass): string {
  return `${u.bedrooms}BR · ${u.view === 'none' ? 'no view' : u.view + ' view'}${u.phase ? ' · ' + u.phase : ''}${typeof u.ageYears === 'number' ? ` · ${u.ageYears}y old` : ''}${typeof u.reviews === 'number' ? ` · ${u.reviews} reviews` : ''}`;
}

/* ── the readout ──────────────────────────────────────────── */

export function compsText(now = Date.now()): string {
  const mine = myUnit();
  const r = classedMedian(now);
  const L: string[] = ['THE COMP SET', ''];

  L.push(mine ? `YOUR UNIT: ${describe(mine)}` : 'YOUR UNIT: not set.');
  L.push('');

  if (!isReady(r)) {
    L.push(`NO CLASSED MEDIAN — ${r.reason}.`);
    L.push(`  ${r.detail}`);
    if (r.rejected.length) {
      L.push('');
      L.push('  Recorded but NOT comparable:');
      for (const x of r.rejected.slice(0, 8)) L.push(`    $${x.nightlyUsd} — ${x.why}`);
    }
    L.push('');
    L.push('No rate-raise move will be proposed while this is true. A median of');
    L.push('2-bedrooms, sea-view chalets and new-builds is not a price for a 1BR —');
    L.push('it is a different measurement wearing the same unit.');
    return L.join('\n');
  }

  L.push(`CLASSED MEDIAN: $${r.medianUsd} across ${r.n} matching comps (range $${r.low}–$${r.high}).`);
  L.push(`  Every one of them is ${describe(r.cls)}.`);
  return L.join('\n');
}
