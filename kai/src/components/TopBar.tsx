import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Command, Mic, MicOff, Volume2, VolumeX, Settings, Download, AlertTriangle, Loader2, Sparkles, Brain, Plane } from 'lucide-react';
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
      className="glass rounded-lg flex items-center justify-between px-5 sm:px-6 py-4"
    >
      {/* Identity */}
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="text-amber text-base leading-none">◊</span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.28em] text-steel/55 uppercase">KAI</div>
          <div className="text-bone/95 text-sm font-light truncate">
            {greet}<span className="text-bone">{operatorName || operator.name}</span>
          </div>
        </div>
      </div>

      {/* Clock — minimal */}
      <div className="hidden md:flex items-baseline gap-2 font-mono text-bone/75">
        <span className="text-sm tabular-nums">{fmtTime(now)}</span>
        <span className="text-[11px] tracking-[0.24em] text-steel/60 uppercase">{operator.cityLabel || 'Cairo'}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <IconBtn title="Mute sound (M)" onClick={() => { sfx.click(); setSoundOn(!soundOn); }} active={soundOn}>
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </IconBtn>

        <MicChip
          voiceOn={voiceOn}
          voiceState={voiceState}
          onClick={() => { sfx.click(); setVoiceOn(!voiceOn); }}
        />

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
          id="tour-autopilot"
          onClick={() => { sfx.whoosh(); onAutopilot(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber/45 text-amber hover:border-amber hover:bg-amber/10 transition font-mono text-[10px] tracking-[0.16em] uppercase"
          title="Autopilot · run the morning loop"
        >
          <Plane size={11} /> <span className="hidden sm:inline">Autopilot</span>
        </button>

        <button
          id="tour-braindump"
          onClick={() => { sfx.whoosh(); onBrainDump(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber/35 text-amber/95 hover:border-amber hover:bg-amber/10 transition font-mono text-[10px] tracking-[0.16em] uppercase"
          title="Brain Dump · capture & sort"
        >
          <Brain size={11} /> <span className="hidden sm:inline">Dump</span>
        </button>

        <button
          id="tour-content"
          onClick={() => { sfx.whoosh(); onContent(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber/35 text-amber/95 hover:border-amber hover:bg-amber/10 transition font-mono text-[10px] tracking-[0.16em] uppercase"
          title="Content · reel hooks"
        >
          <Sparkles size={11} /> <span className="hidden sm:inline">Content</span>
        </button>

        <IconBtn title="Settings (S)" onClick={() => { sfx.click(); onSettings(); }}>
          <Settings size={14} />
        </IconBtn>

        <button
          id="tour-cmdk"
          onClick={() => { sfx.whoosh(); onCmdK(); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-white/[0.08] hover:border-white/15 transition text-bone/85 text-xs"
          title="Command bar (⌘K)"
        >
          <Command size={12} className="text-bone/75" /> <kbd>K</kbd>
        </button>
      </div>
    </motion.header>
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
