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
import { startMirror } from './lib/kai/mirror';
import { scanBookings, getBookingTelemetry } from './lib/kai/bookingwatch';
import { makadiDiag } from './lib/kai/commandSignals';
import CommandCorePanel from './components/panels/CommandCorePanel';
import MobileCommand from './components/MobileCommand';
import { useIsMobile } from './hooks/useIsMobile';
import { useSovereignNav } from './hooks/useSovereignNav';
import SystemPulse from './components/SystemPulse';
import AskKaiDrawer from './components/AskKaiDrawer';
import { runAnomalyWatch } from './lib/kai/anomaly';
import Debrief from './components/Debrief';
import { shouldShowDebrief, ensureDebrief, markDebriefShown, type Debrief as DebriefData } from './lib/kai/debrief';
import MorningPlan from './components/MorningPlan';
import { shouldShowMorningPlan, ensureMorningPlan, markPlanShown, type MorningPlan as PlanData } from './lib/kai/morningPlan';
import Reckoning from './components/Reckoning';
import { shouldShowReckoning, ensureReckoning, markReckoningShown, type Reckoning as ReckoningData } from './lib/kai/reckoning';
import OneThingMode from './components/OneThingMode';
import DayRitual from './components/DayRitual';
import { shouldDayCompile, shouldShutdown } from './lib/kai/protocol';
import NightWatch from './components/NightWatch';
import { startWatchtower } from './lib/kai/watchtower';
import { seedSpine, installSeedDevHooks, migrateMoney, migrateMakadiListing, recordWithdrawnInquiry, recordRealBookings } from './lib/kai/seed';
import { seedCodex, installGardenDevHooks } from './lib/kai/garden';
import ConfirmationFloating from './lib/kai/ConfirmationFloating';
import { startSync } from './lib/kai/sync';
import { scanMilestones, hasVictory } from './lib/kai/warchest';
import { retrieveEvents } from './lib/kai/retrieval';
import { weeklyDrifts } from './lib/kai/patterns';
import { tokenTotals } from './lib/kai/tokens';
import WarChestSession from './components/WarChestSession';
import NightLedger from './components/NightLedger';
import { shouldShowNightLedger } from './lib/kai/nightLedger';
import Greeting from './components/Greeting';
import { buildGreeting } from './lib/kai/greeting';
import { subscribe as subscribeSpine } from './lib/kai/store';
import { installBackupDevHooks } from './lib/kai/backup';
import ShareCaptureSheet, { type ShareContent } from './components/ShareCaptureSheet';
import InstallPrompt from './components/InstallPrompt';
import MakadiProfitLine from './components/MakadiProfitLine';
import HunterDrawer from './components/HunterDrawer';
import { runHunt, hunterLedger } from './lib/kai/hunter';
import PushToTalk from './components/PushToTalk';
import KaiEye from './components/KaiEye';
import PullToRefresh from './components/PullToRefresh';
import { speakNow } from './lib/tts';

/* Lazy-loaded heavies: orb (three + drei + postprocessing) and the
   chart panel (recharts). Keeps the initial paint slim. */
const KaiCore        = lazy(() => import('./components/KaiCore'));
/* §13.1 — route-level code splitting: one chunk per non-Command view. */
const MoneyView   = lazy(() => import('./components/views/MoneyView'));
const GrowthView  = lazy(() => import('./components/views/GrowthView'));
const OpsView     = lazy(() => import('./components/views/OpsView'));
const CommsView   = lazy(() => import('./components/views/CommsView'));
import ViewSkeleton from './components/views/ViewSkeleton';
import { loadState, saveState } from './lib/store';
import { setSoundEnabled, sfx } from './lib/sound';
import { voice, type VoiceState } from './lib/speech';
import VoiceBanner from './components/VoiceBanner';
import { emit, useKaiPulse } from './hooks/useKaiPulse';
import { runBuiltin } from './lib/commands';
import { toast } from './hooks/useToasts';
import { makadi } from './kaiConfig';
import type { KaiSettings } from './types';
import LockOverlay from './components/LockOverlay';
import { loadLockConfig, type LockConfig } from './lib/lock';
import ViewNav, { VIEW_LABEL, VIEW_ACCENT, VIEWS, type ViewKey } from './components/ViewNav';
import BuildBanner from './components/BuildBanner';
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
   links / Spotlight jumps switch to the right view first.

   After the Living Command Core landed, the Command view became
   the full-bleed organism — no panels render there. The four
   panels that used to live on Command (Mirror 09, Priorities 06,
   Autopilot 17, Watchtower 18) moved to other views so the
   Command Core's ack-organ → ping-panel flow can still find them. */
const PANEL_VIEW: Record<string, ViewKey> = {
  '10': 'money',   '01': 'money',   '02': 'money',   '07': 'money',
  '12': 'growth',  '08': 'growth',  '05': 'growth',  '15': 'growth', '19': 'growth',
  '03': 'ops',     '04': 'ops',     '11': 'ops',     '09': 'ops',    '06': 'ops',
  '13': 'comms',   '16': 'comms',   '14': 'comms',   '20': 'comms',  '21': 'comms',
  '17': 'comms',   '18': 'comms',
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
  const [share, setShare] = useState<ShareContent | null>(null);
  const [warChestOpen, setWarChestOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [debriefData, setDebriefData] = useState<DebriefData | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [morningPlan, setMorningPlan] = useState<PlanData | null>(null);
  const [reckoning, setReckoning] = useState<ReckoningData | null>(null);
  const [hunterOpen, setHunterOpen] = useState(false);
  const [oneThingOpen, setOneThingOpen] = useState(false);
  const [dayRitual, setDayRitual] = useState<'compile' | 'shutdown' | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [focusJournalEntry, setFocusJournalEntry] = useState<string | null>(null);
  const [focusSettingsSection, setFocusSettingsSection] = useState<string | null>(null);
  const [spotOpen, setSpotOpen] = useState(false);
  const idle = useIdle(5 * 60_000);
  const nightIdle = useIdle(3 * 60_000);   /* §7.9 Night Watch on Command */
  const [nwWoke, setNwWoke] = useState(false);
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

  /* Phone viewport → the Command view swaps to the mobile "sun and
     the river" layout (desktop keeps the 12-anchor radial). */
  const isMobile = useIsMobile();

  /* Subscribe to the Spine bus so nav badges recompute when the
     gate fills or the watchtower fires. */
  useKaiVersion();
  /* Heartbeat state — drives the kai-listen / kai-speak classes
     on the orb wrapper so the heart races when KAI is alert. */
  const heart = useKaiPulse();
  const heartClass =
    heart.speaking  ? 'kai-speak'
  : heart.listening ? 'kai-listen'
  : '';
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

  /* Per-view HERO metric — one signature number that anchors
     the page. Falls back to undefined when there's no data
     worth a hero (boot-from-empty safe). */
  const heroFor = (v: ViewKey): { label: string; value: string; sub?: string } | undefined => {
    try {
      if (v === 'command') {
        const ms = mirrorScore();
        if (ms.total === 0) return { label: 'commitments kept · 30d', value: '—', sub: 'Make one. KAI holds you to it.' };
        return {
          label: 'commitments kept · 30d',
          value: `${ms.score}%`,
          sub: `${ms.kept} kept of ${ms.total} resolved.`,
        };
      }
      if (v === 'money') {
        const r = computeRunway();
        if (r.runwayDays === null) return { label: 'days of freedom', value: '—', sub: 'Log a few spends + set cash. Tollgate goes live.' };
        return {
          label: 'days of freedom',
          value: `${Math.floor(r.runwayDays)}`,
          sub: `${Math.round(r.liquidCash).toLocaleString()} EGP liquid ÷ ${Math.round(r.dailyBurn).toLocaleString()} EGP/day burn.`,
        };
      }
      if (v === 'growth') {
        const beats = liveBeats();
        const newCount = beats.filter(b => b.status === 'new').length;
        return {
          label: 'milestones to tell',
          value: String(newCount),
          sub: newCount === 0 ? 'No new chapters yet. Live loud.' : 'Each one is one tap to the queue.',
        };
      }
      if (v === 'ops') {
        const overdue = listPromises().filter(p => p.status === 'open' && p.deadline < Date.now()).length;
        return {
          label: 'people overdue',
          value: String(overdue),
          sub: overdue === 0 ? 'Everyone you depend on is on time.' : 'KAI knows who flaked. Check the Ledger.',
        };
      }
      if (v === 'comms') {
        return {
          label: 'pending approvals',
          value: String(pendingCount),
          sub: pendingCount === 0 ? 'Queue empty. Nothing waiting on your tap.' : 'Tap the pill top-right to review.',
        };
      }
    } catch { /* defensive */ }
    return undefined;
  };

  const setView = useCallback((v: ViewKey) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_STORE_KEY, v); } catch { /* ignore */ }
    /* Jump to top when switching views — each view is its own page. */
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* ignore */ }
  }, []);

  /* Sovereign navigation — swipe / arrow keys walk the five views.
     Disabled behind the lock so gestures don't leak past auth. */
  useSovereignNav({ view, setView, enabled: !(lockCfg.enabled && !unlocked) });

  /* §7.9 — once activity resumes (idle clears), re-arm Night Watch. */
  useEffect(() => { if (!nightIdle) setNwWoke(false); }, [nightIdle]);

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

  /* THE GREETING — KAI speaks first. After boot settles (seed + first sync),
     one gold line of what actually changed since the last open. Suppressed
     when the once-a-day Night Ledger is taking over the same job. */
  useEffect(() => {
    const t = setTimeout(() => {
      try { const g = buildGreeting(); if (g?.line && !shouldShowNightLedger()) setGreeting(g.line); } catch { /* ignore */ }
    }, 900);
    return () => clearTimeout(t);
  }, []);

  /* §14.3 — the Makadi booking-watcher runs eagerly: on open and every
     time the app returns to the foreground (throttled inside scanBookings).
     This is the path that fires the first-booking push the moment it lands,
     rather than waiting for the Ops-view sweep or the nightly pulse. */
  useEffect(() => {
    const scan = () => { void scanBookings().catch(() => {}); };
    scan();
    const onVis = () => { if (document.visibilityState === 'visible') scan(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', scan);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', scan); };
  }, []);

  /* Spine seed — run once (guarded). Writes Ali's real July state
     (debt 59k/89k, makadi 45/0 nights/lock replaced, garden 85,
     cash 15k) + logs the 15 canonical events. window.__kaiSeed()
     forces a re-seed for dev. */
  useEffect(() => {
    installSeedDevHooks(); installBackupDevHooks(); installGardenDevHooks(); seedSpine(); migrateMoney(); migrateMakadiListing(); recordWithdrawnInquiry(); recordRealBookings(); seedCodex();
    /* §13.3 verification hooks (retrieval / patterns / tokens) */
    try {
      (window as any).__kaiRetrieve = (q: string) => retrieveEvents(q);
      (window as any).__kaiDrifts = () => weeklyDrifts();
      (window as any).__kaiTokens = () => tokenTotals(30);
      (window as any).__kaiMakadi = () => { const r = makadiDiag(); console.info('[KAI makadi]', r); return r; };
      (window as any).__kaiBookingLog = () => { const r = getBookingTelemetry(); console.info('[KAI booking scans]', r); return r; };
      (window as any).__kaiScanBookings = () => scanBookings(true).then((r) => { console.info('[KAI booking scan NOW]', r); return r; });
    } catch { /* ignore */ }
  }, []);

  /* Spine sync (§8.1) — foreground + debounced. No-op until the
     operator enables it in Settings and the server has Upstash wired. */
  useEffect(() => { startSync(); }, []);

  /* War Chest (§9) — a money milestone fires a victory session. Scan on
     boot and (debounced) after any Spine write; auto-open when a freed-
     cashflow milestone is pending and nothing else is in the way. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const check = () => { try { scanMilestones(); if (hasVictory()) setWarChestOpen(true); } catch { /* ignore */ } };
    check();
    const off = subscribeSpine(() => { if (t) clearTimeout(t); t = setTimeout(check, 800); });
    return () => { if (t) clearTimeout(t); off(); };
  }, []);

  /* Share-in (§8.3) — OS shared a URL/text as query params (GET share
     target → '/'). We stash the payload in sessionStorage and strip the
     URL, THEN read it back into state — so the one-shot service-worker
     reload on first activation (pwa.ts) can't eat the share. It stays
     pending in sessionStorage across that reload until the operator acts
     on the sheet (cleared in the sheet's onClose). */
  const SHARE_KEY = 'kai.share.pending';
  useEffect(() => {
    try {
      const p = new URLSearchParams(location.search);
      const url = p.get('url') || undefined;
      const text = p.get('text') || undefined;
      const title = p.get('title') || undefined;
      if (url || text || title) {
        sessionStorage.setItem(SHARE_KEY, JSON.stringify({ url, text, title }));
        history.replaceState(null, '', location.pathname + location.hash);
      }
      const raw = sessionStorage.getItem(SHARE_KEY);   // peek — don't clear until acted on
      if (raw) {
        const s = JSON.parse(raw);
        if (s && (s.url || s.text || s.title)) setShare(s);
      }
    } catch { /* ignore malformed search / storage */ }
  }, []);

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
      if (e.key === 'Escape') setAskOpen(false);   /* idempotent — closes Ask KAI if open */
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
      else if (k === 'a') { setAskOpen(o => !o); sfx.click(); }
      else if (k === 'o') { setOneThingOpen(o => !o); sfx.click(); }
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

    // Anomaly Watch (7.4) — stats run client-side; Claude is called
    // only if a fresh trigger fires. No timer, no polling.
    runAnomalyWatch().catch(() => {});

    /* DER JÄGER (Q3.4) — the Hunter runs daily (deterministic, no LLM until
       Ali opens a draft). Logs opportunities to the Spine; surfaces the
       single highest EGP/min move so a real earner never sits unseen. */
    try {
      const opps = runHunt();
      const top = opps[0];
      if (top && top.expectedEgp >= 1000) {
        toast.ok(`${top.title} · +${Math.round(top.expectedEgp).toLocaleString('en-GB')} EGP`, 'DER JÄGER', 7000);
      }
      (window as any).__kaiHunt = () => { const r = runHunt(); console.info('[KAI hunt]', r, hunterLedger()); return r; };
    } catch { /* boot-safe */ }

    /* THE WEEKLY RECKONING — the Sunday accounting (upgrade of the Debrief),
       once per week on first open. On non-mobile, after the boot settles.
       When it's dismissed, the day's Morning Plan follows (Sunday sequence). */
    const planIfDue = () => {
      if (shouldShowMorningPlan() && !isMobile) {
        setTimeout(() => ensureMorningPlan().then(p => { setMorningPlan(p); markPlanShown(); }).catch(() => {}), 400);
      }
    };
    if (shouldShowReckoning() && !isMobile) {
      ensureReckoning().then(r => { setReckoning(r); markReckoningShown(); }).catch(() => planIfDue());
    } else {
      // THE MORNING PLAN — today's 3 moves + one ruling, first open of the day.
      planIfDue();
    }

    // Protocol (6.3) — first open of the day compiles the day; after
    // 21:00 the first open runs the shutdown ritual instead.
    if (shouldShutdown()) setDayRitual('shutdown');
    else if (shouldDayCompile()) setTimeout(() => setDayRitual('compile'), 1200);
    /* Dev hooks to preview the plan / reckoning / debrief on any day. */
    (window as any).__kaiPlan = () => { ensureMorningPlan().then(p => { console.info('[KAI plan]', p); setMorningPlan(p); }).catch(() => {}); };
    (window as any).__kaiReckon = () => { ensureReckoning().then(r => { console.info('[KAI reckoning]', r); setReckoning(r); }).catch(() => {}); };
    (window as any).__kaiDebrief = () => {
      ensureDebrief().then(setDebriefData).catch(() => setDebriefData({
        kept: '2 kept — arrears paid, lock replaced',
        broke: '1 broken — Katie photos by the 12th',
        best: 'Replaced the Makadi lock with your own hands, 500km out',
        mistake: '25,000 EGP Makadi trip in a minimum-payment month',
        lesson: 'You move fast on hardware, slow on the listing that pays for it.',
      }));
    };

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
      } else if (a.type === 'open-plan') {
        ensureMorningPlan().then(setMorningPlan).catch(() => {});
      } else if (a.type === 'open-reckon') {
        ensureReckoning().then(setReckoning).catch(() => {});
      } else if (a.type === 'open-hunter') {
        setHunterOpen(true);
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

    /* Boot toasts are desktop, off-Command only: the phone carries this
       in its river, and the Command view is a clean instrument (§7.1) —
       no toast may clutter the four-corner grid. */
    if (!isMobile && view !== 'command') {
      setTimeout(() => {
        toast.ok(`Welcome back, ${settings.operatorName}. All systems nominal.`, 'KAI');
      }, 800);

      const open = loadState().priorities.filter(p => !p.done).length;
      if (open > 0) {
        setTimeout(() => toast.ok(`${open} open priorit${open === 1 ? 'y' : 'ies'} for today.`, 'TODAY'), 2200);
      }
    }
    if (!isMobile && loadState().makadi?.fixLock) {
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
        if (!isMobile && view !== 'command') toast.ok('Daily briefing ready — say or type "briefing" to hear it.', 'BRIEFING', 6500);
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
      <Background view={view} />

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
            speakOn={!!settings.speakEnabled}
            setSpeakOn={(b) => { onSettings({ ...settings, speakEnabled: b }); if (b) speakNow('Voice on.'); }}
            operatorName={settings.operatorName}
            voiceState={voiceState}
          />

          {/* Live voice status / interim transcript */}
          <VoiceBanner
            state={voiceState}
            lastHeard={lastHeard}
            voiceOn={settings.voiceEnabled}
          />

          {/* Pending external actions — fixed top-right pill that
              pulses on new and opens a slideover drawer with the
              full queue. Was an inline banner; that pattern broke
              once Autopilot started stacking 5-10 proposals at a
              time. The drawer scales, the dashboard layout doesn't
              move. */}
          <ConfirmationFloating />

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
            {/* COMMAND is now the Living Body — full-bleed canvas
                organism with 12 organ panels at viewport %. No
                ViewHeader, no other panels. The other four views
                keep their chrome. */}
            {view !== 'command' && (
              <ViewHeader
                title={VIEW_LABEL[view].label}
                hint={VIEW_LABEL[view].hint}
                chips={chipsFor(view)}
                accent={VIEW_ACCENT[view]}
                hero={heroFor(view)}
              />
            )}

            {view === 'command' && (isMobile ? <MobileCommand /> : <CommandCorePanel />)}
            {view === 'command' && booted && !(lockCfg.enabled && !unlocked) && (
              <MakadiProfitLine onOpen={() => setView('money')} />
            )}

            {/* Non-Command views (§13.1) — each is its own lazy chunk, so
                the default Command load never pulls Money/Growth/Ops/Comms
                panels or the charts bundle. Skeleton grid while it loads. */}
            {view !== 'command' && (
              <Suspense fallback={<ViewSkeleton count={view === 'comms' ? 7 : 6} />}>
                {view === 'money'  && <MoneyView />}
                {view === 'growth' && <GrowthView />}
                {view === 'ops'    && <OpsView />}
                {view === 'comms'  && <CommsView />}
              </Suspense>
            )}
          </motion.div>

          {/* Live intel strip + HN ticker. The Command view is a clean
              instrument (§7.1 sacred zone) — no dashboard behind the
              core; mobile owns utilities inside its river. So the strip
              only shows on the four non-Command views. */}
          {view !== 'command' && (
            <div className="intel-strip-anchor flex flex-col gap-4 sm:gap-5">
              <IntelStrip delay={1.1} />
              <NewsRow />
            </div>
          )}

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
      {share && (
        <ShareCaptureSheet
          content={share}
          onBrainDump={(t) => { setBrainPrefill(t); setBrainOpen(true); }}
          onLaunched={() => setView('command')}
          onClose={() => { try { sessionStorage.removeItem(SHARE_KEY); } catch { /* ignore */ } setShare(null); }}
        />
      )}
      {warChestOpen && <WarChestSession onClose={() => setWarChestOpen(false)} />}
      <HunterDrawer open={hunterOpen} onClose={() => setHunterOpen(false)} />
      <InstallPrompt />
      {booted && !(lockCfg.enabled && !unlocked) && <KaiEye />}
      {isMobile && <PullToRefresh />}
      {greeting && <Greeting line={greeting} onDone={() => setGreeting(null)} />}
      {booted && !(lockCfg.enabled && !unlocked) && <PushToTalk />}
      <NightLedger />
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
      <BuildBanner />

      {/* Sovereign telemetry — bottom-left on every view including
          Command (§7.1 four corners); long-press it for Rewind. */}
      <SystemPulse hidden={false} />

      {/* Ask KAI — conversational core (A toggles, Esc closes). */}
      <AskKaiDrawer open={askOpen} onClose={() => setAskOpen(false)} />

      {/* Debrief — the weekly Sunday review (typed, gold). */}
      {debriefData && <Debrief data={debriefData} onDone={() => setDebriefData(null)} />}

      {/* THE WEEKLY RECKONING — the Sunday accounting; on dismiss, the day's
          plan follows. Reckoning takes precedence when both are due. */}
      {reckoning && <Reckoning data={reckoning} onDone={() => {
        setReckoning(null);
        if (shouldShowMorningPlan() && !isMobile) ensureMorningPlan().then(p => { setMorningPlan(p); markPlanShown(); }).catch(() => {});
      }} />}

      {/* THE MORNING PLAN — today's 3 moves + one ruling (only when the
          Reckoning isn't up, to avoid stacked overlays). */}
      {morningPlan && !reckoning && <MorningPlan data={morningPlan} onDone={() => setMorningPlan(null)} />}

      {/* Protocol (6.3) — ONE THING focus + the daily ritual. */}
      {oneThingOpen && <OneThingMode onExit={() => setOneThingOpen(false)} />}
      {dayRitual && <DayRitual mode={dayRitual} onDone={() => setDayRitual(null)} />}

      {/* Night Watch (§7.9) — standby face after idle on Command. */}
      {nightIdle && !nwWoke && view === 'command' && !oneThingOpen && !cmdOpen && (
        <NightWatch onWake={() => setNwWoke(true)} />
      )}

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
