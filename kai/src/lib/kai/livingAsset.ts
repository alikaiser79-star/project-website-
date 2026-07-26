/* ============================================================
   §30.14 THE GARDEN → THE LIVING ASSET.

   Hidden Gärten carries the deepest meaning and the thinnest data. Makadi
   has a Profit Line; the garden had a plant count. This gives it an engine
   of the same standard:

     CARE       per-plant rhythm and an overdue watch, with Cairo heat
                shortening the interval — a 41°C week is not a 24°C week.
     YIELD      harvests logged as real value: quantity × market price →
                an income event, so the garden's earnings sit in the same
                ledger as everything else.
     HERITAGE   his father's trees as records — planted, tended, defended
                (case 2662 attached), photographed over years.
     VENUE      events with capacity, package, revenue and cost, so KAI
                knows the garden's numbers the way it knows Makadi's.

   Everything is an event. Nothing is estimated into existence: with no
   harvests and no events the engine says the garden has produced nothing
   measurable, because that is the truth until he logs one.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { read, write } from './store';
import { toEgp } from './money';
import type { Currency } from '../../types';

const DAY = 86_400_000;
const PRICES_KEY = 'kai.garden.prices';

/* ── care rhythm ─────────────────────────────────────────────── */
/* Cairo: summer is the constraint. Heat shortens every interval. */
export function heatFactor(tempC: number | null): number {
  if (tempC == null) return 1;
  if (tempC >= 40) return 0.5;          // twice as often
  if (tempC >= 35) return 0.7;
  if (tempC >= 30) return 0.85;
  return 1;
}

export interface CareItem {
  id: string; name: string;
  lastWateredAt: number | null;
  intervalDays: number;                 // heat-adjusted
  dueInDays: number | null;             // negative = overdue
  overdue: boolean;
  note: string;
}

interface PlantLike { id: string; name: string; lastWateredAt?: number; waterEveryDays?: number; health?: string }

export function careList(now = Date.now(), tempC: number | null = null): CareItem[] {
  const plants = read<PlantLike[]>('kai.garden.codex', []);
  const f = heatFactor(tempC);
  return plants.map((p) => {
    const base = p.waterEveryDays ?? 4;
    const intervalDays = Math.max(1, Math.round(base * f));
    const last = p.lastWateredAt ?? null;
    const dueInDays = last == null ? null : Math.round((last + intervalDays * DAY - now) / DAY);
    return {
      id: p.id, name: p.name, lastWateredAt: last, intervalDays,
      dueInDays, overdue: dueInDays != null && dueInDays < 0,
      note: last == null
        ? 'never watered on record'
        : dueInDays! < 0 ? `${-dueInDays!}d overdue` : `due in ${dueInDays}d`,
    };
  }).sort((a, b) => (a.dueInDays ?? 999) - (b.dueInDays ?? 999));
}

export function careLine(now = Date.now(), tempC: number | null = null): string {
  const list = careList(now, tempC);
  if (!list.length) return 'No plants in the Codex yet.';
  const over = list.filter((c) => c.overdue);
  /* State the ACTUAL adjustment — "halved" at 38°C would be wrong (×0.7). */
  const heat = tempC != null && tempC >= 30
    ? ` Cairo at ${Math.round(tempC)}°C — intervals cut to ${Math.round(heatFactor(tempC) * 100)}%.`
    : '';
  return over.length
    ? `${over.length} plant${over.length === 1 ? '' : 's'} overdue: ${over.slice(0, 4).map((c) => `${c.name} (${c.note})`).join(', ')}.${heat}`
    : `All ${list.length} tended. Next: ${list[0].name} ${list[0].note}.${heat}`;
}

/* ── yield → real value ──────────────────────────────────────── */
export type Unit = 'kg' | 'bunch' | 'piece' | 'litre';
export interface Price { crop: string; egpPerUnit: number; unit: Unit; at: number }

export function setPrice(crop: string, egpPerUnit: number, unit: Unit = 'kg', now = Date.now()): void {
  const list = read<Price[]>(PRICES_KEY, []).filter((p) => p.crop.toLowerCase() !== crop.toLowerCase());
  list.push({ crop, egpPerUnit, unit, at: now });
  write(PRICES_KEY, list);
}
export function prices(): Price[] { return read<Price[]>(PRICES_KEY, []); }
export function priceOf(crop: string): Price | null {
  return prices().find((p) => p.crop.toLowerCase() === crop.toLowerCase()) ?? null;
}

/* A harvest becomes an income event when — and only when — a market price
   is on record. Without one it is still logged, but with no value, because
   inventing a price would put a number in the ledger he never gave. */
export function logHarvest(crop: string, quantity: number, unit: Unit = 'kg', now = Date.now()): { valued: boolean; egp: number } {
  const p = priceOf(crop);
  const egp = p ? Math.round(quantity * p.egpPerUnit) : 0;
  try {
    logEvent({
      domain: 'garden', type: 'harvest', value: quantity,
      meta: { crop, unit, egp: p ? egp : null, priced: !!p },
      source: 'user', ts: now,
    });
    if (p && egp > 0) {
      logEvent({ domain: 'income', type: 'received', value: egp, ccy: 'EGP', meta: { src: 'garden', crop, quantity, unit }, source: 'user', ts: now });
    }
  } catch { /* ignore */ }
  return { valued: !!p, egp };
}

/* ── venue ───────────────────────────────────────────────────── */
export interface GardenEvent { name: string; guests: number; revenueEgp: number; costEgp: number; at: number }

export function logGardenEvent(e: GardenEvent): void {
  const net = Math.round(e.revenueEgp - e.costEgp);
  try {
    logEvent({ domain: 'garden', type: 'event_held', value: e.guests, meta: { name: e.name, guests: e.guests, revenue: Math.round(e.revenueEgp), cost: Math.round(e.costEgp), net }, source: 'user', ts: e.at });
    if (e.revenueEgp > 0) logEvent({ domain: 'income', type: 'received', value: Math.round(e.revenueEgp), ccy: 'EGP', meta: { src: 'garden_event', name: e.name, guests: e.guests }, source: 'user', ts: e.at });
    if (e.costEgp > 0) logEvent({ domain: 'expense', type: 'expense_logged', value: Math.round(e.costEgp), ccy: 'EGP', meta: { merchant: 'garden event: ' + e.name }, source: 'user', ts: e.at });
  } catch { /* ignore */ }
}

/* ── heritage ────────────────────────────────────────────────── */
export interface Heritage { id: string; what: string; plantedBy: string; plantedAt: number | null; note: string; caseRef?: string }

export function recordHeritage(h: Omit<Heritage, 'id'>, now = Date.now()): void {
  try {
    logEvent({
      domain: 'garden', type: 'heritage',
      meta: { what: h.what, plantedBy: h.plantedBy, plantedAt: h.plantedAt, note: h.note, caseRef: h.caseRef ?? null },
      source: 'user', ts: now,
    });
  } catch { /* ignore */ }
}

export function heritage(): Heritage[] {
  return getEvents({ domain: 'garden', type: 'heritage' }).map((e) => ({
    id: e.id,
    what: String(e.meta?.what || ''),
    plantedBy: String(e.meta?.plantedBy || ''),
    plantedAt: e.meta?.plantedAt != null ? Number(e.meta.plantedAt) : null,
    note: String(e.meta?.note || ''),
    caseRef: e.meta?.caseRef ? String(e.meta.caseRef) : undefined,
  }));
}

/* ── the garden's P&L, the same standard as Makadi's ─────────── */
export interface GardenLedger {
  harvests: number; harvestEgp: number; unpriced: number;
  events: number; eventRevenueEgp: number; eventCostEgp: number;
  investedEgp: number; earnedEgp: number; net: number;
  plants: number; heritageCount: number;
  verdict: string;
}

export function gardenLedger(now = Date.now()): GardenLedger {
  const evs = getEvents({ domain: 'garden' });
  const harvests = evs.filter((e) => e.type === 'harvest');
  const harvestEgp = harvests.reduce((s, e) => s + (Number(e.meta?.egp) || 0), 0);
  const unpriced = harvests.filter((e) => !e.meta?.priced).length;

  const events = evs.filter((e) => e.type === 'event_held');
  const eventRevenueEgp = events.reduce((s, e) => s + (Number(e.meta?.revenue) || 0), 0);
  const eventCostEgp = events.reduce((s, e) => s + (Number(e.meta?.cost) || 0), 0);

  /* garden-attributable spending from the expense ledger */
  const investedEgp = getEvents({ domain: 'expense' })
    .filter((e) => /garden|plant|soil|seed|irrigat/i.test(`${e.type} ${JSON.stringify(e.meta || {})}`))
    .reduce((s, e) => s + toEgp(e.value || 0, (e.ccy as Currency) || 'EGP'), 0);

  const earnedEgp = harvestEgp + eventRevenueEgp;
  const net = earnedEgp - investedEgp;
  const plants = read<PlantLike[]>('kai.garden.codex', []).length;
  const heritageCount = evs.filter((e) => e.type === 'heritage').length;

  const egp = (n: number) => Math.round(n).toLocaleString('en-GB');
  let verdict: string;
  if (!harvests.length && !events.length) {
    verdict = investedEgp > 0
      ? `${egp(investedEgp)} EGP into the garden and nothing measured out yet. Log a harvest or an event and it starts keeping score.`
      : 'Nothing measured yet — the garden has no numbers until a harvest or an event is logged.';
  } else {
    verdict = `${egp(earnedEgp)} EGP earned against ${egp(investedEgp)} EGP invested — ${net >= 0 ? `+${egp(net)} net` : `${egp(-net)} still down`}.`
      + (unpriced ? ` ${unpriced} harvest${unpriced === 1 ? '' : 's'} unvalued — set a market price to count them.` : '');
  }

  return { harvests: harvests.length, harvestEgp, unpriced, events: events.length, eventRevenueEgp, eventCostEgp, investedEgp, earnedEgp, net, plants, heritageCount, verdict };
}

/* The one-screen read. */
export function gardenText(now = Date.now(), tempC: number | null = null): string {
  const l = gardenLedger(now);
  const L: string[] = [];
  L.push('HIDDEN GÄRTEN');
  L.push(l.verdict);
  L.push('');
  L.push(careLine(now, tempC));
  if (l.events) L.push(`${l.events} event${l.events === 1 ? '' : 's'} held · ${Math.round(l.eventRevenueEgp).toLocaleString('en-GB')} EGP revenue, ${Math.round(l.eventCostEgp).toLocaleString('en-GB')} EGP cost.`);
  if (l.harvests) L.push(`${l.harvests} harvest${l.harvests === 1 ? '' : 's'} · ${Math.round(l.harvestEgp).toLocaleString('en-GB')} EGP.`);
  const h = heritage();
  if (h.length) {
    L.push('');
    L.push('HERITAGE');
    for (const x of h) {
      const when = x.plantedAt ? new Date(x.plantedAt).getFullYear() : '—';
      L.push(`  ${x.what} · planted by ${x.plantedBy} (${when})${x.caseRef ? ` · case ${x.caseRef}` : ''}`);
      if (x.note) L.push(`    ${x.note}`);
    }
  }
  return L.join('\n');
}
