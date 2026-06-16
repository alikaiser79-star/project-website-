/* ============================================================
   KAI — central config
   Edit every number, name, and target from here.
   ============================================================ */

export const operator = {
  name: 'Ali',
  timezone: 'Africa/Cairo',
  locale: 'en-GB',
  /* Cairo coordinates — used by the weather feed in IntelStrip. */
  lat: 30.0444,
  lon: 31.2357,
  cityLabel: 'Cairo',
};

/* Currency — KAI normalises everything to EGP for the headline. */
export const currency = {
  egpPerEur: 53.5,          // Update freely
  primary: 'EGP' as const,
};

/* ── INCOME STREAMS ───────────────────────────────────── */
export type IncomeStream = {
  id: string;
  label: string;
  amount: number;            // raw amount in `ccy`
  ccy: 'EUR' | 'EGP';
  cadence: 'monthly' | 'nightly';
  trend?: number;            // % vs last month, signed
  note?: string;
};

export const income: IncomeStream[] = [
  { id: 'enpal',   label: 'Enpal Solar',         amount: 620,    ccy: 'EUR', cadence: 'monthly', trend:  0.0, note: 'Germany · solar lease' },
  { id: 'honda',   label: 'Honda Civic Rental',  amount: 16000,  ccy: 'EGP', cadence: 'monthly', trend:  2.1, note: 'long-term lease' },
  { id: 'garden',  label: 'Hidden Garden',       amount: 28000,  ccy: 'EGP', cadence: 'monthly', trend:  6.4, note: 'events + plant sales' },
  { id: 'makadi',  label: 'Makadi Airbnb',       amount: 1800,   ccy: 'EGP', cadence: 'nightly', trend: -1.2, note: '~22 nights / month avg' },
];

/* ── DEBT ─────────────────────────────────────────────── */
export const debt = {
  label: 'Credit Card',
  original: 75000,    // EGP — starting balance KAI tracks against
  current:  41500,    // EGP — current outstanding
  apr: 38,
  minPayment: 4200,
};

/* ── HIDDEN GARDEN ────────────────────────────────────── */
export const garden = {
  plantCount: 112,
  speciesCount: 24,
  todayTasks: [
    'Water bird-of-paradise row',
    'Prune lemon tree south side',
    'Repot the four new monsteras',
  ],
  nextEvent: {
    title: 'Garden Sunset Listening',
    when: nextSaturdayAt(18, 30),
  },
};

/* ── MAKADI AIRBNB ────────────────────────────────────── */
export const makadi = {
  nightlyRate: 1800,   // EGP
  occupancy30d: 0.72,
  nextBooking: addDays(3),
  fixLock: true,      // true = door lock needs attention
  rating: 4.91,
};

/* ── INSTAGRAM ────────────────────────────────────────── */
export const instagram = {
  accounts: [
    { handle: '@alikaiser1',      followers: 14200, weekly: [13780, 13860, 13950, 14010, 14080, 14150, 14200] },
    { handle: '@hiddengarden.eg', followers:  8640, weekly: [ 8220,  8300,  8390,  8450,  8520,  8580,  8640] },
  ],
};

/* ── LONG-TERM GOALS ──────────────────────────────────── */
export type Goal = {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  /* Lower current is "better" for paydown-style goals. */
  lowerIsBetter?: boolean;
};

export const defaultGoals: Goal[] = [
  { id: 'g-debt',     label: 'Clear credit card',    current: 41500, target: 0,    unit: 'EGP', lowerIsBetter: true },
  { id: 'g-savings',  label: 'Emergency fund',       current: 32000, target: 100000, unit: 'EGP' },
  { id: 'g-plants',   label: 'Hidden Garden plants', current: 112,   target: 200,    unit: '' },
  { id: 'g-ig',       label: '@hiddengarden.eg',     current: 8640,  target: 25000,  unit: 'followers' },
];

/* ── PRIORITIES (default list when KAI first boots) ───── */
export const defaultPriorities = [
  { id: 'p1', text: 'Pay 6,000 EGP toward credit card',     done: false },
  { id: 'p2', text: 'Call Makadi locksmith for fix lock',   done: false },
  { id: 'p3', text: 'Film Hidden Garden weekly reel',       done: false },
  { id: 'p4', text: 'Audit Enpal contract renewal date',    done: false },
  { id: 'p5', text: 'Plan Sunset Listening guest list',     done: false },
];

/* ── COMMAND-BAR / CLAUDE API ─────────────────────────── */
/* Drop your Anthropic API key here, OR set VITE_ANTHROPIC_API_KEY in a
   `.env.local` file. The command bar falls back to scripted answers when
   no key is present. See README. */
export const claudeConfig = {
  model: 'claude-sonnet-4-6',
  apiKey: (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) || '',
  enabled: true,
  systemPrompt:
    `You are KAI — Ali Kaiser's personal command core, a calm, dry, slightly British AI ` +
    `assistant. Speak in short, precise sentences. Reference Ali's domains: Enpal income, ` +
    `Honda Civic rental, Hidden Garden, Makadi Airbnb, Instagram (@alikaiser1, ` +
    `@hiddengarden.eg), credit-card paydown. Never invent numbers — call get_state_snapshot ` +
    `before answering anything fact-based. Use tools to actually act: add_reminder when Ali ` +
    `asks to be reminded; cancel_reminder / snooze_reminder when he asks to cancel or push ` +
    `one back; add_journal for "note/log/remember"; add_priority for new todos; ` +
    `complete_priority when he says a todo is done; mark_habit when he ticks a habit; ` +
    `start_focus for "focus N min" / "pomodoro"; apply_debt_payment when he says he paid ` +
    `something. Confirm in a single short sentence after.`,
};

/* ── HELPERS ──────────────────────────────────────────── */
function nextSaturdayAt(h: number, m: number) {
  const d = new Date();
  const diff = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(15, 0, 0, 0);
  return d.toISOString();
}

export function toEGP(amount: number, ccy: 'EUR' | 'EGP') {
  return ccy === 'EUR' ? amount * currency.egpPerEur : amount;
}
export function monthlyTotalEGP(): number {
  return income.reduce((sum, s) => {
    const base = toEGP(s.amount, s.ccy);
    return sum + (s.cadence === 'nightly' ? base * 22 : base);
  }, 0);
}
export function debtClearedPct(): number {
  const cleared = Math.max(0, debt.original - debt.current);
  return Math.min(100, (cleared / debt.original) * 100);
}
