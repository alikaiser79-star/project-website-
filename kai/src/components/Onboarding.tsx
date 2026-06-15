import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, User, Palette, Mic, Bell } from 'lucide-react';
import { sfx } from '../lib/sound';
import { voice } from '../lib/speech';
import { loadState, saveState } from '../lib/store';
import type { Accent, KaiSettings } from '../types';

const ACCENTS: { id: Accent; label: string; hex: string }[] = [
  { id: 'amber',   label: 'Amber',   hex: '#FFB300' },
  { id: 'cyan',    label: 'Cyan',    hex: '#5FE3FF' },
  { id: 'emerald', label: 'Emerald', hex: '#7AE6A8' },
];

type Props = { open: boolean; onDone: (s: KaiSettings) => void };

export default function Onboarding({ open, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<KaiSettings>(() => loadState().settings);

  const steps = [
    { icon: Sparkles, title: 'Welcome to KAI', body: 'Your command core is online. Let’s tune it.' },
    { icon: User,     title: 'Operator name',  body: 'How should KAI address you?' },
    { icon: Palette,  title: 'Core accent',    body: 'Pick the colour for KAI’s presence.' },
    { icon: Mic,      title: 'Voice',          body: 'Enable speech recognition and audio replies?' },
    { icon: Bell,     title: 'Notifications',  body: 'Let KAI ping you with browser notifications when reminders fire?' },
  ];

  function next() {
    sfx.click();
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    const finalSettings: KaiSettings = { ...s, onboarded: true };
    const st = loadState();
    st.settings = finalSettings;
    saveState(st);
    sfx.confirm();
    onDone(finalSettings);
  }

  function setOp(name: string)  { setS({ ...s, operatorName: name || 'commander' }); }
  function setAcc(a: Accent)    { setS({ ...s, accent: a }); sfx.click(); }
  function setVoiceOn(v: boolean) {
    setS({ ...s, voiceEnabled: v });
    if (v) voice.speak(`Voice channel online, ${s.operatorName}.`, { rate: s.voiceRate, pitch: s.voicePitch, voiceName: s.voiceName });
    sfx.click();
  }
  async function setNotif(v: boolean) {
    sfx.click();
    if (!v) { setS({ ...s, notifications: false }); return; }
    if (!('Notification' in window)) { setS({ ...s, notifications: false }); return; }
    const perm = await Notification.requestPermission();
    setS({ ...s, notifications: perm === 'granted' });
  }

  const cur = steps[step];
  const Icon = cur.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[450] grid place-items-center px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ background: 'rgba(7,10,15,0.86)', backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            initial={{ y: 16, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="glass w-[min(540px,94vw)] rounded-md overflow-hidden"
          >
            <header className="flex items-center justify-between px-5 py-3 border-b border-amber/15">
              <div className="flex items-center gap-2">
                <span className="text-amber text-xl drop-shadow-[0_0_10px_rgba(255,179,0,0.6)]">◊</span>
                <h3 className="font-sans text-bone text-sm tracking-wide">KAI · onboarding</h3>
              </div>
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">
                {step + 1} / {steps.length}
              </span>
            </header>

            <div className="px-6 py-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ x: 12, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -12, opacity: 0 }}
                  transition={{ duration: 0.26 }}
                  className="space-y-5"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={22} className="text-amber drop-shadow-[0_0_8px_rgba(255,179,0,0.5)]" />
                    <div>
                      <h2 className="font-display text-bone text-2xl leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>{cur.title}</h2>
                      <p className="font-mono text-[11px] text-steel">{cur.body}</p>
                    </div>
                  </div>

                  {step === 0 && (
                    <div className="font-mono text-[12px] text-steel leading-relaxed pt-1">
                      KAI is your personal control core — finance, garden, makadi, focus,
                      voice. Press <kbd>⌘</kbd><kbd>K</kbd> any time for the command bar,
                      or talk to KAI once voice is enabled.
                    </div>
                  )}

                  {step === 1 && (
                    <input
                      autoFocus
                      value={s.operatorName}
                      onChange={e => setOp(e.target.value)}
                      placeholder="Ali"
                      className="w-full bg-transparent border border-amber/25 focus:border-amber rounded px-3 py-2.5 text-bone text-base outline-none font-sans"
                    />
                  )}

                  {step === 2 && (
                    <div className="grid grid-cols-3 gap-2">
                      {ACCENTS.map(a => (
                        <button
                          key={a.id}
                          onClick={() => setAcc(a.id)}
                          className={'p-3 rounded border flex flex-col items-center gap-1.5 transition ' +
                            (s.accent === a.id ? 'border-amber bg-amber/10 shadow-glow-amber' : 'border-amber/20 hover:border-amber/60')}
                        >
                          <span className="w-7 h-7 rounded-full" style={{ background: a.hex, boxShadow: `0 0 14px ${a.hex}` }} />
                          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-bone">{a.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-2">
                      <ChoiceBtn on={s.voiceEnabled === true}  label="Yes — turn voice on"  hint="Continuous recognition + spoken replies" onClick={() => setVoiceOn(true)} />
                      <ChoiceBtn on={s.voiceEnabled === false} label="Not yet" hint="You can flip V in the top bar later" onClick={() => setVoiceOn(false)} />
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-2">
                      <ChoiceBtn on={s.notifications === true}  label="Allow notifications"  hint="Reminders ping even when the tab is in the background" onClick={() => setNotif(true)} />
                      <ChoiceBtn on={s.notifications === false} label="Skip for now" hint="Toasts will still fire when KAI is in focus" onClick={() => setNotif(false)} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="flex items-center justify-between px-5 py-3 border-t border-amber/15">
              <button
                onClick={() => { sfx.click(); setStep(Math.max(0, step - 1)); }}
                disabled={step === 0}
                className="font-mono text-[11px] tracking-[0.18em] uppercase text-steel hover:text-amber disabled:opacity-30 disabled:hover:text-steel"
              >back</button>
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <span key={i} className={'w-1.5 h-1.5 rounded-full transition ' + (i === step ? 'bg-amber shadow-glow-amber' : 'bg-amber/25')} />
                ))}
              </div>
              <button
                onClick={next}
                className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 border border-amber text-amber hover:bg-amber/10 hover:shadow-glow-amber rounded"
              >
                {step === steps.length - 1 ? 'Engage' : 'Next'} <ArrowRight size={11} />
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChoiceBtn({ on, label, hint, onClick }: { on: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={'w-full text-left px-3 py-2.5 rounded border transition ' +
        (on ? 'border-amber bg-amber/10 shadow-glow-amber' : 'border-amber/20 hover:border-amber/60')}
    >
      <div className="font-sans text-bone text-[13px]">{label}</div>
      <div className="font-mono text-[10px] tracking-[0.14em] text-steel mt-0.5">{hint}</div>
    </button>
  );
}
