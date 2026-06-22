import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import Background from './components/Background';
import Boot from './components/Boot';
import TopBar from './components/TopBar';
import CommandBar from './components/CommandBar';
import ContentPanel from './components/ContentPanel';
import BrainDump from './components/BrainDump';
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
import { onAction, emitAction } from './lib/actions';
import { isCapturing } from './lib/captureMode';
import { logEvent as logEventSpine } from './lib/kai/events';
import { useIdle } from './hooks/useIdle';
import IntelStrip, { NewsRow } from './components/IntelStrip';
import { briefing } from './lib/commands';
import IncomePanel    from './components/panels/IncomePanel';
import DebtPanel      from './components/panels/DebtPanel';
import GardenPanel    from './components/panels/GardenPanel';
import MakadiPanel    from './components/panels/MakadiPanel';
import PrioritiesPanel from './components/panels/PrioritiesPanel';
import ExpensesPanel   from './components/panels/ExpensesPanel';
import ContentQueuePanel from './components/panels/ContentQueuePanel';
import { MirrorPanel, startMirror } from './lib/kai/mirror';
import TollgatePanel from './components/panels/TollgatePanel';
import LedgerPanel from './components/panels/LedgerPanel';
import CrownPanel from './components/panels/CrownPanel';
import InboxPanel from './components/panels/InboxPanel';
import SitePanel from './components/panels/SitePanel';
import IgFeedPanel from './components/panels/IgFeedPanel';
import PhonePanel from './components/panels/PhonePanel';
import AutopilotPanel from './components/panels/AutopilotPanel';
import WatchtowerPanel from './components/panels/WatchtowerPanel';
import ScribePanel from './components/panels/ScribePanel';
import EnvoyPanel from './components/panels/EnvoyPanel';
import DelegatePanel from './components/panels/DelegatePanel';
import { startWatchtower } from './lib/kai/watchtower';
import ConfirmationGate from './lib/kai/ConfirmationGate';

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
import LockOverlay from './components/LockOverlay';
import { loadLockConfig, type LockConfig } from './lib/lock';
import ViewNav, { VIEW_LABEL, VIEWS, type ViewKey } from './components/ViewNav';
import ViewHeader, { type ViewChip } from './components/ViewHeader';
import NowStrip from './components/NowStrip';
import { getPending } from './lib/kai/pending';
import { getWatchtower } from './lib/kai/watchtower';
import { useKaiVersion } from './lib/kai/mirror';
import { mirrorScore } from './lib/kai/commitments';
import { computeRunway } from './lib/kai/runway';
import { liveBeats } from './lib/kai/crown';
import { listPromises } from './lib/kai/ledger';
import { Inbox as InboxIcon, ShieldCheck, Wallet, Crown as CrownIcon, Eye, Send } from 'lucide-react';

const VIEW_STORE_KEY = 'kai.view';

/* Which view each panel (by data-panel num) lives on — so deep
   links / Spotlight jumps switch to the right view first. */
const PANEL_VIEW: Record<string, ViewKey> = {
  '17': 'command', '09': 'command', '06': 'command', '18': 'command',
  '10': 'money',   '01': 'money',   '02': 'money',   '07': 'money',
  '12': 'growth',  '08': 'growth',  '05': 'growth',  '15': 'growth', '19': 'growth',
  '03': 'ops',     '04': 'ops',     '11': 'ops',
  '13': 'comms',   '16': 'comms',   '14': 'comms',   '20': 'comms',  '21': 'comms',
};

function loadView(): ViewKey {
  try {
    const v = localStorage.getItem(VIEW_STORE_KEY);
    if (v === 'command' || v === 'money' || v === 'growth' || v === 'ops' || v === 'comms') return v;
  } catch { /* ignore */ }
  return 'command';
}

export default function App() {
  const initial = loadState();
  const [booted, setBooted]   = useState(false);
  const [view, setViewState]  = useState<ViewKey>(() => loadView());
  const [cmdOpen, setCmdOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [brainPrefill, setBrainPrefill] = useState<string | undefined>(undefined);
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

  /* Biometric / PIN lock state.
     - lockCfg.enabled  → dashboard hidden behind LockOverlay
     - showSetup        → first-run "Protect KAI" prompt
     - unlocked         → true after a successful WebAuthn/PIN pass
     Device-local only; see lib/lock.ts. */
  const [lockCfg, setLockCfg] = useState<LockConfig>(() => loadLockConfig());
  const [unlocked, setUnlocked] = useState<boolean>(() => !loadLockConfig().enabled);
  const [showSetup, setShowSetup] = useState<boolean>(false);

  /* Subscribe to the Spine bus so nav badges recompute when the
     gate fills or the watchtower fires. */
  useKaiVersion();
  const pendingCount = (() => { try { return getPending().length; } catch { return 0; } })();
  const alertCount   = (() => { try { return getWatchtower().alerts.length; } catch { return 0; } })();
  const navBadges: Partial<Record<ViewKey, number>> = {
    comms: pendingCount,
    command: alertCount,
  };

  /* Per-view metric chips for the ViewHeader. Each is a tight
     read off the Spine / store — no extra fetches. */
  const chipsFor = (v: ViewKey): ViewChip[] => {
    try {
      if (v === 'command') {
        const ms = mirrorScore();
        const chips: ViewChip[] = [];
        if (ms.score !== null) chips.push({
          label: 'kept',
          value: `${ms.score}%`,
          tone: ms.score >= 80 ? 'good' : ms.score >= 50 ? 'warn' : 'danger',
          Icon: ShieldCheck,
        });
        if (pendingCount > 0) chips.push({
          label: 'gate',
          value: pendingCount,
          tone: 'warn', Icon: Send,
        });
        if (alertCount > 0) chips.push({
          label: 'alerts',
          value: alertCount,
          tone: 'danger', Icon: Eye,
        });
        return chips;
      }
      if (v === 'money') {
        const r = computeRunway();
        const chips: ViewChip[] = [];
        if (r.runwayDays !== null) chips.push({
          label: 'runway',
          value: `${Math.floor(r.runwayDays)}d`,
          tone: r.runwayDays < 7 ? 'danger' : r.runwayDays < 14 ? 'warn' : 'good',
          Icon: Wallet,
        });
        return chips;
      }
      if (v === 'growth') {
        const beats = liveBeats().filter(b => b.status === 'new').length;
        const chips: ViewChip[] = [];
        if (beats > 0) chips.push({
          label: 'legend',
          value: `${beats} new`,
          tone: 'accent', Icon: CrownIcon,
        });
        return chips;
      }
      if (v === 'ops') {
        const overdue = listPromises().filter(p => p.status === 'open' && p.deadline < Date.now()).length;
        const chips: ViewChip[] = [];
        if (overdue > 0) chips.push({
          label: 'overdue',
          value: overdue,
          tone: 'danger',
        });
        return chips;
      }
      if (v === 'comms') {
        const chips: ViewChip[] = [];
        if (pendingCount > 0) chips.push({
          label: 'gate',
          value: pendingCount,
          tone: 'warn', Icon: Send,
        });
        return chips;
      }
    } catch { /* defensive */ }
    return [];
  };

  const setView = useCallback((v: ViewKey) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_STORE_KEY, v); } catch { /* ignore */ }
    /* Jump to top when switching views — each view is its own page. */
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* ignore */ }
  }, []);

  const onSettings = useCallback((s: KaiSettings) => {
    setSettings(s);
    setSoundEnabled(s.soundEnabled);
  }, []);

  // settings change → persist + sound enable flag
  useEffect(() => { setSoundEnabled(settings.soundEnabled); }, [settings.soundEnabled]);

  /* The Mirror — resolves open commitments against the Spine on
     mount, every 6h, and on tab visibility change. Idempotent
     and safe to call any time. */
  useEffect(() => startMirror(), []);

  /* The Watchtower — ambient triggers. Ticks on boot, every 5 min
     while visible, on visibility regain. Fires toasts and (if
     granted) native Notifications. */
  useEffect(() => startWatchtower(), []);

  /* Phone-bridge intake — /api/ingest stashed the shared payload
     in sessionStorage and 302'd here. Route it to the right
     surface, log the share to the Spine, then clear. Runs once
     on boot (and again whenever the tab is revisited after a
     share, since iOS opens the PWA fresh each time). */
  useEffect(() => {
    function takeShare() {
      try {
        const raw = sessionStorage.getItem('kai.pendingShare');
        if (!raw) return;
        sessionStorage.removeItem('kai.pendingShare');
        const payload = JSON.parse(raw);
        if (!payload || typeof payload !== 'object') return;

        const kind = String(payload.kind || '');
        try { logEventSpine({ domain: 'system', type: 'phone_share', value: 1, meta: { kind }, source: 'auto' }); } catch {}

        if (kind === 'text' && typeof payload.text === 'string') {
          setBrainPrefill(payload.text);
          setBrainOpen(true);
          toast.ok('Share received — sorting…', 'PHONE', 3500);
          return;
        }
        if (kind === 'receipt') {
          emitAction({ type: 'open-receipt', draft: payload.draft });
          const msg = payload.draft
            ? `Receipt read: ${payload.draft.merchant} · ${payload.draft.total} ${payload.draft.currency}`
            : payload.extraction_error
              ? `Couldn't read the image: ${String(payload.extraction_error).slice(0, 60)}`
              : 'Receipt couldn\'t be read — enter manually.';
          toast.ok(msg, 'PHONE', 4500);
          return;
        }
      } catch { /* tolerate any sessionStorage / JSON oddity */ }
    }
    takeShare();
    /* iOS sometimes restores the PWA from background without a
       reload — listen for the visibility change too. */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') takeShare();
    });
  }, []);

  /* Relock after the tab has been hidden for ≥ 5 minutes. The base
     idle-watermark fires sooner (5 min of inactivity in this tab),
     but visibility hiding is the stronger signal — the user
     switched apps / locked the device. */
  useEffect(() => {
    if (!lockCfg.enabled) return;
    let hiddenAt = 0;
    function onVis() {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 5 * 60_000) {
        setUnlocked(false);
      }
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [lockCfg.enabled]);

  /* Offer setup once after boot, if the user has never been asked
     and the device has any unlock capability. Null-safe — if the
     check throws or the user skipped before, we just don't show it. */
  useEffect(() => {
    if (!booted) return;
    if (lockCfg.enabled || lockCfg.offered) return;
    const id = setTimeout(() => setShowSetup(true), 1600);
    return () => clearTimeout(id);
  }, [booted, lockCfg.enabled, lockCfg.offered]);

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

      /* Brain Dump (or another transient capture surface) is
         currently grabbing voice — don't double-fire the global
         wake-word / Claude pipeline. */
      if (isCapturing()) return;

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
        return;
      }

      /* No built-in match → route the spoken question through the
         exact same pipeline as typed input: open the command bar and
         submit. CommandBar streams Claude, shows the answer, and
         speaks it sentence-by-sentence when voiceEnabled. */
      emit('command');
      sfx.confirm();
      toast.ok(`Heard: “${text}”`, 'VOICE');
      setCmdOpen(true);
      emitAction({ type: 'open-cmd', prefill: payload, submit: true });
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
      /* View shortcuts — 1..5 jump straight to the matching view. */
      if (/^[1-5]$/.test(k)) {
        const v = VIEWS[parseInt(k, 10) - 1];
        if (v) { setView(v.key); sfx.whoosh(); }
        return;
      }
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
    /* Don't fire welcome toasts / briefing TTS while the lock overlay
       is up — would speak through it before the user has even passed
       auth. Effect re-runs the moment unlocked flips true. */
    if (lockCfg.enabled && !unlocked) return;
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
        /* Switch to the view that owns this panel first, then flash
           it (after the view transition mounts the element). */
        const targetView = PANEL_VIEW[a.panel];
        if (targetView) setView(targetView);
        setTimeout(() => {
          const el = document.querySelector<HTMLElement>(`[data-panel="${a.panel}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.remove('panel-flash');
            void el.offsetWidth;
            el.classList.add('panel-flash');
            setTimeout(() => el.classList.remove('panel-flash'), 1400);
          }
        }, targetView ? 160 : 0);
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
  }, [booted, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onContent={() => setContentOpen(true)}
            onBrainDump={() => setBrainOpen(true)}
            onAutopilot={() => {
              /* Autopilot lives on the Command view — switch there,
                 then flash the panel so the user sees the live
                 status surface while it runs. */
              setView('command');
              setTimeout(() => {
                const el = document.querySelector<HTMLElement>('[data-panel="17"]');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.remove('panel-flash');
                  void el.offsetWidth;
                  el.classList.add('panel-flash');
                  setTimeout(() => el.classList.remove('panel-flash'), 1400);
                }
              }, 120);
            }}
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

          {/* Pending external actions — pinned across all views,
              invisible when none, attention-grabber when KAI has
              proposed something. */}
          <ConfirmationGate />

          {/* View navigation — breaks 21 panels into 5 focused views. */}
          <ViewNav active={view} onChange={setView} badges={navBadges} />

          {/* Active view */}
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col gap-6 sm:gap-8"
          >
            <ViewHeader
              title={VIEW_LABEL[view].label}
              hint={VIEW_LABEL[view].hint}
              chips={chipsFor(view)}
            />

            {/* COMMAND — the daily cockpit. Orb is the hero. */}
            {view === 'command' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                <div className="lg:col-span-2 order-2 lg:order-1 flex flex-col gap-6 sm:gap-8 items-start">
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 items-start">
                    <AutopilotPanel delay={0.10} />
                    <MirrorPanel delay={0.15} />
                    <PrioritiesPanel delay={0.20} />
                    <WatchtowerPanel delay={0.25} />
                  </div>
                </div>
                <div className="order-1 lg:order-2 flex flex-col gap-6 items-stretch">
                  <motion.div
                    className="kai-core-wrap relative grid place-items-center w-full py-2 lg:py-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 0.5, duration: 0.8 } }}
                  >
                    <Suspense fallback={<div className="text-steel font-mono text-[10px] py-12">spinning up core…</div>}>
                      <div className="relative w-[min(320px,80vw)] aspect-square">
                        <KaiCore size={320} accent={settings.accent} />
                      </div>
                    </Suspense>
                  </motion.div>
                  <NowStrip />
                </div>
              </div>
            )}

            {/* MONEY */}
            {view === 'money' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
                <TollgatePanel delay={0.10} />
                <IncomePanel delay={0.15} />
                <DebtPanel delay={0.20} />
                <ExpensesPanel delay={0.25} />
              </div>
            )}

            {/* GROWTH */}
            {view === 'growth' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
                <CrownPanel delay={0.10} />
                <ContentQueuePanel delay={0.15} />
                <Suspense fallback={<div className="glass rounded-lg p-5 text-steel font-mono text-xs">loading charts…</div>}>
                  <InstagramPanel delay={0.20} />
                </Suspense>
                <IgFeedPanel delay={0.25} />
                <ScribePanel delay={0.30} />
              </div>
            )}

            {/* OPERATIONS */}
            {view === 'ops' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
                <GardenPanel delay={0.10} />
                <MakadiPanel delay={0.15} />
                <LedgerPanel delay={0.20} />
              </div>
            )}

            {/* COMMS */}
            {view === 'comms' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
                <InboxPanel delay={0.10} />
                <PhonePanel delay={0.15} />
                <SitePanel delay={0.20} />
                <EnvoyPanel delay={0.25} />
                <DelegatePanel delay={0.30} />
              </div>
            )}
          </motion.div>

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
            <span title="Vercel commit SHA, injected at build time">kai · {__BUILD_ID__}</span>
            <span className="hidden md:inline normal-case tracking-normal text-steel/50">
              <kbd>⌘</kbd><kbd>K</kbd>&nbsp;commands&nbsp;·&nbsp;<span id="tour-spotlight"><kbd>⌘</kbd><kbd>/</kbd>&nbsp;search</span>&nbsp;·&nbsp;<kbd>⌘</kbd><kbd>J</kbd>&nbsp;journal&nbsp;·&nbsp;<kbd>1</kbd>&hairsp;–&hairsp;<kbd>5</kbd>&nbsp;views
            </span>
            <span className="text-steel/55">presence stable</span>
          </motion.footer>

          </div>{/* max-w inner */}
        </div>
      )}

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} settings={settings} />
      <ContentPanel open={contentOpen} onClose={() => setContentOpen(false)} />
      <BrainDump    open={brainOpen}   onClose={() => { setBrainOpen(false); setBrainPrefill(undefined); }} initialText={brainPrefill} />
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

      {/* Biometric / PIN lock. Setup is one-time, unlock gates every
          relaunch + post-idle resume when enabled. */}
      {lockCfg.enabled && !unlocked && (
        <LockOverlay
          mode="unlock"
          onUnlocked={() => setUnlocked(true)}
          onSetupDone={() => {}}
        />
      )}
      {showSetup && !lockCfg.enabled && (
        <LockOverlay
          mode="setup"
          onUnlocked={() => {}}
          onSetupDone={(cfg) => {
            setLockCfg(cfg);
            setShowSetup(false);
            if (cfg.enabled) {
              setUnlocked(true);
              toast.ok('Lock armed. KAI will ask on next launch.', 'SECURITY', 5000);
            }
          }}
        />
      )}
    </>
  );
}
