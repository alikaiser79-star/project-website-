/* ============================================================
   THE GREETING overlay — KAI's first word on open. One line of gold, top
   of screen, fades in, holds, fades out (or tap to dismiss). Content from
   lib/kai/greeting (a real Spine diff). Silent when there's nothing to say.
   ============================================================ */

import { useEffect, useState } from 'react';

interface Props { line: string; onDone: () => void; }

export default function Greeting({ line, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hold = setTimeout(() => setLeaving(true), 6200);      // read time
    const gone = setTimeout(onDone, 6800);
    return () => { clearTimeout(hold); clearTimeout(gone); };
  }, [onDone]);

  return (
    <div
      className={'kai-greeting' + (leaving ? ' is-leaving' : '')}
      role="status"
      onClick={() => { setLeaving(true); setTimeout(onDone, 400); }}
    >
      <span className="kai-greeting-dot" />
      <span className="kai-greeting-line">{line}</span>
    </div>
  );
}
