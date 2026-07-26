/* ============================================================
   §36 DER HÄNDLER — the arbitrage engine.

   Buy under the median, sell at it, and count properly. Most trading
   fails at the third step, so this file is mostly the third step.

   ── WHAT IS REAL AND WHAT IS NOT ──────────────────────────────
   §36.1 asks for continuous monitoring of OLX, Facebook Marketplace
   groups and Dubizzle. That part is NOT built as described, and pretending
   otherwise would be the worst thing in this file:

     • Facebook Marketplace and its groups are behind login. There is no
       API for them, and scraping them violates the terms of the account
       it would run under — his account.
     • OLX and Dubizzle publish no listings API. The web_search tool sees
       search snippets, not a structured listing feed.
     • There is no daemon. Vercel Hobby runs crons, not continuous watches.

   So the SCANNER here is a price ENGINE, not a crawler. Listings enter by
   paste or by hand — which is what actually happens, because he is already
   looking at these apps on his phone — and everything downstream is fully
   real: the learned distribution, the flagging, the margin maths, the
   rules, the ledger, the guard. `parseListing` takes the messy text of a
   pasted ad and pulls out what it can. When a source cannot be read, the
   engine says which one and why, rather than quietly returning nothing.

   ── THE DOCTRINE ──────────────────────────────────────────────
   It never says "buy". It says what the numbers are and what it cannot
   see. Money moves only by his hand: this file proposes nothing, and
   nothing here touches the Gate.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { computeRunway } from './runway';
import { read, write, emit } from './store';

const DAY = 86_400_000;
const RULES_KEY = 'kai.haendler.rules';

/* ── 36.4 THE RULES HE SETS ───────────────────────────────── */

export interface Rules {
  maxPerDealEgp: number;
  maxDeployedEgp: number;
  inspectInPerson: boolean;      // never buy what he hasn't held
  maxHoldDays: number;
  hourlyValueEgp: number;        // what an hour of his time costs a deal
  minNetMarginPct: number;       // §36.2 — under this it does not surface
  tradingCapitalEgp: number;     // ring-fenced, never runway money
}

const DEFAULT_RULES: Rules = {
  maxPerDealEgp: 20_000,
  maxDeployedEgp: 60_000,
  inspectInPerson: true,
  maxHoldDays: 21,
  hourlyValueEgp: 400,
  minNetMarginPct: 30,
  tradingCapitalEgp: 0,
};

export function rules(): Rules { return { ...DEFAULT_RULES, ...read<Partial<Rules>>(RULES_KEY, {}) }; }
export function setRules(patch: Partial<Rules>): Rules {
  const next = { ...rules(), ...patch };
  write(RULES_KEY, next); emit();
  try { logEvent({ domain: 'system', type: 'haendler_rules_set', meta: { ...next }, source: 'user' }); } catch { /* ignore */ }
  return next;
}

/* ── 36.5 THE LEDGER ──────────────────────────────────────── */

export interface Deal {
  id: string;
  category: string;
  item: string;
  buyEgp: number;
  costsEgp: number;          // transport + repair + fees, actually paid
  hours: number;             // HIS hours, actually spent
  boughtAt: number;
  soldEgp: number | null;
  soldAt: number | null;
}

export function deals(): Deal[] { return read<Deal[]>('kai.haendler.deals', []); }

export function recordBuy(d: Omit<Deal, 'id' | 'soldEgp' | 'soldAt'>): Deal {
  const deal: Deal = { ...d, id: 'd-' + Math.random().toString(36).slice(2, 9), soldEgp: null, soldAt: null };
  write('kai.haendler.deals', [...deals(), deal]); emit();
  try {
    logEvent({ domain: 'money', type: 'trade_bought', value: d.buyEgp, ccy: 'EGP',
      meta: { category: d.category, item: d.item }, source: 'user', ts: d.boughtAt });
  } catch { /* ignore */ }
  return deal;
}

export function recordSell(id: string, soldEgp: number, at = Date.now()): Deal | null {
  const all = deals();
  const d = all.find((x) => x.id === id);
  if (!d || d.soldAt !== null) return null;
  d.soldEgp = soldEgp; d.soldAt = at;
  write('kai.haendler.deals', all); emit();
  try {
    logEvent({ domain: 'money', type: 'trade_sold', value: soldEgp, ccy: 'EGP',
      meta: { category: d.category, item: d.item, net: soldEgp - d.buyEgp - d.costsEgp }, source: 'user', ts: at });
  } catch { /* ignore */ }
  return d;
}

/* Capital currently sitting in unsold stock — the number that decides
   whether another deal is allowed at all. */
export function deployedEgp(): number {
  return deals().filter((d) => d.soldAt === null).reduce((s, d) => s + d.buyEgp + d.costsEgp, 0);
}

export interface CategoryReturn {
  category: string;
  deals: number;
  netEgp: number;
  capitalEgp: number;
  returnPct: number | null;
  hours: number;
  egpPerHour: number | null;
  avgDaysHeld: number | null;
  verdict: string;
}

/* Real return per category and PER HOUR — the number that says whether a
   category is worth his time at all. Cash return alone hides the fact
   that furniture pays 40% on capital and 60 EGP an hour. */
export function categoryReturns(now = Date.now()): CategoryReturn[] {
  const closed = deals().filter((d) => d.soldAt !== null);
  const byCat = new Map<string, Deal[]>();
  for (const d of closed) byCat.set(d.category, [...(byCat.get(d.category) || []), d]);

  const r = rules();
  return [...byCat.entries()].map(([category, ds]) => {
    const capital = ds.reduce((s, d) => s + d.buyEgp + d.costsEgp, 0);
    const net = ds.reduce((s, d) => s + (d.soldEgp as number) - d.buyEgp - d.costsEgp, 0);
    const hours = ds.reduce((s, d) => s + d.hours, 0);
    const returnPct = capital > 0 ? (net / capital) * 100 : null;
    const egpPerHour = hours > 0 ? net / hours : null;
    const avgDaysHeld = ds.reduce((s, d) => s + ((d.soldAt as number) - d.boughtAt) / DAY, 0) / ds.length;

    const verdict =
      egpPerHour === null ? 'No hours logged — the return per hour cannot be computed, and that is the number that matters.'
      : net <= 0 ? `Losing money: ${Math.round(net).toLocaleString('en-GB')} EGP net across ${ds.length} deals. Stop.`
      : egpPerHour < r.hourlyValueEgp
        ? `${Math.round(egpPerHour).toLocaleString('en-GB')} EGP/hour — BELOW the ${r.hourlyValueEgp} EGP you priced your own time at. This category is not worth your hours, whatever the margin says.`
        : `${Math.round(egpPerHour).toLocaleString('en-GB')} EGP/hour on ${Math.round(returnPct as number)}% of capital across ${ds.length} deals.`;

    return { category, deals: ds.length, netEgp: net, capitalEgp: capital, returnPct, hours, egpPerHour, avgDaysHeld, verdict };
  }).sort((a, b) => (b.egpPerHour ?? -Infinity) - (a.egpPerHour ?? -Infinity));
}

/* ── 36.1 THE PRICE ENGINE ────────────────────────────────── */

export type Condition = 'new' | 'good' | 'worn' | 'broken' | 'unknown';

export interface Listing {
  id: string;
  category: string;
  model: string;
  condition: Condition;
  askEgp: number;
  source: string;              // 'OLX', 'Dubizzle', 'FB group', 'in person'
  at: number;
  url?: string;
}

export function listings(): Listing[] { return read<Listing[]>('kai.haendler.listings', []); }

export function addListing(l: Omit<Listing, 'id' | 'at'> & { at?: number }): Listing {
  const item: Listing = { ...l, at: l.at ?? Date.now(), id: 'l-' + Math.random().toString(36).slice(2, 9) };
  write('kai.haendler.listings', [...listings(), item]); emit();
  return item;
}

/* Pull structure out of a pasted ad. Returns nulls for what it could not
   read rather than filling gaps — a guessed model or condition would end
   up in a price distribution and quietly corrupt every later comparison. */
export interface Parsed { model: string | null; askEgp: number | null; condition: Condition; missing: string[] }

/* Latin terms are word-bounded; Arabic ones CANNOT be. JavaScript's \b is
   defined on [A-Za-z0-9_], so there is no boundary between a newline and
   an Arabic letter and `/\bعطلان\b/` can never match anything. His two
   other languages are the edge this whole module is built on — silently
   failing to read them would remove the edge. */
const COND_RE: Array<[RegExp, Condition]> = [
  [/\b(brand ?new|sealed|neu|neuwertig)\b/i, 'new'],
  [/جديد/, 'new'],
  [/\b(broken|not working|for parts|kaputt|defekt)\b/i, 'broken'],
  [/عطلان|تالف/, 'broken'],
  [/\b(scratch(?:ed|es)?|worn|needs? (?:work|repair)|reparaturbedürftig)\b/i, 'worn'],
  [/بحاجة|خربان/, 'worn'],
  [/\b(like new|excellent|very good|mint|sehr gut)\b/i, 'good'],
  [/\b(used|good condition|gebraucht)\b/i, 'good'],
  [/ممتاز|مستعمل|حالة جيدة/, 'good'],
];

export function parseListing(text: string): Parsed {
  const missing: string[] = [];

  /* Price: prefer an explicitly currency-marked number. */
  const priceM = text.match(/(?:egp|le|جنيه|£)\s*([\d][\d,. ]{2,})|([\d][\d,. ]{2,})\s*(?:egp|le|جنيه|£)/i);
  const raw = priceM ? (priceM[1] || priceM[2]).replace(/[^\d]/g, '') : '';
  const askEgp = raw ? parseInt(raw, 10) : null;
  if (!askEgp) missing.push('price');

  let condition: Condition = 'unknown';
  for (const [re, c] of COND_RE) if (re.test(text)) { condition = c; break; }
  if (condition === 'unknown') missing.push('condition');

  /* Model: the first line is the ad title in every one of these apps. */
  const first = text.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
  const model = first.length >= 3 ? first.slice(0, 80) : null;
  if (!model) missing.push('model');

  return { model, askEgp, condition, missing };
}

export interface Distribution {
  category: string;
  model: string;
  condition: Condition;
  n: number;
  median: number | null;
  low: number | null;
  high: number | null;
}

/* A median off two listings is not a median. Below this the engine says
   it does not know the price rather than inventing a reference. */
const MIN_SAMPLE = 5;

export function distribution(
  category: string, model: string, condition: Condition,
  now = Date.now(), windowDays = 120,
  /* The listing being judged must NOT sit in the market it is judged
     against. A cheap ad included in its own median drags that median down
     and makes the ad look less of a bargain than it is — the engine would
     understate exactly the deals it exists to find. */
  excludeId?: string,
): Distribution {
  const pool = listings().filter((l) =>
    l.id !== excludeId &&
    l.category.toLowerCase() === category.toLowerCase() &&
    l.condition === condition &&
    now - l.at <= windowDays * DAY &&
    l.model.toLowerCase().includes(model.toLowerCase().slice(0, 12)));

  if (pool.length < MIN_SAMPLE) {
    return { category, model, condition, n: pool.length, median: null, low: null, high: null };
  }
  const xs = pool.map((l) => l.askEgp).sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  const median = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  return { category, model, condition, n: xs.length, median, low: xs[0], high: xs[xs.length - 1] };
}

/* ── 36.2 THE MARGIN MATH ─────────────────────────────────── */

export interface Costs {
  transportEgp: number;
  repairEgp: number;
  hours: number;
  feesEgp: number;
  /* Probability the ad is misrepresented, 0..1. Applied as a discount on
     the EXPECTED SALE, which is where the damage would actually land. */
  riskPct: number;
}

export interface Margin {
  buyEgp: number;
  expectedSaleEgp: number;
  riskAdjustedSaleEgp: number;
  hoursCostEgp: number;
  totalCostEgp: number;
  netEgp: number;
  netMarginPct: number;
  breakdown: string[];
}

export function margin(buyEgp: number, expectedSaleEgp: number, c: Costs, r = rules()): Margin {
  const hoursCost = c.hours * r.hourlyValueEgp;
  const totalCost = buyEgp + c.transportEgp + c.repairEgp + hoursCost + c.feesEgp;
  const riskAdjusted = expectedSaleEgp * (1 - Math.min(1, Math.max(0, c.riskPct)));
  const net = riskAdjusted - totalCost;
  const pct = totalCost > 0 ? (net / totalCost) * 100 : 0;

  return {
    buyEgp, expectedSaleEgp, riskAdjustedSaleEgp: riskAdjusted,
    hoursCostEgp: hoursCost, totalCostEgp: totalCost, netEgp: net, netMarginPct: pct,
    breakdown: [
      `buy ${Math.round(buyEgp).toLocaleString('en-GB')}`,
      `transport ${Math.round(c.transportEgp).toLocaleString('en-GB')}`,
      `repair ${Math.round(c.repairEgp).toLocaleString('en-GB')}`,
      `${c.hours}h of your time at ${r.hourlyValueEgp} = ${Math.round(hoursCost).toLocaleString('en-GB')}`,
      `fees ${Math.round(c.feesEgp).toLocaleString('en-GB')}`,
      `expected sale ${Math.round(expectedSaleEgp).toLocaleString('en-GB')} less ${Math.round(c.riskPct * 100)}% risk discount = ${Math.round(riskAdjusted).toLocaleString('en-GB')}`,
    ],
  };
}

/* ── 36.6 THE HONEST GUARD ────────────────────────────────── */

/* Everything the engine structurally cannot know. This is not a disclaimer
   bolted on the end — it is computed per candidate from what is actually
   missing, and a candidate always carries it. */
function unverifiable(l: Listing, d: Distribution, c: Costs): string[] {
  const out: string[] = [
    'the real condition — I have only the words in the ad',
    'whether the seller is who they say they are',
    'hidden damage, wear, or missing parts',
  ];
  if (l.condition === 'unknown') out.push('the stated condition — the ad did not give one');
  if (c.repairEgp === 0) out.push('the repair cost — you entered zero, which is an assumption, not a measurement');
  if (d.n < 10) out.push(`the median itself — it rests on ${d.n} listings, which is thin`);
  if (!l.url) out.push('the source ad — no link was saved, so this cannot be re-checked later');
  return out;
}

export type Block =
  | 'over_per_deal_cap' | 'over_deployed_cap' | 'margin_too_thin'
  | 'no_median' | 'not_inspectable' | 'would_use_runway_money';

export interface Candidate {
  listing: Listing;
  distribution: Distribution;
  discountPct: number | null;
  margin: Margin;
  blocks: Block[];
  cannotVerify: string[];
  line: string;
}

export const BLOCK_TEXT: Record<Block, string> = {
  over_per_deal_cap: 'above your maximum per deal',
  over_deployed_cap: 'would put you over your maximum capital deployed at once',
  margin_too_thin: 'net margin under your floor',
  no_median: 'not enough comparable listings to know the going price',
  not_inspectable: 'you have not marked this as inspectable in person',
  would_use_runway_money: 'this would be runway money, not trading capital',
};

export interface Assessed { inspectable?: boolean }

export function assess(l: Listing, expectedSaleEgp: number, c: Costs, opts: Assessed = {}, now = Date.now()): Candidate {
  const r = rules();
  const d = distribution(l.category, l.model, l.condition, now, 120, l.id);
  const discountPct = d.median ? ((d.median - l.askEgp) / d.median) * 100 : null;
  const m = margin(l.askEgp, expectedSaleEgp, c, r);

  const blocks: Block[] = [];
  if (d.median === null) blocks.push('no_median');
  if (l.askEgp + c.transportEgp + c.repairEgp > r.maxPerDealEgp) blocks.push('over_per_deal_cap');
  if (deployedEgp() + l.askEgp + c.transportEgp + c.repairEgp > r.maxDeployedEgp) blocks.push('over_deployed_cap');
  if (m.netMarginPct < r.minNetMarginPct) blocks.push('margin_too_thin');
  if (r.inspectInPerson && !opts.inspectable) blocks.push('not_inspectable');

  /* Trading capital is ring-fenced from runway. If the ring-fence is unset
     or too small to cover this, it is his runway paying for the deal. */
  const needed = l.askEgp + c.transportEgp + c.repairEgp;
  const free = r.tradingCapitalEgp - deployedEgp();
  if (needed > free) blocks.push('would_use_runway_money');

  const cannotVerify = unverifiable(l, d, c);
  const head = discountPct === null
    ? `${l.model}: ${l.askEgp.toLocaleString('en-GB')} EGP asked. I have ${d.n} comparable listing${d.n === 1 ? '' : 's'} — not enough to say whether that is cheap.`
    : `${l.model}: ${l.askEgp.toLocaleString('en-GB')} EGP asked, ${Math.round(discountPct)}% ${discountPct >= 0 ? 'under' : 'over'} the median of ${Math.round(d.median as number).toLocaleString('en-GB')} EGP across ${d.n} listings.`;

  return { listing: l, distribution: d, discountPct, margin: m, blocks, cannotVerify, line: head };
}

/* §36.1 — candidates are listings ≥25% under the learned median, ≥ the
   net-margin floor, and inside every rule. A blocked candidate does NOT
   surface: the rules are not advice. */
const FLAG_DISCOUNT = 25;

export function candidates(
  batch: Array<{ listing: Listing; expectedSaleEgp: number; costs: Costs; inspectable?: boolean }>,
  now = Date.now(),
): { surfaced: Candidate[]; suppressed: Array<{ c: Candidate; why: string }> } {
  const surfaced: Candidate[] = [];
  const suppressed: Array<{ c: Candidate; why: string }> = [];

  for (const b of batch) {
    const c = assess(b.listing, b.expectedSaleEgp, b.costs, { inspectable: b.inspectable }, now);
    const tooDear = c.discountPct !== null && c.discountPct < FLAG_DISCOUNT;
    if (c.blocks.length || tooDear) {
      const why = [...c.blocks.map((x) => BLOCK_TEXT[x]), ...(tooDear ? [`only ${Math.round(c.discountPct as number)}% under median`] : [])].join('; ');
      suppressed.push({ c, why });
    } else {
      surfaced.push(c);
    }
  }
  surfaced.sort((a, b) => b.margin.netEgp - a.margin.netEgp);
  return { surfaced, suppressed };
}

/* ── the readouts ─────────────────────────────────────────── */

/* Never "buy". States the numbers, then states the blindness. */
export function candidateText(c: Candidate): string {
  const L: string[] = [c.line, ''];
  L.push(`  net ${Math.round(c.margin.netEgp).toLocaleString('en-GB')} EGP at ${Math.round(c.margin.netMarginPct)}% after everything:`);
  for (const b of c.margin.breakdown) L.push(`    ${b}`);
  L.push('');
  L.push('  WHAT I CANNOT SEE:');
  for (const u of c.cannotVerify) L.push(`    · ${u}`);
  L.push('');
  L.push('  I am not telling you to buy this. I am telling you what the numbers are');
  L.push('  and what I am blind to. The money is yours and so is the decision.');
  return L.join('\n');
}

export function sourcesNote(): string {
  return [
    'ON THE SCANNER: listings enter by paste or by hand, not by crawl.',
    '  · Facebook Marketplace and its groups are behind a login. No API, and',
    '    scraping them would violate the terms of the account it would run',
    '    under — yours. I will not build that quietly.',
    '  · OLX and Dubizzle publish no listings API. Web search returns snippets,',
    '    not a feed I can price against.',
    '  · There is no daemon on this hosting — crons, not continuous watches.',
    '  Everything after intake is real: the distribution, the flagging, the',
    '  margin maths, the rules, the ledger. Paste an ad and it works.',
  ].join('\n');
}

export function haendlerText(now = Date.now()): string {
  const r = rules();
  const cats = categoryReturns(now);
  const open = deals().filter((d) => d.soldAt === null);
  const runway = computeRunway(now);
  const L: string[] = ['DER HÄNDLER', ''];

  L.push('YOUR RULES:');
  L.push(`  max ${r.maxPerDealEgp.toLocaleString('en-GB')} EGP per deal · max ${r.maxDeployedEgp.toLocaleString('en-GB')} EGP deployed at once`);
  L.push(`  ${r.inspectInPerson ? 'nothing you have not held in your hands' : 'in-person inspection NOT required (you turned this off)'} · flip within ${r.maxHoldDays} days`);
  L.push(`  your hour priced at ${r.hourlyValueEgp.toLocaleString('en-GB')} EGP · nothing under ${r.minNetMarginPct}% net surfaces`);
  L.push(`  trading capital ${r.tradingCapitalEgp.toLocaleString('en-GB')} EGP, ring-fenced from runway${r.tradingCapitalEgp === 0 ? ' — UNSET, so every deal currently reads as runway money' : ''}`);
  L.push('');

  L.push(`DEPLOYED: ${Math.round(deployedEgp()).toLocaleString('en-GB')} EGP in ${open.length} unsold item${open.length === 1 ? '' : 's'}.`);
  if (runway.runwayDays !== null) {
    L.push(`  Your runway is ${Math.floor(runway.runwayDays)} days. Trading capital is separate money and stays separate.`);
  }
  L.push('');

  L.push('THE LEDGER — real return, per category and per hour:');
  if (!cats.length) {
    L.push('  No closed deals yet. Nothing to judge, and I will not judge it early.');
  } else {
    for (const c of cats) {
      L.push(`  ${c.category}: ${Math.round(c.netEgp).toLocaleString('en-GB')} EGP net over ${c.deals} deal${c.deals === 1 ? '' : 's'}, avg ${Math.round(c.avgDaysHeld ?? 0)} days held`);
      L.push(`    ${c.verdict}`);
    }
  }
  L.push('');
  L.push(sourcesNote());
  return L.join('\n');
}
