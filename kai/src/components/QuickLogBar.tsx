/* ============================================================
   DER EINGANG — the QUICK LOG BAR. A persistent one-liner at the
   bottom of the Money view. Type "450 cleaner" → logged. Amount +
   word = event, no syntax, no dialog (the typing IS the intent). A
   live preview shows how KAI read it before you commit; "paste"
   opens the bulk sheet for a bank SMS or a list, which routes
   through the Gate.
   ============================================================ */

import { useRef, useState } from 'react';
import { parseLine, parseBatch, applyIntakeEntry, entrySummary, type IntakeEntry } from '../lib/kai/intake';
import { proposeAction } from '../lib/kai/pending';
import { emit } from '../lib/kai/store';
import { toast } from '../hooks/useToasts';
import { ClipboardList, X } from 'lucide-react';

export default function QuickLogBar() {
  const [text, setText] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = text.trim() ? parseLine(text) : null;

  function log() {
    const e = parseLine(text);
    if (!e) return;
    applyIntakeEntry(e);
    emit();
    toast.ok('Logged · ' + entrySummary(e), 'INTAKE', 2400);
    setText('');
    inputRef.current?.focus();
  }

  return (
    <div className="quicklog" data-quicklog>
      <form className="quicklog-row" onSubmit={(e) => { e.preventDefault(); log(); }}>
        <input
          ref={inputRef}
          className="quicklog-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='log fast — "450 cleaner", "1500 booking friend"'
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="button" className="quicklog-paste" onClick={() => setBulkOpen(true)} title="Paste a batch / bank SMS">
          <ClipboardList size={15} />
        </button>
        <button type="submit" className="quicklog-go" disabled={!preview}>log</button>
      </form>
      {preview
        ? <div className="quicklog-hint ok">{entrySummary(preview)}{preview.category ? ` · ${preview.category}` : ''}</div>
        : text.trim()
          ? <div className="quicklog-hint bad">need an amount — try "450 cleaner"</div>
          : null}

      {bulkOpen && <BulkPasteSheet onClose={() => setBulkOpen(false)} />}
    </div>
  );
}

/* ── BULK PASTE — paste text, review parsed rows, send the batch to the
   Gate for a one-tap approval. Nothing logs from here directly. ── */
function BulkPasteSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<IntakeEntry[] | null>(null);

  function parse() { setRows(parseBatch(text)); }
  function drop(i: number) { setRows((r) => (r ? r.filter((_, idx) => idx !== i) : r)); }

  function send() {
    if (!rows || !rows.length) return;
    const total = rows.reduce((s, e) => s + (e.dir === 'out' ? e.amount : 0), 0);
    const summary = `Log ${rows.length} item${rows.length === 1 ? '' : 's'}` +
      (total ? ` · ${Math.round(total).toLocaleString('en-GB')} EGP out` : '');
    proposeAction('log_batch', summary, { entries: rows, note: 'bulk' });
    toast.ok(`${rows.length} queued at the Gate — one tap to confirm.`, 'INTAKE', 3200);
    onClose();
  }

  return (
    <div className="bulk-scrim" onClick={onClose}>
      <div className="bulk" role="dialog" aria-label="Bulk log" onClick={(e) => e.stopPropagation()}>
        <div className="bulk-head">
          <span className="bulk-title">BULK LOG</span>
          <button className="bulk-x" onClick={onClose} aria-label="close"><X size={14} /></button>
        </div>
        <textarea
          className="bulk-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Paste a bank SMS or a list:\n\n450 cleaner\n2000 withdrawal\nsalary 33000\n1500 booking friend'}
          rows={6}
        />
        {!rows
          ? <button className="bulk-parse" onClick={parse} disabled={!text.trim()}>parse</button>
          : (
            <>
              <div className="bulk-rows">
                {rows.length === 0 && <div className="bulk-empty">Nothing parsed — check the text has amounts.</div>}
                {rows.map((e, i) => (
                  <div key={i} className={'bulk-row ' + e.dir}>
                    <span className="bulk-sum">{entrySummary(e)}</span>
                    <button className="bulk-drop" onClick={() => drop(i)} aria-label="remove">✕</button>
                  </div>
                ))}
              </div>
              <div className="bulk-actions">
                <button className="bulk-reparse" onClick={() => setRows(null)}>edit</button>
                <button className="bulk-send" onClick={send} disabled={!rows.length}>send {rows.length} to Gate →</button>
              </div>
            </>
          )}
      </div>
    </div>
  );
}
