import { Suspense, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Background from './components/Background';
import Boot from './components/Boot';
import TopBar from './components/TopBar';
import KaiCore from './components/KaiCore';
import CommandBar from './components/CommandBar';
import SettingsDrawer from './components/SettingsDrawer';
import CheatSheet from './components/CheatSheet';
import JournalDrawer from './components/JournalDrawer';
import Spotlight from './components/Spotlight';
import ToastStack from './components/ToastStack';
import { resumeReminders } from './lib/reminders';
import { useIdle } from './hooks/useIdle';
import IntelStrip, { NewsRow } from './components/IntelStrip';
import OrbAudio from './components/OrbAudio';
import { briefing } from './lib/commands';
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
import { toast } from './hooks/useToasts';
import { makadi } from './kaiConfig';
import type { KaiSettings } from './types';

export default function App() {
  const initial = loadState();
  const [booted, setBooted]   = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [spotOpen, setSpotOpen] = useState(false);
  const idle = useIdle(5 * 60_000);
  const [settings, setSettings] = useState<KaiSettings>(initial.settings);

  const onSettings = useCallback((s: KaiSettings) => {
    setSettings(s);
    setSoundEnabled(s.soundEnabled);
  }, []);

  // settings change → persist + sound enable flag
  useEffect(() => { setSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);

  // voice recognition lifecycle
  useEffect(() => {
    if (!settings.voiceEnabled) { voice.stop(); emit('listen-end'); return; }
    if (!voice.supported()) {
      toast.err('Voice recognition not supported in this browser.');
      return;
    }
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
        voice.speak(
          reply,
          { rate: settings.voiceRate, pitch: settings.voicePitch, voiceName: settings.voiceName },
          () => emit('speak-end'),
        );
        toast.ok(`Heard: “${text}”`, 'VOICE');
      }
    });
    return () => { voice.stop(); emit('listen-end'); };
  }, [settings.voiceEnabled, settings.voiceRate, settings.voicePitch, settings.voiceName]);

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
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setJournalOpen(o => !o);
        sfx.whoosh();
        return;
      }
      if (mod && e.key === '/') {
        e.preventDefault();
        setSpotOpen(o => !o);
        sfx.whoosh();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'm') { const next = { ...settings, soundEnabled: !settings.soundEnabled }; saveSettings(next); sfx.click(); }
      else if (k === 'v') { const next = { ...settings, voiceEnabled: !settings.voiceEnabled }; saveSettings(next); sfx.click(); }
      else if (k === 's') { setSetOpen(o => !o); sfx.click(); }
      else if (k === 'j') { setJournalOpen(o => !o); sfx.click(); }
      else if (k === '?') { setCheatOpen(o => !o); sfx.click(); }
    }
    function saveSettings(next: KaiSettings) {
      setSettings(next);
      const st = loadState(); st.settings = next; saveState(st);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings]);

  // Choreograph entrance + proactive boot notifications
  useEffect(() => {
    if (!booted) return;
    const tl = gsap.timeline();
    tl.from('.kai-core-wrap', { scale: 0.6, opacity: 0, duration: 1.1, ease: 'power3.out' });

    // Re-arm any pending reminders from previous sessions
    resumeReminders();

    setTimeout(() => {
      toast.ok(`Welcome back, ${settings.operatorName}. All systems nominal.`, 'KAI');
    }, 800);

    const open = loadState().priorities.filter(p => !p.done).length;
    if (open > 0) {
      setTimeout(() => toast.ok(`${open} open priorit${open === 1 ? 'y' : 'ies'} for today.`, 'TODAY'), 2200);
    }
    if (makadi.fixLock) {
      setTimeout(() => toast.warn('Makadi door lock still flagged — book the locksmith.', 'REMINDER', 7000), 3600);
    }

    // Auto daily briefing — once per calendar day
    const today = new Date().toDateString();
    const last = localStorage.getItem('kai.lastBriefing');
    if (last !== today) {
      setTimeout(() => {
        const text = briefing();
        toast.ok('Daily briefing ready — say or type "briefing" to hear it.', 'BRIEFING', 6500);
        if (settings.voiceEnabled) {
          emit('speak-start');
          voice.speak(
            text,
            { rate: settings.voiceRate, pitch: settings.voicePitch, voiceName: settings.voiceName },
            () => emit('speak-end'),
          );
        }
        localStorage.setItem('kai.lastBriefing', today);
      }, 5200);
    }
  }, [booted]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Background />

      {!booted && <Boot onDone={() => setBooted(true)} />}

      {booted && idle && (
        <div className="idle-watermark">◊ standby — move to wake</div>
      )}

      {booted && (
        <div className={'relative z-10 h-full p-4 flex flex-col gap-4 ' + (idle ? 'idle-mode' : '')}>
          <TopBar
            onCmdK={() => setCmdOpen(true)}
            onSettings={() => setSetOpen(true)}
            voiceOn={settings.voiceEnabled}
            setVoiceOn={(b) => onSettings({ ...settings, voiceEnabled: b })}
            soundOn={settings.soundEnabled}
            setSoundOn={(b) => onSettings({ ...settings, soundEnabled: b })}
            operatorName={settings.operatorName}
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
                  <div className="relative" style={{ width: 420, height: 420 }}>
                    <KaiCore size={420} accent={settings.accent} />
                    <OrbAudio accent={settings.accent} />
                  </div>
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

          {/* Live intel strip + HN ticker */}
          <IntelStrip delay={1.1} />
          <NewsRow />

          {/* Footer ribbon */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1.2 } }}
            className="glass flex items-center justify-between px-4 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-steel rounded-none"
          >
            <span>kai · v1.5.0</span>
            <span><kbd>⌘</kbd><kbd>K</kbd> cmd · <kbd>⌘</kbd><kbd>/</kbd> search · <kbd>⌘</kbd><kbd>J</kbd> journal · <kbd>V</kbd> voice · <kbd>S</kbd> settings · <kbd>?</kbd> shortcuts</span>
            <span className="text-amber">◊ presence stable</span>
          </motion.footer>
        </div>
      )}

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} settings={settings} />
      <SettingsDrawer open={setOpen} onClose={() => setSetOpen(false)} onSettings={onSettings} />
      <JournalDrawer open={journalOpen} onClose={() => setJournalOpen(false)} />
      <Spotlight
        open={spotOpen}
        onClose={() => setSpotOpen(false)}
        runCommand={(q) => {
          const reply = runBuiltin(q);
          if (reply) {
            emit('command');
            toast.ok(reply, 'KAI', 6500);
            if (settings.voiceEnabled) {
              emit('speak-start');
              voice.speak(reply, { rate: settings.voiceRate, pitch: settings.voicePitch, voiceName: settings.voiceName }, () => emit('speak-end'));
            }
          }
        }}
      />
      <CheatSheet open={cheatOpen} onClose={() => setCheatOpen(false)} />
      <ToastStack />
    </>
  );
}
