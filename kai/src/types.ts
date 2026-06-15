export type Priority = { id: string; text: string; done: boolean };

export type KaiSettings = {
  voiceEnabled: boolean;
  soundEnabled: boolean;
};

export type KaiPersisted = {
  priorities: Priority[];
  settings: KaiSettings;
  debtCurrent: number;
  history: Array<{ t: string; you: string; kai: string }>;
};
