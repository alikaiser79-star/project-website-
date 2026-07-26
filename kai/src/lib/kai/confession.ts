/* ============================================================
   §26 DIE BEICHTE (The Confession) — spoken truth correction.

   Most of KAI's headline numbers start seeded and drift stale. This turns
   speech into Spine state: Ali says a fact once, confirms it, and it is
   true. Nothing enters the Spine unconfirmed — a misheard number is worse
   than a missing one, so every parse is proposed, never applied.

     parseFacts()   one utterance → N facts (multi-fact splits), EN + AR
     applyFact()    a CONFIRMED fact → real Spine events + typed state
     truthAges()    how old every headline number is; >14d is stale and
                    must never be shown with the confidence of a fresh one

   Deterministic and dependency-free of the LLM: a number misheard by the
   recogniser is caught by the confirm step, not by a model's guess.
   ============================================================ */

import { logEvent, getEvents } from './events';
import { loadState, saveState, setLiquidCash } from '../store';
import type { Currency } from '../../types';

const DAY = 86_400_000;
export const STALE_DAYS = 14;

export type FactKind = 'cash' | 'debt' | 'makadi_rate' | 'expense' | 'recurring' | 'income';

export interface Fact {
  kind: FactKind;
  value: number;
  ccy: Currency;
  label: string;              // human confirm line: "cash → 12,000 EGP"
  detail?: string;            // category / channel / cadence
  raw: string;                // the clause it came from
}

/* ── numbers: EN words, digits, k/thousand, Arabic-Indic digits ── */
const AR_DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const EN_SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

function normalise(s: string): string {
  return String(s || '').replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d).toLowerCase();
}

/* Pull the first amount out of a clause. Returns null when there's no number
   — a clause without a number is never a fact. */
export function parseAmount(clauseRaw: string): number | null {
  const s = normalise(clauseRaw);

  /* 1. digits, optional thousands commas/decimal, optional k / thousand / ألف */
  const m = s.match(/(\d[\d,]*(?:\.\d+)?)\s*(k\b|thousand|thousands|alf|ألف|الف|آلاف)?/);
  if (m) {
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (isFinite(n) && n > 0) {
      if (m[2]) n *= 1000;
      return n;
    }
  }

  /* 2. English number words ("fifteen thousand", "twelve hundred") — the
     recogniser sometimes returns words instead of digits, and the correction
     pass reads numbers aloud, so replies arrive this way. */
  const words = s.split(/[^a-z]+/).filter(Boolean);
  let total = 0, current = 0, seen = false;
  for (const w of words) {
    if (w in EN_SMALL) { current += EN_SMALL[w]; seen = true; continue; }
    if (w === 'hundred') { current = (current || 1) * 100; seen = true; continue; }
    if (w === 'thousand' || w === 'alf') { total += (current || 1) * 1000; current = 0; seen = true; continue; }
  }
  if (seen) { const n = total + current; if (n > 0) return n; }
  return null;
}

/* ── subjects: what the number is ABOUT (EN + AR) ─────────────── */
const CASH_RE   = /\b(cash|liquid|on hand|in hand|pocket)\b|كاش|نقدي|السيولة|فلوس/i;
const DEBT_RE   = /\b(card|credit|debt|balance|visa|mastercard)\b|بطاقة|الكارت|كارت|الدين|الكريدت/i;
const RATE_RE   = /\b(makadi|nightly|per night|a night|the night|rate)\b|مكادي|الليلة|بالليلة|السعر/i;
const SPENT_RE  = /\b(spent|paid|bought|cost me)\b|صرفت|دفعت|اشتريت/i;
const RECUR_RE  = /\b(per turnover|each turnover|per month|a month|monthly|every month|per clean|per stay)\b|كل شهر|شهريا|كل تنظيف/i;
const INCOME_RE = /\b(earned|received|income|salary|got paid|came in)\b|دخل|قبضت|استلمت/i;

const CCY_RE: Array<{ re: RegExp; ccy: Currency }> = [
  { re: /\$|\busd\b|dollar/i, ccy: 'USD' },
  { re: /€|\beur\b|euro/i, ccy: 'EUR' },
];
function ccyOf(s: string, fallback: Currency = 'EGP'): Currency {
  return CCY_RE.find((c) => c.re.test(s))?.ccy ?? fallback;
}

const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

/* ── split one utterance into fact-bearing clauses ────────────── */
export function splitClauses(utterance: string): string[] {
  return String(utterance || '')
    /* sentence enders, semicolons, Arabic comma/question mark */
    .split(/[.!?؟;،]+|\band\b|\bthen\b|\balso\b| و /gi)
    .map((c) => c.trim())
    .filter((c) => c.length > 1);
}

/* ── the parse ────────────────────────────────────────────────── */
export function parseFacts(utterance: string, _now = Date.now()): Fact[] {
  const out: Fact[] = [];
  /* "I spent 300 on fuel and 450 on groceries" — the second clause carries a
     number and a noun but no verb. An enumerating clause inherits the last
     verb, so a chained list logs every item instead of only the first. */
  let carried: 'expense' | 'income' | null = null;

  for (const raw of splitClauses(utterance)) {
    const amount = parseAmount(raw);
    if (amount == null) continue;
    const ccy = ccyOf(raw);

    const hasOwnSubject = RECUR_RE.test(raw) || RATE_RE.test(raw) || DEBT_RE.test(raw)
      || CASH_RE.test(raw) || SPENT_RE.test(raw) || INCOME_RE.test(raw);
    if (!hasOwnSubject && carried) {
      const what = subjectWord(raw);
      if (what) {
        out.push(carried === 'expense'
          ? { kind: 'expense', value: amount, ccy, label: `spent ${egp(amount)} ${ccy} · ${what}`, detail: what, raw }
          : { kind: 'income', value: amount, ccy, label: `income ${egp(amount)} ${ccy} · ${what}`, detail: what, raw });
        continue;
      }
    }
    if (SPENT_RE.test(raw)) carried = 'expense';
    else if (INCOME_RE.test(raw)) carried = 'income';
    else if (hasOwnSubject) carried = null;

    /* order matters: the most specific subject wins the clause */
    if (RECUR_RE.test(raw)) {
      const what = subjectWord(raw) || 'recurring cost';
      out.push({ kind: 'recurring', value: amount, ccy, label: `${what} → ${egp(amount)} ${ccy}`, detail: cadenceOf(raw), raw });
      continue;
    }
    if (RATE_RE.test(raw)) {
      const channel = /\bdirect\b|مباشر/i.test(raw) ? 'direct' : /airbnb/i.test(raw) ? 'airbnb' : undefined;
      out.push({ kind: 'makadi_rate', value: amount, ccy, label: `Makadi rate → ${egp(amount)} ${ccy}/night`, detail: channel, raw });
      continue;
    }
    if (DEBT_RE.test(raw)) {
      out.push({ kind: 'debt', value: amount, ccy: 'EGP', label: `card balance → ${egp(amount)} EGP`, raw });
      continue;
    }
    if (CASH_RE.test(raw)) {
      out.push({ kind: 'cash', value: amount, ccy: 'EGP', label: `cash → ${egp(amount)} EGP`, raw });
      continue;
    }
    if (SPENT_RE.test(raw)) {
      const what = subjectWord(raw) || 'expense';
      out.push({ kind: 'expense', value: amount, ccy, label: `spent ${egp(amount)} ${ccy} · ${what}`, detail: what, raw });
      continue;
    }
    if (INCOME_RE.test(raw)) {
      const what = subjectWord(raw) || 'income';
      out.push({ kind: 'income', value: amount, ccy, label: `income ${egp(amount)} ${ccy} · ${what}`, detail: what, raw });
      continue;
    }
  }
  return out;
}

/* The noun the clause is about — "on fuel" / "for the cleaner" / trailing word. */
function subjectWord(raw: string): string | null {
  const s = normalise(raw);
  /* English prepositions … */
  const m = s.match(/\b(?:on|for|to)\s+(?:the\s+)?([a-z]{3,20})/);
  if (m) return m[1];
  /* … and the Arabic ones (على / في / لـ), where the noun carries its article. */
  const ar = s.match(/(?:على|في|ل)\s*(?:ال)?([؀-ۿ]{3,20})/);
  if (ar) return ar[1];
  const m2 = s.match(/\b(cleaner|fuel|petrol|food|groceries|rent|internet|phone|electricity|water|transport|uber)\b/);
  if (m2) return m2[1];
  const ar2 = s.match(/(بنزين|كهربا|مياه|أكل|اكل|نظافة|إيجار|ايجار)/);
  return ar2 ? ar2[1] : null;
}
function cadenceOf(raw: string): string {
  if (/turnover|clean|stay/i.test(raw)) return 'per turnover';
  if (/month/i.test(raw) || /شهر/.test(raw)) return 'per month';
  return 'recurring';
}

/* ── commit a CONFIRMED fact ──────────────────────────────────── */
export function applyFact(f: Fact, now = Date.now()): void {
  switch (f.kind) {
    case 'cash': {
      setLiquidCash(f.value);
      logEvent({ domain: 'system', type: 'cash_on_hand', value: Math.round(f.value), ccy: 'EGP', meta: { source: 'confession' }, source: 'voice', ts: now });
      break;
    }
    case 'debt': {
      const s = loadState();
      s.debtCurrent = Math.max(0, Math.round(f.value));
      saveState(s);
      logEvent({ domain: 'debt', type: 'balance_updated', value: s.debtCurrent, ccy: 'EGP', meta: { source: 'confession' }, source: 'voice', ts: now });
      break;
    }
    case 'makadi_rate': {
      const s = loadState();
      s.makadi = { ...s.makadi, nightlyRate: Math.round(f.value), rateCcy: f.ccy };
      saveState(s);
      logEvent({ domain: 'makadi', type: 'rate_changed', value: Math.round(f.value), ccy: f.ccy, meta: { channel: f.detail, source: 'confession' }, source: 'voice', ts: now });
      break;
    }
    case 'expense': {
      logEvent({ domain: 'expense', type: 'expense_logged', value: Math.round(f.value), ccy: f.ccy, meta: { merchant: f.detail || 'expense', source: 'confession' }, source: 'voice', ts: now });
      break;
    }
    case 'income': {
      logEvent({ domain: 'income', type: 'received', value: Math.round(f.value), ccy: f.ccy, meta: { label: f.detail || 'income', source: 'confession' }, source: 'voice', ts: now });
      break;
    }
    case 'recurring': {
      logEvent({ domain: 'system', type: 'recurring_cost', value: Math.round(f.value), ccy: f.ccy, meta: { label: f.detail || 'recurring', cadence: f.detail, source: 'confession' }, source: 'voice', ts: now });
      break;
    }
  }
}

/* ── §26.4 TRUTH AGE — never show a stale number confidently ──── */
export interface TruthAge { key: string; label: string; at: number | null; days: number | null; stale: boolean }

const SOURCES: Array<{ key: string; label: string; find: (evs: ReturnType<typeof getEvents>) => number | null }> = [
  { key: 'cash', label: 'Cash', find: (e) => last(e, (x) => (x.domain === 'system' && x.type === 'cash_on_hand') || (x.domain === 'income' && x.type === 'cash_set')) },
  { key: 'debt', label: 'Debt', find: (e) => last(e, (x) => x.domain === 'debt' && (x.type === 'balance_updated' || x.type === 'payment_logged')) },
  { key: 'makadi', label: 'Makadi net', find: (e) => last(e, (x) => x.domain === 'makadi' && (x.type === 'booking_confirmed' || x.type === 'rate_changed' || x.type === 'nights_booked')) },
  { key: 'runway', label: 'Runway', find: (e) => last(e, (x) => x.domain === 'expense' || (x.domain === 'system' && x.type === 'cash_on_hand')) },
];

function last(evs: ReturnType<typeof getEvents>, pred: (e: any) => boolean): number | null {
  let t: number | null = null;
  for (const e of evs) if (pred(e) && (t == null || e.ts > t)) t = e.ts;
  return t;
}

export function truthAges(now = Date.now()): Record<string, TruthAge> {
  const evs = safeEvents();
  const out: Record<string, TruthAge> = {};
  for (const s of SOURCES) {
    const at = s.find(evs);
    const days = at == null ? null : Math.floor((now - at) / DAY);
    out[s.key] = { key: s.key, label: s.label, at, days, stale: days == null || days > STALE_DAYS };
  }
  return out;
}

/* "3d ago" / "today" / "never set" — the age label under a headline number. */
export function ageLabel(t: TruthAge | undefined): string {
  if (!t || t.days == null) return 'never set';
  if (t.days <= 0) return 'today';
  if (t.days === 1) return '1d ago';
  return `${t.days}d ago`;
}

function safeEvents() { try { return getEvents({}); } catch { return [] as ReturnType<typeof getEvents>; } }

/* ── §26.2 THE CORRECTION PASS — the guided walk ─────────────── */
export interface CorrectionStep { key: FactKind; prompt: string; spoken: string; current: number | null }

/* The core numbers, in the order KAI reads them aloud. */
export function correctionSteps(now = Date.now()): CorrectionStep[] {
  const s = safeState();
  const ages = truthAges(now);
  const steps: CorrectionStep[] = [];
  const cash = s?.liquidCash ?? null;
  const debt = s?.debtCurrent ?? null;
  const rate = s?.makadi?.nightlyRate ?? null;
  const rccy = (s?.makadi?.rateCcy ?? 'EGP') as Currency;

  steps.push({ key: 'cash', current: cash, prompt: `Cash: ${cash == null ? '—' : egp(cash)} EGP (${ageLabel(ages.cash)}). Correct?`, spoken: `Cash: ${cash == null ? 'not set' : egp(cash)} pounds. Correct?` });
  steps.push({ key: 'debt', current: debt, prompt: `Card: ${debt == null ? '—' : egp(debt)} EGP (${ageLabel(ages.debt)}). Correct?`, spoken: `The card: ${debt == null ? 'not set' : egp(debt)} pounds. Correct?` });
  steps.push({ key: 'makadi_rate', current: rate, prompt: `Makadi rate: ${rate == null ? '—' : egp(rate)} ${rccy}/night (${ageLabel(ages.makadi)}). Correct?`, spoken: `Makadi: ${rate == null ? 'not set' : egp(rate)} ${rccy === 'USD' ? 'dollars' : 'pounds'} a night. Correct?` });
  return steps;
}

/* A spoken reply during the pass: yes/no, or a corrected number. */
export function parseCorrection(reply: string, step: CorrectionStep): { ok: true } | { fact: Fact } | { skip: true } {
  const s = normalise(reply).trim();
  /* NOTE: \b is ASCII-only in JS — an Arabic alternative followed by \b never
     matches. ASCII words keep the boundary; Arabic ones are matched bare. */
  if (/^(?:yes|yeah|yep|correct|right|ok|okay|fine)\b/.test(s) || /^(?:صح|أيوه|ايوه|نعم|تمام|مضبوط|أيوة)/.test(s)) return { ok: true };
  if (/^(?:skip|next|later|pass)\b/.test(s) || /^(?:بعدين|تخطى|التالي)/.test(s)) return { skip: true };
  const amount = parseAmount(reply);
  if (amount != null) {
    const ccy: Currency = step.key === 'makadi_rate' ? ccyOf(reply, 'USD') : 'EGP';
    const label = step.key === 'cash' ? `cash → ${egp(amount)} EGP`
      : step.key === 'debt' ? `card balance → ${egp(amount)} EGP`
      : `Makadi rate → ${egp(amount)} ${ccy}/night`;
    return { fact: { kind: step.key, value: amount, ccy, label, raw: reply } };
  }
  return { skip: true };
}

function safeState() { try { return loadState(); } catch { return null; } }
