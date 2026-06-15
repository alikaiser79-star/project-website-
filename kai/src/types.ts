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
};

export type ChatTurn = { you: string; kai: string; at: string; streamed?: boolean };

export type JournalEntry = { id: string; text: string; at: string };

/* habit.history: ISO-day strings the habit was checked on */
export type Habit = { id: string; label: string; history: string[] };

export type Reminder = { id: string; text: string; at: string; fired?: boolean };

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
};
