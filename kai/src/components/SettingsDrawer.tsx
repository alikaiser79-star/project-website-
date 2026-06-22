import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, X, Volume2, Mic, Palette, RotateCcw, User, Download, Upload, Bell, MapPin, Clock, Compass, Wallet, Plus, Trash2, Target, Flame, Leaf, Bed, AtSign, ShieldCheck, Fingerprint, KeyRound } from 'lucide-react';
import {
  loadState, saveState, defaults,
  updateGarden, updateMakadi, upsertInstagram, removeInstagram, setFx,
} from '../lib/store';
import {
  listGoals,
  goalCurrent,
  goalPct,
  upsertGoal,
  updateGoal as updateGoalLib,
  removeGoal as removeGoalLib,
} from '../lib/goals';
import type { KaiSettings, Accent, IncomeOverride, Habit, Goal, GardenState, MakadiState, IgAccount } from '../types';
import { sfx } from '../lib/sound';
import { voice } from '../lib/speech';
import { toast } from '../hooks/useToasts';
import { listReminders, cancelReminder } from '../lib/reminders';
import {
  loadLockConfig, saveLockConfig, clearLock,
  webAuthnSupported, platformAuthAvailable,
  registerCredential, verifyCredential,
  setPin, verifyPin,
  type LockConfig,
} from '../lib/lock';

const ACCENTS: { id: Accent; label: string; hex: string }[] = [
  { id: 'amber',   label: 'Amber',   hex: '#FFB300' },
  { id: 'cyan',    label: 'Cyan',    hex: '#5FE3FF' },
  { id: 'emerald', label: 'Emerald', hex: '#7AE6A8' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSettings: (s: KaiSettings) => void;
  onTour: () => void;
  /* When open, scroll the section whose title matches this prop into view. */
  focusSection?: string | null;
};

export default function SettingsDrawer({ open, onClose, onSettings, onTour, focusSection }: Props) {
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

  /* When opened with a focusSection, scroll that section into view. */
  useEffect(() => {
    if (!open || !focusSection) return;
    const id = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-section="${focusSection.toLowerCase()}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 240);
    return () => clearTimeout(id);
  }, [open, focusSection]);

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
                <Toggle label='Wake word ("Hey KAI")' value={s.wakeWord} onChange={v => setS({ ...s, wakeWord: v })} />
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

              <Section icon={<Bell size={12} />} title="Notifications">
                <Toggle
                  label="Browser notifications"
                  value={s.notifications}
                  onChange={async (v) => {
                    if (v && 'Notification' in window) {
                      const perm = await Notification.requestPermission();
                      setS({ ...s, notifications: perm === 'granted' });
                      if (perm !== 'granted') toast.warn('Browser blocked notifications.');
                    } else {
                      setS({ ...s, notifications: v });
                    }
                  }}
                />
                <p className="mt-2 text-[10px] text-steel leading-relaxed">
                  Reminders ping you in your OS notification center when the tab is in the background.
                </p>
              </Section>

              <Section icon={<Clock size={12} />} title="Reminders">
                <RemindersList />
              </Section>

              <Section icon={<Wallet size={12} />} title="Income streams">
                <IncomeEditor />
              </Section>

              <Section icon={<Wallet size={12} />} title="FX rate">
                <FxEditor />
              </Section>

              <Section icon={<Leaf size={12} />} title="Hidden Garden">
                <GardenEditor />
              </Section>

              <Section icon={<Bed size={12} />} title="Makadi Airbnb">
                <MakadiEditor />
              </Section>

              <Section icon={<AtSign size={12} />} title="Instagram">
                <InstagramEditor />
              </Section>

              <Section icon={<Target size={12} />} title="Goals">
                <GoalsEditor />
              </Section>

              <Section icon={<Flame size={12} />} title="Habits">
                <HabitsEditor />
              </Section>

              <Section icon={<Compass size={12} />} title="Tour">
                <button
                  onClick={() => { sfx.click(); onClose(); setTimeout(onTour, 220); }}
                  className="w-full px-3 py-2 border border-amber/40 text-amber rounded text-[11px] tracking-[0.16em] uppercase hover:bg-amber/10 hover:shadow-glow-amber"
                >
                  Take the tour
                </button>
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

              <Section icon={<ShieldCheck size={12} />} title="Security">
                <SecurityEditor />
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
    <div data-section={title.toLowerCase()}>
      <div className="flex items-center gap-2 mb-2.5 text-amber/90">
        {icon}
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function IncomeEditor() {
  const [items, setItems] = useState<IncomeOverride[]>(() => loadState().income);

  function persist(next: IncomeOverride[]) {
    const s = loadState(); s.income = next; saveState(s);
    setItems(next);
  }
  function edit(id: string, patch: Partial<IncomeOverride>) {
    persist(items.map(i => i.id === id ? { ...i, ...patch } : i));
  }
  function remove(id: string) {
    persist(items.filter(i => i.id !== id));
    sfx.click();
  }
  function add() {
    const fresh: IncomeOverride = {
      id: 'inc-' + Date.now(),
      label: 'New stream',
      amount: 0,
      ccy: 'EGP',
      cadence: 'monthly',
      custom: true,
    };
    persist([...items, fresh]);
    sfx.click();
  }

  return (
    <>
      <ul className="space-y-1.5">
        {items.map(i => (
          <li key={i.id} className="p-2 border border-amber/15 rounded space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                value={i.label}
                onChange={e => edit(i.id, { label: e.target.value })}
                className="flex-1 bg-transparent border-b border-amber/20 focus:border-amber py-0.5 text-bone text-[12px] outline-none font-sans"
              />
              <button onClick={() => remove(i.id)} className="text-steel hover:text-danger transition" title="Remove">
                <Trash2 size={11} />
              </button>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5 font-mono text-[11px]">
              <input
                type="number"
                value={i.amount}
                onChange={e => edit(i.id, { amount: parseFloat(e.target.value) || 0 })}
                className="bg-transparent border border-amber/15 focus:border-amber/40 rounded px-1.5 py-0.5 text-bone tabular-nums outline-none"
              />
              <select
                value={i.ccy}
                onChange={e => edit(i.id, { ccy: e.target.value as 'EUR' | 'EGP' })}
                className="bg-ink2 border border-amber/15 focus:border-amber/40 rounded px-1 py-0.5 text-bone outline-none"
              >
                <option value="EGP">EGP</option>
                <option value="EUR">EUR</option>
              </select>
              <select
                value={i.cadence}
                onChange={e => edit(i.id, { cadence: e.target.value as 'monthly' | 'nightly' })}
                className="bg-ink2 border border-amber/15 focus:border-amber/40 rounded px-1 py-0.5 text-bone outline-none"
              >
                <option value="monthly">/ mo</option>
                <option value="nightly">/ night</option>
              </select>
            </div>
          </li>
        ))}
      </ul>
      <button
        onClick={add}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 border border-amber/30 text-amber hover:border-amber hover:shadow-glow-amber rounded text-[10px] tracking-[0.16em] uppercase"
      >
        <Plus size={11} /> Add stream
      </button>
    </>
  );
}

function GoalsEditor() {
  const [items, setItems] = useState<Goal[]>(() => listGoals());

  function refresh() { setItems(listGoals()); }
  function edit(id: string, patch: Partial<Goal>) {
    updateGoalLib(id, patch);
    refresh();
  }
  function add() {
    const g: Goal = { id: 'g-' + Date.now(), label: 'New goal', current: 0, target: 1000, unit: '' };
    upsertGoal(g);
    refresh();
    sfx.click();
  }
  function remove(id: string) {
    removeGoalLib(id);
    refresh();
    sfx.click();
  }

  return (
    <>
      <ul className="space-y-1.5">
        {items.map(g => {
          const live = goalCurrent(g);
          const pct = goalPct(g);
          const isLive = !!g.liveSource;
          return (
            <li key={g.id} className="p-2 border border-amber/15 rounded space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={g.label}
                  onChange={e => edit(g.id, { label: e.target.value })}
                  className="flex-1 bg-transparent border-b border-amber/20 focus:border-amber py-0.5 text-bone text-[12px] outline-none font-sans"
                />
                <span className="font-mono text-[10px] text-amber tabular-nums">{pct.toFixed(0)}%</span>
                <button onClick={() => remove(g.id)} className="text-steel hover:text-danger transition" title="Remove">
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-1.5 font-mono text-[11px]">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] tracking-[0.14em] uppercase text-steel">Current{isLive ? ' · live' : ''}</span>
                  <input
                    type="number"
                    value={isLive ? live : g.current}
                    disabled={isLive}
                    onChange={e => edit(g.id, { current: parseFloat(e.target.value) || 0 })}
                    className={'bg-transparent border border-amber/15 focus:border-amber/40 rounded px-1.5 py-0.5 text-bone tabular-nums outline-none ' + (isLive ? 'opacity-60' : '')}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] tracking-[0.14em] uppercase text-steel">Target</span>
                  <input
                    type="number"
                    value={g.target}
                    onChange={e => edit(g.id, { target: parseFloat(e.target.value) || 0 })}
                    className="bg-transparent border border-amber/15 focus:border-amber/40 rounded px-1.5 py-0.5 text-bone tabular-nums outline-none"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[9px] tracking-[0.14em] uppercase text-steel">Unit</span>
                  <input
                    value={g.unit}
                    onChange={e => edit(g.id, { unit: e.target.value })}
                    className="w-16 bg-transparent border border-amber/15 focus:border-amber/40 rounded px-1.5 py-0.5 text-bone outline-none font-sans"
                  />
                </label>
              </div>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="font-mono text-[11px] text-steel">No goals.</li>
        )}
      </ul>
      <button
        onClick={add}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 border border-amber/30 text-amber hover:border-amber hover:shadow-glow-amber rounded text-[10px] tracking-[0.16em] uppercase"
      >
        <Plus size={11} /> Add goal
      </button>
    </>
  );
}

function HabitsEditor() {
  const [items, setItems] = useState<Habit[]>(() => loadState().habits);

  function persist(next: Habit[]) {
    const s = loadState(); s.habits = next; saveState(s);
    setItems(next);
  }
  function rename(id: string, label: string) {
    persist(items.map(h => h.id === id ? { ...h, label } : h));
  }
  function remove(id: string) {
    persist(items.filter(h => h.id !== id));
    sfx.click();
  }
  function add() {
    persist([...items, { id: 'h-' + Date.now(), label: 'New habit', history: [] }]);
    sfx.click();
  }

  return (
    <>
      <ul className="space-y-1.5">
        {items.map(h => (
          <li key={h.id} className="flex items-center gap-1.5 px-2 py-1.5 border border-amber/15 rounded">
            <Flame size={11} className="text-amber/70 shrink-0" />
            <input
              value={h.label}
              onChange={e => rename(h.id, e.target.value)}
              className="flex-1 bg-transparent border-b border-amber/15 focus:border-amber py-0.5 text-bone text-[12px] outline-none font-sans"
            />
            <span className="font-mono text-[10px] text-steel tabular-nums">{h.history.length}d</span>
            <button onClick={() => remove(h.id)} className="text-steel hover:text-danger transition" title="Remove">
              <Trash2 size={11} />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={add}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 border border-amber/30 text-amber hover:border-amber hover:shadow-glow-amber rounded text-[10px] tracking-[0.16em] uppercase"
      >
        <Plus size={11} /> Add habit
      </button>
    </>
  );
}

function RemindersList() {
  const [items, setItems] = useState(() => listReminders());
  useEffect(() => {
    const t = setInterval(() => setItems(listReminders()), 5000);
    return () => clearInterval(t);
  }, []);
  if (!items.length) {
    return <p className="text-[11px] text-steel">No pending reminders. Set one with "Kai, remind me in 30 minutes to call Mira."</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map(r => {
        const ms = +new Date(r.at) - Date.now();
        const mins = Math.max(0, Math.round(ms / 60_000));
        const due = mins < 60 ? `in ${mins}m` : mins < 1440 ? `in ${Math.round(mins/60)}h` : `in ${Math.round(mins/1440)}d`;
        return (
          <li key={r.id} className="flex items-center gap-2 px-2 py-1.5 border border-amber/15 rounded">
            <MapPin size={11} className="text-amber/70 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-bone text-[12px] truncate">{r.text}</div>
              <div className="font-mono text-[10px] text-steel">{due} · {new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <button
              onClick={() => { cancelReminder(r.id); setItems(listReminders()); sfx.click(); }}
              className="text-steel hover:text-danger transition"
            >
              <X size={12} />
            </button>
          </li>
        );
      })}
    </ul>
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

/* ───────── FX rate editor ───────── */
function FxEditor() {
  const [rate, setRate] = useState<number>(() => loadState().fxEgpPerEur);
  function commit(v: number) {
    if (!Number.isFinite(v) || v <= 0) return;
    setRate(v); setFx(v);
  }
  return (
    <>
      <div className="flex items-baseline gap-2 font-mono text-[11px]">
        <span className="text-steel text-[10px] tracking-[0.18em] uppercase">1 EUR =</span>
        <input
          type="number"
          step="0.01"
          value={rate}
          onChange={e => commit(parseFloat(e.target.value))}
          className="flex-1 bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone tabular-nums outline-none"
        />
        <span className="text-steel text-[10px]">EGP</span>
      </div>
      <p className="mt-2 text-[10px] text-steel leading-relaxed">
        Used everywhere KAI converts EUR streams to EGP and back.
      </p>
    </>
  );
}

/* ───────── Garden editor ───────── */
function GardenEditor() {
  const [g, setG] = useState<GardenState>(() => loadState().garden);
  const [taskDraft, setTaskDraft] = useState('');

  function commit(patch: Partial<GardenState>) {
    const next = { ...g, ...patch };
    setG(next);
    updateGarden(patch);
  }
  function addTask() {
    const t = taskDraft.trim();
    if (!t) return;
    commit({ todayTasks: [...g.todayTasks, t] });
    setTaskDraft('');
  }
  function removeTask(i: number) {
    commit({ todayTasks: g.todayTasks.filter((_, n) => n !== i) });
  }
  function setEvent(patch: Partial<GardenState['nextEvent']>) {
    commit({ nextEvent: { ...g.nextEvent, ...patch } });
  }
  const whenLocal = (() => {
    const d = new Date(g.nextEvent.when);
    if (Number.isNaN(+d)) return '';
    /* datetime-local needs `YYYY-MM-DDTHH:mm` without TZ. */
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div className="space-y-2 font-mono text-[11px]">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Plants</span>
          <input
            type="number"
            value={g.plantCount}
            onChange={e => commit({ plantCount: parseInt(e.target.value) || 0 })}
            className="mt-1 w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone tabular-nums outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Species</span>
          <input
            type="number"
            value={g.speciesCount}
            onChange={e => commit({ speciesCount: parseInt(e.target.value) || 0 })}
            className="mt-1 w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone tabular-nums outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Next event · title</span>
        <input
          value={g.nextEvent.title}
          onChange={e => setEvent({ title: e.target.value })}
          className="mt-1 w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone outline-none font-sans"
        />
      </label>
      <label className="block">
        <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Next event · when</span>
        <input
          type="datetime-local"
          value={whenLocal}
          onChange={e => {
            const v = e.target.value;
            if (v) setEvent({ when: new Date(v).toISOString() });
          }}
          className="mt-1 w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone outline-none"
        />
      </label>

      <div>
        <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Today’s tasks</span>
        <ul className="mt-1 space-y-1">
          {g.todayTasks.map((t, i) => (
            <li key={i} className="flex items-center gap-1.5 px-2 py-1 border border-amber/10 rounded">
              <span className="text-amber/70 shrink-0">·</span>
              <input
                value={t}
                onChange={e => {
                  const next = [...g.todayTasks]; next[i] = e.target.value;
                  commit({ todayTasks: next });
                }}
                className="flex-1 bg-transparent border-b border-amber/10 focus:border-amber py-0.5 text-bone outline-none font-sans"
              />
              <button onClick={() => removeTask(i)} className="text-steel hover:text-danger transition">
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1.5 mt-1.5">
          <input
            value={taskDraft}
            onChange={e => setTaskDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Add a task…"
            className="flex-1 bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone outline-none font-sans"
          />
          <button onClick={addTask}
            className="px-2 border border-amber/40 text-amber hover:border-amber rounded">
            <Plus size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Makadi editor ───────── */
function MakadiEditor() {
  const [m, setM] = useState<MakadiState>(() => loadState().makadi);

  function commit(patch: Partial<MakadiState>) {
    const next = { ...m, ...patch };
    setM(next);
    updateMakadi(patch);
  }
  const bookingLocal = (() => {
    const d = new Date(m.nextBooking);
    if (Number.isNaN(+d)) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  return (
    <div className="space-y-2 font-mono text-[11px]">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Nightly · EGP</span>
          <input
            type="number"
            value={m.nightlyRate}
            onChange={e => commit({ nightlyRate: parseFloat(e.target.value) || 0 })}
            className="mt-1 w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone tabular-nums outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Occupancy · %</span>
          <input
            type="number"
            min={0} max={100} step="1"
            value={Math.round(m.occupancy30d * 100)}
            onChange={e => commit({ occupancy30d: Math.max(0, Math.min(1, (parseFloat(e.target.value) || 0) / 100)) })}
            className="mt-1 w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone tabular-nums outline-none"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Next booking</span>
        <input
          type="datetime-local"
          value={bookingLocal}
          onChange={e => { const v = e.target.value; if (v) commit({ nextBooking: new Date(v).toISOString() }); }}
          className="mt-1 w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone outline-none"
        />
      </label>
      <label className="block">
        <span className="text-[10px] tracking-[0.18em] uppercase text-steel">Rating</span>
        <input
          type="number" min={0} max={5} step="0.01"
          value={m.rating}
          onChange={e => commit({ rating: Math.max(0, Math.min(5, parseFloat(e.target.value) || 0)) })}
          className="mt-1 w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone tabular-nums outline-none"
        />
      </label>
      <Toggle label="Door-lock flag" value={m.fixLock} onChange={v => commit({ fixLock: v })} />
    </div>
  );
}

/* ───────── Instagram editor ───────── */
function InstagramEditor() {
  const [items, setItems] = useState<IgAccount[]>(() => loadState().instagram);
  const [draft, setDraft] = useState('');

  function refresh() { setItems(loadState().instagram); }
  function setFollowers(handle: string, v: number) {
    upsertInstagram(handle, Math.max(0, Math.round(v) || 0));
    refresh();
  }
  function remove(handle: string) {
    removeInstagram(handle); refresh(); sfx.click();
  }
  function add() {
    const h = draft.trim();
    if (!h) return;
    upsertInstagram(h, 0);
    setDraft(''); refresh(); sfx.click();
  }

  return (
    <>
      <ul className="space-y-1.5">
        {items.map(a => (
          <li key={a.handle} className="flex items-center gap-2 px-2 py-1.5 border border-amber/15 rounded">
            <AtSign size={11} className="text-amber/70 shrink-0" />
            <span className="font-sans text-bone text-[12px] flex-1 truncate">{a.handle}</span>
            <input
              type="number"
              value={a.followers}
              onChange={e => setFollowers(a.handle, parseFloat(e.target.value))}
              className="w-24 font-mono bg-transparent border border-amber/15 focus:border-amber/40 rounded px-1.5 py-0.5 text-bone tabular-nums outline-none text-[11px]"
            />
            <button onClick={() => remove(a.handle)} className="text-steel hover:text-danger transition" title="Remove">
              <Trash2 size={11} />
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="font-mono text-[11px] text-steel">No accounts yet.</li>
        )}
      </ul>
      <div className="flex gap-1.5 mt-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="@handle"
          className="flex-1 bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1 text-bone text-[11px] outline-none font-mono"
        />
        <button onClick={add}
          className="px-2 border border-amber/40 text-amber hover:border-amber rounded">
          <Plus size={11} />
        </button>
      </div>
    </>
  );
}

/* ── Security · biometric / PIN lock ────────────────────
   Device-local convenience lock. Turning the lock OFF
   requires passing the lock once. Re-enrolment of Face ID
   and PIN change live here too. */
function SecurityEditor() {
  const [cfg, setCfg] = useState<LockConfig>(() => loadLockConfig());
  const [hasPlatform, setHasPlatform] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [verifyPinInput, setVerifyPinInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok,  setOk]  = useState<string | null>(null);

  useEffect(() => {
    platformAuthAvailable().then(setHasPlatform);
  }, []);

  function refresh() { setCfg(loadLockConfig()); }
  function flash(message: string) { setOk(message); setTimeout(() => setOk(null), 2400); }

  async function toggleLock(next: boolean) {
    setErr(null);
    if (next) {
      if (!cfg.credentialId && !cfg.pinHash) {
        setErr('Register Face ID or set a PIN before turning the lock on.');
        return;
      }
      const updated = { ...cfg, enabled: true, offered: true };
      saveLockConfig(updated); setCfg(updated);
      flash('Lock armed.');
      return;
    }

    /* Turning OFF requires passing the lock — biometric preferred,
       PIN fallback. */
    setBusy(true);
    try {
      let passed = false;
      if (cfg.credentialId && webAuthnSupported()) {
        passed = await verifyCredential(cfg.credentialId);
      }
      if (!passed && cfg.pinHash) {
        const entered = window.prompt('Enter your PIN to disable the lock:');
        if (entered) passed = await verifyPin(entered, cfg);
      }
      if (!passed) { setErr('Could not verify — lock left on.'); return; }
      const updated = { ...cfg, enabled: false };
      saveLockConfig(updated); setCfg(updated);
      flash('Lock disabled.');
    } catch (e: any) {
      setErr(humanize(e));
    } finally {
      setBusy(false);
    }
  }

  async function enrollBiometric() {
    setErr(null); setBusy(true);
    try {
      const id = await registerCredential('KAI Operator');
      const updated = { ...loadLockConfig(), credentialId: id, offered: true };
      saveLockConfig(updated); setCfg(updated);
      flash('Biometric registered.');
    } catch (e: any) {
      setErr(humanize(e));
    } finally {
      setBusy(false);
    }
  }

  function clearBiometric() {
    const updated = { ...cfg, credentialId: undefined };
    /* If that was the only unlock method and the lock was on, force
       it off so the user can't lock themselves out. */
    if (!updated.pinHash) updated.enabled = false;
    saveLockConfig(updated); setCfg(updated);
    flash('Biometric cleared.');
  }

  async function savePinFlow() {
    setErr(null);
    if (pin1 !== pin2)                   { setErr("PINs don't match.");        return; }
    if (!/^\d{4,6}$/.test(pin1))         { setErr('PIN must be 4-6 digits.');  return; }
    /* Changing a PIN when one exists requires verifying the old one. */
    if (cfg.pinHash) {
      if (!verifyPinInput)               { setErr('Enter the current PIN.');   return; }
      const ok = await verifyPin(verifyPinInput, cfg);
      if (!ok)                           { setErr('Current PIN is wrong.');    return; }
    }
    try {
      const updated = await setPin(pin1, { ...loadLockConfig(), offered: true });
      saveLockConfig(updated); setCfg(updated);
      setPin1(''); setPin2(''); setVerifyPinInput('');
      flash('PIN saved.');
    } catch (e: any) {
      setErr(e?.message || 'Could not save PIN.');
    }
  }

  function clearPin() {
    const updated = { ...cfg, pinHash: undefined, pinSalt: undefined };
    if (!updated.credentialId) updated.enabled = false;
    saveLockConfig(updated); setCfg(updated);
    flash('PIN cleared.');
  }

  function fullReset() {
    if (!confirm('Wipe the lock entirely? You will be asked to set it up again next launch.')) return;
    clearLock(); refresh(); flash('Lock reset.');
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-steel/80 leading-relaxed">
        Device-local convenience lock — no backend verification. Uses your
        platform authenticator (Face&nbsp;ID, Touch&nbsp;ID, Windows&nbsp;Hello,
        Android biometric). PIN is the backup so you can't be locked out.
      </p>

      <Toggle
        label="Require lock on launch"
        value={cfg.enabled}
        onChange={toggleLock}
      />

      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-steel">
          <Fingerprint size={11} /> Biometric
          {cfg.credentialId && <span className="text-emerald normal-case tracking-normal">· registered</span>}
        </div>
        {webAuthnSupported() ? (
          <div className="flex gap-2">
            <button
              onClick={enrollBiometric}
              disabled={busy}
              className="flex-1 px-2 py-1.5 border border-amber/40 text-amber rounded hover:border-amber hover:bg-amber/10 text-[11px] tracking-[0.14em] uppercase disabled:opacity-50"
            >
              {cfg.credentialId ? 'Re-enrol' : (hasPlatform ? 'Enrol Face ID / biometric' : 'Try biometric')}
            </button>
            {cfg.credentialId && (
              <button
                onClick={clearBiometric}
                className="px-2 py-1.5 border border-steel/30 text-steel rounded hover:text-bone hover:border-steel text-[11px] tracking-[0.14em] uppercase"
                title="Forget biometric credential"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ) : (
          <div className="text-steel/80 text-[11px] leading-relaxed">
            WebAuthn isn't available in this browser. PIN-only.
          </div>
        )}
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase text-steel">
          <KeyRound size={11} /> PIN
          {cfg.pinHash && <span className="text-emerald normal-case tracking-normal">· set</span>}
        </div>
        {cfg.pinHash && (
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={verifyPinInput}
            onChange={e => setVerifyPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Current PIN"
            className="w-full bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone tabular-nums tracking-[0.3em] outline-none"
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin1}
            onChange={e => setPin1(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={cfg.pinHash ? 'New PIN' : 'PIN'}
            className="bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone tabular-nums tracking-[0.3em] outline-none"
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin2}
            onChange={e => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Confirm"
            className="bg-transparent border border-amber/20 focus:border-amber rounded px-2 py-1.5 text-bone tabular-nums tracking-[0.3em] outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={savePinFlow}
            className="flex-1 px-2 py-1.5 border border-amber/40 text-amber rounded hover:border-amber hover:bg-amber/10 text-[11px] tracking-[0.14em] uppercase"
          >
            {cfg.pinHash ? 'Change PIN' : 'Set PIN'}
          </button>
          {cfg.pinHash && (
            <button
              onClick={clearPin}
              className="px-2 py-1.5 border border-steel/30 text-steel rounded hover:text-bone hover:border-steel text-[11px] tracking-[0.14em] uppercase"
              title="Forget PIN"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {err && <div className="text-danger text-[11px] leading-relaxed">{err}</div>}
      {ok  && !err && <div className="text-emerald text-[11px] leading-relaxed">{ok}</div>}

      <button
        onClick={fullReset}
        className="w-full px-2 py-1.5 border border-steel/30 text-steel rounded hover:text-bone hover:border-steel text-[10px] tracking-[0.18em] uppercase"
      >
        Reset lock state
      </button>
    </div>
  );

  function humanize(e: any): string {
    const name = String(e?.name || '');
    if (name === 'NotAllowedError')   return 'Cancelled or timed out.';
    if (name === 'SecurityError')     return 'Origin not allowed by the authenticator.';
    if (name === 'InvalidStateError') return 'A credential is already registered.';
    if (name === 'NotSupportedError') return 'No platform authenticator on this device.';
    return String(e?.message || 'Authenticator error.').slice(0, 140);
  }
}

