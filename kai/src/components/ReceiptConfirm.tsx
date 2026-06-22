/* Confirm step after a receipt upload. Pre-filled with the
   vision extraction; every field is editable so the user can
   correct anything the model got wrong. Save commits to the
   expenses store. Also used standalone to enter an expense
   manually when the image is unreadable. */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Trash2 } from 'lucide-react';
import { CATEGORIES } from '../lib/expenses';
import type { Expense, ExpenseCategory } from '../types';

export type Draft = Omit<Expense, 'id'>;

type Props = {
  open: boolean;
  draft: Draft;
  title?: string;
  note?: string | null;
  onCancel: () => void;
  onSave: (final: Draft) => void;
  onDelete?: () => void;
};

const TODAY = () => new Date().toISOString().slice(0, 10);

export default function ReceiptConfirm({
  open, draft, title, note, onCancel, onSave, onDelete,
}: Props) {
  const [merchant, setMerchant] = useState(draft.merchant);
  const [total,    setTotal]    = useState<string>(String(draft.total ?? ''));
  const [currency, setCurrency] = useState(draft.currency || 'EGP');
  const [date,     setDate]     = useState(draft.date || TODAY());
  const [category, setCategory] = useState<ExpenseCategory>(draft.category || 'other');
  const [err, setErr] = useState<string | null>(null);

  /* Reset whenever a new draft comes in (e.g. another receipt). */
  useEffect(() => {
    setMerchant(draft.merchant);
    setTotal(String(draft.total ?? ''));
    setCurrency(draft.currency || 'EGP');
    setDate(draft.date || TODAY());
    setCategory(draft.category || 'other');
    setErr(null);
  }, [draft]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function save() {
    const t = parseFloat(total.replace(/,/g, '.'));
    if (!Number.isFinite(t) || t <= 0) { setErr('Total must be a positive number.'); return; }
    if (!merchant.trim())              { setErr('Merchant is required.');             return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('Date must be YYYY-MM-DD.');      return; }
    onSave({
      merchant: merchant.trim(),
      total: t,
      currency: currency.trim().toUpperCase() || 'EGP',
      date,
      category,
    });
  }

  return (
    <motion.div
      key="receipt-confirm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[330] flex items-start justify-center pt-[10vh] px-4 pb-8"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ background: 'rgba(10,14,20,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        initial={{ y: -10, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="glass w-full max-w-[460px] rounded-md overflow-hidden"
      >
        <header className="flex items-center gap-2 px-5 py-3.5 border-b border-amber/15">
          <Check size={14} className="text-amber" />
          <h3 className="font-sans text-bone text-sm tracking-wide">{title || 'Confirm expense'}</h3>
          <button onClick={onCancel} className="ml-auto text-steel hover:text-amber"><X size={14} /></button>
        </header>

        <div className="px-5 py-4 space-y-3 font-mono text-[12px]">
          {note && (
            <div className="px-3 py-2 border border-amber/20 rounded text-bone/85 text-[11px] leading-relaxed bg-amber/[0.04]">
              {note}
            </div>
          )}

          <Field label="Merchant">
            <input
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone font-sans text-[13px] outline-none"
            />
          </Field>

          <div className="grid grid-cols-[1fr_88px] gap-2">
            <Field label="Total">
              <input
                value={total}
                onChange={e => setTotal(e.target.value.replace(/[^\d.,]/g, ''))}
                inputMode="decimal"
                className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone tabular-nums text-[14px] outline-none"
              />
            </Field>
            <Field label="Currency">
              <input
                value={currency}
                onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 4))}
                className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone tracking-[0.18em] text-[12px] uppercase outline-none"
              />
            </Field>
          </div>

          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-3 py-2 text-bone text-[13px] outline-none"
            />
          </Field>

          <Field label="Category">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={
                    'px-2.5 py-1 rounded border text-[10px] tracking-[0.16em] uppercase transition ' +
                    (category === c
                      ? 'border-amber bg-amber/10 text-amber'
                      : 'border-amber/20 text-steel hover:text-bone hover:border-amber/60')
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          {err && <div className="text-danger text-[11px] leading-relaxed">{err}</div>}

          <div className="flex items-center gap-2 pt-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-2 border border-danger/40 text-danger rounded hover:bg-danger/10 text-[11px] tracking-[0.16em] uppercase"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            )}
            <button
              onClick={onCancel}
              className="ml-auto px-3 py-2 border border-steel/30 text-steel rounded hover:text-bone hover:border-steel text-[11px] tracking-[0.16em] uppercase"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="px-4 py-2 border border-amber text-amber rounded hover:bg-amber/10 hover:shadow-glow-amber text-[11px] tracking-[0.16em] uppercase"
            >
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.18em] text-steel uppercase mb-1">{label}</label>
      {children}
    </div>
  );
}
