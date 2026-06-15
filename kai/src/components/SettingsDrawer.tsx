import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, X, Volume2, Mic, Palette, RotateCcw, User, Download, Upload } from 'lucide-react';
import { loadState, saveState, defaults } from '../lib/store';
import type { KaiSettings, Accent } from '../types';
import { sfx } from '../lib/sound';
import { voice } from '../lib/speech';
import { toast } from '../hooks/useToasts';

const ACCENTS: { id: Accent; label: string; hex: string }[] = [
  { id: 'amber',   label: 'Amber',   hex: '#FFB300' },
  { id: 'cyan',    label: 'Cyan',    hex: '#5FE3FF' },
  { id: 'emerald', label: 'Emerald', hex: '#7AE6A8' },
];

type Props = { open: boolean; onClose: () => void; onSettings: (s: KaiSettings) => void };

export default function SettingsDrawer({ open, onClose, onSettings }: Props) {
  const [s, setS] = useState<KaiSettings>(() => loadState().settings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    function pick() {
      if ('speechSynthesis' in window) setVoices(speechSynthesis.getVoices());
    }
    pick();
    if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = pick;
  }, []);

  useEffect(() => {
    const state = loadState();
    state.settings = s; saveState(state);
    onSettings(s);
  }, [s, onSettings]);

  function resetAll() {
    if (!confirm('Wipe ALL local state (priorities, debt, chat, settings)?')) return;
    try { localStorage.removeItem('kai.state.v1'); } catch {}
    toast.warn('Local state cleared. Reloading…');
    setTimeout(() => location.reload(), 700);
  }

  function exportState() {
    const payload = loadState();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kai-state-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.ok('State exported.', 'BACKUP', 3000);
  }

  function importState(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        localStorage.setItem('kai.state.v1', JSON.stringify(parsed));
        toast.ok('State imported. Reloading…');
        setTimeout(() => location.reload(), 700);
      } catch {
        toast.err('Could not parse that file.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[350]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          style={{ background: 'rgba(10,14,20,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <motion.aside
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass absolute right-3 top-3 bottom-3 w-[360px] rounded-md overflow-hidden flex flex-col"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-amber/15">
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-amber" />
                <h3 className="font-sans text-bone text-sm tracking-wide">Settings</h3>
              </div>
              <button onClick={onClose} className="text-steel hover:text-amber"><X size={14} /></button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 font-mono text-[12px]">
              <Section icon={<User size={12} />} title="Operator">
                <label className="block text-[10px] tracking-[0.18em] text-steel uppercase mb-1">Display name</label>
                <input
                  value={s.operatorName}
                  onChange={e => setS({ ...s, operatorName: e.target.value })}
                  className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone outline-none"
                />
              </Section>

              <Section icon={<Mic size={12} />} title="Voice">
                <Toggle label="Recognition" value={s.voiceEnabled} onChange={v => setS({ ...s, voiceEnabled: v })} />
                <label className="block mt-3 text-[10px] tracking-[0.18em] text-steel uppercase mb-1">Rate · {s.voiceRate.toFixed(2)}</label>
                <input type="range" min={0.6} max={1.4} step={0.05} value={s.voiceRate}
                  onChange={e => setS({ ...s, voiceRate: parseFloat(e.target.value) })}
                  className="w-full accent-amber" />
                <label className="block mt-3 text-[10px] tracking-[0.18em] text-steel uppercase mb-1">Pitch · {s.voicePitch.toFixed(2)}</label>
                <input type="range" min={0.6} max={1.2} step={0.05} value={s.voicePitch}
                  onChange={e => setS({ ...s, voicePitch: parseFloat(e.target.value) })}
                  className="w-full accent-amber" />
                {voices.length > 0 && (
                  <>
                    <label className="block mt-3 text-[10px] tracking-[0.18em] text-steel uppercase mb-1">Voice</label>
                    <select
                      value={s.voiceName || ''}
                      onChange={e => setS({ ...s, voiceName: e.target.value || undefined })}
                      className="w-full bg-ink2 border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone outline-none"
                    >
                      <option value="">(system default)</option>
                      {voices.filter(v => /en/i.test(v.lang)).map(v => (
                        <option key={v.name} value={v.name}>{v.name} · {v.lang}</option>
                      ))}
                    </select>
                  </>
                )}
                <button
                  onClick={() => {
                    sfx.speak();
                    voice.speak(`Voice check, ${s.operatorName || 'commander'}.`);
                  }}
                  className="mt-3 w-full px-2 py-1.5 border border-amber/40 text-amber rounded hover:border-amber hover:shadow-glow-amber"
                >
                  Test voice
                </button>
              </Section>

              <Section icon={<Volume2 size={12} />} title="Sound">
                <Toggle label="UI sounds" value={s.soundEnabled} onChange={v => setS({ ...s, soundEnabled: v })} />
              </Section>

              <Section icon={<Palette size={12} />} title="Core accent">
                <div className="grid grid-cols-3 gap-2">
                  {ACCENTS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { sfx.click(); setS({ ...s, accent: a.id }); }}
                      className={'p-2.5 rounded border transition flex flex-col items-center gap-1.5 ' +
                        (s.accent === a.id
                          ? 'border-amber bg-amber/10 shadow-glow-amber'
                          : 'border-amber/20 hover:border-amber/60')}
                    >
                      <span className="w-5 h-5 rounded-full" style={{ background: a.hex, boxShadow: `0 0 10px ${a.hex}` }} />
                      <span className="text-[10px] tracking-[0.18em] uppercase text-bone">{a.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-steel leading-relaxed">
                  Recolours the KAI Core orb and a few highlights. The UI palette stays amber.
                </p>
              </Section>

              <Section icon={<Download size={12} />} title="Backup">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={exportState}
                    className="flex items-center justify-center gap-1.5 px-2 py-2 border border-amber/40 text-amber hover:border-amber hover:shadow-glow-amber rounded text-[11px] tracking-[0.14em] uppercase"
                  >
                    <Download size={12} /> Export
                  </button>
                  <label className="flex items-center justify-center gap-1.5 px-2 py-2 border border-amber/40 text-amber hover:border-amber hover:shadow-glow-amber rounded text-[11px] tracking-[0.14em] uppercase cursor-pointer">
                    <Upload size={12} /> Import
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) importState(f); }}
                    />
                  </label>
                </div>
                <p className="mt-2 text-[10px] text-steel leading-relaxed">
                  Download a JSON snapshot of all KAI state, or load one back.
                </p>
              </Section>

              <Section icon={<RotateCcw size={12} />} title="Danger zone">
                <button
                  onClick={resetAll}
                  className="w-full px-3 py-2 border border-danger/50 text-danger hover:bg-danger/10 rounded text-[11px] tracking-[0.16em] uppercase"
                >
                  Reset all KAI state
                </button>
              </Section>
            </div>

            <footer className="px-4 py-2 border-t border-amber/15 font-mono text-[10px] tracking-[0.18em] uppercase text-steel">
              changes save instantly
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5 text-amber/90">
        {icon}
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => { sfx.click(); onChange(!value); }}
      className="w-full flex items-center justify-between px-2 py-2 border border-amber/15 hover:border-amber/40 rounded"
    >
      <span className="text-bone text-[12px]">{label}</span>
      <span className={'w-9 h-5 rounded-full border relative transition ' + (value ? 'bg-amber/20 border-amber' : 'border-amber/20')}>
        <span className={'absolute top-0.5 w-4 h-4 rounded-full transition ' + (value ? 'left-4 bg-amber shadow-glow-amber' : 'left-0.5 bg-steel')} />
      </span>
    </button>
  );
}
