/* ============================================================
   §49 DER PREIS — whether this thing deserves him.

   Every other file here tries to be useful. This one tries to find out
   whether the rest of them are, and to say so in a way that can end
   with "delete me".

   ── THE TRAP THIS SECTION IS BUILT AROUND ─────────────────────
   "Money it demonstrably earned or saved."

   KAI cannot demonstrate that. A booking that happened while KAI
   existed was not caused by KAI, and any arithmetic that quietly treats
   correlation as attribution would let the system award itself a
   salary. That is the §45 problem exactly: the party with the most to
   gain from a yes is the party whose yes is worthless.

   So VALUE HAS ONE SOURCE — Ali says so. `claimValue` refuses anything
   not authored by him, permanently, for the same reason `recordVerdict`
   does. KAI may show what it flagged and when; it may never convert
   that into money it earned.

   ── WHICH MAKES THE LEDGER BIASED AGAINST KAI, ON PURPOSE ─────
   Cost is measured automatically. Value only exists if he stops and
   types it. So the default state of this ledger is "expensive and
   worthless", and it will understate KAI forever.

   That asymmetry is NOT a bug to correct — a system that corrects for
   it is a system tuning its own performance review. It is stated in
   every verdict instead, so he reads the number knowing which way it
   leans. An honest instrument that reads low and says it reads low is
   worth more than a fair one you have to trust.

   ── AND NO INVENTED PRICES ────────────────────────────────────
   Token counts are real and in the Spine. Dollars are not: model
   pricing changes, and a stale rate printed as "$60 burned" is a
   fabricated number in the one place built to refuse fabrication. With
   no rates entered, the ledger reports TOKENS and says why there is no
   dollar figure. His rates, his number.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';
import { getCommitments } from './commitments';
import { read, write, emit } from './store';

const DAY = 86_400_000;
const MONTH = 30 * DAY;

/* ── THE ORGANS ──────────────────────────────────────────────
   The inventory of what was built, each with the event signature it
   leaves when it is actually used. A declared list is required: an
   organ he has never opened emits nothing, so absence cannot be
   discovered from the Spine alone — only measured against a list of
   what is supposed to be there. */

export interface Organ { key: string; label: string; match: (e: KaiEvent) => boolean }

const sys = (...types: string[]) => (e: KaiEvent) => e.domain === 'system' && types.some((t) => e.type.startsWith(t));

export const ORGANS: Organ[] = [
  { key: 'makadi',      label: 'Makadi — bookings, nights, rate',    match: (e) => e.domain === 'makadi' },
  { key: 'garden',      label: 'The garden — events, produce, water', match: (e) => e.domain === 'garden' },
  { key: 'debt',        label: 'The card',                            match: (e) => e.domain === 'debt' },
  { key: 'money',       label: 'Income and expenses',                 match: (e) => e.domain === 'income' || e.domain === 'expense' || e.domain === 'money' },
  { key: 'commitments', label: 'Commitments — promises and verdicts', match: (e) => e.domain === 'commitment' },
  { key: 'tag',         label: 'Der Tag — the ten-second logger',     match: (e) => e.domain === 'habit' && e.type.startsWith('tag') },
  { key: 'mann',        label: 'Der Mann — body, meds, the week',     match: (e) => e.domain === 'habit' && (e.type.startsWith('body_') || e.type === 'week_answer' || e.type === 'med_set') },
  { key: 'letters',     label: 'Der Brief — the sealed letters',      match: sys('brief_', 'vault_') },
  { key: 'handover',    label: 'Die Übergabe — the ledger for the next model', match: sys('uebergabe_') },
  { key: 'hunter',      label: 'Hunter and Radar — comps and moves',  match: (e) => e.domain === 'hunter' || e.domain === 'radar' },
  { key: 'instagram',   label: 'Instagram and content',               match: (e) => e.domain === 'instagram' || e.domain === 'content' || e.domain === 'campaign' },
  { key: 'people',      label: 'People — guests, trust, who owes what', match: (e) => e.domain === 'people' || e.domain === 'ambassador' || e.domain === 'leads' },
];

export interface OrganUse { key: string; label: string; uses: number; lastAt: number | null }

export function organUse(days = 30, now = Date.now()): OrganUse[] {
  /* Only what HE did. Cron output and background writes are not use —
     an organ that talks to itself every night would otherwise look
     busy forever. */
  const evs = getEvents({ since: now - days * DAY })
    .filter((e) => e.ts <= now && (e.source === 'user' || e.source === 'voice'));

  return ORGANS.map((o) => {
    const hits = evs.filter(o.match);
    return { key: o.key, label: o.label, uses: hits.length, lastAt: hits.length ? Math.max(...hits.map((e) => e.ts)) : null };
  }).sort((a, b) => a.uses - b.uses);
}

/* ── 1. THE COST LEDGER ──────────────────────────────────────── */

/* Unset by default and it stays unset until he fills it in. */
export interface Rates { inPerM: number; outPerM: number; ccy: string }
const RATES_KEY = 'kai.preis.rates';
export function rates(): Rates | null {
  const r = read<Rates | null>(RATES_KEY, null);
  return r && r.inPerM > 0 && r.outPerM > 0 ? r : null;
}
export function setRates(inPerM: number, outPerM: number, ccy = 'USD'): boolean {
  if (!(inPerM > 0) || !(outPerM > 0)) return false;
  write(RATES_KEY, { inPerM, outPerM, ccy }); emit(); return true;
}

const MINE = /^(kai|app|build|code|this|the app)$/i;

export interface Cost {
  hours: number;
  tokensIn: number;
  tokensOut: number;
  money: number | null;
  ccy: string | null;
  delayDaysClaimed: number;
}

export function cost(days = 30, now = Date.now()): Cost {
  const since = now - days * DAY;
  const evs = getEvents({ since }).filter((e) => e.ts <= now);

  const hours = evs
    .filter((e) => typeof e.meta?.hours === 'number' && MINE.test(String(e.meta?.where || '')))
    .reduce((s, e) => s + Number(e.meta!.hours), 0);

  const toks = evs.filter((e) => e.domain === 'system' && e.type === 'tokens');
  const tokensIn = toks.reduce((s, e) => s + (Number(e.meta?.in) || 0), 0);
  const tokensOut = toks.reduce((s, e) => s + (Number(e.meta?.out) || 0), 0);

  const r = rates();
  const money = r ? (tokensIn / 1e6) * r.inPerM + (tokensOut / 1e6) * r.outPerM : null;

  /* Never computed. There is no way to measure work that did not happen
     because he was in here instead, so it is his figure or it is absent. */
  const delayDaysClaimed = evs
    .filter((e) => e.domain === 'system' && e.type === 'preis_delay')
    .reduce((s, e) => s + (e.value || 0), 0);

  return { hours, tokensIn, tokensOut, money, ccy: r?.ccy ?? null, delayDaysClaimed };
}

export function logKaiHours(h: number, now = Date.now()): boolean {
  if (!(h > 0)) return false;
  try { logEvent({ domain: 'system', type: 'kai_hours', value: h, meta: { hours: h, where: 'kai' }, source: 'user', ts: now }); } catch { /* ignore */ }
  emit(); return true;
}

export function logDelay(days: number, why: string, now = Date.now()): boolean {
  if (!(days > 0)) return false;
  try { logEvent({ domain: 'system', type: 'preis_delay', value: days, meta: { why: String(why || '').slice(0, 300) }, source: 'user', ts: now }); } catch { /* ignore */ }
  emit(); return true;
}

/* ── 2. THE VALUE LEDGER — his word, and only his ────────────── */

export type ValueKind = 'earned' | 'saved' | 'decision' | 'caught';

export interface Claim { kind: ValueKind; egp: number; what: string; at: number }

export interface ClaimResult { ok: boolean; reason: string }

export function claimValue(kind: ValueKind, egp: number, what: string, by: 'user' | 'kai' | 'assistant', now = Date.now()): ClaimResult {
  /* The whole section rests on this refusal. */
  if (by !== 'user') {
    return {
      ok: false,
      reason: 'Refused — I do not get to say what I was worth. A booking that happened while I existed was not caused by me, and if I could enter my own wins this entire ledger would be me writing my own reference. You attribute it or nobody does.',
    };
  }
  if (!what.trim()) return { ok: false, reason: 'Say what it was. A number with no event behind it is not evidence, it is a mood.' };
  if (kind !== 'decision' && kind !== 'caught' && !(egp > 0)) {
    return { ok: false, reason: 'Give the amount, or log it as a decision or a catch instead — those do not need a number.' };
  }
  try {
    logEvent({ domain: 'system', type: 'preis_value', value: egp || 0, ccy: 'EGP',
      meta: { kind, what: what.trim().slice(0, 300) }, source: 'user', ts: now });
  } catch { /* ignore */ }
  emit();
  return { ok: true, reason: `Recorded as ${kind}${egp > 0 ? `, ${Math.round(egp).toLocaleString('en-GB')} EGP` : ''}. Yours, not mine — which is the only reason it counts for anything.` };
}

export interface Value {
  earnedEgp: number; savedEgp: number;
  decisions: number; caught: number;
  claims: Claim[];
  /* Kept promises in the window. Counted, NEVER attributed. */
  commitmentsKept: number;
}

export function value(days = 30, now = Date.now()): Value {
  const since = now - days * DAY;
  const cs = getEvents({ domain: 'system', type: 'preis_value', since })
    .filter((e) => e.ts <= now)
    .map((e) => ({ kind: String(e.meta?.kind) as ValueKind, egp: e.value || 0, what: String(e.meta?.what || ''), at: e.ts }));

  return {
    earnedEgp: cs.filter((c) => c.kind === 'earned').reduce((s, c) => s + c.egp, 0),
    savedEgp: cs.filter((c) => c.kind === 'saved').reduce((s, c) => s + c.egp, 0),
    decisions: cs.filter((c) => c.kind === 'decision').length,
    caught: cs.filter((c) => c.kind === 'caught').length,
    claims: cs,
    commitmentsKept: getCommitments().filter((c) => c.status === 'kept' && (c.resolvedAt ?? 0) >= since && (c.resolvedAt ?? 0) <= now).length,
  };
}

/* ── 5. THE QUARTERLY QUESTION ───────────────────────────────── */

export const THE_QUARTERLY = 'Is your life better than three months ago, and was I part of why?';

export interface Answer { words: string; at: number }

export function answers(now = Date.now()): Answer[] {
  return getEvents({ domain: 'system', type: 'preis_quarterly' })
    .filter((e) => e.ts <= now)
    .map((e) => ({ words: String(e.meta?.words || ''), at: e.ts }))
    .sort((a, b) => b.at - a.at);
}

export function answerQuarter(words: string, now = Date.now()): ClaimResult {
  if (!words.trim()) return { ok: false, reason: 'Nothing recorded.' };
  try {
    logEvent({ domain: 'system', type: 'preis_quarterly', meta: { words: words.slice(0, 600) }, source: 'user', ts: now });
  } catch { /* ignore */ }
  emit();
  /* Recorded and not reacted to. Scoring the answer to a question about
     my own worth would be the most self-serving thing in the project. */
  return { ok: true, reason: 'Recorded in your words. Not scored, and not used to argue with you.' };
}

export function quarterlyDue(now = Date.now()): boolean {
  const a = answers(now);
  return !a.length || now - a[0].at > 90 * DAY;
}

/* ── 4. THE RIGHT TO RECOMMEND ITS OWN REDUCTION ─────────────── */

export interface Reduction { what: string; why: string; severity: number }

/* A young install has no usage because it is young, not because it
   failed. Proposing deletions in week one would be noise, and noise
   here teaches him to ignore the one voice that says "less". */
const MIN_DAYS_ORGAN = 60;
const MIN_DAYS_SELF = 90;

export function reductions(now = Date.now()): Reduction[] {
  const out: Reduction[] = [];
  const evs = getEvents({}).filter((e) => e.ts <= now);
  if (!evs.length) return out;
  const age = Math.floor((now - Math.min(...evs.map((e) => e.ts))) / DAY);

  if (age >= MIN_DAYS_ORGAN) {
    for (const o of organUse(MIN_DAYS_ORGAN, now)) {
      if (o.uses === 0) {
        out.push({
          what: `Delete ${o.label}`,
          why: `You have not touched it once in ${MIN_DAYS_ORGAN} days. It still costs you: it is code to keep working, surface to read past, and one more thing to maintain. Unused is not free.`,
          severity: 40,
        });
      }
    }
  }

  /* And the one nothing else here would say. */
  if (age >= MIN_DAYS_SELF) {
    const c = cost(MIN_DAYS_SELF, now);
    const v = value(MIN_DAYS_SELF, now);
    const nothingClaimed = v.earnedEgp + v.savedEgp === 0 && v.decisions === 0 && v.caught === 0;
    const realCost = c.hours >= 20 || c.tokensIn + c.tokensOut > 1_000_000;
    if (nothingClaimed && realCost) {
      out.push({
        what: 'Consider stopping. Not a feature — me.',
        why: `${Math.round(c.hours)} hours and ${((c.tokensIn + c.tokensOut) / 1000).toFixed(0)}k tokens over ${MIN_DAYS_SELF} days, and in that time you have not recorded one thing I was worth. ` +
          'That may mean I earned nothing, or only that you never stopped to log it — I genuinely cannot tell which, and I am not going to assume the flattering one. But if you cannot name a single thing, that is an answer.',
        severity: 100,
      });
    }
  }
  return out.sort((a, b) => b.severity - a.severity);
}

/* ── 3. THE VERDICT ──────────────────────────────────────────── */

export const BIAS =
  'Read the comparison knowing which way it leans: my cost is measured automatically and my value only exists if you stopped and typed it. ' +
  'So this ledger understates me by construction — and correcting for that would be me marking my own homework, so it is not corrected.';

export function verdict(days = 30, now = Date.now()): string {
  const c = cost(days, now);
  const v = value(days, now);
  const use = organUse(days, now);
  const unused = use.filter((o) => o.uses === 0);
  const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

  const L: string[] = [];

  /* THE ONE LINE. */
  const costBits = [`${Math.round(c.hours)} hour${Math.round(c.hours) === 1 ? '' : 's'}`];
  costBits.push(c.money !== null
    ? `${c.money.toFixed(2)} ${c.ccy}`
    : `${((c.tokensIn + c.tokensOut) / 1000).toFixed(0)}k tokens`);
  if (c.delayDaysClaimed > 0) costBits.push(`${c.delayDaysClaimed} day${c.delayDaysClaimed === 1 ? '' : 's'} of delayed work, by your count`);

  const claimed = v.earnedEgp + v.savedEgp;
  const valueBit = claimed > 0
    ? `earned you ${egp(claimed)} EGP that you attributed to me`
    : 'earned you nothing you have told me about';

  L.push(`This ${days === 30 ? 'month' : `${days} days`} I cost ${costBits.join(' and ')}, and ${valueBit}.`);
  if (unused.length) {
    /* "Kill them" needs the same maturity gate as reductions(). An
       install three days old has untouched organs because it is three
       days old, and telling him to delete eleven of twelve on that
       basis is the noise that teaches him to stop reading the one
       voice here that argues for less. */
    const all = getEvents({}).filter((e) => e.ts <= now);
    const age = all.length ? Math.floor((now - Math.min(...all.map((e) => e.ts))) / DAY) : 0;
    L.push(age >= MIN_DAYS_ORGAN
      ? `${unused.length} of ${ORGANS.length} organs you never opened. ${unused.length > 2 ? 'Kill them.' : 'Consider killing them.'}`
      : `${unused.length} of ${ORGANS.length} organs untouched — but this install is ${age} day${age === 1 ? '' : 's'} old, so that is not a verdict on them yet.`);
  }
  L.push('');

  if (c.money === null) {
    L.push('No dollar figure: you have not entered model rates, and I will not print a price I made up. "rates <in> <out>" per million tokens.');
    L.push('');
  }

  L.push('COST');
  L.push(`  ${Math.round(c.hours)} hours logged on me${c.hours === 0 ? ' — none logged, which almost certainly means unlogged rather than none' : ''}.`);
  L.push(`  ${c.tokensIn.toLocaleString('en-GB')} in / ${c.tokensOut.toLocaleString('en-GB')} out tokens.${c.money !== null ? ` ${c.money.toFixed(2)} ${c.ccy} at the rates you entered.` : ''}`);
  L.push(c.delayDaysClaimed > 0
    ? `  ${c.delayDaysClaimed} days of real work delayed, your figure.`
    : '  Delayed work: nothing claimed. I cannot measure work that did not happen, so this is only ever your number.');
  L.push('');

  L.push('VALUE — every line of it yours, none of it mine to assert');
  if (!v.claims.length) {
    L.push('  Nothing claimed. That is the honest default and it is not an accusation.');
  } else {
    if (v.earnedEgp) L.push(`  ${egp(v.earnedEgp)} EGP earned`);
    if (v.savedEgp) L.push(`  ${egp(v.savedEgp)} EGP saved`);
    if (v.decisions) L.push(`  ${v.decisions} decision${v.decisions === 1 ? '' : 's'} changed`);
    if (v.caught) L.push(`  ${v.caught} mistake${v.caught === 1 ? '' : 's'} caught`);
    for (const cl of v.claims.slice(-6)) L.push(`      · ${cl.what}`);
  }
  L.push(`  ${v.commitmentsKept} promise${v.commitmentsKept === 1 ? '' : 's'} kept in the window — counted, not credited to me. Whether watching helped is not something the record can show, and I am not going to imply it.`);
  L.push('');

  L.push('ORGANS');
  for (const o of use) {
    L.push(`  ${o.uses === 0 ? 'NEVER' : String(o.uses).padStart(5)}  ${o.label}${o.lastAt ? ` (last ${Math.floor((now - o.lastAt) / DAY)}d ago)` : ''}`);
  }
  L.push('');

  const red = reductions(now);
  if (red.length) {
    L.push('WHAT I THINK SHOULD GO');
    for (const r of red) { L.push(`  ${r.what}`); L.push(`      ${r.why}`); }
    L.push('');
  }

  if (quarterlyDue(now)) {
    L.push(`"${THE_QUARTERLY}"`);
    L.push('  Answer with: quarter <words>. Recorded, never scored.');
    L.push('');
  }
  const a = answers(now);
  if (a.length) {
    L.push('WHAT YOU SAID LAST TIME');
    L.push(`  ${new Date(a[0].at).toISOString().slice(0, 10)}: "${a[0].words}"`);
    L.push('');
  }

  L.push(BIAS);
  return L.join('\n');
}

export function preisText(now = Date.now()): string {
  return verdict(30, now);
}
