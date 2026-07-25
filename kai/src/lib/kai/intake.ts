/* ============================================================
   DER EINGANG (§Q3.x) — THE INTAKE. Logging a life in seconds.

   One job: turn the least possible typing into a true Spine event.
     "450 cleaner"        → expense 450 EGP, "cleaner"
     "1500 booking friend"→ Makadi income 1,500 EGP, "friend"
     "$100 tip"           → expense 100 USD, "tip"
     "salary 33000"       → income 33,000 EGP, "salary"

   The QUICK LOG BAR logs directly (your typing IS the intent — no Gate).
   BULK PASTE and RECURRING go THROUGH the Gate as a log_batch (one tap
   approves the lot). Nothing is invented — every number comes from you.
   Feeds the Twin the data it needs to model you.
   ============================================================ */

import { logEvent } from './events';
import { addExpense } from '../expenses';
import { proposeAction, getPending } from './pending';
import { read, write } from './store';
import type { Currency, ExpenseCategory } from '../../types';

export type IntakeDir = 'in' | 'out';
export interface IntakeEntry {
  amount: number;
  ccy: Currency;
  label: string;
  dir: IntakeDir;
  domain: 'expense' | 'income' | 'makadi';
  type: string;
  category?: ExpenseCategory;
  raw: string;
}

/* ── vocab ────────────────────────────────────────────────── */
const INCOME_RE = /\b(salary|paid me|payment|received|income|rent|client|sold|sale|refund|deposit|booking|booked|guest|airbnb|enpal|honda|freelance|invoice|earned|got paid|cash in)\b/i;
const MAKADI_RE = /\b(booking|booked|guest|airbnb|makadi|reservation|nights?|check[-\s]?in|stay)\b/i;
const CCY_RE: Array<{ re: RegExp; ccy: Currency }> = [
  { re: /\$|\busd\b|\bdollars?\b/i, ccy: 'USD' },
  { re: /€|\beur\b|\beuros?\b/i, ccy: 'EUR' },
  { re: /\begp\b|\ble\b|\bpounds?\b|جنيه/i, ccy: 'EGP' },
];
/* light category guess for expenses — best-effort, defaults to 'other'. */
const CAT_RE: Array<{ re: RegExp; cat: ExpenseCategory }> = [
  { re: /\b(petrol|fuel|gas|benzine)\b/i, cat: 'fuel' },
  { re: /\b(uber|taxi|careem|transport|metro|bus|ride)\b/i, cat: 'transport' },
  { re: /\b(lunch|dinner|breakfast|coffee|restaurant|cafe|café|meal)\b/i, cat: 'dining' },
  { re: /\b(groceries|grocery|supermarket|carrefour|market)\b/i, cat: 'groceries' },
  { re: /\b(bill|electric|water|internet|phone|subscription|rent)\b/i, cat: 'bills' },
  { re: /\b(shopping|clothes|amazon|shein|shoes)\b/i, cat: 'shopping' },
];

/* ── parse one line ───────────────────────────────────────── */
export function parseLine(input: string): IntakeEntry | null {
  const raw = String(input || '').trim();
  if (!raw) return null;

  /* amount: first number token, optional thousands commas / decimal, optional
     k suffix. Ignore a leading currency symbol glued to it. */
  const m = raw.match(/(?:[$€£]\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k)?/i);
  if (!m) return null;
  let amount = parseFloat(m[1].replace(/,/g, ''));
  if (!isFinite(amount) || amount <= 0) return null;
  if (m[2]) amount *= 1000;

  const ccy = (CCY_RE.find((c) => c.re.test(raw))?.ccy) || 'EGP';

  /* label = everything that isn't the amount token or a currency word. */
  let label = raw
    .replace(m[0], ' ')
    .replace(/[$€£]/g, ' ')
    .replace(/\b(usd|eur|egp|le|dollars?|euros?|pounds?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const dir: IntakeDir = INCOME_RE.test(raw) ? 'in' : 'out';

  if (dir === 'in' && MAKADI_RE.test(raw)) {
    return { amount, ccy, label: label || 'Makadi income', dir, domain: 'makadi', type: 'booking_confirmed', raw };
  }
  if (dir === 'in') {
    return { amount, ccy, label: label || 'income', dir, domain: 'income', type: 'received', raw };
  }
  const category = CAT_RE.find((c) => c.re.test(raw))?.cat || 'other';
  return { amount, ccy, label: label || 'expense', dir, domain: 'expense', type: 'expense_logged', category, raw };
}

/* ── parse a batch (bank SMS, pasted list) ────────────────── */
export function parseBatch(text: string): IntakeEntry[] {
  const lines = String(text || '')
    .split(/[\n;]+|,(?=\s)/)                    // newlines, semicolons, or a LIST comma (comma+space)
    .map((l) => l.trim())                       // — never a thousands comma ("2,000" stays whole)
    .filter(Boolean);
  const out: IntakeEntry[] = [];
  for (const l of lines) {
    const e = parseLine(l);
    if (e) out.push(e);
  }
  return out;
}

/* ── apply an entry to the real stores ────────────────────── */
export function applyIntakeEntry(e: IntakeEntry, now = Date.now()): void {
  if (e.domain === 'expense') {
    addExpense({
      merchant: e.label, total: e.amount, currency: e.ccy,
      date: new Date(now).toISOString().slice(0, 10),
      category: e.category || 'other',
    });
    return;
  }
  if (e.domain === 'makadi') {
    logEvent({
      domain: 'makadi', type: 'booking_confirmed', value: e.amount, ccy: e.ccy,
      meta: { guest: e.label, amount: `${e.amount} ${e.ccy}`, source: 'intake' }, source: 'user', ts: now,
    });
    return;
  }
  logEvent({
    domain: 'income', type: 'received', value: e.amount, ccy: e.ccy,
    meta: { label: e.label, source: 'intake' }, source: 'user', ts: now,
  });
}

export function entrySummary(e: IntakeEntry): string {
  const n = Math.round(e.amount).toLocaleString('en-GB');
  const sign = e.dir === 'in' ? '+' : '−';
  return `${sign}${n} ${e.ccy} · ${e.label}`;
}

/* ── EVENING PROMPT — has anything been logged today? ─────── */
const DAY = 86_400_000;
export function loggedExpenseToday(now = Date.now()): boolean {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return read<any[]>('kai.events', [])
    .some((e) => e.domain === 'expense' && e.ts >= start.getTime());
}
const EVENING_KEY = 'kai.intake.eveningAsked';
/* Ask once, only in the evening, only if nothing's been logged today. */
export function shouldAskEvening(now = Date.now()): boolean {
  const d = new Date(now);
  if (d.getHours() < 21) return false;
  const today = d.toISOString().slice(0, 10);
  try { if (localStorage.getItem(EVENING_KEY) === today) return false; } catch { /* ignore */ }
  return !loggedExpenseToday(now);
}
export function markEveningAsked(now = Date.now()): void {
  try { localStorage.setItem(EVENING_KEY, new Date(now).toISOString().slice(0, 10)); } catch { /* ignore */ }
}

/* ── RECURRING — fixed items that log themselves, gated ───── */
export interface RecurringItem {
  id: string;
  label: string;
  amount: number;
  ccy: Currency;
  dir: IntakeDir;
  domain: 'expense' | 'income' | 'makadi';
  type: string;
  dayOfMonth: number;      // 1–28
  enabled: boolean;
  lastMonth?: string;      // 'YYYY-MM' it last fired
}
const REC_KEY = 'kai.intake.recurring';

export function getRecurring(): RecurringItem[] { return read<RecurringItem[]>(REC_KEY, []); }
export function saveRecurring(list: RecurringItem[]): void { write(REC_KEY, list); }
export function upsertRecurring(item: Partial<RecurringItem> & { label: string; amount: number }): RecurringItem[] {
  const list = getRecurring();
  const id = (item as any).id || 'rec-' + Math.random().toString(36).slice(2, 9);
  const dir: IntakeDir = item.dir || (/(salary|rent|income|booking)/i.test(item.label) ? 'in' : 'out');
  const domain = item.domain || (dir === 'in' ? 'income' : 'expense');
  const next: RecurringItem = {
    id, label: item.label, amount: item.amount, ccy: item.ccy || 'EGP',
    dir, domain, type: item.type || (domain === 'expense' ? 'expense_logged' : 'received'),
    dayOfMonth: Math.max(1, Math.min(28, item.dayOfMonth || 1)),
    enabled: item.enabled ?? true, lastMonth: item.lastMonth,
  };
  const i = list.findIndex((r) => r.id === id);
  if (i >= 0) list[i] = next; else list.push(next);
  saveRecurring(list);
  return list;
}
export function removeRecurring(id: string): RecurringItem[] {
  const list = getRecurring().filter((r) => r.id !== id);
  saveRecurring(list);
  return list;
}

/* Which recurring items are due this month and not yet fired. */
export function dueRecurring(now = Date.now()): RecurringItem[] {
  const d = new Date(now);
  const month = d.toISOString().slice(0, 7);
  const dom = d.getDate();
  return getRecurring().filter((r) => r.enabled && dom >= r.dayOfMonth && r.lastMonth !== month);
}

export function recurringToEntry(r: RecurringItem): IntakeEntry {
  return { amount: r.amount, ccy: r.ccy, label: r.label, dir: r.dir, domain: r.domain, type: r.type, raw: r.label };
}

/* Mark items fired for this month (called when the batch is approved). */
export function markRecurringFired(ids: string[], now = Date.now()): void {
  const month = new Date(now).toISOString().slice(0, 7);
  const list = getRecurring();
  for (const r of list) if (ids.includes(r.id)) r.lastMonth = month;
  saveRecurring(list);
}

/* Propose this month's due recurring items as ONE gated batch — one tap
   confirms the lot. Idempotent: an already-proposed item is marked fired
   only on approval, and a pending proposal for the same items isn't
   duplicated within a run. Returns how many items it queued. */
export function runRecurring(now = Date.now()): number {
  const due = dueRecurring(now);
  if (!due.length) return 0;
  /* Don't stack proposals — if a recurring batch is already waiting at the
     Gate, leave it. Approval marks the items fired (executor); rejection
     leaves them un-fired and re-proposable next foreground. */
  const alreadyQueued = getPending().some((a) => a.kind === 'log_batch' && (a.payload as any)?.note === 'recurring');
  if (alreadyQueued) return 0;

  const entries = due.map(recurringToEntry);
  const recurringIds = due.map((r) => r.id);
  const total = due.reduce((s, r) => s + (r.dir === 'in' ? 0 : r.amount), 0);
  const summary = `Log ${due.length} recurring item${due.length === 1 ? '' : 's'}` +
    (total ? ` · ${Math.round(total).toLocaleString('en-GB')} EGP out` : '') +
    ' — ' + due.map((r) => r.label).join(', ');
  proposeAction('log_batch', summary, { entries, recurringIds, note: 'recurring' });
  return due.length;
}
