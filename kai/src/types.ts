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

/* Editable live values that used to live in kaiConfig. */
export type GardenState = {
  plantCount: number;
  speciesCount: number;
  todayTasks: string[];
  nextEvent: { title: string; when: string };
};
export type MakadiState = {
  nightlyRate: number;
  occupancy30d: number;     // 0..1
  nextBooking: string;
  fixLock: boolean;
  rating: number;
};
export type IgAccount = { handle: string; followers: number };

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
  igByHandle?: Record<string, number>;
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

/* A goal is now FULLY editable from the UI — label, target, current,
   plus an optional `liveSource` that wires the current value to live
   store data (debt, plant count, ig followers). */
export type GoalLiveSource = 'debt' | 'plants' | 'ig-by-handle' | 'ig-total';
export type Goal = {
  id: string;
  label: string;
  current: number;          // ignored when liveSource is set
  target: number;
  unit: string;
  lowerIsBetter?: boolean;
  liveSource?: GoalLiveSource;
  liveHandle?: string;      // when liveSource === 'ig-by-handle'
};

/* Legacy persisted goal — just {id, current}. Used only for migrating
   older saves into the new full Goal shape. */
export type GoalState = { id: string; current: number };

/* Receipts / expenses — a single uploaded receipt or manual entry.
   date is ISO YYYY-MM-DD; total is in `currency`. category is the
   short fixed-set string (see lib/expenses.ts). */
export type ExpenseCategory =
  | 'groceries' | 'dining' | 'fuel' | 'transport' | 'shopping' | 'bills' | 'other';
export type Expense = {
  id: string;
  merchant: string;
  total: number;
  currency: string;        // ISO 4217 code, e.g. 'EGP', 'EUR'
  date: string;            // YYYY-MM-DD
  category: ExpenseCategory;
};

/* Content queue — a saved planned reel/carousel/story.
   account/format are constrained sets so panel rendering can branch.
   shotlist is 2-4 short lines, hashtags are 3-5 normalised "#tag"s. */
export type ContentAccount = 'ali' | 'garden';
export type ContentFormat  = 'reel' | 'carousel' | 'story';
export type ContentStatus  = 'idea' | 'shot' | 'posted';
export type ContentItem = {
  id: string;
  slot: string;
  account: ContentAccount;
  format: ContentFormat;
  hook: string;
  shotlist: string[];
  caption: string;
  hashtags: string[];
  status: ContentStatus;
  createdAt: string;
};

export type KaiPersisted = {
  priorities: Priority[];
  settings: KaiSettings;
  debtCurrent: number;
  history: ChatTurn[];
  journal: JournalEntry[];
  habits: Habit[];
  reminders: Reminder[];
  goals: Goal[];
  income: IncomeOverride[];
  snapshots: Snapshot[];
  garden: GardenState;
  makadi: MakadiState;
  instagram: IgAccount[];
  fxEgpPerEur: number;
  expenses: Expense[];
  contentQueue: ContentItem[];
  /* Liquid cash on hand in EGP — the numerator of the Tollgate
     runway. Editable in Settings; 0 means "not set yet". */
  liquidCash: number;
};
