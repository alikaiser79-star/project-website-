export type Priority = { id: string; text: string; done: boolean };

export type Accent = 'amber' | 'cyan' | 'emerald';

/* Every money value in KAI carries one of these — no bare numbers with
   assumed units. EGP is the operator's home/headline currency; USD is
   the Makadi listing currency; EUR is Enpal (and future agency work). */
export type Currency = 'EGP' | 'USD' | 'EUR';

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
  /* Voice Out (§6.6) — speechSynthesis TTS for Ask-KAI answers and
     ONE THING. Off by default. */
  speakEnabled?: boolean;
  /* Haptic pulse (§7.10) — vibrate while an organ calls. On by
     default where supported (Android); iOS Safari has no vibration. */
  haptics?: boolean;
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
  rateCcy: Currency;        // currency of nightlyRate — Makadi lists in USD
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
  ccy: Currency;
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

/* ── DER GÄRTNER (§10) — the Garten Codex plant registry ──
   Each plant/tree is a living record. Full-resolution photos live
   in IndexedDB (on-device); only a small thumbnail dataURL rides in
   the record, and captures append to the plant's own history. */
export type PlantHealth = 'thriving' | 'watch' | 'ailing' | 'unknown';
export type IdConfidence = 'high' | 'med' | 'low';

export type PlantPhoto = {
  id: string;             // also the IndexedDB key for the full image
  thumb: string;          // small JPEG dataURL (~120px) — cheap to keep in the record
  at: number;             // ms
  note?: string;          // e.g. the health read this capture produced
};

export type PlantDiagnosis = {
  at: number;
  identification?: string;
  health?: string;
  confidence?: IdConfidence;
  move?: string;          // the one action now
  watchFor?: string;      // re-check in 7 days
  photoId?: string;       // the capture this diagnosis came from
};

export type Plant = {
  id: string;
  name: string;
  species?: string;
  speciesConfidence?: IdConfidence;
  zone?: string;                 // where in the garden
  plantedAt?: number;            // ms, when known
  ageYears?: number;             // manual, for heritage trees whose exact date is lost
  heritage?: string;             // provenance note (e.g. planted by Horst Kaiser; legal evidence)
  health: PlantHealth;
  lastWateredAt?: number;
  photos: PlantPhoto[];          // capture history (thumbnails)
  diagnoses: PlantDiagnosis[];   // AI reads over time
  carePlan?: string;             // §10.3 masterplan text
  waterEveryDays?: number;       // §10.3 schedule cadence
  notes?: string;
  createdAt: number;
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

/* ── ORGAN SIGNAL ────────────────────────────────────────────
   Lived in commandCore.ts (the V4 renderer). V6 replaced V4 for every
   actual render, but rewind.ts and commandSignals.ts still imported
   this ONE TYPE from it — so 55 KB of superseded animation code shipped
   in every bundle to carry an interface. It lives here now, and
   commandCore.ts is gone. Deliberately NOT placed in src/lib/kai/:
   the §50 freeze blocks new modules there, and this is a relocation,
   not a section. */
export interface OrganSignal {
  formatted: string;            // display value, e.g. "$12,480"
  calling: boolean;             // domain says "needs you"
  victory?: boolean;            // §9 — a money milestone landed; pulse GOLD, not crimson
  intensity?: number;           // 0..1 call strength (default 1). <1 = a gentle call, not an urgent one.
}
