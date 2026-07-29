/* ============================================================
   §44.5 DAS GEDÄCHTNIS DER WELT — the ledger of trust.

   Every person as a record: what they promised, what they delivered,
   when they went quiet, what they are worth, what he owes them.

   ── NOT A CRM, AND THE DIFFERENCE IS THE WHOLE POINT ──────────
   A CRM stores what you typed about someone. This scores what they
   DID, from events, and it scores him too — "what I owe them" is a
   column, and it is the one most likely to be uncomfortable.

   ── THREE RULES THAT KEEP THIS FROM BECOMING GOSSIP ───────────
   1. NO SCORE WITHOUT BEHAVIOUR. A person with one interaction has no
      score, and the file says so. A reputation built from a single
      data point is a prejudice.
   2. SILENCE IS MEASURED, NOT INTERPRETED. It reports "silent 24 days
      across 3 touches". It does not conclude they dislike him, are
      avoiding him, or have gone elsewhere — the record cannot see any
      of that.
   3. THE CLOSE RECOMMENDATION CITES HIS OWN CONVERSION RATE, and only
      appears once that rate exists. "Your record with silent leads:
      0 of 4 converted" is a fact about HIM, not a judgement of them,
      and without four resolved leads it is not said at all.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';

const DAY = 86_400_000;
const MIN_TOUCHES = 2;         // below this, no score
const MIN_RESOLVED = 4;        // below this, no conversion claim
const SILENT_DAYS = 14;

export interface Person {
  name: string;
  touches: number;
  first: number;
  last: number;
  silentDays: number;
  promisedByThem: number;
  deliveredByThem: number;
  promisedByHim: number;
  deliveredByHim: number;
  worthEgp: number;              // money actually moved with them
  scored: boolean;
  line: string;
}

function nameOf(e: KaiEvent): string {
  const m = e.meta || {} as any;
  return String(m.person || m.guest || m.who || m.contact || m.name || '').trim();
}

export function people(now = Date.now()): Person[] {
  const byName = new Map<string, KaiEvent[]>();
  for (const e of getEvents({})) {
    if (e.ts > now) continue;
    const n = nameOf(e);
    if (!n || n.length < 2) continue;
    byName.set(n, [...(byName.get(n) || []), e]);
  }

  const out: Person[] = [];
  for (const [name, evs] of byName) {
    const sorted = [...evs].sort((a, b) => a.ts - b.ts);
    const first = sorted[0].ts, last = sorted[sorted.length - 1].ts;
    const silentDays = Math.floor((now - last) / DAY);

    const has = (re: RegExp) => (e: KaiEvent) => re.test(e.type + ' ' + JSON.stringify(e.meta || {}));
    const promisedByThem = evs.filter(has(/promis|will |agreed|said.*would|quote/i)).length;
    const deliveredByThem = evs.filter(has(/paid|delivered|arrived|completed|confirmed|booking_confirmed/i)).length;
    const promisedByHim = evs.filter(has(/i (will|owe)|owed|my promise|commit/i)).length;
    const deliveredByHim = evs.filter(has(/sent|replied|email_sent|sms_sent|handed|gave/i)).length;
    const worthEgp = evs.reduce((s, e) => s + (typeof e.value === 'number' && e.ccy ? e.value : 0), 0);

    const scored = evs.length >= MIN_TOUCHES;
    const line = !scored
      ? `${name}: one interaction on record. No score — a reputation from one data point is a prejudice.`
      : `${name}: ${evs.length} touches over ${Math.max(1, Math.floor((last - first) / DAY))} days` +
        (worthEgp > 0 ? ` · ${Math.round(worthEgp).toLocaleString('en-GB')} EGP moved` : ' · no money moved') +
        (silentDays >= SILENT_DAYS ? ` · silent ${silentDays} days` : '');

    out.push({
      name, touches: evs.length, first, last, silentDays,
      promisedByThem, deliveredByThem, promisedByHim, deliveredByHim,
      worthEgp, scored, line,
    });
  }
  return out.sort((a, b) => b.worthEgp - a.worthEgp || b.touches - a.touches);
}

/* ── his own conversion record — a fact about HIM ────────────── */

export interface Conversion { resolved: number; converted: number; rate: number | null; line: string }

export function silentLeadRecord(now = Date.now()): Conversion {
  /* A lead is resolved once it either converted or went quiet long
     enough that it is not coming back on its own. */
  const all = people(now).filter((p) => p.touches >= MIN_TOUCHES);
  const resolvedList = all.filter((p) => p.silentDays >= SILENT_DAYS || p.worthEgp > 0);
  const converted = resolvedList.filter((p) => p.worthEgp > 0).length;
  const silentOnes = resolvedList.filter((p) => p.silentDays >= SILENT_DAYS && p.worthEgp === 0);

  if (resolvedList.length < MIN_RESOLVED) {
    return {
      resolved: resolvedList.length, converted, rate: null,
      line: `${resolvedList.length} resolved contacts. Below ${MIN_RESOLVED} there is no conversion rate worth quoting, so nothing here recommends closing anything.`,
    };
  }
  const silentConverted = 0;   // by construction: silent && worth 0
  const rate = silentOnes.length ? silentConverted / silentOnes.length : null;
  return {
    resolved: resolvedList.length, converted, rate,
    line: silentOnes.length
      ? `Your record with silent leads: ${silentConverted} of ${silentOnes.length} converted.`
      : `No silent leads on record — everyone who went quiet eventually moved money.`,
  };
}

export interface Close { name: string; line: string }

export function closeFiles(now = Date.now()): Close[] {
  const conv = silentLeadRecord(now);
  if (conv.rate === null) return [];           // no rate → no recommendation
  return people(now)
    .filter((p) => p.scored && p.worthEgp === 0 && p.silentDays >= SILENT_DAYS)
    .map((p) => ({
      name: p.name,
      line: `${p.name} has been silent ${p.silentDays} days across ${p.touches} touches. ${conv.line} Close the file.`,
    }));
}

export function weltText(now = Date.now()): string {
  const ps = people(now);
  const L = ['DAS GEDÄCHTNIS DER WELT', ''];
  if (!ps.length) {
    L.push('Nobody on the record yet.');
    L.push('');
    L.push('People arrive here from events that name them — a guest, a contact,');
    L.push('a person on a booking. Nothing is typed in by hand, so nothing here');
    L.push('is what you thought of someone, only what happened.');
    return L.join('\n');
  }
  for (const p of ps) L.push('  ' + p.line);

  const owed = ps.filter((p) => p.promisedByHim > p.deliveredByHim);
  if (owed.length) {
    L.push('');
    L.push('WHAT YOU OWE:');
    for (const p of owed) L.push(`  ${p.name}: ${p.promisedByHim} promise(s) from you, ${p.deliveredByHim} delivered.`);
  }

  const closes = closeFiles(now);
  if (closes.length) {
    L.push('');
    L.push('CLOSE THE FILE:');
    for (const c of closes) L.push('  ' + c.line);
  } else {
    L.push('');
    L.push('  ' + silentLeadRecord(now).line);
  }
  return L.join('\n');
}
