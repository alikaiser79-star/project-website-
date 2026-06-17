/* Live voice status banner — sits between the TopBar and the main
   grid whenever voice is on. Always visible while listening so the
   user can confirm at a glance that speech recognition is alive,
   and see the live interim transcript as words come in. */

import { Mic, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VoiceState } from '../lib/speech';

const ERROR_HINTS: Record<string, string> = {
  'not-allowed':         'Microphone access denied. Check site permissions in the address bar.',
  'service-not-allowed': 'Speech service blocked. Some browsers / extensions disable it.',
  'audio-capture':       'No microphone detected.',
  'network':             'Speech service network error. Chrome SR needs network access to Google.',
  'no-speech':           'No speech detected. Restarting…',
  'aborted':             'Recognition aborted. Restarting…',
  'language-not-supported': 'Browser language not supported by speech service.',
  'construct-failed':    'Failed to construct SpeechRecognition.',
  'start-failed':        'Failed to start recognition. Retrying…',
  'unknown':             'Unknown speech error.',
};

type Props = { state: VoiceState; lastHeard: string; voiceOn: boolean };

export default function VoiceBanner({ state, lastHeard, voiceOn }: Props) {
  /* Show whenever voice is enabled OR voice is unsupported (so the
     user sees why nothing happens). Hide once voice is fully off. */
  const show = voiceOn || state.kind === 'unsupported';
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={'voice-banner'}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -10, opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="glass rounded-md px-3 py-2 flex items-center gap-3 min-w-0"
        role="status"
        aria-live="polite"
      >
        <Inner state={state} lastHeard={lastHeard} />
      </motion.div>
    </AnimatePresence>
  );
}

function Inner({ state, lastHeard }: { state: VoiceState; lastHeard: string }) {
  switch (state.kind) {
    case 'unsupported':
      return (
        <>
          <AlertTriangle size={12} className="text-amber2 shrink-0" />
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-amber2 shrink-0">VOICE · UNSUPPORTED</span>
          <span className="flex-1 min-w-0 font-mono text-[11px] text-bone/80 truncate">
            This browser doesn’t expose SpeechRecognition. Try Chrome.
          </span>
        </>
      );

    case 'idle':
      /* Voice toggle is on but the wrapper hasn't engaged yet — usually a transient
         state between stop()/start(). Show a neutral indicator. */
      return (
        <>
          <Mic size={12} className="text-steel shrink-0" />
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel shrink-0">VOICE · IDLE</span>
          {lastHeard && (
            <span className="flex-1 min-w-0 font-mono text-[11px] text-bone/70 truncate">
              last: “{lastHeard}”
            </span>
          )}
        </>
      );

    case 'starting':
      return (
        <>
          <Loader2 size={12} className="text-amber animate-spin shrink-0" />
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-amber shrink-0">VOICE · STARTING</span>
          <span className="flex-1 min-w-0 font-mono text-[11px] text-bone/70 truncate">
            requesting microphone…
          </span>
        </>
      );

    case 'listening': {
      const interim = state.interim;
      return (
        <>
          <span className="relative shrink-0">
            <Mic size={12} className="text-ok" />
            <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-ok animate-pulse-soft" />
          </span>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-ok shrink-0">VOICE · LIVE</span>
          <span className="flex-1 min-w-0 font-mono text-[11.5px] truncate">
            {interim ? (
              <span className="text-amber">“{interim}”</span>
            ) : lastHeard ? (
              <span className="text-bone/80">last: “{lastHeard}”</span>
            ) : (
              <span className="text-steel/80">listening…</span>
            )}
          </span>
        </>
      );
    }

    case 'error':
      return (
        <>
          <AlertTriangle size={12} className="text-danger shrink-0" />
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-danger shrink-0">VOICE · {state.code}</span>
          <span className="flex-1 min-w-0 font-mono text-[11px] text-danger/85 truncate">
            {ERROR_HINTS[state.code] || state.message || state.code}
          </span>
        </>
      );

    default:
      return null;
  }
}
