/* ============================================================
   Expenses panel.

   Hero: total spent this month.
   Breakdown: per-category bars (live from the expenses store).
   List: recent expenses with edit + delete.
   Upload: file input that opens the camera on mobile.

   Upload flow:
   1. compressImage(file)
   2. extractReceipt(image) via /api/claude vision
   3. Open ReceiptConfirm pre-filled (or with note when unreadable)
   4. Save → addExpense + panel refresh.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Loader2, Pencil, Plus, Receipt, ScanLine, Trash2 } from 'lucide-react';
import Panel from '../Panel';
import {
  listExpenses, addExpense, updateExpense, deleteExpense,
  monthlyTotal, categoryBreakdown, currentMonthKey, CATEGORIES,
} from '../../lib/expenses';
import { compressImage, extractReceipt } from '../../lib/receipts';
import { operator } from '../../kaiConfig';
import { sfx } from '../../lib/sound';
import { toast } from '../../hooks/useToasts';
import ReceiptConfirm, { type Draft } from '../ReceiptConfirm';
import type { Expense, ExpenseCategory } from '../../types';

function fmtCcy(n: number, ccy = 'EGP') {
  try {
    return new Intl.NumberFormat(operator.locale, {
      style: 'currency', currency: ccy, maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n).toLocaleString(operator.locale)} ${ccy}`;
  }
}

function emptyDraft(): Draft {
  return {
    merchant: '',
    total: 0,
    currency: 'EGP',
    date: new Date().toISOString().slice(0, 10),
    category: 'other',
  };
}

const CAT_COLOR: Record<ExpenseCategory, string> = {
  groceries: '#7AE6A8',
  dining:    '#FFB300',
  fuel:      '#FF6B6B',
  transport: '#5FE3FF',
  shopping:  '#C792EA',
  bills:     '#82AAFF',
  other:     '#7C8794',
};

export default function ExpensesPanel({ delay = 0 }: { delay?: number }) {
  const [items, setItems] = useState<Expense[]>(() => listExpenses());
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmNote, setConfirmNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() { setItems(listExpenses()); }

  /* ── Upload flow ────────────────────────────────────── */

  async function onFileChosen(f: File | null) {
    if (!f) return;
    if (!/^image\//i.test(f.type)) {
      toast.err('That file isn\'t an image.');
      return;
    }
    setBusy(true);
    sfx.whoosh();
    try {
      const img = await compressImage(f);
      const out = await extractReceipt(img);
      if (out.ok) {
        setDraft(out.data);
        setConfirmNote("Read by KAI. Fix anything that looks off, then Save.");
      } else {
        setDraft({ ...emptyDraft() });
        setConfirmNote(out.message + ' Enter it manually below.');
      }
    } catch (e: any) {
      const msg = String(e?.message || 'unknown');
      if (msg === 'NO_API_KEY') {
        toast.err('No Anthropic key on the server — set ANTHROPIC_API_KEY in Vercel.', 'RECEIPTS', 5000);
      } else {
        toast.err('Vision failed: ' + msg.slice(0, 120), 'RECEIPTS', 5000);
      }
      setDraft({ ...emptyDraft() });
      setConfirmNote("Couldn't reach the model. Enter it manually below.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function startManual() {
    setDraft({ ...emptyDraft() });
    setConfirmNote(null);
    setEditing(null);
  }
  function startEdit(e: Expense) {
    setEditing(e);
    setDraft({
      merchant: e.merchant, total: e.total, currency: e.currency,
      date: e.date, category: e.category,
    });
    setConfirmNote(null);
  }
  function saveDraft(d: Draft) {
    if (editing) {
      updateExpense(editing.id, d);
      toast.ok('Expense updated.', 'RECEIPTS', 2400);
    } else {
      addExpense(d);
      sfx.confirm();
      toast.ok(`${d.merchant} · ${fmtCcy(d.total, d.currency)} logged.`, 'RECEIPTS', 2800);
    }
    setDraft(null);
    setEditing(null);
    setConfirmNote(null);
    refresh();
  }
  function deleteFromConfirm() {
    if (!editing) return;
    deleteExpense(editing.id);
    setDraft(null);
    setEditing(null);
    setConfirmNote(null);
    toast.ok('Expense deleted.', 'RECEIPTS', 2400);
    refresh();
  }
  function deleteRow(e: Expense) {
    if (!confirm(`Delete "${e.merchant}" — ${fmtCcy(e.total, e.currency)}?`)) return;
    deleteExpense(e.id);
    toast.ok('Expense deleted.', 'RECEIPTS', 2400);
    refresh();
  }

  /* ── Derived view-model ─────────────────────────────── */

  const ym = currentMonthKey();
  const monthLabel = new Date(ym + '-01T00:00:00').toLocaleDateString(operator.locale, {
    month: 'short', year: 'numeric',
  });
  const total = monthlyTotal(ym);
  const breakdown = categoryBreakdown(ym);
  const maxCat = breakdown.reduce((m, b) => Math.max(m, b.total), 0);

  return (
    <Panel num="07" title="Expenses" tag={monthLabel} delay={delay}>
      <div className="space-y-5">

        {/* Hero number */}
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-1">spent this month</div>
          <div className="font-sans text-bone text-[34px] sm:text-[40px] leading-none tabular-nums">
            {fmtCcy(total)}
          </div>
          <div className="font-mono text-[10px] tracking-[0.15em] text-steel/70 mt-1">
            {items.filter(e => e.date.startsWith(ym)).length} entr{items.filter(e => e.date.startsWith(ym)).length === 1 ? 'y' : 'ies'}
          </div>
        </div>

        {/* Category breakdown */}
        {breakdown.length > 0 && (
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-2">by category</div>
            <div className="space-y-1.5">
              {breakdown.map(b => {
                const pct = maxCat > 0 ? (b.total / maxCat) * 100 : 0;
                return (
                  <div key={b.category} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-bone/80 w-[68px] shrink-0">
                      {b.category}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-ink2/60 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: pct + '%' }}
                        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="h-full rounded-full"
                        style={{ background: CAT_COLOR[b.category] }}
                      />
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-bone/85 w-[88px] text-right shrink-0">
                      {fmtCcy(b.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload / manual */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label
            className={
              'flex items-center justify-center gap-2 px-3 py-2.5 rounded border ' +
              'border-amber/40 text-amber hover:bg-amber/10 hover:shadow-glow-amber transition ' +
              'cursor-pointer text-[11px] tracking-[0.16em] uppercase ' +
              (busy ? 'opacity-60 pointer-events-none' : '')
            }
          >
            {busy
              ? <><Loader2 size={13} className="animate-spin" /> reading receipt…</>
              : <><Camera size={13} /> Upload receipt</>}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => onFileChosen(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            onClick={startManual}
            disabled={busy}
            className="px-3 py-2.5 rounded border border-amber/20 text-steel hover:text-bone hover:border-amber/60 text-[11px] tracking-[0.16em] uppercase disabled:opacity-50"
            title="Add an expense manually"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Recent list */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={11} className="text-amber/75" />
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">recent</span>
            <span className="ml-auto font-mono text-[10px] text-steel/55">{items.length} total</span>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-6 border border-amber/15 rounded text-center">
              <ScanLine size={18} className="text-amber/60 mx-auto mb-2" />
              <p className="text-bone/85 text-[12.5px]">No expenses yet.</p>
              <p className="text-steel text-[10.5px] mt-1">Snap a receipt or add one manually.</p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {items.slice(0, 8).map(e => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2 }}
                    className="group flex items-center gap-2 px-2.5 py-2 border border-amber/15 rounded hover:border-amber/35 transition"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: CAT_COLOR[e.category], boxShadow: `0 0 6px ${CAT_COLOR[e.category]}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-sans text-bone text-[12.5px] truncate">{e.merchant}</div>
                      <div className="font-mono text-[10px] text-steel/85 tracking-[0.06em]">
                        {e.date} · {e.category}
                      </div>
                    </div>
                    <div className="font-mono text-[12px] text-bone/95 tabular-nums shrink-0">
                      {fmtCcy(e.total, e.currency)}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => startEdit(e)}
                        className="p-1 text-steel hover:text-amber"
                        title="Edit"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => deleteRow(e)}
                        className="p-1 text-steel hover:text-danger"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>

      <ReceiptConfirm
        open={draft !== null}
        draft={draft || emptyDraft()}
        title={editing ? 'Edit expense' : 'Confirm expense'}
        note={confirmNote}
        onCancel={() => { setDraft(null); setEditing(null); setConfirmNote(null); }}
        onSave={saveDraft}
        onDelete={editing ? deleteFromConfirm : undefined}
      />
    </Panel>
  );
}

/* Keep the category list import alive for typing — silences unused
   imports without polluting the runtime. */
export const _CATEGORIES_REF: ExpenseCategory[] = CATEGORIES;
