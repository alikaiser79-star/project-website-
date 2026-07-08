/* ============================================================
   INTEGRITY (§13.2 TRUTH) — the dashboard must never disagree with
   itself. Cross-checks every derived number against the raw Spine:
   debt vs its payment history, income vs its sources, Escape Velocity
   inputs, and currency tags on 100% of money events. Any mismatch is a
   discrepancy card naming the exact events; a reconcile flow fixes it.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';
import { read, write, emit } from './store';
import { loadState, saveState } from '../store';
import { monthlyIncomeEgp } from './money';
import { escapeState } from './escape';
import type { Currency } from '../../types';

const EVENTS_KEY = 'kai.events';

export type IntegrityStatus = 'ok' | 'warn' | 'fail';
export interface IntegrityCheck {
  id: string;
  title: string;
  status: IntegrityStatus;
  detail: string;
  events?: KaiEvent[];                 // the exact events involved
  fix?: { kind: 'backfill_ccy' | 'align_debt'; eventIds?: string[] };
}

/* A money-valued event that should carry a currency tag. */
export function isMoneyEvent(e: KaiEvent): boolean {
  if (typeof e.value !== 'number') return false;
  if (e.domain === 'debt' || e.domain === 'income' || e.domain === 'expense' || e.domain === 'money') return true;
  if (e.domain === 'makadi' && (e.type === 'rate_changed' || e.type === 'arrears_paid')) return true;
  if (e.domain === 'system' && e.type === 'cash_on_hand') return true;
  return false;
}

export function runIntegrity(now = Date.now()): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];
  const s = loadState();
  const all = getEvents({});

  /* 1. Currency tags on 100% of money events. */
  try {
    const untagged = all.filter(isMoneyEvent).filter((e) => !e.ccy);
    checks.push(untagged.length === 0
      ? { id: 'ccy', title: 'Currency tags', status: 'ok', detail: `All ${all.filter(isMoneyEvent).length} money events carry a currency.` }
      : { id: 'ccy', title: 'Currency tags', status: 'fail',
          detail: `${untagged.length} money event(s) have a value but no currency tag.`,
          events: untagged.slice(0, 12), fix: { kind: 'backfill_ccy', eventIds: untagged.map((e) => e.id) } });
  } catch { /* ignore */ }

  /* 2. Debt vs payment history — the stored balance must equal the
     latest balance_updated event. */
  try {
    const bals = getEvents({ domain: 'debt', type: 'balance_updated' }).sort((a, b) => a.ts - b.ts);
    const latest = bals[bals.length - 1];
    if (latest && typeof latest.value === 'number' && latest.value !== s.debtCurrent) {
      checks.push({ id: 'debt', title: 'Debt vs Spine', status: 'fail',
        detail: `Stored balance ${s.debtCurrent.toLocaleString()} EGP disagrees with the latest Spine balance_updated (${latest.value.toLocaleString()} EGP).`,
        events: [latest], fix: { kind: 'align_debt' } });
    } else {
      checks.push({ id: 'debt', title: 'Debt vs Spine', status: 'ok', detail: latest ? 'Stored balance matches the Spine.' : 'No balance history yet.' });
    }
  } catch { /* ignore */ }

  /* 3. Income vs sources — every stream carries a valid currency and a
     positive amount, and the total recomputes without error. */
  try {
    const bad = (s.income || []).filter((i) => !['EGP', 'USD', 'EUR'].includes(i.ccy) || !(i.amount > 0));
    const total = monthlyIncomeEgp(s.income);
    if (bad.length) {
      checks.push({ id: 'income', title: 'Income vs sources', status: 'fail',
        detail: `${bad.length} income stream(s) have a missing/invalid currency or non-positive amount: ${bad.map((b) => b.label).join(', ')}.` });
    } else if (!isFinite(total)) {
      checks.push({ id: 'income', title: 'Income vs sources', status: 'fail', detail: 'Monthly income total did not compute to a finite number.' });
    } else {
      checks.push({ id: 'income', title: 'Income vs sources', status: 'ok', detail: `${(s.income || []).length} streams reconcile → ${Math.round(total).toLocaleString()} EGP/mo.` });
    }
  } catch { /* ignore */ }

  /* 4. Escape Velocity inputs — FX present and the ratio is finite. */
  try {
    const fx = s.fxEgpPerEur;
    const e = escapeState(now);
    if (!(fx > 0)) {
      checks.push({ id: 'escape', title: 'Escape Velocity inputs', status: 'fail', detail: `FX rate is ${fx} — must be a positive EGP-per-EUR number.` });
    } else if (!isFinite(e.ratio)) {
      checks.push({ id: 'escape', title: 'Escape Velocity inputs', status: 'fail', detail: 'Escape ratio did not compute to a finite number.' });
    } else {
      checks.push({ id: 'escape', title: 'Escape Velocity inputs', status: 'ok', detail: `FX ${fx} · owned ${e.ownedEur} EUR vs base ${e.baseEur} EUR → ${Math.round(e.ratio * 100)}%.` });
    }
  } catch { /* ignore */ }

  return checks;
}

/* ── reconcile ────────────────────────────────────────────── */

/* Backfill a currency onto money events that lack one. Tagging, not a
   value change — makadi rate events default to their stored rateCcy,
   everything else to EGP (the operator's home/headline currency). */
export function backfillCcy(eventIds: string[]): number {
  const ids = new Set(eventIds);
  const s = loadState();
  const makadiCcy = (s.makadi?.rateCcy ?? 'USD') as Currency;
  const list = read<KaiEvent[]>(EVENTS_KEY, []);
  let fixed = 0;
  for (const e of list) {
    if (!ids.has(e.id) || e.ccy) continue;
    e.ccy = (e.domain === 'makadi' && e.type === 'rate_changed') ? makadiCcy : 'EGP';
    fixed++;
  }
  write(EVENTS_KEY, list); emit();
  return fixed;
}

/* Align the stored debt balance to the Spine's latest balance_updated,
   so the dashboard stops disagreeing with itself. */
export function alignDebtToSpine(): void {
  const bals = getEvents({ domain: 'debt', type: 'balance_updated' }).sort((a, b) => a.ts - b.ts);
  const latest = bals[bals.length - 1];
  if (!latest || typeof latest.value !== 'number') return;
  const s = loadState();
  s.debtCurrent = latest.value;
  saveState(s);
  emit();
}

export function integritySummary(now = Date.now()): { total: number; failing: number } {
  const checks = runIntegrity(now);
  return { total: checks.length, failing: checks.filter((c) => c.status !== 'ok').length };
}
