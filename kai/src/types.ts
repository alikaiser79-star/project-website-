export type Priority = { id: string; text: string; done: boolean };

export type Accent = 'amber' | 'cyan' | 'emerald';

export type KaiSettings = {
  voiceEnabled: boolean;
  soundEnabled: boolean;
  voiceRate: number;     // 0.6 – 1.4
  voicePitch: number;    // 0.6 – 1.2
  voiceName?: string;    // browser voice name override
  accent: Accent;
  operatorName: string;
};

export type ChatTurn = { you: string; kai: string; at: string };

export type KaiPersisted = {
  priorities: Priority[];
  settings: KaiSettings;
  debtCurrent: number;
  history: ChatTurn[];
};
