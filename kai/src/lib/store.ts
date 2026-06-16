import type { KaiPersisted, IncomeOverride } from '../types';
import { defaultPriorities, defaultGoals, income as configIncome, debt, operator } from '../kaiConfig';

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
};

export function loadState(): KaiPersisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
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
    };
  } catch { return { ...defaults }; }
}

export function saveState(s: KaiPersisted) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
