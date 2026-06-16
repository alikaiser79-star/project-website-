import { useEffect, useState } from 'react';

/* A small event bus so anything (Core, panels, sounds) can react when
   KAI "speaks" or runs a command. */
type PulseEvent = 'speak-start' | 'speak-end' | 'command' | 'listen-start' | 'listen-end';

const listeners = new Set<(e: PulseEvent) => void>();
export function emit(e: PulseEvent) { listeners.forEach(fn => fn(e)); }

export function useKaiPulse() {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [pulseTick, setPulseTick] = useState(0);
  useEffect(() => {
    const fn = (e: PulseEvent) => {
      if (e === 'speak-start') setSpeaking(true);
      if (e === 'speak-end')   setSpeaking(false);
      if (e === 'listen-start') setListening(true);
      if (e === 'listen-end')   setListening(false);
      if (e === 'command')      setPulseTick(t => t + 1);
    };
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return { speaking, listening, pulseTick };
}
