/* ============================================================
   §38.2 DIE LEHRE — THE SKILL LIBRARY.

   KAI's own reference knowledge in the areas that make him money, held as
   cited notes rather than as whatever a model happens to recall.

   ── THE PROVENANCE RULE ───────────────────────────────────────
   Every note carries where it came from:

     principle  — a general truth that holds anywhere (occupancy × rate is
                  arithmetic; it does not need a citation).
     derived    — computed live from HIS Spine. Recomputed on read, so it
                  cannot go stale, and it names the events behind it.
     external   — a specific claim about the world that requires a source:
                  a statute, a platform's published ranking factors, a
                  market price. It CANNOT be stored without one.

   ── WHY THAT RULE IS ENFORCED AND NOT ADVISED ─────────────────
   This library was asked to hold Egyptian property law touching a live
   court case — setbacks, tree protection, Law 119/2008 — and Cairo market
   price baselines.

   I will not write those from memory. An invented article number or an
   imagined setback distance would be the most dangerous text in this
   entire project: it would be quoted, in a real case, about his land. The
   same applies to a fabricated "market baseline" that he would then price
   a real trade against.

   So packs can be marked REGULATED. A regulated pack refuses any note that
   is not `external` with a real source — no principles, no reasoning, no
   "generally in Egypt...". What it holds instead is the case timeline built
   from his own Spine, and a standing instruction naming exactly which
   documents have to be read into it and by whom.

   That is not the pack failing to do its job. A legal pack that knows it is
   empty is worth more than one confidently holding three wrong articles.

   ── UPDATING WHEN REALITY DISAGREES ───────────────────────────
   `contradict()` retires a note against evidence and logs it. Derived notes
   never need it: they are recomputed from the record every time.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { makadiProfit } from './makadiProfit';
import { read, write, emit } from './store';

const DAY = 86_400_000;

export type Provenance = 'principle' | 'derived' | 'external';

export interface Note {
  id: string;
  claim: string;
  provenance: Provenance;
  /* Required for `external`. A note that needs a source and has none is
     refused at write time, not flagged at read time. */
  source?: string;
  /* `derived` notes carry a live computation instead of a stored claim. It
     returns null when his record cannot support the point yet — which is
     printed as "not yet in your numbers", never as a general statement. */
  compute?: (now: number) => string | null;
}

export interface Pack {
  id: string;
  title: string;
  /* A regulated pack holds ONLY sourced external notes plus derived ones.
     No principles, no reasoning from memory. */
  regulated: boolean;
  regulatedNote?: string;
  notes: Note[];
}

/* ── AIRBNB OPERATOR ──────────────────────────────────────── */

const airbnb: Pack = {
  id: 'airbnb', title: 'Airbnb operator', regulated: false,
  notes: [
    { id: 'adr-vs-occ', provenance: 'principle',
      claim: 'Revenue is nightly rate × nights sold, so a higher rate at lower occupancy can beat a lower rate at higher occupancy. The comparison is always rate × nights, never occupancy alone — occupancy is a vanity number on its own.' },
    { id: 'occupancy-cost', provenance: 'principle',
      claim: 'Every booked night carries a turnover cost — cleaning, laundry, consumables, your time. A night sold near cost adds occupancy and subtracts profit, which is why chasing occupancy with discounts can lower earnings while the calendar looks healthier.' },
    { id: 'marginal-night', provenance: 'principle',
      claim: 'An empty night is worth zero and cannot be recovered — the inventory is perishable. That argues for discounting LATE and never early: a rate cut months out sells nights that would have sold anyway.' },
    { id: 'review-recency', provenance: 'principle',
      claim: 'Ratings are read as a trend, not an average. A recent 3-star does more damage than an old one, and guests read the most recent reviews first, so a bad review is answered by generating new good ones quickly rather than by arguing with it.' },
    { id: 'review-expectation', provenance: 'principle',
      claim: 'Review scores measure the gap between expectation and delivery, not absolute quality. A listing that promises less and delivers the same scores higher — which makes the listing copy a lever on the rating, not just on the booking.' },
    { id: 'complaint-speed', provenance: 'principle',
      claim: 'A complaint answered inside the stay usually becomes a private message; the same complaint answered after checkout becomes a public review. Response speed during the stay is the cheapest rating protection available.' },
    { id: 'my-rate', provenance: 'derived',
      compute: (now) => {
        const p = makadiProfit(now);
        if (!p.nightlyEgp || !p.nightsBooked) return null;
        return `Your own numbers: ${Math.round(p.nightlyEgp).toLocaleString('en-GB')} EGP/night, ${p.nightsBooked} nights recorded, ${Math.round(p.earned).toLocaleString('en-GB')} EGP earned against ${Math.round(p.spent).toLocaleString('en-GB')} EGP spent.`;
      },
      claim: 'Your realised rate and nights, from the record.' },
    { id: 'my-lead-time', provenance: 'derived',
      compute: (now) => {
        const b = getEvents({ domain: 'makadi', type: 'booking_confirmed' });
        if (b.length < 3) return null;
        const gaps = b.map((e) => e.ts).sort((a, x) => a - x)
          .map((ts, i, arr) => (i ? (ts - arr[i - 1]) / DAY : null))
          .filter((g): g is number => g !== null);
        if (!gaps.length) return null;
        const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        return `Your bookings arrive about every ${Math.round(avg)} days across ${b.length} on record. A gap much longer than that is the signal to act, not a quiet week.`;
      },
      claim: 'Your booking rhythm, from the record.' },
  ],
};

/* ── EGYPTIAN PROPERTY LAW — REGULATED ────────────────────── */

const propertyLaw: Pack = {
  id: 'property-law', title: 'Egyptian property law — case 2662',
  regulated: true,
  regulatedNote:
    'THIS PACK IS DELIBERATELY EMPTY OF LAW.\n' +
    'It was asked to hold the provisions touching case 2662 — setbacks, tree\n' +
    'protection, Law 119/2008. I will not write those from memory. An invented\n' +
    'article number or an imagined setback distance would be quoted in a real\n' +
    'case about your land, and being confidently wrong there costs more than\n' +
    'being empty.\n' +
    '\n' +
    'What goes in here, and only this:\n' +
    '  · the statute text itself, pasted from the official gazette or an\n' +
    '    official published copy — with the article number it actually carries\n' +
    '  · your lawyer\'s written position, quoted, dated, and attributed\n' +
    '  · filings and expert reports from the case file\n' +
    'Each one entered as an external note with its source. Nothing else is\n' +
    'accepted, including anything I could reason my way to.\n' +
    '\n' +
    'Law 119/2008 is, to my understanding, the Unified Building Law — and that\n' +
    'is the limit of what I will assert unsourced. Its provisions, their\n' +
    'numbering, and whether any of them apply to your plot are exactly the\n' +
    'things that must come from the text and from your lawyer.',
  notes: [
    { id: 'case-timeline', provenance: 'derived',
      compute: (now) => {
        const evs = getEvents({}).filter((e) => /2662|court|lawyer|hearing|expert/i.test(e.type + ' ' + JSON.stringify(e.meta || {})));
        if (!evs.length) return null;
        const sorted = [...evs].sort((a, b) => a.ts - b.ts);
        return sorted.slice(-8).map((e) =>
          `${new Date(e.ts).toISOString().slice(0, 10)} · ${e.domain}.${e.type}: ${JSON.stringify(e.meta || {}).slice(0, 100)}`).join('\n    ');
      },
      claim: 'Case 2662 timeline, assembled from your own record.' },
  ],
};

/* ── CAIRO MARKET TRADING — REGULATED ─────────────────────── */

const trading: Pack = {
  id: 'trading', title: 'Cairo market trading', regulated: true,
  regulatedNote:
    'NO PRICE BASELINES ARE STORED HERE, and none will be invented.\n' +
    'A made-up "typical Cairo price" is a number you would price a real trade\n' +
    'against. I have no live Cairo market data and no honest way to produce a\n' +
    'baseline from memory.\n' +
    '\n' +
    'Baselines come from ONE place: the price distribution learned from\n' +
    'listings you actually collect (§36 DER HÄNDLER). That is real, it is\n' +
    'yours, and it improves as you paste ads. Until a category has enough\n' +
    'listings, the honest answer is "I do not know the going price" — which is\n' +
    'what the engine says.\n' +
    '\n' +
    'Seasonality is the same: it becomes knowledge once your own ledger spans\n' +
    'the seasons, not before.',
  notes: [
    { id: 'my-categories', provenance: 'derived',
      compute: (now) => {
        const bought = getEvents({ domain: 'money', type: 'trade_bought' });
        const sold = getEvents({ domain: 'money', type: 'trade_sold' });
        if (!bought.length) return null;
        const cats = new Set(bought.map((e) => String(e.meta?.category || '')));
        return `${bought.length} buys and ${sold.length} sales on record across ${cats.size} categor${cats.size === 1 ? 'y' : 'ies'}: ${[...cats].filter(Boolean).join(', ')}. Return per category lives in the Händler ledger.`;
      },
      claim: 'What you have actually traded.' },
  ],
};

/* ── SMALL BUSINESS FINANCE ───────────────────────────────── */

const finance: Pack = {
  id: 'finance', title: 'Small business finance', regulated: false,
  notes: [
    { id: 'cashflow-not-profit', provenance: 'principle',
      claim: 'Profitable businesses die of cash, not of losses. Profit is an opinion about a period; cash is a fact about a date. The question is never "am I profitable" but "can I pay what is due before the money arrives".' },
    { id: 'unit-economics', provenance: 'principle',
      claim: 'Until one unit — one night, one client, one flip — makes money after ALL its costs including your time, more volume makes things worse, not better. Scaling a negative unit is how businesses fail while growing.' },
    { id: 'cost-of-capital', provenance: 'principle',
      claim: 'Debt is right when the thing it buys returns more than the debt costs, and the return arrives before the payment is due. Both halves must hold: a good return that lands late is still a default.' },
    { id: 'debt-poison', provenance: 'principle',
      claim: 'Debt taken to cover a shortfall — rather than to buy something that earns — converts a cash problem into a larger cash problem with interest attached. That is the one case where it is always wrong.' },
    { id: 'fixed-vs-variable', provenance: 'principle',
      claim: 'A fixed cost must be paid whether or not you earn; a variable one scales with activity. Runway is set by fixed costs, so the fastest way to extend it is cutting one fixed line, not trimming many variable ones.' },
    { id: 'my-burn', provenance: 'derived',
      compute: (now) => {
        const exp = getEvents({ domain: 'expense', since: now - 30 * DAY });
        if (exp.length < 8) return null;
        const total = exp.reduce((s, e) => s + (e.value || 0), 0);
        return `Your last 30 days: ${Math.round(total).toLocaleString('en-GB')} EGP out across ${exp.length} logged expenses — about ${Math.round(total / 30).toLocaleString('en-GB')} EGP a day.`;
      },
      claim: 'Your actual burn, from the record.' },
  ],
};

/* ── CONTENT THAT PERFORMS — his numbers only ─────────────── */

const content: Pack = {
  id: 'content', title: 'Content that performs (@alikaiser1)', regulated: false,
  notes: [
    { id: 'own-numbers-only', provenance: 'principle',
      claim: 'General advice about what performs is worth less than your own last twenty posts. This pack holds your numbers; where they are thin it says so instead of substituting somebody else\'s playbook.' },
    { id: 'my-posts', provenance: 'derived',
      compute: (now) => {
        const posts = getEvents({ domain: 'instagram' }).filter((e) => typeof e.value === 'number');
        if (posts.length < 5) return null;
        const withReach = posts.filter((e) => typeof e.meta?.reach === 'number');
        if (withReach.length < 5) {
          return `${posts.length} posts on record, but only ${withReach.length} carry reach numbers. Without reach per post there is nothing here to learn from — log the numbers and this becomes real.`;
        }
        const sorted = [...withReach].sort((a, b) => Number(b.meta!.reach) - Number(a.meta!.reach));
        const top = sorted.slice(0, 3).map((e) => `${String(e.meta?.kind || e.type)} (${Number(e.meta!.reach).toLocaleString('en-GB')})`);
        return `Your best three by reach: ${top.join(', ')} — out of ${withReach.length} measured posts.`;
      },
      claim: 'What actually worked on your account.' },
  ],
};

export const PACKS: Pack[] = [airbnb, propertyLaw, trading, finance, content];

export function getPack(id: string): Pack | null { return PACKS.find((p) => p.id === id) || null; }

/* ── added notes, and the refusal ─────────────────────────── */

const ADDED_KEY = 'kai.packs.added';
const RETIRED_KEY = 'kai.packs.retired';

interface Added extends Note { packId: string }

export interface AddResult { ok: boolean; reason: string }

/* The provenance rule, enforced at write time. */
export function addNote(packId: string, claim: string, provenance: Provenance, source?: string): AddResult {
  const pack = getPack(packId);
  if (!pack) return { ok: false, reason: `No pack "${packId}".` };

  if (provenance === 'external' && !(source || '').trim()) {
    return { ok: false, reason: 'Refused — an external claim needs a source. Where did this come from? A statute reference, a document, a page. Without one it is something I remembered, and this library does not store things I remembered.' };
  }
  if (pack.regulated && provenance !== 'external') {
    return { ok: false, reason: `Refused — "${pack.title}" is a regulated pack. It holds only sourced external material: the statute text, your lawyer's written position, filings. Not principles, not reasoning, not anything I could work out. That restriction is the point of the pack.` };
  }

  const list = read<Added[]>(ADDED_KEY, []);
  list.push({ packId, id: 'n-' + Math.random().toString(36).slice(2, 9), claim, provenance, source });
  write(ADDED_KEY, list); emit();
  try { logEvent({ domain: 'system', type: 'pack_note_added', meta: { packId, provenance, source: source || null }, source: 'user' }); } catch { /* ignore */ }
  return { ok: true, reason: `Added to ${pack.title}${source ? ` — sourced: ${source}` : ''}.` };
}

export function contradict(noteId: string, evidence: string, now = Date.now()): AddResult {
  if (!evidence.trim()) return { ok: false, reason: 'Retiring a note needs the evidence that contradicts it.' };
  const retired = read<Array<{ id: string; evidence: string; at: number }>>(RETIRED_KEY, []);
  if (retired.some((r) => r.id === noteId)) return { ok: false, reason: 'Already retired.' };
  retired.push({ id: noteId, evidence, at: now });
  write(RETIRED_KEY, retired); emit();
  try { logEvent({ domain: 'system', type: 'pack_note_retired', meta: { noteId, evidence }, source: 'user', ts: now }); } catch { /* ignore */ }
  return { ok: true, reason: 'Retired. Reality beats the reference — that is the correct order.' };
}

export function isRetired(noteId: string): boolean {
  return read<Array<{ id: string }>>(RETIRED_KEY, []).some((r) => r.id === noteId);
}

/* ── reading a pack ───────────────────────────────────────── */

export interface Rendered { id: string; text: string; provenance: Provenance; source?: string }

export function renderPack(packId: string, now = Date.now()): Rendered[] {
  const pack = getPack(packId);
  if (!pack) return [];
  const added = read<Added[]>(ADDED_KEY, []).filter((a) => a.packId === packId);

  const out: Rendered[] = [];
  for (const n of [...pack.notes, ...added]) {
    if (isRetired(n.id)) continue;
    if (n.provenance === 'derived') {
      const v = n.compute ? n.compute(now) : null;
      out.push({ id: n.id, provenance: 'derived', text: v ?? `${n.claim} — not yet in your numbers.` });
    } else {
      out.push({ id: n.id, provenance: n.provenance, text: n.claim, source: n.source });
    }
  }
  return out;
}

export function packText(packId: string, now = Date.now()): string {
  const pack = getPack(packId);
  if (!pack) return `No pack "${packId}". Try: ${PACKS.map((p) => p.id).join(', ')}.`;
  const L: string[] = [pack.title.toUpperCase(), ''];
  if (pack.regulated && pack.regulatedNote) { L.push(pack.regulatedNote); L.push(''); }
  for (const r of renderPack(packId, now)) {
    L.push(`· ${r.text}`);
    if (r.source) L.push(`    source: ${r.source}`);
    if (r.provenance === 'derived') L.push('    [from your own record]');
  }
  return L.join('\n');
}

export function libraryText(): string {
  const L = ['THE SKILL LIBRARY', ''];
  for (const p of PACKS) {
    const n = p.notes.length;
    L.push(`${p.id.padEnd(14)} ${p.title}${p.regulated ? '  [REGULATED — sourced material only]' : ''}  (${n} note${n === 1 ? '' : 's'})`);
  }
  L.push('');
  L.push('Two packs are regulated and deliberately hold no knowledge of mine:');
  L.push('property law, because an invented article would be quoted in a real case');
  L.push('about your land; and trading, because an invented price baseline is one');
  L.push('you would trade real money against. Both say what goes in and who puts');
  L.push('it there.');
  return L.join('\n');
}
