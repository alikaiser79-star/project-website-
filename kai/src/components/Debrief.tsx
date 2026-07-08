/* ============================================================
   DEBRIEF — the Sunday review overlay (Academy 8.3). Full black,
   gold JetBrains Mono, typed line by line, full attention. Tap to
   continue. Content from lib/kai/debrief (Spine-derived, flat).
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import type { Debrief as DebriefData } from '../lib/kai/debrief';

interface Props { data: DebriefData; onDone: () => void; }

const ROWS: Array<[keyof DebriefData, string]> = [
  ['kept', 'KEPT'], ['broke', 'BROKE'], ['best', 'BEST'], ['mistake', 'MISTAKE'], ['lesson', 'LESSON'],
];

export default function Debrief({ data, onDone }: Props) {
  const lines = data.raw
    ? data.raw.split('\n').filter(Boolean)
    : ROWS.filter(([k]) => data[k]).map(([k, label]) => `${label}: ${data[k]}`);

  const [shown, setShown] = useState(0);          // how many lines revealed
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
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 300 : 850);
    return () => clearTimeout(t);
  }, [shown, lines.length]);

  return (
    <div className={'kai-debrief' + (leaving ? ' is-leaving' : '')} onClick={finish} role="dialog" aria-label="weekly debrief">
      <div className="kai-debrief-head">THE DEBRIEF · THIS WEEK</div>
      <div className="kai-debrief-body">
        {lines.slice(0, shown).map((ln, i) => {
          const [label, ...rest] = ln.split(':');
          const isBroke = /^\s*(BROKE|MISTAKE)/i.test(ln);
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
