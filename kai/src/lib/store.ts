import type {
  KaiPersisted, IncomeOverride, GardenState, MakadiState, IgAccount,
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
  goals: defaultGoals.map(g => ({ id: g.id, current: g.current })),
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
};

export function loadState(): KaiPersisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw) as Partial<KaiPersisted>;
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      priorities: parsed.priorities && parsed.priorities.length ? parsed.priorities : defaults.priorities,
      journal: parsed.journal ?? [],
      habits: parsed.habits && parsed.habits.length ? parsed.habits : defaults.habits,
      reminders: parsed.reminders ?? [],
      goals: parsed.goals && parsed.goals.length ? parsed.goals : defaults.goals,
      income: parsed.income && parsed.income.length ? parsed.income : defaults.income,
      snapshots: parsed.snapshots ?? [],
      garden:    { ...defaults.garden,   ...(parsed.garden   || {}) },
      makadi:    { ...defaults.makadi,   ...(parsed.makadi   || {}) },
      instagram: parsed.instagram && parsed.instagram.length ? parsed.instagram : defaults.instagram,
      fxEgpPerEur: typeof parsed.fxEgpPerEur === 'number' && parsed.fxEgpPerEur > 0
        ? parsed.fxEgpPerEur
        : defaults.fxEgpPerEur,
    };
  } catch { return cloneDefaults(); }
}

export function saveState(s: KaiPersisted) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

function cloneDefaults(): KaiPersisted {
  return JSON.parse(JSON.stringify(defaults));
}

/* ── Live-data accessors ───────────────────────────────────────
   Components read these instead of importing from kaiConfig so that
   edits in the Settings drawer and Claude tool calls take effect
   without a reload. */

export function getGarden(): GardenState   { return loadState().garden; }
export function getMakadi(): MakadiState   { return loadState().makadi; }
export function getInstagram(): IgAccount[]{ return loadState().instagram; }
export function getFx(): number            { return loadState().fxEgpPerEur; }

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
  const idx = s.instagram.findIndex(a => String(a.handle ?? '').toLowerCase() === norm.toLowerCase());
  if (idx >= 0) s.instagram[idx] = { ...s.instagram[idx], followers };
  else          s.instagram = [...s.instagram, { handle: norm, followers }];
  saveState(s);
}
export function removeInstagram(handle: string) {
  const h = String(handle ?? '').trim().toLowerCase();
  if (!h) return;
  const s = loadState();
  s.instagram = s.instagram.filter(a => String(a.handle ?? '').toLowerCase() !== h);
  saveState(s);
}
export function setFx(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) return;
  const s = loadState();
  s.fxEgpPerEur = rate;
  saveState(s);
}
