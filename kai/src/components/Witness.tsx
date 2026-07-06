/* ============================================================
   THE WITNESS — the daily unlock overlay.

   Full-black. One line of JetBrains Mono, gold on black, typed
   character by character with a heartbeat under it (only if sound
   is on). Holds ~3s total, then lifts. Tap anywhere to skip.
   The line comes from lib/kai/witness (Spine-proven testimony).
   Corner marker reads CORE-V4W so the feature is verifiable on
   sight.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';

interface Props {
  line: string;
  soundOn: boolean;
  onDone: () => void;
}

const TYPE_MS = 55;        // per character
const HOLD_MS = 1100;      // after the line finishes typing
const BEAT_MS = 850;       // heartbeat period

export default function Witness({ line, soundOn, onDone }: Props) {
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);
  const actxRef = useRef<AudioContext | null>(null);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    setTimeout(onDone, 420);   // let the fade-out play
  };

  /* Type the line out. */
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(i);
      if (i >= line.length) {
        clearInterval(id);
        setTimeout(finish, HOLD_MS);
      }
    }, TYPE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  /* Heartbeat — a low lub-dub under the testimony. Sound only. */
  useEffect(() => {
    if (!soundOn) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const actx: AudioContext = new Ctx();
    actxRef.current = actx;

    const thump = (freq: number, at: number, gain: number) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, at);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, at + 0.18);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);
      o.connect(g); g.connect(actx.destination);
      o.start(at); o.stop(at + 0.3);
    };
    const beat = () => {
      if (stopped) return;
      const t = actx.currentTime;
      thump(58, t, 0.32);          // lub
      thump(46, t + 0.16, 0.22);   // dub
      timer = setTimeout(beat, BEAT_MS);
    };
    beat();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      try { actx.close(); } catch { /* ignore */ }
    };
  }, [soundOn]);

  return (
    <div
      className={'kai-witness' + (leaving ? ' is-leaving' : '')}
      onClick={finish}
      role="button"
      aria-label="the witness — tap to continue"
    >
      <div className="kai-witness-line">
        {line.slice(0, shown)}
        <span className="kai-witness-caret" />
      </div>
      <div className="kai-witness-skip">TAP TO CONTINUE</div>
      <div className="kai-witness-ver">CORE-V4W</div>
    </div>
  );
}
