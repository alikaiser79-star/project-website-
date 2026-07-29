/* ============================================================
   §43 DER GÄRTNER — the garden, measured like the flat.

   KAI knew Makadi to the pound and the garden not at all. This is the
   same treatment: a ledger, an organ with real signals, an event
   pipeline, a produce line, a hunter lane, and the comparison that
   decides where the next pound and the next hour go.

   ── THE ONE THING THIS MUST NOT DO ────────────────────────────
   It must not make the garden look like a business because the code
   for a business already existed. If growing things is a hobby that
   costs money, the honest output is "this is a hobby that costs money"
   — and that is a perfectly good answer about a garden. Every verdict
   here is derived from what is logged, and where nothing is logged it
   says so instead of implying a zero.

   ── TWO LIMITS, STATED WHERE THEY BITE ────────────────────────
   1. The brief asks the organ to call on "38°C FORECAST". There is no
      forecast in this app — garden.ts caches a CURRENT reading. The
      signal fires on the cached reading and says which it is, because
      "forecast" and "what it was when you last looked" are different
      claims and only one of them is true here.
   2. Per-hour-of-your-time needs logged hours. Neither asset has them
      unless he logs them, so that column returns null and the
      comparison says the column is empty rather than dividing by an
      assumption.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';
import { toEgp } from './money';
import { makadiProfit } from './makadiProfit';
import { isHeatwave, getCachedTempC, dueToday } from './garden';
import type { Currency } from '../../types';

const DAY = 86_400_000;

const egp = (n: number) => Math.round(n).toLocaleString('en-GB');
function money(e: KaiEvent): number { return toEgp(e.value || 0, (e.ccy as Currency) || 'EGP'); }

/* ── 43.3 THE EVENT PIPELINE — bookings as first-class events ── */

export interface GardenEvent {
  guest: string;
  pkg: string;             // which package
  priceEgp: number;
  date: number;            // when the event is/was held
}

export function logEnquiry(g: Partial<GardenEvent> & { guest: string }, now = Date.now()): void {
  try {
    logEvent({ domain: 'garden', type: 'event_enquiry', value: g.priceEgp, ccy: 'EGP' as Currency,
      meta: { guest: g.guest, pkg: g.pkg, date: g.date }, source: 'user', ts: now });
  } catch { /* ignore */ }
}
export function logConfirmed(g: GardenEvent, now = Date.now()): void {
  try {
    logEvent({ domain: 'garden', type: 'event_confirmed', value: g.priceEgp, ccy: 'EGP' as Currency,
      meta: { guest: g.guest, pkg: g.pkg, date: g.date }, source: 'user', ts: now });
  } catch { /* ignore */ }
}
export function logCompleted(g: GardenEvent, now = Date.now()): void {
  try {
    logEvent({ domain: 'garden', type: 'event_completed', value: g.priceEgp, ccy: 'EGP' as Currency,
      meta: { guest: g.guest, pkg: g.pkg, date: g.date }, source: 'user', ts: now });
  } catch { /* ignore */ }
}
export function logHarvest(what: string, qty: number, unit: string, marketEgp: number, now = Date.now()): void {
  try {
    logEvent({ domain: 'garden', type: 'harvest', value: marketEgp, ccy: 'EGP' as Currency,
      meta: { what, qty, unit, sold: false }, source: 'user', ts: now });
  } catch { /* ignore */ }
}
export function logProduceSale(what: string, egpIn: number, now = Date.now()): void {
  try {
    logEvent({ domain: 'garden', type: 'produce_sold', value: egpIn, ccy: 'EGP' as Currency,
      meta: { what }, source: 'user', ts: now });
  } catch { /* ignore */ }
}

export function events(type: string, now = Date.now()): KaiEvent[] {
  return getEvents({ domain: 'garden', type }).filter((e) => e.ts <= now);
}

/* ── 43.1 THE GARDEN LEDGER — the Makadi Profit Line, mirrored ── */

export interface GardenProfit {
  spent: number;
  earned: number;
  net: number;
  avgEventEgp: number;       // realised, from completed events
  eventsHeld: number;
  eventsToBreakEven: number;
  brokeEven: boolean;
  verdict: string;
}

export function gardenProfit(now = Date.now()): GardenProfit {
  /* SPENT — anything in expense tagged to the garden, plus garden-domain
     outflows. Same attribution rule Makadi uses. */
  let spent = 0;
  for (const e of getEvents({ domain: 'expense' })) {
    if (e.ts > now) continue;
    if (/garden/i.test(e.type) || (e.meta as any)?.garden || (e.meta as any)?.src === 'garden') spent += money(e);
  }
  for (const e of getEvents({ domain: 'garden' })) {
    if (e.ts > now) continue;
    if (/spend|invest|build|tool|labour|labor/i.test(e.type)) spent += money(e);
  }

  /* EARNED — completed events and produce actually sold. A confirmed
     booking is NOT earned: it is a promise, and counting promises as
     revenue is how a ledger starts lying. */
  const completed = events('event_completed', now);
  const sold = events('produce_sold', now);
  const earned = completed.reduce((s, e) => s + money(e), 0) + sold.reduce((s, e) => s + money(e), 0);

  const eventsHeld = completed.length;
  const avgEventEgp = eventsHeld ? completed.reduce((s, e) => s + money(e), 0) / eventsHeld : 0;

  const net = earned - spent;
  const brokeEven = net >= 0 && spent > 0;
  const remaining = Math.max(0, spent - earned);
  const eventsToBreakEven = avgEventEgp > 0 ? Math.ceil(remaining / avgEventEgp) : 0;

  let verdict: string;
  if (spent === 0 && earned === 0) {
    verdict = 'No garden money logged yet — not the same as none spent.';
  } else if (brokeEven) {
    verdict = `PAID FOR ITSELF — +${egp(net)} EGP net across ${eventsHeld} event${eventsHeld === 1 ? '' : 's'}.`;
  } else if (avgEventEgp > 0) {
    verdict = `${egp(spent)} EGP invested · ${egp(earned)} EGP earned · ${eventsToBreakEven} event${eventsToBreakEven === 1 ? '' : 's'} to break even.`;
  } else {
    verdict = `${egp(spent)} EGP invested · ${egp(earned)} EGP earned · no completed event yet, so there is no event value to break even against.`;
  }

  return { spent, earned, net, avgEventEgp, eventsHeld, eventsToBreakEven, brokeEven, verdict };
}

/* ── 43.2 THE ORGAN — real signals, each with its own reason ──── */

export type SignalKind = 'empty_calendar' | 'heat_unwatered' | 'harvest_unlogged' | 'enquiry_unanswered';
export interface Signal { kind: SignalKind; text: string; because: string; urgency: number }

const EMPTY_DAYS = 14;

export function signals(now = Date.now()): Signal[] {
  const out: Signal[] = [];

  /* 1. An empty calendar is lost revenue — the same logic as empty
        Makadi nights, applied to a thing that also sits there earning
        nothing. */
  const upcoming = events('event_confirmed', now)
    .filter((e) => { const d = Number(e.meta?.date); return isFinite(d) && d > now && d <= now + EMPTY_DAYS * DAY; });
  const everConfirmed = events('event_confirmed', now).length;
  if (!upcoming.length && everConfirmed > 0) {
    out.push({
      kind: 'empty_calendar',
      text: `No event booked in the next ${EMPTY_DAYS} days.`,
      because: `${everConfirmed} event${everConfirmed === 1 ? '' : 's'} on record, none of them inside the window. An empty fortnight earns nothing and still costs upkeep.`,
      urgency: 700,
    });
  }

  /* 2. Heat. NOT a forecast — the cached reading, and it says so. */
  if (isHeatwave()) {
    const since = now - 2 * DAY;
    const watered = getEvents({ domain: 'garden', since }).some((e) => /water/i.test(e.type));
    if (!watered) {
      out.push({
        kind: 'heat_unwatered',
        text: `${getCachedTempC()}°C and nothing watered in 48 hours.`,
        because: 'This is the last CACHED temperature reading, not a forecast — this app has no forecast. Above 38°C every watering interval tightens by 40%.',
        urgency: 900,
      });
    }
  }

  /* 3. A harvest picked and never written down is produce that vanishes
        from the ledger, which is exactly how a garden looks like a hobby
        when it is not one. */
  const due = dueToday(now);
  const lastHarvest = events('harvest', now).slice(-1)[0];
  const harvestAge = lastHarvest ? Math.floor((now - lastHarvest.ts) / DAY) : null;
  if (due.length && (harvestAge === null || harvestAge > 21)) {
    out.push({
      kind: 'harvest_unlogged',
      text: harvestAge === null
        ? 'Plants on the codex and no harvest ever logged.'
        : `Nothing harvested in ${harvestAge} days.`,
      because: 'Produce that is picked and not written down never reaches the ledger, and the garden then looks like it earns nothing.',
      urgency: 400,
    });
  }

  /* 4. An enquiry with no confirmation and no reply. */
  const enquiries = events('event_enquiry', now);
  const confirmedGuests = new Set(events('event_confirmed', now).map((e) => String(e.meta?.guest || '').toLowerCase()));
  const stale = enquiries.filter((e) => {
    const g = String(e.meta?.guest || '').toLowerCase();
    if (g && confirmedGuests.has(g)) return false;
    return now - e.ts > 2 * DAY;
  });
  if (stale.length) {
    const oldest = stale.reduce((a, b) => (a.ts < b.ts ? a : b));
    out.push({
      kind: 'enquiry_unanswered',
      text: `${stale.length} package enquir${stale.length === 1 ? 'y' : 'ies'} unanswered — oldest ${Math.floor((now - oldest.ts) / DAY)} days.`,
      because: 'An enquiry with no confirmation and no reply on the record.',
      urgency: 850,
    });
  }

  return out.sort((a, b) => b.urgency - a.urgency);
}

export function gardenCalls(now = Date.now()): boolean { return signals(now).length > 0; }

/* ── 43.4 THE PRODUCE LINE — earner or hobby, honestly ───────── */

export interface Produce {
  harvests: number;
  marketValueEgp: number;   // what it was worth
  soldEgp: number;          // what it actually brought in
  verdict: string;
}

export function produce(now = Date.now()): Produce {
  const h = events('harvest', now);
  const s = events('produce_sold', now);
  const marketValueEgp = h.reduce((x, e) => x + money(e), 0);
  const soldEgp = s.reduce((x, e) => x + money(e), 0);

  let verdict: string;
  if (!h.length) {
    verdict = 'No harvest logged. Nothing can be said about whether growing earns.';
  } else if (soldEgp === 0) {
    verdict = `${h.length} harvests worth ${egp(marketValueEgp)} EGP at market — none of it sold. That is food you grew and ate, which is a real saving and NOT revenue. As a business line the garden earns nothing so far.`;
  } else {
    const share = Math.round((soldEgp / Math.max(1, marketValueEgp)) * 100);
    verdict = `${h.length} harvests worth ${egp(marketValueEgp)} EGP at market · ${egp(soldEgp)} EGP actually sold (${share}%). The rest you ate.`;
  }
  return { harvests: h.length, marketValueEgp, soldEgp, verdict };
}

/* ── 43.5 THE HUNTER LANE — garden-specific revenue moves ────── */

export interface GardenMove { title: string; rationale: string; expectedEgp: number; minutes: number }

export function gardenMoves(now = Date.now()): GardenMove[] {
  const out: GardenMove[] = [];
  const p = gardenProfit(now);
  const sig = signals(now);

  /* Only proposes against a REALISED average. With no completed event
     there is no number to project from, and inventing one here would be
     the §36 pooled-median mistake in a different coat. */
  if (sig.some((s) => s.kind === 'empty_calendar') && p.avgEventEgp > 0) {
    const three = Math.round(p.avgEventEgp * 3);
    out.push({
      title: 'Draft the outreach — the next three weeks are empty',
      rationale: `Your ${p.eventsHeld} completed events averaged ${egp(p.avgEventEgp)} EGP. Filling three of the empty slots is ~+${egp(three)} EGP, on your own realised average and nothing else.`,
      expectedEgp: three, minutes: 20,
    });
  }

  const pr = produce(now);
  if (pr.harvests > 0 && pr.soldEgp === 0 && pr.marketValueEgp > 0) {
    out.push({
      title: 'Harvest ready — sell it or eat it, but decide',
      rationale: `${egp(pr.marketValueEgp)} EGP of market value harvested and none sold. Selling turns it into revenue; eating it is a saving. Either is fine — leaving it unrecorded is not.`,
      expectedEgp: pr.marketValueEgp, minutes: 30,
    });
  }

  const enq = sig.find((s) => s.kind === 'enquiry_unanswered');
  if (enq && p.avgEventEgp > 0) {
    out.push({
      title: 'Answer the package enquiry',
      rationale: `${enq.text} An event at your realised average is worth ${egp(p.avgEventEgp)} EGP.`,
      expectedEgp: p.avgEventEgp, minutes: 10,
    });
  }

  return out.sort((a, b) => (b.expectedEgp / b.minutes) - (a.expectedEgp / a.minutes));
}

/* ── 43.6 THE COMPARISON — which asset deserves the next pound ── */

export interface Side {
  name: string;
  invested: number;
  earned: number;
  net: number;
  hours: number | null;
  perHour: number | null;
}
export interface Comparison { makadi: Side; garden: Side; line: string; hoursMissing: string[] }

/* Hours come only from logged work. Neither side gets an assumption. */
function hoursFor(match: (e: KaiEvent) => boolean, now: number): number | null {
  const evs = getEvents({}).filter((e) => e.ts <= now && match(e) && typeof e.meta?.hours === 'number');
  if (!evs.length) return null;
  return evs.reduce((s, e) => s + Number(e.meta!.hours), 0);
}

export function compare(now = Date.now()): Comparison {
  const m = makadiProfit(now);
  const g = gardenProfit(now);

  const mh = hoursFor((e) => e.domain === 'makadi' || (e.meta as any)?.makadi === true, now);
  const gh = hoursFor((e) => e.domain === 'garden' || (e.meta as any)?.garden === true, now);

  const side = (name: string, invested: number, earned: number, hours: number | null): Side => ({
    name, invested, earned, net: earned - invested,
    hours, perHour: hours && hours > 0 ? (earned - invested) / hours : null,
  });

  const makadi = side('Makadi', m.spent, m.earned, mh);
  const garden = side('Garden', g.spent, g.earned, gh);

  const hoursMissing = [!mh ? 'Makadi' : '', !gh ? 'Garden' : ''].filter(Boolean);

  let line: string;
  if (makadi.net === 0 && garden.net === 0) {
    line = 'Neither side has enough money logged to compare. This decides nothing yet.';
  } else if (makadi.perHour !== null && garden.perHour !== null) {
    const better = makadi.perHour >= garden.perHour ? makadi : garden;
    line = `${better.name} returns ${egp(better.perHour!)} EGP per hour of your time against ${egp((better === makadi ? garden : makadi).perHour!)}. The next hour goes there.`;
  } else {
    const better = makadi.net >= garden.net ? makadi : garden;
    line = `${better.name} is ${egp(Math.abs(better.net))} EGP ${better.net >= 0 ? 'ahead' : 'behind'} against ${egp(Math.abs((better === makadi ? garden : makadi).net))} — but that is money only. Per-hour is the number that decides where your TIME goes, and it needs hours logged.`;
  }

  return { makadi, garden, line, hoursMissing };
}

/* ── the readouts ────────────────────────────────────────────── */

export function gardenText(now = Date.now()): string {
  const p = gardenProfit(now);
  const pr = produce(now);
  const sig = signals(now);
  const mv = gardenMoves(now);
  const L = ['DER GÄRTNER', '', p.verdict, ''];

  if (sig.length) {
    L.push('NEEDS YOU:');
    for (const s of sig) { L.push(`  ${s.text}`); L.push(`      ${s.because}`); }
    L.push('');
  } else {
    L.push('Nothing calling.');
    L.push('');
  }

  L.push('PRODUCE:');
  L.push('  ' + pr.verdict);

  if (mv.length) {
    L.push('');
    L.push('MOVES:');
    for (const m of mv) { L.push(`  ${m.title}`); L.push(`      ${m.rationale}`); }
  }
  return L.join('\n');
}

export function compareText(now = Date.now()): string {
  const c = compare(now);
  const row = (s: Side) =>
    `  ${s.name.padEnd(7)} invested ${egp(s.invested).padStart(9)} · earned ${egp(s.earned).padStart(9)} · net ${(s.net >= 0 ? '+' : '−') + egp(Math.abs(s.net))}` +
    `  · per hour ${s.perHour === null ? '—' : egp(s.perHour)}`;
  const L = ['MAKADI vs GARDEN', '', row(c.makadi), row(c.garden), '', c.line];
  if (c.hoursMissing.length) {
    L.push('');
    L.push(`No hours logged for ${c.hoursMissing.join(' or ')}, so the per-hour column is empty rather than estimated.`);
    L.push('Log hours against the work and this becomes the number that decides your week.');
  }
  return L.join('\n');
}
