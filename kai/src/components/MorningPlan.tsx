/* ============================================================
   THE MORNING PLAN overlay — full black, gold JetBrains Mono, typed line
   by line, full attention. The day's 3 moves + one ruling. Reuses the
   Debrief overlay styling (kai-debrief-*). Tap to continue.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import type { MorningPlan as PlanData } from '../lib/kai/morningPlan';

interface Props { data: PlanData; onDone: () => void; }

export default function MorningPlan({ data, onDone }: Props) {
  const lines: Array<{ label?: string; text: string; gold?: boolean }> = [
    ...(data.money ? [{ text: data.money }] : []),
    ...data.moves.map((m, i) => ({ label: `MOVE ${i + 1}`, text: m })),
    { label: 'RULING', text: data.ruling, gold: true },
  ];

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
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 300 : 780);
    return () => clearTimeout(t);
  }, [shown, lines.length]);

  return (
    <div className={'kai-debrief' + (leaving ? ' is-leaving' : '')} onClick={finish} role="dialog" aria-label="morning plan">
      <div className="kai-debrief-head">THE MORNING PLAN · TODAY</div>
      <div className="kai-debrief-body">
        {lines.slice(0, shown).map((ln, i) => (
          <div key={i} className="kai-debrief-line">
            {ln.label ? (
              <>
                <span className={'kai-debrief-label' + (ln.gold ? '' : '')}>{ln.label}</span>
                <span className="kai-debrief-text">{ln.text}</span>
              </>
            ) : (
              <span className="kai-debrief-text" style={{ opacity: 0.7 }}>{ln.text}</span>
            )}
          </div>
        ))}
        {shown < lines.length && <span className="kai-debrief-caret" />}
      </div>
      {shown >= lines.length && <div className="kai-debrief-skip">TAP TO CONTINUE</div>}
      <div className="kai-debrief-ver">CORE-V6</div>
    </div>
  );
}
