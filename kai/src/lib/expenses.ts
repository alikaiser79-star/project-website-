/* ============================================================
   Expenses store + aggregations.

   CRUD over KaiPersisted.expenses (localStorage). Pure helpers
   for monthly total + per-category breakdowns so the panel
   and the get_expenses tool share one source of truth.
   ============================================================ */

import { loadState, saveState } from './store';
import type { Expense, ExpenseCategory } from '../types';
import { logEvent } from './kai/events';

export const CATEGORIES: ExpenseCategory[] = [
  'groceries', 'dining', 'fuel', 'transport', 'shopping', 'bills', 'other',
];

export function isCategory(v: any): v is ExpenseCategory {
  return typeof v === 'string' && (CATEGORIES as string[]).includes(v);
}

export function listExpenses(): Expense[] {
  return [...(loadState().expenses || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function addExpense(e: Omit<Expense, 'id'>): Expense {
  const next: Expense = {
    id: 'x-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    merchant: clean(e.merchant) || 'Unknown',
    total: round2(Math.max(0, Number(e.total) || 0)),
    currency: normCcy(e.currency),
    date: normDate(e.date),
    category: isCategory(e.category) ? e.category : 'other',
  };
  const s = loadState();
  s.expenses = [next, ...(s.expenses || [])];
  saveState(s);
  /* Spine — amount + category metadata so "spend under N on X this
     month" commitments can resolve. */
  logEvent({
    domain: 'expense', type: 'expense_logged',
    value: next.total,
    meta: { merchant: next.merchant, category: next.category, currency: next.currency },
    source: 'user',
  });
  return next;
}

export function updateExpense(id: string, patch: Partial<Omit<Expense, 'id'>>): Expense | null {
  const s = loadState();
  const idx = (s.expenses || []).findIndex(e => e.id === id);
  if (idx < 0) return null;
  const cur = s.expenses[idx];
  const next: Expense = {
    ...cur,
    ...(patch.merchant !== undefined ? { merchant: clean(patch.merchant) || cur.merchant } : {}),
    ...(patch.total    !== undefined ? { total:    round2(Math.max(0, Number(patch.total) || 0)) } : {}),
    ...(patch.currency !== undefined ? { currency: normCcy(patch.currency) } : {}),
    ...(patch.date     !== undefined ? { date:     normDate(patch.date) } : {}),
    ...(patch.category !== undefined ? { category: isCategory(patch.category) ? patch.category : cur.category } : {}),
  };
  s.expenses = s.expenses.map(e => e.id === id ? next : e);
  saveState(s);
  return next;
}

export function deleteExpense(id: string): boolean {
  const s = loadState();
  const before = (s.expenses || []).length;
  s.expenses = (s.expenses || []).filter(e => e.id !== id);
  saveState(s);
  return s.expenses.length !== before;
}

/* ── Aggregations ───────────────────────────────────────── */

function ymOfDate(d: string): string {
  return String(d || '').slice(0, 7);     // YYYY-MM
}

export function currentMonthKey(): string {
  const d = new Date();
  return d.toISOString().slice(0, 7);
}

export function monthlyTotal(ym = currentMonthKey()): number {
  return listExpenses()
    .filter(e => ymOfDate(e.date) === ym)
    .reduce((sum, e) => sum + e.total, 0);
}

/* Per-category totals for the given YYYY-MM, sorted desc. */
export function categoryBreakdown(ym = currentMonthKey()): Array<{ category: ExpenseCategory; total: number }> {
  const buckets = new Map<ExpenseCategory, number>();
  for (const e of listExpenses()) {
    if (ymOfDate(e.date) !== ym) continue;
    buckets.set(e.category, (buckets.get(e.category) || 0) + e.total);
  }
  return CATEGORIES
    .map(c => ({ category: c, total: round2(buckets.get(c) || 0) }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

/* Snapshot for the get_expenses tool — small JSON-friendly payload. */
export function expensesSnapshot() {
  const ym = currentMonthKey();
  const items = listExpenses();
  const monthItems = items.filter(e => ymOfDate(e.date) === ym);
  return {
    month: ym,
    monthly_total: round2(monthlyTotal(ym)),
    by_category: categoryBreakdown(ym),
    month_count: monthItems.length,
    recent: items.slice(0, 12).map(e => ({
      id: e.id, merchant: e.merchant, total: e.total,
      currency: e.currency, date: e.date, category: e.category,
    })),
  };
}

/* ── Helpers ────────────────────────────────────────────── */

function clean(s: any): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}
function normCcy(c: any): string {
  const s = String(c ?? 'EGP').trim().toUpperCase().slice(0, 6);
  return s || 'EGP';
}
function normDate(d: any): string {
  const s = String(d ?? '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
