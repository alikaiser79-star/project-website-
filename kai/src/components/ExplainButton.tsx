/* ============================================================
   EXPLAIN ANYTHING (AI 7.2). A small ⓘ affordance on a panel. Tap
   → one focused Claude call that explains THIS metric for THIS
   operator: what it means, how it's computed from the Spine, whether
   it's good or bad for his situation, and the one lever that moves it.

   Cached per (panel, value-hash) in localStorage, so repeat taps on
   an unchanged number are free — no call. 503 → clear offline note.
   role=dialog + [data-noswipe] so the sovereign swipe never fires.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { askClaudeStream } from '../lib/claude';
import { buildKaiContext } from '../lib/kai/context';

interface Props { panel: string; metric: string; value: string; }

/* stable short hash of the value so the cache key changes only when
   the number changes (djb2). */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export default function ExplainButton({ panel, metric, value }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'offline'>('idle');
  const reqId = useRef(0);

  const cacheKey = `kai.explain.${panel}.${hash(value)}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function explain() {
    setOpen(true);
    if (state === 'ready' || state === 'loading') return;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setText(cached); setState('ready'); return; }
    } catch { /* fall through */ }

    setState('loading');
    setText('');
    const id = ++reqId.current;
    const prompt =
      'Explain ONE metric for the operator, from HIS data below. Four short parts, each ' +
      'labelled, total under 120 words, flat tone, no praise:\n' +
      'MEANS: <what the number is>\n' +
      'COMPUTED: <how it comes from the Spine>\n' +
      'VERDICT: <good or bad FOR HIS situation, and why>\n' +
      'LEVER: <the one thing that moves it>\n\n' +
      `METRIC: ${panel} — ${metric} = ${value}\n\nCONTEXT:\n${buildKaiContext(Date.now(), `${metric} ${panel}`)}`;
    /* §13.3c/d — streams token-by-token on the cheap tier (no tools). */
    let acc = '';
    askClaudeStream(prompt, [], (chunk) => {
      if (id !== reqId.current) return;
      acc += chunk; setText(acc); setState('ready');
    }, undefined, { tier: 'cheap', noTools: true, feature: 'explain' }).then(() => {
      if (id !== reqId.current) return;
      try { localStorage.setItem(cacheKey, acc.trim()); } catch { /* ignore */ }
    }).catch(() => { if (id === reqId.current && !acc) setState('offline'); });
  }

  return (
    <>
      <button
        className="explain-btn"
        onClick={(e) => { e.stopPropagation(); explain(); }}
        aria-label={`Explain ${metric}`}
        title={`Explain ${metric}`}
      >
        <Info size={12} />
      </button>

      {open && (
        <div className="explain-scrim" data-noswipe onClick={() => setOpen(false)}>
          <div className="explain-card" role="dialog" aria-label={`Explain ${metric}`} data-noswipe onClick={(e) => e.stopPropagation()}>
            <div className="explain-head">
              <span className="explain-title">{panel} · {metric}</span>
              <button className="explain-x" onClick={() => setOpen(false)} aria-label="close">✕</button>
            </div>
            <div className="explain-val">{value}</div>
            <div className="explain-body">
              {state === 'loading' && <span className="explain-dim">reading your numbers…</span>}
              {state === 'offline' && <span className="explain-dim">Explain is offline — no API key wired on the server.</span>}
              {state === 'ready' && text}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
