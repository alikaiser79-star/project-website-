import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Command, Mic, MicOff, Volume2, VolumeX, Settings, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { operator } from '../kaiConfig';
import { sfx } from '../lib/sound';
import type { VoiceState } from '../lib/speech';

type Props = {
  onCmdK: () => void;
  onSettings: () => void;
  voiceOn: boolean;
  setVoiceOn: (b: boolean) => void;
  soundOn: boolean;
  setSoundOn: (b: boolean) => void;
  operatorName: string;
  voiceState?: VoiceState;
};

function fmtTime(d: Date) {
  return d.toLocaleTimeString(operator.locale, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: operator.timezone,
  });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString(operator.locale, {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    timeZone: operator.timezone,
  }).toUpperCase();
}

export default function TopBar({ onCmdK, onSettings, voiceOn, setVoiceOn, soundOn, setSoundOn, operatorName, voiceState }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  /* PWA install prompt — only surfaces when the browser has fired
     beforeinstallprompt (Chromium-family on supported origins). */
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
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 0.1, duration: 0.5 } }}
      className="glass flex items-center justify-between px-5 py-3 h-[64px] rounded-none"
    >
      <div className="flex items-center gap-4">
        <span className="text-amber text-xl drop-shadow-[0_0_10px_rgba(255,179,0,0.55)]">◊</span>
        <div>
          <div className="font-mono text-[10px] tracking-[0.32em] text-steel uppercase">KAI · COMMAND CORE</div>
          <div className="text-bone text-sm">{greet}<span className="text-amber">{operatorName || operator.name}.</span></div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4 font-mono text-[12px] text-bone tracking-wider">
        <span className="text-steel">{fmtDate(now)}</span>
        <span className="text-amber/60">·</span>
        <span className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.4)]">{fmtTime(now)}</span>
        <span className="text-amber/60">·</span>
        <span className="text-steel uppercase">Cairo</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => { sfx.click(); setSoundOn(!soundOn); }}
          onMouseEnter={() => sfx.hover()}
          className="px-2.5 py-1.5 rounded border border-amber/25 hover:border-amber hover:shadow-glow-amber text-amber/80 hover:text-amber transition"
          title="Mute sound (M)"
        >
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        <MicChip
          voiceOn={voiceOn}
          voiceState={voiceState}
          onClick={() => { sfx.click(); setVoiceOn(!voiceOn); }}
        />
        {installEvt && (
          <button
            onClick={install}
            onMouseEnter={() => sfx.hover()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber bg-amber/10 text-amber shadow-glow-amber transition font-mono text-[11px] tracking-[0.16em] uppercase"
            title="Install KAI as an app"
          >
            <Download size={12} /> Install
          </button>
        )}
        <button
          onClick={() => { sfx.click(); onSettings(); }}
          onMouseEnter={() => sfx.hover()}
          className="px-2.5 py-1.5 rounded border border-amber/25 hover:border-amber hover:shadow-glow-amber text-amber/80 hover:text-amber transition"
          title="Settings (S)"
        >
          <Settings size={14} />
        </button>
        <button
          id="tour-cmdk"
          onClick={() => { sfx.whoosh(); onCmdK(); }}
          onMouseEnter={() => sfx.hover()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber/25 hover:border-amber hover:shadow-glow-amber transition text-bone text-xs"
        >
          <Command size={12} /> <kbd>K</kbd>
        </button>
        <div className="ml-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase">
          <span className="w-2 h-2 rounded-full bg-ok shadow-[0_0_10px_#7AE6A8] animate-pulse-soft" />
          <span className="text-ok">SYSTEM ONLINE</span>
        </div>
      </div>
    </motion.header>
  );
}

/* Voice mic chip with full status feedback:
   - off:        muted mic, amber/25
   - on + starting:   spinner, amber
   - on + listening:  mic + green pulse dot, ok colour
   - on + error:      warning icon, danger colour, error code in title
   - on + unsupported: muted mic, danger, "unsupported" title */
function MicChip({
  voiceOn, voiceState, onClick,
}: { voiceOn: boolean; voiceState?: VoiceState; onClick: () => void }) {
  if (!voiceOn) {
    return (
      <button
        id="tour-voice"
        onClick={onClick}
        onMouseEnter={() => sfx.hover()}
        className="px-2.5 py-1.5 rounded border border-amber/25 text-amber/70 hover:border-amber/60 transition"
        title="Toggle voice (V) — currently off"
      >
        <MicOff size={14} />
      </button>
    );
  }

  /* voice is on — paint by current state */
  const s = voiceState;
  let icon: JSX.Element = <Mic size={14} />;
  let className =
    'relative px-2.5 py-1.5 rounded border border-amber bg-amber/10 text-amber shadow-glow-amber transition';
  let dot: JSX.Element | null = null;
  let title = 'Voice on (V)';

  if (s?.kind === 'starting') {
    icon = <Loader2 size={14} className="animate-spin" />;
    title = 'Voice · starting…';
  } else if (s?.kind === 'listening') {
    className =
      'relative px-2.5 py-1.5 rounded border border-ok bg-ok/10 text-ok shadow-[0_0_10px_rgba(122,230,168,0.45)] transition';
    dot = (
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ok shadow-[0_0_6px_#7AE6A8] animate-pulse-soft" />
    );
    title = 'Voice · listening';
  } else if (s?.kind === 'error') {
    className =
      'relative px-2.5 py-1.5 rounded border border-danger bg-danger/10 text-danger transition';
    icon = <AlertTriangle size={14} />;
    title = `Voice · ${s.code}${s.message ? ' · ' + s.message : ''}`;
  } else if (s?.kind === 'unsupported') {
    className =
      'relative px-2.5 py-1.5 rounded border border-amber2/60 bg-amber2/10 text-amber2 transition';
    icon = <AlertTriangle size={14} />;
    title = 'Voice · unsupported (no SpeechRecognition in this browser)';
  }

  return (
    <button
      id="tour-voice"
      onClick={onClick}
      onMouseEnter={() => sfx.hover()}
      className={className}
      title={title}
      aria-label={title}
    >
      {icon}
      {dot}
    </button>
  );
}
