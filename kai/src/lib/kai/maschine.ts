/* ============================================================
   §35 DIE MASCHINE — the machine that makes machines.

   KAI stops helping Kaiser earn and starts measuring whether what he
   earns COMPOUNDS. Three parts, one idea: the shape of an income line
   matters more than its size.

   35.1 THE COMPOUNDING LAW — every line classified by TYPE, and every
        opportunity ranked by type FIRST, money second. A 1,500 EGP
        booking and a $10/month client look identical in a total. They
        are not: one is a night, the other never stops.

   35.2 THE FACTORY — the studio is a job until client #10 costs less
        than client #1. That is a measurement, not an opinion, and this
        file makes it.

   35.3 THE VERTICAL — managing other owners' apartments is the leap from
        asset-owner to operator. It is ALSO the fastest way to buy
        yourself a worse job. The test is whether MINUTES PER UNIT falls
        as units are added. If it rises, the machine isn't a machine.

   WHAT THIS FILE WILL NOT DO:
     • It will not project a freedom date from a growth rate. Two good
       months is not a trend, and a date is the most seductive fabricated
       number available here.
     • It will not classify a line as MULTIPLYING because it sounds like
       it. Multiplying means yield PER UNIT rose as units grew, and that
       has to be visible in the record or the label is not awarded.
     • Where a hours figure is required and was never logged, it returns
       null and says the measurement cannot be made. Build hours are the
       one thing this app cannot see unless he tells it.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';
import { computeRunway } from './runway';
import { toEgp } from './money';
import { read, write, emit } from './store';
import type { Currency } from '../../types';

const DAY = 86_400_000;
const OVERRIDE_KEY = 'kai.maschine.types';

/* ── 35.1 THE COMPOUNDING LAW ─────────────────────────────── */

export type IncomeType = 'LINEAR' | 'ASSET' | 'RECURRING' | 'MULTIPLYING';

/* Ranked by how the money behaves over time, NOT by how much of it there
   is. This ordering is the whole reframing the section asks for. */
export const TYPE_RANK: Record<IncomeType, number> = {
  MULTIPLYING: 4, RECURRING: 3, ASSET: 2, LINEAR: 1,
};

export const TYPE_MEANING: Record<IncomeType, string> = {
  LINEAR: 'trades your hours for money — stops the day you stop',
  ASSET: 'earns while you sleep, but once per unit',
  RECURRING: 'one act, then it earns without being repeated',
  MULTIPLYING: 'earns MORE per unit as it grows',
};

/* Deterministic classification. Recurrence is a fact about cadence, not a
   guess: a line is RECURRING only when the record shows it arriving on a
   repeating schedule from a single act. */
const LINEAR_RE = /\benpal|salary|shift|freelance|one.?off|hourly|per.hour|contract work|cx\b/i;
const ASSET_RE = /\bmakadi|airbnb|booking|night|rent|garden event|venue\b/i;
const RECURRING_RE = /\bsubscription|retainer|monthly|maintenance|hosting|care plan|per month|\/mo\b/i;

export function classify(label: string, meta: Record<string, any> = {}): IncomeType {
  const override = read<Record<string, IncomeType>>(OVERRIDE_KEY, {})[label.toLowerCase()];
  if (override) return override;
  if (meta.recurring === true || meta.cadence === 'monthly') return 'RECURRING';
  const blob = `${label} ${JSON.stringify(meta)}`;
  if (RECURRING_RE.test(blob)) return 'RECURRING';
  if (ASSET_RE.test(blob)) return 'ASSET';
  if (LINEAR_RE.test(blob)) return 'LINEAR';
  return 'LINEAR';                 // the honest default: assume it costs hours
}

export function setType(label: string, type: IncomeType): void {
  const m = read<Record<string, IncomeType>>(OVERRIDE_KEY, {});
  m[label.toLowerCase()] = type;
  write(OVERRIDE_KEY, m); emit();
  try { logEvent({ domain: 'system', type: 'income_type_set', meta: { label, type }, source: 'user' }); } catch { /* ignore */ }
}

export interface Line {
  label: string;
  type: IncomeType;
  monthlyEgp: number;
  months: number;
  events: number;
  /* MULTIPLYING is EARNED, never assumed: per-unit yield must have risen
     across the record. This carries the proof or the reason it failed. */
  multiplyingProof: string | null;
}

function monthKey(ts: number): string { return new Date(ts).toISOString().slice(0, 7); }

function egpOf(e: KaiEvent): number {
  const v = typeof e.value === 'number' ? e.value : 0;
  return e.ccy ? toEgp(v, e.ccy as Currency) : v;
}

export function lines(now = Date.now(), windowDays = 365): Line[] {
  const evs = getEvents({ domain: 'income', since: now - windowDays * DAY })
    .filter((e) => typeof e.value === 'number' && e.value > 0);
  const makadi = getEvents({ domain: 'makadi', type: 'booking_confirmed', since: now - windowDays * DAY })
    .filter((e) => typeof e.value === 'number' && e.value > 0);

  const buckets = new Map<string, KaiEvent[]>();
  for (const e of evs) {
    const k = String(e.meta?.label || e.meta?.source || 'unlabelled');
    buckets.set(k, [...(buckets.get(k) || []), e]);
  }
  if (makadi.length) buckets.set('Makadi nights', [...(buckets.get('Makadi nights') || []), ...makadi]);

  const out: Line[] = [];
  for (const [label, list] of buckets) {
    const months = new Set(list.map((e) => monthKey(e.ts))).size || 1;
    const total = list.reduce((s, e) => s + egpOf(e), 0);
    const base = classify(label, list[list.length - 1].meta || {});
    const proof = multiplyingProof(label, list);
    out.push({
      label,
      /* Promotion to MULTIPLYING happens only on evidence, and only from
         a type that could plausibly compound in the first place. */
      type: proof && base !== 'LINEAR' ? 'MULTIPLYING' : base,
      monthlyEgp: total / months,
      months,
      events: list.length,
      multiplyingProof: proof,
    });
  }
  return out.sort((a, b) =>
    TYPE_RANK[b.type] - TYPE_RANK[a.type] || b.monthlyEgp - a.monthlyEgp);
}

/* MULTIPLYING means the yield PER UNIT rose as the number of units grew.
   Not "it got bigger" — a busier month is not a compounding one. Requires
   two comparable halves of real history, or it returns null. */
function multiplyingProof(_label: string, list: KaiEvent[]): string | null {
  if (list.length < 8) return null;
  const sorted = [...list].sort((a, b) => a.ts - b.ts);
  const mid = Math.floor(sorted.length / 2);
  const early = sorted.slice(0, mid);
  const late = sorted.slice(mid);
  const perUnitEarly = early.reduce((s, e) => s + egpOf(e), 0) / early.length;
  const perUnitLate = late.reduce((s, e) => s + egpOf(e), 0) / late.length;
  if (perUnitEarly <= 0) return null;
  const lift = (perUnitLate - perUnitEarly) / perUnitEarly;
  if (lift < 0.2) return null;                     // noise, not compounding

  /* Volume must ALSO have grown, or a shrinking-but-pricier line would be
     called compounding. Measured as events per day across each half's own
     span — comparing the halves' COUNTS cannot work, because splitting a
     list down the middle makes them equal by construction. */
  const span = (xs: KaiEvent[]) => Math.max(1, (xs[xs.length - 1].ts - xs[0].ts) / DAY);
  const earlyRate = early.length / span(early);
  const lateRate = late.length / span(late);
  if (lateRate <= earlyRate) return null;

  return `per-unit yield rose ${Math.round(lift * 100)}% (${Math.round(perUnitEarly)} → ${Math.round(perUnitLate)} EGP) while volume went from ${earlyRate.toFixed(2)} to ${lateRate.toFixed(2)} per day`;
}

/* ── the freedom measure ──────────────────────────────────── */

export interface Freedom {
  monthlyBurnEgp: number;
  passiveEgp: number;          // ASSET + RECURRING + MULTIPLYING
  linearEgp: number;
  coverage: number | null;     // passive ÷ burn, null when burn unknown
  free: boolean;
  line: string;
}

export function freedom(now = Date.now()): Freedom {
  const r = computeRunway(now);
  const ls = lines(now);
  const passive = ls.filter((l) => l.type !== 'LINEAR').reduce((s, l) => s + l.monthlyEgp, 0);
  const linear = ls.filter((l) => l.type === 'LINEAR').reduce((s, l) => s + l.monthlyEgp, 0);
  const burn = r.sampleCount >= 8 ? r.dailyBurn * 30 : 0;
  const coverage = burn > 0 ? passive / burn : null;

  const line = coverage === null
    ? `No burn signal yet (${r.sampleCount} expenses logged) — freedom cannot be measured, only guessed at, and I won't guess.`
    : coverage >= 1
      ? `Your non-linear income covers your burn ${coverage.toFixed(2)}×. On this record you do not need the hours.`
      : `Non-linear income covers ${Math.round(coverage * 100)}% of your burn. ${Math.round(burn - passive).toLocaleString('en-GB')} EGP/month still has to come from your hours.`;

  return { monthlyBurnEgp: burn, passiveEgp: passive, linearEgp: linear, coverage, free: coverage !== null && coverage >= 1, line };
}

/* What one new recurring line is actually worth — the section's core
   claim, made computable. Deliberately expressed as a SHARE OF BURN and
   in days per month, never as a date: projecting the freedom date needs
   an assumed growth rate, and that number would be invented. */
export interface Compounding {
  monthlyEgp: number;
  shareOfBurn: number | null;
  daysPerMonth: number | null;
  line: string;
}

export function worthOf(monthlyEgp: number, type: IncomeType, now = Date.now()): Compounding {
  const r = computeRunway(now);
  const burn = r.sampleCount >= 8 ? r.dailyBurn * 30 : 0;
  if (burn <= 0) {
    return { monthlyEgp, shareOfBurn: null, daysPerMonth: null,
      line: `${Math.round(monthlyEgp).toLocaleString('en-GB')} EGP/month — with no burn signal I cannot tell you what that buys you.` };
  }
  const share = monthlyEgp / burn;
  const days = monthlyEgp / r.dailyBurn;

  if (type === 'LINEAR') {
    return { monthlyEgp, shareOfBurn: share, daysPerMonth: days,
      line: `${Math.round(monthlyEgp).toLocaleString('en-GB')} EGP, once. It covers ${days.toFixed(1)} days and then it is gone. It buys time; it does not buy freedom.` };
  }
  return { monthlyEgp, shareOfBurn: share, daysPerMonth: days,
    line: `${Math.round(monthlyEgp).toLocaleString('en-GB')} EGP/month covers ${days.toFixed(1)} days of your burn EVERY month, from one act. That is ${Math.round(share * 100)}% of the way to not needing the hours.` };
}

/* Ranking: TYPE FIRST, money second — the whole point of §35.1. */
export interface Candidate { label: string; monthlyEgp: number; type: IncomeType; once?: boolean }

export function rankByType(cands: Candidate[]): Candidate[] {
  return [...cands].sort((a, b) =>
    TYPE_RANK[b.type] - TYPE_RANK[a.type] || b.monthlyEgp - a.monthlyEgp);
}

/* ── 35.2 THE FACTORY ─────────────────────────────────────── */

/* A factory is not a claim, it is a slope: client #10 must cost less than
   client #1. Hours are the measurement, and hours are the one thing the
   Spine cannot see unless he logs them. */
export interface Factory {
  clients: number;
  withHours: number;
  firstHours: number | null;
  lastHours: number | null;
  trend: 'falling' | 'flat' | 'rising' | 'unknown';
  recurringClients: number;
  recurringMonthlyEgp: number;
  assets: Array<{ name: string; present: boolean }>;
  line: string;
}

const FACTORY_ASSETS = [
  ['template system', /template|boilerplate|starter/i],
  ['deploy pipeline', /deploy|pipeline|ci\b/i],
  ['intake form', /intake|brief form|questionnaire/i],
  ['proposal draft', /proposal/i],
  ['contract', /contract|agreement/i],
  ['invoice', /invoice/i],
  ['handover doc', /handover|handoff/i],
] as const;

export function factory(now = Date.now()): Factory {
  const delivered = getEvents({ domain: 'income', type: 'client_delivered' })
    .sort((a, b) => a.ts - b.ts);
  const withHours = delivered.filter((e) => typeof e.meta?.hours === 'number' && e.meta.hours > 0);

  const first = withHours.length ? Number(withHours[0].meta!.hours) : null;
  const last = withHours.length ? Number(withHours[withHours.length - 1].meta!.hours) : null;
  let trend: Factory['trend'] = 'unknown';
  if (withHours.length >= 3 && first !== null && last !== null) {
    const change = (last - first) / first;
    trend = change <= -0.2 ? 'falling' : change >= 0.2 ? 'rising' : 'flat';
  }

  const recurring = getEvents({ domain: 'income' })
    .filter((e) => classify(String(e.meta?.label || ''), e.meta || {}) === 'RECURRING');
  const recurringLabels = new Set(recurring.map((e) => String(e.meta?.label || '')));
  const recurringMonthly = [...recurringLabels].reduce((s, label) => {
    const list = recurring.filter((e) => String(e.meta?.label || '') === label);
    const months = new Set(list.map((e) => monthKey(e.ts))).size || 1;
    return s + list.reduce((a, e) => a + egpOf(e), 0) / months;
  }, 0);

  /* An asset counts as built only when the record mentions it. Nothing is
     assumed present because it would be sensible to have. */
  const blob = getEvents({}).map((e) => e.type + ' ' + JSON.stringify(e.meta || {})).join(' ');
  const assets = FACTORY_ASSETS.map(([name, re]) => ({ name, present: re.test(blob) }));

  const line = withHours.length < 3
    ? `${delivered.length} client${delivered.length === 1 ? '' : 's'} delivered, ${withHours.length} with hours logged. I cannot tell you whether this is a factory or a job — that answer lives in hours, and hours are the one thing I cannot see unless you log them.`
    : trend === 'falling'
      ? `Client #1 took ${first}h, the latest took ${last}h. It is getting cheaper to deliver. That is a factory.`
      : trend === 'rising'
        ? `Client #1 took ${first}h, the latest took ${last}h. Each one is costing you MORE. That is not a factory, it is a job that is getting worse.`
        : `Client #1 took ${first}h, the latest took ${last}h. Flat. You have ten clients' worth of practice and none of it has been turned into a machine.`;

  return {
    clients: delivered.length, withHours: withHours.length,
    firstHours: first, lastHours: last, trend,
    recurringClients: recurringLabels.size, recurringMonthlyEgp: recurringMonthly,
    assets, line,
  };
}

/* ── 35.3 THE VERTICAL ────────────────────────────────────── */

/* The section was cut off at "KAI should be tracking:", so this measures
   the thing the section itself argues is the point: whether managing more
   units makes each one cheaper in TIME. Owning is capital; operating is
   leverage — and leverage that costs linear minutes is just a worse job. */
export interface Unit {
  id: string;
  name: string;
  owned: boolean;            // his, or another owner's
  sharePct: number;          // his cut when managed
}

export interface Vertical {
  units: Unit[];
  managed: number;
  owned: number;
  revenueEgp: number;
  shareEgp: number;
  minutesPerUnit: number | null;
  leverage: 'improving' | 'flat' | 'worsening' | 'unknown';
  line: string;
}

export function units(): Unit[] { return read<Unit[]>('kai.maschine.units', []); }

export function addUnit(u: Omit<Unit, 'id'>): Unit {
  const unit: Unit = { ...u, id: 'u-' + Math.random().toString(36).slice(2, 9) };
  write('kai.maschine.units', [...units(), unit]); emit();
  try { logEvent({ domain: 'makadi', type: 'unit_added', meta: { name: u.name, owned: u.owned, sharePct: u.sharePct }, source: 'user' }); } catch { /* ignore */ }
  return unit;
}

export function vertical(now = Date.now(), windowDays = 180): Vertical {
  const us = units();
  const managed = us.filter((u) => !u.owned).length;
  const owned = us.filter((u) => u.owned).length;

  const bookings = getEvents({ domain: 'makadi', type: 'booking_confirmed', since: now - windowDays * DAY });
  const revenue = bookings.reduce((s, e) => s + egpOf(e), 0);

  /* His cut: full revenue on units he owns, the agreed share on the rest. */
  const shareEgp = bookings.reduce((s, e) => {
    const unitName = String(e.meta?.unit || '');
    const u = us.find((x) => x.name.toLowerCase() === unitName.toLowerCase());
    if (!u) return s + egpOf(e);                    // unattributed → treat as his own
    return s + egpOf(e) * (u.owned ? 1 : u.sharePct / 100);
  }, 0);

  /* Minutes per unit — the only number that says whether this is leverage.
     Requires logged minutes; absent, it says so rather than inventing. */
  const work = getEvents({ domain: 'makadi', type: 'unit_work', since: now - windowDays * DAY })
    .filter((e) => typeof e.value === 'number');
  const totalMinutes = work.reduce((s, e) => s + (e.value as number), 0);
  const minutesPerUnit = us.length && work.length ? totalMinutes / us.length : null;

  let leverage: Vertical['leverage'] = 'unknown';
  if (work.length >= 6 && us.length >= 2) {
    const sorted = [...work].sort((a, b) => a.ts - b.ts);
    const mid = Math.floor(sorted.length / 2);
    const early = sorted.slice(0, mid).reduce((s, e) => s + (e.value as number), 0) / mid;
    const late = sorted.slice(mid).reduce((s, e) => s + (e.value as number), 0) / (sorted.length - mid);
    const ch = (late - early) / (early || 1);
    leverage = ch <= -0.15 ? 'improving' : ch >= 0.15 ? 'worsening' : 'flat';
  }

  const line = !us.length
    ? 'No units recorded. Add the one you own before measuring whether a second would be leverage.'
    : minutesPerUnit === null
      ? `${us.length} unit${us.length === 1 ? '' : 's'} (${owned} owned, ${managed} managed). No minutes logged against them, so I cannot tell you whether a second unit would be leverage or a second job. That is the whole question and it needs your time logged to answer.`
      : leverage === 'worsening'
        ? `${us.length} units, ~${Math.round(minutesPerUnit)} min each, and time per unit is RISING. This is not the operator leap — you are buying yourself a job with someone else's apartment.`
        : leverage === 'improving'
          ? `${us.length} units, ~${Math.round(minutesPerUnit)} min each, and falling. The machine is doing the work, not you. This is the leap.`
          : `${us.length} units, ~${Math.round(minutesPerUnit)} min each, flat. Adding a third will cost you the same again — that is arithmetic, not leverage.`;

  return { units: us, managed, owned, revenueEgp: revenue, shareEgp, minutesPerUnit, leverage, line };
}

/* ── the readout ──────────────────────────────────────────── */

export function maschineText(now = Date.now()): string {
  const ls = lines(now);
  const f = freedom(now);
  const fac = factory(now);
  const v = vertical(now);
  const L: string[] = ['DIE MASCHINE', ''];

  L.push('THE COMPOUNDING LAW — by shape, not by size:');
  if (!ls.length) {
    L.push('  No income on record yet.');
  } else {
    for (const l of ls) {
      L.push(`  ${l.type.padEnd(11)} ${Math.round(l.monthlyEgp).toLocaleString('en-GB').padStart(8)} EGP/mo  ${l.label}`);
      if (l.multiplyingProof) L.push(`              ↑ ${l.multiplyingProof}`);
    }
    L.push('');
    L.push(`  ${TYPE_MEANING.MULTIPLYING} > ${TYPE_MEANING.RECURRING} > ${TYPE_MEANING.ASSET} > ${TYPE_MEANING.LINEAR}`);
  }
  L.push('');
  L.push('FREEDOM:');
  L.push('  ' + f.line);
  L.push('');

  L.push('THE FACTORY:');
  L.push('  ' + fac.line);
  const missing = fac.assets.filter((a) => !a.present).map((a) => a.name);
  if (missing.length) L.push(`  Not yet on the record: ${missing.join(', ')}. Each one is a thing you redo per client.`);
  if (fac.recurringClients) L.push(`  ${fac.recurringClients} recurring client${fac.recurringClients === 1 ? '' : 's'} — ${Math.round(fac.recurringMonthlyEgp).toLocaleString('en-GB')} EGP/mo that does not need selling again.`);
  L.push('');

  L.push('THE VERTICAL:');
  L.push('  ' + v.line);
  if (v.managed) L.push(`  ${Math.round(v.shareEgp).toLocaleString('en-GB')} EGP is your share of ${Math.round(v.revenueEgp).toLocaleString('en-GB')} EGP across ${v.units.length} units.`);
  L.push('');
  L.push('No freedom date is projected here. That number needs an assumed growth rate,');
  L.push('and an assumed growth rate is the most convincing lie this app could tell you.');
  return L.join('\n');
}
