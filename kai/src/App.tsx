import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Background from './components/Background';
import Boot from './components/Boot';
import TopBar from './components/TopBar';
import CommandBar from './components/CommandBar';
import SettingsDrawer from './components/SettingsDrawer';
import CheatSheet from './components/CheatSheet';
import JournalDrawer from './components/JournalDrawer';
import Spotlight from './components/Spotlight';
import Onboarding from './components/Onboarding';
import Tour from './components/Tour';
import ToastStack from './components/ToastStack';
import { resumeReminders } from './lib/reminders';
import { recordSnapshot } from './lib/history';
import { fetchCalendar } from './lib/calendar';
import { onAction } from './lib/actions';
import { useIdle } from './hooks/useIdle';
import IntelStrip, { NewsRow } from './components/IntelStrip';
import { briefing } from './lib/commands';
import IncomePanel    from './components/panels/IncomePanel';
import DebtPanel      from './components/panels/DebtPanel';
import GardenPanel    from './components/panels/GardenPanel';
import MakadiPanel    from './components/panels/MakadiPanel';
import PrioritiesPanel from './components/panels/PrioritiesPanel';

/* Lazy-loaded heavies: orb (three + drei + postprocessing) and the
   chart panel (recharts). Keeps the initial paint slim. */
const KaiCore        = lazy(() => import('./components/KaiCore'));
const InstagramPanel = lazy(() => import('./components/panels/InstagramPanel'));
import { loadState, saveState } from './lib/store';
import { setSoundEnabled, sfx } from './lib/sound';
import { voice, type VoiceState } from './lib/speech';
import VoiceBanner from './components/VoiceBanner';
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
  const [focusJournalEntry, setFocusJournalEntry] = useState<string | null>(null);
  const [focusSettingsSection, setFocusSettingsSection] = useState<string | null>(null);
  const [spotOpen, setSpotOpen] = useState(false);
  const idle = useIdle(5 * 60_000);
  const [onbOpen, setOnbOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [settings, setSettings] = useState<KaiSettings>(initial.settings);
  const [voiceState, setVoiceState] = useState<VoiceState>(() => voice.getState());
  const [lastHeard, setLastHeard] = useState('');

  const onSettings = useCallback((s: KaiSettings) => {
    setSettings(s);
    setSoundEnabled(s.soundEnabled);
  }, []);

  // settings change → persist + sound enable flag
  useEffect(() => { setSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);

  /* Voice state — always subscribed so the banner reflects the
     wrapper's truth (starting / listening / error / idle / unsupported)
     even when the user just toggled off. */
  useEffect(() => {
    const offState = voice.onState((s) => {
      setVoiceState(s);
      /* Tie the orb's listening pulse to the AUTHORITATIVE onstart
         signal, not the user's toggle. */
      if (s.kind === 'listening')              emit('listen-start');
      else if (s.kind === 'idle' || s.kind === 'unsupported') emit('listen-end');
      /* Surface actionable errors as toasts; transient ones (no-speech,
         aborted) just show in the banner and auto-restart. */
      if (s.kind === 'error') {
        const fatal = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'];
        if (fatal.includes(s.code)) toast.err(`Voice error · ${s.code}`, 'VOICE', 7000);
      }
    });
    return offState;
  }, []);

  /* Voice recognition lifecycle — start/stop based on user toggle. */
  useEffect(() => {
    if (!settings.voiceEnabled) { voice.stop(); return; }
    if (!voice.supported()) {
      toast.err('Voice recognition not supported in this browser.');
      return;
    }
    voice.start();
    return () => { voice.stop(); };
  }, [settings.voiceEnabled]);

  /* Voice results — registered separately so interim text always
     surfaces (banner + last-heard) even when the wake-word gate
     decides not to run a command. */
  useEffect(() => {
    if (!settings.voiceEnabled || !voice.supported()) return;
    const offRes = voice.onResult(({ final, text }) => {
      if (!text) return;
      if (!final) {
        /* Interim — never discarded, always visible. */
        setLastHeard(text);
        return;
      }
      /* Final — remember as last-heard regardless of wake-word match. */
      setLastHeard(text);

      const lower = text.toLowerCase().trim();
      const wakeRe = /^(?:hey )?(?:kai|core)[,.\s]+(.+)$/i;
      let payload: string | null = null;
      if (settings.wakeWord) {
        const m = lower.match(wakeRe);
        if (m) payload = m[1];
      } else {
        payload = lower.replace(/^(?:hey )?(?:kai|core)[,.\s]*/i, '').trim();
      }
      if (!payload) return;

      const reply = runBuiltin(payload);
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
    return offRes;
  }, [settings.voiceEnabled, settings.voiceRate, settings.voicePitch, settings.voiceName, settings.wakeWord]);

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

    // Record today's snapshot for trend lines (idempotent per ISO day)
    recordSnapshot();

    // Warm the calendar cache so the briefing + Agenda have data
    // ready instead of waiting for the first AgendaTile mount.
    fetchCalendar().catch(() => {});

    // Spotlight-driven UI actions
    const offAct = onAction((a) => {
      if (a.type === 'open-journal') {
        setFocusJournalEntry(a.entryId ?? null);
        setJournalOpen(true);
      } else if (a.type === 'open-settings') {
        setFocusSettingsSection(a.section ?? null);
        setSetOpen(true);
      } else if (a.type === 'open-cmd') {
        setCmdOpen(true);
      } else if (a.type === 'ping-panel') {
        const el = document.querySelector<HTMLElement>(`[data-panel="${a.panel}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.remove('panel-flash');
          // Force a reflow so the animation restarts on re-add
          void el.offsetWidth;
          el.classList.add('panel-flash');
          setTimeout(() => el.classList.remove('panel-flash'), 1400);
        }
      }
    });

    // First-run onboarding
    if (!settings.onboarded) {
      setTimeout(() => setOnbOpen(true), 900);
    }

    setTimeout(() => {
      toast.ok(`Welcome back, ${settings.operatorName}. All systems nominal.`, 'KAI');
    }, 800);

    const open = loadState().priorities.filter(p => !p.done).length;
    if (open > 0) {
      setTimeout(() => toast.ok(`${open} open priorit${open === 1 ? 'y' : 'ies'} for today.`, 'TODAY'), 2200);
    }
    if (loadState().makadi?.fixLock) {
      /* Surface at most once per calendar day. The toast is already
         click-to-dismiss; this gate stops it firing every reload. */
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem('kai.fixlock.lastShown');
      if (last !== today) {
        setTimeout(() => {
          toast.warn('Makadi door lock still flagged — book the locksmith.', 'REMINDER', 9000);
          try { localStorage.setItem('kai.fixlock.lastShown', today); } catch {}
        }, 3600);
      }
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

    return () => { offAct(); };
  }, [booted]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Background />

      {!booted && <Boot onDone={() => setBooted(true)} />}

      {booted && idle && (
        <div className="idle-watermark">◊ standby — move to wake</div>
      )}

      {booted && (
        <div className={'relative z-10 min-h-screen ' + (idle ? 'idle-mode' : '')}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-6 sm:gap-8">

          <TopBar
            onCmdK={() => setCmdOpen(true)}
            onSettings={() => setSetOpen(true)}
            voiceOn={settings.voiceEnabled}
            setVoiceOn={(b) => onSettings({ ...settings, voiceEnabled: b })}
            soundOn={settings.soundEnabled}
            setSoundOn={(b) => onSettings({ ...settings, soundEnabled: b })}
            operatorName={settings.operatorName}
            voiceState={voiceState}
          />

          {/* Live voice status / interim transcript */}
          <VoiceBanner
            state={voiceState}
            lastHeard={lastHeard}
            voiceOn={settings.voiceEnabled}
          />

          {/* Orb — mobile only, gets its own breathing room */}
          <motion.div
            className="kai-core-wrap relative w-full grid place-items-center lg:hidden py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.8, duration: 0.8 } }}
          >
            <Suspense fallback={<div className="text-steel font-mono text-[10px] py-12">spinning up core…</div>}>
              <div className="relative w-[min(280px,72vw)] aspect-square">
                <KaiCore size={280} accent={settings.accent} />
              </div>
            </Suspense>
          </motion.div>

          {/* Main grid — 1 col mobile, 3 col desktop. Generous gaps. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Left */}
            <div className="flex flex-col gap-6 sm:gap-8 min-w-0">
              <IncomePanel delay={0.20} />
              <PrioritiesPanel delay={0.55} />
            </div>

            {/* Center — orb (desktop only) sits in its own column, then Garden */}
            <div className="flex flex-col gap-6 sm:gap-8 items-stretch min-w-0">
              <motion.div
                className="kai-core-wrap relative hidden lg:grid place-items-center w-full py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.8, duration: 0.8 } }}
              >
                <Suspense fallback={<div className="text-steel font-mono text-[10px] py-12">spinning up core…</div>}>
                  <div className="relative w-[min(460px,100%)] aspect-square">
                    <KaiCore size={460} accent={settings.accent} />
                  </div>
                </Suspense>
              </motion.div>
              <GardenPanel delay={0.45} />
            </div>

            {/* Right */}
            <div className="flex flex-col gap-6 sm:gap-8 min-w-0">
              <DebtPanel delay={0.30} />
              <MakadiPanel delay={0.40} />
              <Suspense fallback={<div className="glass rounded-lg p-5 text-steel font-mono text-xs">loading charts…</div>}>
                <InstagramPanel delay={0.50} />
              </Suspense>
            </div>
          </div>

          {/* Live intel strip + HN ticker */}
          <div className="intel-strip-anchor flex flex-col gap-4 sm:gap-5">
            <IntelStrip delay={1.1} />
            <NewsRow />
          </div>

          {/* Quiet footer — no frame, just text */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1.2 } }}
            className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 font-mono text-[10px] tracking-[0.18em] uppercase text-steel/45"
          >
            <span>kai · v1.13</span>
            <span className="hidden md:inline normal-case tracking-normal text-steel/50">
              <kbd>⌘</kbd><kbd>K</kbd>&nbsp;commands&nbsp;·&nbsp;<span id="tour-spotlight"><kbd>⌘</kbd><kbd>/</kbd>&nbsp;search</span>&nbsp;·&nbsp;<kbd>⌘</kbd><kbd>J</kbd>&nbsp;journal
            </span>
            <span className="text-steel/55">presence stable</span>
          </motion.footer>

          </div>{/* max-w inner */}
        </div>
      )}

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} settings={settings} />
      <SettingsDrawer
        open={setOpen}
        onClose={() => { setSetOpen(false); setFocusSettingsSection(null); }}
        onSettings={onSettings}
        onTour={() => setTourOpen(true)}
        focusSection={focusSettingsSection}
      />
      <JournalDrawer
        open={journalOpen}
        onClose={() => { setJournalOpen(false); setFocusJournalEntry(null); }}
        focusEntryId={focusJournalEntry}
      />
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
      <Onboarding
        open={onbOpen}
        onDone={(next) => {
          onSettings(next);
          setOnbOpen(false);
          toast.ok(`Engaged. Welcome aboard, ${next.operatorName}.`, 'KAI', 5000);
          setTimeout(() => setTourOpen(true), 1200);
        }}
      />
      <Tour open={tourOpen} onClose={() => setTourOpen(false)} />
      <ToastStack />
    </>
  );
}
