import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Background from './components/Background';
import Boot from './components/Boot';
import TopBar from './components/TopBar';
import KaiCore from './components/KaiCore';
import CommandBar from './components/CommandBar';
import Panel from './components/Panel';
import IncomePanel    from './components/panels/IncomePanel';
import DebtPanel      from './components/panels/DebtPanel';
import GardenPanel    from './components/panels/GardenPanel';
import MakadiPanel    from './components/panels/MakadiPanel';
import InstagramPanel from './components/panels/InstagramPanel';
import PrioritiesPanel from './components/panels/PrioritiesPanel';
import { loadState, saveState } from './lib/store';
import { setSoundEnabled, sfx } from './lib/sound';
import { voice } from './lib/speech';
import { emit } from './hooks/useKaiPulse';
import { runBuiltin } from './lib/commands';

export default function App() {
  const initial = loadState();
  const [booted, setBooted]   = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(initial.settings.voiceEnabled);
  const [soundOn, setSoundOn] = useState(initial.settings.soundEnabled);

  // persist settings
  useEffect(() => {
    const s = loadState();
    s.settings = { voiceEnabled: voiceOn, soundEnabled: soundOn };
    saveState(s);
    setSoundEnabled(soundOn);
  }, [voiceOn, soundOn]);

  // voice recognition lifecycle
  useEffect(() => {
    if (!voiceOn) { voice.stop(); emit('listen-end'); return; }
    if (!voice.supported()) return;
    emit('listen-start');
    voice.start();
    voice.onResult(({ final, text }) => {
      if (!final) return;
      const stripped = text.toLowerCase().replace(/^(?:hey )?(?:kai|core)[,.\s]*/i, '').trim();
      const reply = runBuiltin(stripped);
      if (reply) {
        emit('command');
        sfx.confirm();
        emit('speak-start');
        sfx.speak();
        voice.speak(reply, undefined, () => emit('speak-end'));
      }
    });
    return () => { voice.stop(); emit('listen-end'); };
  }, [voiceOn]);

  // global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
        sfx.whoosh();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'm') { setSoundOn(s => !s); sfx.click(); }
      if (e.key.toLowerCase() === 'v') { setVoiceOn(v => !v); sfx.click(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // After boot, choreograph entrance with a small GSAP timeline.
  useEffect(() => {
    if (!booted) return;
    const tl = gsap.timeline();
    tl.from('.kai-core-wrap', { scale: 0.6, opacity: 0, duration: 1.1, ease: 'power3.out' });
  }, [booted]);

  return (
    <>
      <Background />

      {!booted && <Boot onDone={() => setBooted(true)} />}

      {booted && (
        <div className="relative z-10 h-full p-4 flex flex-col gap-4">
          <TopBar
            onCmdK={() => setCmdOpen(true)}
            voiceOn={voiceOn}
            setVoiceOn={setVoiceOn}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
          />

          {/* Main grid */}
          <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 min-h-0">
              <IncomePanel delay={0.20} />
              <PrioritiesPanel delay={0.55} />
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col items-center min-h-0">
              <motion.div
                className="kai-core-wrap relative flex-1 grid place-items-center w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.8, duration: 0.6 } }}
              >
                <Suspense fallback={<div className="text-amber font-mono text-xs">spinning up core…</div>}>
                  <KaiCore size={420} />
                </Suspense>
                <div className="absolute inset-x-0 bottom-2 text-center pointer-events-none">
                  <div className="font-mono text-[10px] tracking-[0.4em] text-steel uppercase">KAI CORE</div>
                  <div className="font-mono text-[10px] tracking-[0.3em] text-amber/80 uppercase">command presence</div>
                </div>
              </motion.div>

              <GardenPanel delay={0.45} />
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 min-h-0">
              <DebtPanel delay={0.30} />
              <MakadiPanel delay={0.40} />
              <InstagramPanel delay={0.50} />
            </div>
          </div>

          {/* Footer ribbon */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1.0 } }}
            className="glass flex items-center justify-between px-4 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-steel rounded-none"
          >
            <span>kai · v1.0.0</span>
            <span><kbd>⌘</kbd><kbd>K</kbd> commands · <kbd>V</kbd> voice · <kbd>M</kbd> mute</span>
            <span className="text-amber">◊ presence stable</span>
          </motion.footer>
        </div>
      )}

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} voiceOn={voiceOn} />
    </>
  );
}
