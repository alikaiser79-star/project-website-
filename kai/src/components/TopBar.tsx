import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, Mic, MicOff, Volume2, VolumeX, Settings, Download, AlertTriangle, Loader2, Sparkles, Brain, Plane, MoreHorizontal } from 'lucide-react';
import { operator } from '../kaiConfig';
import { sfx } from '../lib/sound';
import type { VoiceState } from '../lib/speech';

type Props = {
  onCmdK: () => void;
  onSettings: () => void;
  onContent: () => void;
  onBrainDump: () => void;
  onAutopilot: () => void;
  voiceOn: boolean;
  setVoiceOn: (b: boolean) => void;
  soundOn: boolean;
  setSoundOn: (b: boolean) => void;
  operatorName: string;
  voiceState?: VoiceState;
};

function fmtTime(d: Date) {
  return d.toLocaleTimeString(operator.locale, {
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: operator.timezone,
  });
}

export default function TopBar({
  onCmdK, onSettings, onContent, onBrainDump, onAutopilot, voiceOn, setVoiceOn, soundOn, setSoundOn, operatorName, voiceState,
}: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);

  /* PWA install prompt — only when Chromium offers it. */
  const [installEvt, setInstallEvt] = useState<any>(null);
  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setInstallEvt(e); };
    const onInstalled = () => setInstallEvt(null);
    window.addEventListener('beforeinstallprompt', onPrompt as any);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt as any);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  async function install() {
    if (!installEvt) return;
    sfx.click();
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
  }

  const hour = parseInt(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: operator.timezone }), 10);
  const greet =
    hour < 5  ? "You're up late, " :
    hour < 12 ? 'Good morning, ' :
    hour < 18 ? 'Good afternoon, ' :
                'Good evening, ';

  return (
    <motion.header
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.7 } }}
      className="glass rounded-lg flex items-center justify-between gap-2 px-3 sm:px-5 lg:px-6 py-2.5 sm:py-4"
    >
      {/* Identity */}
      <div className="flex items-baseline gap-2 sm:gap-3 min-w-0 shrink">
        <span className="text-amber text-base leading-none">◊</span>
        <div className="min-w-0">
          <div className="font-mono text-[9.5px] sm:text-[10px] tracking-[0.24em] sm:tracking-[0.28em] text-steel/55 uppercase">KAI</div>
          <div className="text-bone/95 text-[12.5px] sm:text-sm font-light truncate">
            {greet}<span className="text-bone">{operatorName || operator.name}</span>
          </div>
        </div>
      </div>

      {/* Clock — desktop only */}
      <div className="hidden lg:flex items-baseline gap-2 font-mono text-bone/75 shrink-0">
        <span className="text-sm tabular-nums">{fmtTime(now)}</span>
        <span className="text-[11px] tracking-[0.24em] text-steel/60 uppercase">{operator.cityLabel || 'Cairo'}</span>
      </div>

      {/* Actions — always-visible essentials + overflow menu for secondary */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Voice — primary input, always visible */}
        <MicChip
          voiceOn={voiceOn}
          voiceState={voiceState}
          onClick={() => { sfx.click(); setVoiceOn(!voiceOn); }}
        />

        {/* Autopilot — the one-tap morning loop. Always visible. */}
        <button
          id="tour-autopilot"
          onClick={() => { sfx.whoosh(); onAutopilot(); }}
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded border border-amber/45 text-amber hover:border-amber hover:bg-amber/10 transition font-mono text-[10px] tracking-[0.16em] uppercase"
          title="Autopilot · run the morning loop"
        >
          <Plane size={11} /> <span className="hidden sm:inline">Autopilot</span>
        </button>

        {/* ⌘K — always visible */}
        <button
          id="tour-cmdk"
          onClick={() => { sfx.whoosh(); onCmdK(); }}
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded border border-white/[0.08] hover:border-white/15 transition text-bone/85 text-xs"
          title="Command bar (⌘K)"
        >
          <Command size={12} className="text-bone/75" />
          <kbd className="hidden sm:inline">K</kbd>
        </button>

        {/* Secondary actions — chips on desktop, overflow menu on mobile */}
        <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
          <IconBtn title="Mute sound (M)" onClick={() => { sfx.click(); setSoundOn(!soundOn); }} active={soundOn}>
            {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </IconBtn>
          {installEvt && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber/35 text-amber/90 hover:border-amber transition font-mono text-[10px] tracking-[0.16em] uppercase"
              title="Install KAI as an app"
            >
              <Download size={11} /> Install
            </button>
          )}
          <button
            id="tour-braindump"
            onClick={() => { sfx.whoosh(); onBrainDump(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber/35 text-amber/95 hover:border-amber hover:bg-amber/10 transition font-mono text-[10px] tracking-[0.16em] uppercase"
            title="Brain Dump · capture & sort"
          >
            <Brain size={11} /> Dump
          </button>
          <button
            id="tour-content"
            onClick={() => { sfx.whoosh(); onContent(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber/35 text-amber/95 hover:border-amber hover:bg-amber/10 transition font-mono text-[10px] tracking-[0.16em] uppercase"
            title="Content · reel hooks"
          >
            <Sparkles size={11} /> Content
          </button>
          <IconBtn title="Settings (S)" onClick={() => { sfx.click(); onSettings(); }}>
            <Settings size={14} />
          </IconBtn>
        </div>

        {/* Mobile overflow menu */}
        <MoreMenu
          soundOn={soundOn} setSoundOn={setSoundOn}
          onBrainDump={onBrainDump} onContent={onContent} onSettings={onSettings}
          installEvt={installEvt} install={install}
        />
      </div>
    </motion.header>
  );
}

/* Three-dot menu that collapses secondary chips on small screens.
   Closes on Esc, on outside click, and on any item tap. */
function MoreMenu({
  soundOn, setSoundOn, onBrainDump, onContent, onSettings, installEvt, install,
}: {
  soundOn: boolean; setSoundOn: (b: boolean) => void;
  onBrainDump: () => void; onContent: () => void; onSettings: () => void;
  installEvt: any; install: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function run(fn: () => void) { setOpen(false); fn(); }

  return (
    <div className="relative md:hidden" ref={ref}>
      <button
        onClick={() => { sfx.click(); setOpen(o => !o); }}
        className={
          'p-2 rounded border transition ' +
          (open
            ? 'border-amber/45 text-amber bg-amber/[0.06]'
            : 'border-white/[0.08] text-steel hover:text-bone/85 hover:border-white/15')
        }
        title="More"
        aria-label="More actions"
        aria-expanded={open}
      >
        <MoreHorizontal size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full mt-2 z-40 w-[200px] rounded-md glass p-1.5 flex flex-col gap-0.5"
            role="menu"
          >
            <MenuItem
              icon={soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              label={soundOn ? 'Mute sound' : 'Unmute sound'}
              hint="M"
              onClick={() => run(() => setSoundOn(!soundOn))}
            />
            <MenuItem
              icon={<Brain size={13} />}
              label="Brain Dump"
              onClick={() => run(onBrainDump)}
            />
            <MenuItem
              icon={<Sparkles size={13} />}
              label="Content · reel hooks"
              onClick={() => run(onContent)}
            />
            <MenuItem
              icon={<Settings size={13} />}
              label="Settings"
              hint="S"
              onClick={() => run(onSettings)}
            />
            {installEvt && (
              <MenuItem
                icon={<Download size={13} />}
                label="Install KAI as app"
                onClick={() => run(install)}
                accent
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon, label, hint, onClick, accent,
}: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={
        'flex items-center gap-2 px-2.5 py-2 rounded text-left transition ' +
        (accent
          ? 'text-amber hover:bg-amber/10'
          : 'text-bone/90 hover:bg-amber/10 hover:text-bone')
      }
    >
      <span className={'shrink-0 ' + (accent ? 'text-amber' : 'text-steel')}>{icon}</span>
      <span className="font-sans text-[12.5px] flex-1 truncate">{label}</span>
      {hint && <kbd className="font-mono text-[9.5px] tracking-wide text-steel/65">{hint}</kbd>}
    </button>
  );
}

/* Minimal icon button — quiet, no glow */
function IconBtn({
  children, onClick, title, active = false,
}: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        'p-2 rounded border transition ' +
        (active
          ? 'border-white/15 text-bone/85'
          : 'border-white/[0.08] text-steel hover:text-bone/85 hover:border-white/15')
      }
    >
      {children}
    </button>
  );
}

/* Voice mic chip — quiet by default, brightens only on real states */
function MicChip({
  voiceOn, voiceState, onClick,
}: { voiceOn: boolean; voiceState?: VoiceState; onClick: () => void }) {
  if (!voiceOn) {
    return (
      <button
        id="tour-voice"
        onClick={onClick}
        className="p-2 rounded border border-white/[0.08] text-steel hover:text-bone/85 hover:border-white/15 transition"
        title="Voice off — click to enable (V)"
      >
        <MicOff size={14} />
      </button>
    );
  }
  const s = voiceState;
  let icon: React.ReactNode = <Mic size={14} />;
  let className = 'relative p-2 rounded border border-amber/30 bg-amber/[0.06] text-amber transition';
  let dot: React.ReactNode = null;
  let title = 'Voice on (V)';

  if (s?.kind === 'starting') {
    icon = <Loader2 size={14} className="animate-spin" />;
    title = 'Voice · starting…';
  } else if (s?.kind === 'listening') {
    className = 'relative p-2 rounded border border-ok/35 bg-ok/[0.07] text-ok transition';
    dot = <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-ok animate-pulse-soft" />;
    title = 'Voice · listening';
  } else if (s?.kind === 'error') {
    className = 'relative p-2 rounded border border-danger/45 bg-danger/[0.06] text-danger transition';
    icon = <AlertTriangle size={14} />;
    title = `Voice · ${s.code}${s.message ? ' · ' + s.message : ''}`;
  } else if (s?.kind === 'unsupported') {
    className = 'relative p-2 rounded border border-amber2/50 bg-amber2/[0.06] text-amber2 transition';
    icon = <AlertTriangle size={14} />;
    title = 'Voice · unsupported (no SpeechRecognition in this browser)';
  }
  return (
    <button
      id="tour-voice"
      onClick={onClick}
      className={className}
      title={title}
      aria-label={title}
    >
      {icon}
      {dot}
    </button>
  );
}
