/* ============================================================
   THE WEEKLY RECKONING overlay — the Sunday accounting. Full black, gold
   JetBrains Mono, typed line by line. GRADE / MONEY / KEPT / BROKE / WINS
   / FOCUS. BROKE renders in danger. Reuses the Debrief overlay styling.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import type { Reckoning as ReckoningData } from '../lib/kai/reckoning';

interface Props { data: ReckoningData; onDone: () => void; }

const ROWS: Array<[keyof ReckoningData, string]> = [
  ['grade', 'GRADE'], ['money', 'MONEY'], ['kept', 'KEPT'], ['broke', 'BROKE'], ['wins', 'WINS'], ['focus', 'FOCUS'],
];

export default function Reckoning({ data, onDone }: Props) {
  const lines = data.raw
    ? data.raw.split('\n').filter(Boolean)
    : ROWS.filter(([k]) => data[k]).map(([k, label]) => `${label}: ${data[k]}`);

  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    setTimeout(onDone, 420);
  };

  useEffect(() => {
    if (shown >= lines.length) return;
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 300 : 820);
    return () => clearTimeout(t);
  }, [shown, lines.length]);

  return (
    <div className={'kai-debrief' + (leaving ? ' is-leaving' : '')} onClick={finish} role="dialog" aria-label="weekly reckoning">
      <div className="kai-debrief-head">THE RECKONING · THIS WEEK</div>
      <div className="kai-debrief-body">
        {lines.slice(0, shown).map((ln, i) => {
          const [label, ...rest] = ln.split(':');
          const isBroke = /^\s*BROKE/i.test(ln);
          return (
            <div key={i} className="kai-debrief-line">
              {rest.length ? (
                <>
                  <span className={'kai-debrief-label' + (isBroke ? ' danger' : '')}>{label.trim()}</span>
                  <span className="kai-debrief-text">{rest.join(':').trim()}</span>
                </>
              ) : (
                <span className="kai-debrief-text">{ln}</span>
              )}
            </div>
          );
        })}
        {shown < lines.length && <span className="kai-debrief-caret" />}
      </div>
      {shown >= lines.length && <div className="kai-debrief-skip">TAP TO CONTINUE</div>}
      <div className="kai-debrief-ver">CORE-V6</div>
    </div>
  );
}
