import type {
  KaiPersisted, IncomeOverride, GardenState, MakadiState, IgAccount, Goal,
} from '../types';
import {
  defaultPriorities, defaultGoals, income as configIncome,
  debt, operator, garden as configGarden, makadi as configMakadi,
  instagram as configInstagram, currency,
} from '../kaiConfig';

const KEY = 'kai.state.v1';

export const defaults: KaiPersisted = {
  priorities: defaultPriorities,
  settings: {
    voiceEnabled: false,
    soundEnabled: true,
    voiceRate: 1.0,
    voicePitch: 0.85,
    accent: 'amber',
    operatorName: operator.name,
    onboarded: false,
    notifications: false,
    wakeWord: true,
  },
  debtCurrent: debt.current,
  history: [],
  journal: [],
  habits: [
    { id: 'h1', label: 'Workout',      history: [] },
    { id: 'h2', label: 'Read 20m',     history: [] },
    { id: 'h3', label: 'Garden visit', history: [] },
    { id: 'h4', label: 'No takeaway',  history: [] },
  ],
  reminders: [],
  goals: defaultGoals,
  income: configIncome.map<IncomeOverride>(s => ({
    id: s.id, label: s.label, amount: s.amount, ccy: s.ccy,
    cadence: s.cadence, note: s.note, trend: s.trend,
  })),
  snapshots: [],
  garden: {
    plantCount:   configGarden.plantCount,
    speciesCount: configGarden.speciesCount,
    todayTasks:   [...configGarden.todayTasks],
    nextEvent:    { title: configGarden.nextEvent.title, when: configGarden.nextEvent.when },
  },
  makadi: {
    nightlyRate:  configMakadi.nightlyRate,
    occupancy30d: configMakadi.occupancy30d,
    nextBooking:  configMakadi.nextBooking,
    fixLock:      configMakadi.fixLock,
    rating:       configMakadi.rating,
  },
  instagram: configInstagram.accounts.map<IgAccount>(a => ({
    handle: a.handle, followers: a.followers,
  })),
  fxEgpPerEur: currency.egpPerEur,
  expenses: [],
};

/* Migrate a legacy `goals: GoalState[]` ({id, current}) array into
   the new full Goal[] shape using the defaults as the source of label
   / target / liveSource. Unknown ids are dropped. */
function migrateGoals(parsed: any): Goal[] {
  if (!Array.isArray(parsed)) return defaultGoals;
  if (parsed.length === 0) return defaultGoals;
  const sample = parsed[0];
  const looksFull = sample && typeof sample === 'object' && 'label' in sample && 'target' in sample;
  if (looksFull) {
    return parsed.filter(g => g && typeof g === 'object' && typeof g.id === 'string')
                 .map(g => ({
                   id: String(g.id),
                   label: String(g.label ?? ''),
                   current: Number(g.current) || 0,
                   target: Number(g.target) || 0,
                   unit: String(g.unit ?? ''),
                   lowerIsBetter: !!g.lowerIsBetter,
                   liveSource: g.liveSource,
                   liveHandle: g.liveHandle,
                 }));
  }
  /* Legacy {id, current} shape — merge with defaults */
  const out: Goal[] = [];
  for (const def of defaultGoals) {
    const old = parsed.find((p: any) => p && p.id === def.id);
    out.push({ ...def, current: old ? (Number(old.current) || def.current) : def.current });
  }
  return out;
}

export function loadState(): KaiPersisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as Partial<KaiPersisted> & { goals?: any };

    /* Every field reaches a known-good value even if the persisted
       payload is partial, mis-shaped, or completely missing the key. */
    return {
      ...defaults,
      ...parsed,
      settings:   { ...defaults.settings, ...(parsed.settings || {}) },
      priorities: Array.isArray(parsed.priorities) && parsed.priorities.length ? parsed.priorities : defaults.priorities,
      history:    Array.isArray(parsed.history)    ? parsed.history    : [],
      journal:    Array.isArray(parsed.journal)    ? parsed.journal    : [],
      habits:     Array.isArray(parsed.habits) && parsed.habits.length    ? parsed.habits    : defaults.habits,
      reminders:  Array.isArray(parsed.reminders)  ? parsed.reminders  : [],
      goals:      migrateGoals(parsed.goals),
      income:     Array.isArray(parsed.income) && parsed.income.length    ? parsed.income    : defaults.income,
      snapshots:  Array.isArray(parsed.snapshots)  ? parsed.snapshots  : [],
      garden:     { ...defaults.garden,   ...(parsed.garden   || {}),
                    nextEvent: { ...defaults.garden.nextEvent, ...((parsed.garden as any)?.nextEvent || {}) },
                    todayTasks: Array.isArray((parsed.garden as any)?.todayTasks) ? (parsed.garden as any).todayTasks : defaults.garden.todayTasks },
      makadi:     { ...defaults.makadi,   ...(parsed.makadi   || {}) },
      instagram:  Array.isArray(parsed.instagram) && parsed.instagram.length
                    ? parsed.instagram.filter((a: any) => a && typeof a === 'object')
                    : defaults.instagram,
      fxEgpPerEur: typeof parsed.fxEgpPerEur === 'number' && parsed.fxEgpPerEur > 0
        ? parsed.fxEgpPerEur
        : defaults.fxEgpPerEur,
      expenses: Array.isArray(parsed.expenses)
        ? parsed.expenses.filter((e: any) =>
            e && typeof e === 'object' && typeof e.id === 'string' && typeof e.total === 'number')
        : [],
    };
  } catch { return cloneDefaults(); }
}

export function saveState(s: KaiPersisted) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

function cloneDefaults(): KaiPersisted {
  return JSON.parse(JSON.stringify(defaults));
}

/* ── Live-data accessors ───────────────────────────────────── */

export function getGarden(): GardenState    { return loadState().garden; }
export function getMakadi(): MakadiState    { return loadState().makadi; }
export function getInstagram(): IgAccount[] { return loadState().instagram; }
export function getFx(): number             { return loadState().fxEgpPerEur; }

export function updateGarden(patch: Partial<GardenState>) {
  const s = loadState();
  s.garden = { ...s.garden, ...patch };
  saveState(s);
}
export function updateMakadi(patch: Partial<MakadiState>) {
  const s = loadState();
  s.makadi = { ...s.makadi, ...patch };
  saveState(s);
}
export function upsertInstagram(handle: string, followers: number) {
  const h = String(handle ?? '').trim();
  if (!h) return;
  const norm = h.startsWith('@') ? h : '@' + h;
  const s = loadState();
  const idx = s.instagram.findIndex(a => String(a?.handle ?? '').toLowerCase() === norm.toLowerCase());
  if (idx >= 0) s.instagram[idx] = { ...s.instagram[idx], followers };
  else          s.instagram = [...s.instagram, { handle: norm, followers }];
  saveState(s);
}
export function removeInstagram(handle: string) {
  const h = String(handle ?? '').trim().toLowerCase();
  if (!h) return;
  const s = loadState();
  s.instagram = s.instagram.filter(a => String(a?.handle ?? '').toLowerCase() !== h);
  saveState(s);
}
export function setFx(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return;
  const s = loadState();
  s.fxEgpPerEur = rate;
  saveState(s);
}
