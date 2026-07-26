/* ============================================================
   SOUND BLOCKED — the honest failure surface for voice-out.

   iOS Safari drops speechSynthesis calls that aren't unlocked by a user
   gesture, and a phone on the silent switch plays nothing either way.
   Both used to fail invisibly: the toggle said ON and no sound came.

   CORE-V4 law — no invisible operations. When an utterance is attempted
   and the engine never starts, this says so and offers the one tap that
   fixes it (a gesture-primed test utterance).
   ============================================================ */

import { useEffect, useState } from 'react';
import { VolumeX } from 'lucide-react';
import { onSpeechBlocked, speechBlocked, primeSpeech, speakNow } from '../lib/tts';

export default function SpeechHint() {
  const [blocked, setBlocked] = useState(() => speechBlocked());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => onSpeechBlocked(setBlocked), []);

  if (!blocked || dismissed) return null;

  return (
    <div className="speech-hint" role="status">
      <VolumeX size={14} className="speech-hint-icon" />
      <span className="speech-hint-text">
        Voice is on but nothing played — tap to enable sound. If it stays silent, check the ring/silent switch.
      </span>
      <button
        className="speech-hint-go"
        onClick={() => {
          primeSpeech();                       // this tap IS the gesture that unlocks iOS
          speakNow('Voice enabled.');
          setDismissed(true);
        }}
      >
        enable
      </button>
      <button className="speech-hint-x" onClick={() => setDismissed(true)} aria-label="dismiss">✕</button>
    </div>
  );
}
