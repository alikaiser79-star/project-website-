import type { KaiPersisted } from '../types';
import { defaultPriorities, debt, operator } from '../kaiConfig';

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
  },
  debtCurrent: debt.current,
  history: [],
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
    };
  } catch { return { ...defaults }; }
}

export function saveState(s: KaiPersisted) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
