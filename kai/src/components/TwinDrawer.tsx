/* ============================================================
   DER ZWILLING (§Q3.1) — the Twin, made visible. A right-side drawer:
   KAI's behavioral model of Kaiser (reliability by specificity, the
   reward-spend reflex, failure precursors, follow-through), any drift
   forming right now, and a COUNSEL box that answers a decision AS Ali
   on his best day — citing his own numbers. Everything from the Spine.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { buildTwinModel, detectDrift, twinCounsel, type TwinModel, type DriftWarning, type TwinRuling } from '../lib/kai/twin';
import { assembleContext, annotatedDrift } from '../lib/kai/council';
import { AlertTriangle, Scale } from 'lucide-react';

interface Props { open: boolean; question?: string; onClose: () => void; }

export default function TwinDrawer({ open, question, onClose }: Props) {
  const [model, setModel] = useState<TwinModel | null>(null);
  const [drift, setDrift] = useState<DriftWarning[]>([]);
  const [q, setQ] = useState('');
  const [ruling, setRuling] = useState<TwinRuling | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const askedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    /* §25 — drift arrives annotated with what the drifting lane is worth,
       from the Hunter's live moves. The Twin no longer warns in a vacuum. */
    try {
      const ctx = assembleContext(Date.now(), true);
      setModel(ctx.twin);
      setDrift(annotatedDrift(ctx).map((d) => (d.laneText ? { ...d, text: `${d.text} ${d.laneText}` } : d)));
    } catch { /* boot-safe */ }
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  /* A decision passed in via "counsel <question>" auto-runs once. */
  useEffect(() => {
    if (open && question && askedRef.current !== question) {
      askedRef.current = question;
      setQ(question);
      void rule(question);
    }
    if (!open) askedRef.current = undefined;
  }, [open, question]);

  async function rule(question: string) {
    const decision = question.trim();
    if (!decision || busy) return;
    setBusy(true); setRuling(null);
    try { setRuling(await twinCounsel(decision)); }
    finally { setBusy(false); }
  }

  if (!open) return null;
  const m = model;
  const r = (x: { kept: number; total: number; pct: number | null }) => x.total ? `${x.kept}/${x.total}${x.pct != null ? ` · ${x.pct}%` : ''}` : '—';

  return (
    <div className="twin-scrim" data-noswipe onClick={onClose}>
      <div className="twin" role="dialog" aria-label="Der Zwilling" data-noswipe onClick={(e) => e.stopPropagation()}>
        <div className="twin-head">
          <span className="twin-title">DER ZWILLING · THE TWIN</span>
          <button className="twin-x" onClick={onClose} aria-label="close">✕</button>
        </div>

        <div className="twin-body">
          {m && <div className="twin-conf">{m.confidence.honest}</div>}

          {/* drift forming now — loudest, first */}
          {drift.length > 0 && (
            <div className="twin-drift">
              {drift.map((d) => (
                <div key={d.key} className={'twin-drift-row ' + d.severity}>
                  <AlertTriangle size={13} /> <span>{d.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* the Twin's read on Ali — deterministic, cited */}
          {m && m.insights.length > 0 && (
            <div className="twin-read">
              <div className="twin-sec">THE READ</div>
              {m.insights.map((line, i) => <div key={i} className="twin-insight">{line}</div>)}
            </div>
          )}

          {/* the raw model */}
          {m && (
            <div className="twin-stats">
              <div className="twin-sec">THE RECORD</div>
              <div className="twin-stat"><span>Dated commitments kept</span><b>{r(m.reliability.specific)}</b></div>
              <div className="twin-stat"><span>Vague commitments kept</span><b>{r(m.reliability.vague)}</b></div>
              {m.spending.ratio != null && (
                <div className="twin-stat"><span>Spend after a win</span><b>{m.spending.ratio.toFixed(1)}× · {m.spending.wins} wins</b></div>
              )}
              {m.followThrough.length > 0 && (
                <div className="twin-stat"><span>Follow-through</span><b>{m.followThrough.map((f) => `${f.domain} ${f.status === 'sustained' ? '✓' : f.status === 'fading' ? '~' : '×'}`).join('  ')}</b></div>
              )}
            </div>
          )}

          {/* the ruling */}
          {(busy || ruling) && (
            <div className="twin-ruling">
              <div className="twin-sec"><Scale size={11} /> THE COUNSEL</div>
              {busy && <div className="twin-verdict">reading your record…</div>}
              {ruling && (
                <>
                  <div className="twin-verdict">{ruling.verdict}</div>
                  {ruling.lines.slice(1).map((l, i) => <div key={i} className="twin-line">{l}</div>)}
                </>
              )}
            </div>
          )}
        </div>

        <form className="twin-foot" onSubmit={(e) => { e.preventDefault(); rule(q); }}>
          <input
            ref={inputRef}
            className="twin-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={busy ? 'ruling…' : 'a decision — "should I commit to X?"'}
            disabled={busy}
          />
          <button className="twin-send" type="submit" disabled={busy || !q.trim()}>rule</button>
        </form>
      </div>
    </div>
  );
}
