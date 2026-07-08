/* ============================================================
   ONE THING (§6.3a) — full-screen focus takeover. Black; the core
   beats small at the top and IS the timer; ONE task in huge type;
   everything else gone. Exit logs a Spine focus event with minutes.
   ============================================================ */

import { useEffect, useState } from 'react';
import { oneThingSuggestion, logFocus, getPlannedOneThing } from '../lib/kai/protocol';

interface Props { onExit: () => void; }

export default function OneThingMode({ onExit }: Props) {
  const [thing] = useState(() => getPlannedOneThing() || oneThingSuggestion().text);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key.toLowerCase() === 'o') exit(); };
    window.addEventListener('keydown', onKey);
    return () => { clearInterval(t); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exit() {
    logFocus(secs / 60, thing);
    onExit();
  }

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <div className="one-thing" role="dialog" aria-label="one thing focus">
      <div className="one-thing-core" aria-hidden />
      <div className="one-thing-timer">{mm}:{ss}</div>
      <div className="one-thing-task">{thing}</div>
      <button className="one-thing-done" onClick={exit}>DONE</button>
      <div className="one-thing-hint">O or Esc to exit · logs your minutes</div>
    </div>
  );
}
