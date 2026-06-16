export type Priority = { id: string; text: string; done: boolean };

export type Accent = 'amber' | 'cyan' | 'emerald';

export type KaiSettings = {
  voiceEnabled: boolean;
  soundEnabled: boolean;
  voiceRate: number;
  voicePitch: number;
  voiceName?: string;
  accent: Accent;
  operatorName: string;
  onboarded: boolean;
  notifications: boolean;
  wakeWord: boolean;
};

export type ChatTurn = { you: string; kai: string; at: string; streamed?: boolean };

export type JournalEntry = { id: string; text: string; at: string };

/* habit.history: ISO-day strings the habit was checked on */
export type Habit = { id: string; label: string; history: string[] };

export type Reminder = { id: string; text: string; at: string; fired?: boolean };

/* Editable runtime overrides for income streams. id matches kaiConfig.income[].id;
   custom streams (added from the UI) live here too with the same shape. */
export type Snapshot = {
  d: string;           // ISO day YYYY-MM-DD
  debt: number;
  incomeMonthly: number;
  prioritiesOpen: number;
  prioritiesDone: number;
  habitsToday: number;
  journalCount: number;
  igFollowers: number;
};

export type IncomeOverride = {
  id: string;
  label: string;
  amount: number;
  ccy: 'EUR' | 'EGP';
  cadence: 'monthly' | 'nightly';
  note?: string;
  trend?: number;
  custom?: boolean;
};

/* Track in-progress numbers per goal (target/label live in kaiConfig). */
export type GoalState = { id: string; current: number };

export type KaiPersisted = {
  priorities: Priority[];
  settings: KaiSettings;
  debtCurrent: number;
  history: ChatTurn[];
  journal: JournalEntry[];
  habits: Habit[];
  reminders: Reminder[];
  goals: GoalState[];
  income: IncomeOverride[];
  snapshots: Snapshot[];
};
