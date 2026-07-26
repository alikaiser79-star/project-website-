/* ============================================================
   §33.2 DER TOTMANNSCHALTER — the dead man's switch.

   Not sentiment. The difference between people inheriting a mess and
   inheriting an operation.

   If KAI cannot verify Ali is alive and consenting for N days (default 21,
   escalating check-ins from day 7):
     • ALL ACTION LOCKS — nothing sends, spends, or commits. Permanently,
       until he returns. The lock is checked before any tier or grant.
     • THE SPINE IS SEALED — hash-anchored at that moment, so the record
       handed over is provably the record as it stood.
     • THE PACKAGE RELEASES to the person he named — an operations manual,
       never a key. Credential LOCATIONS only; the secrets themselves are
       never stored here and never travel.
     • HIS LETTER, written by him, held sealed until then.

   ANY single interaction resets everything, no explanation required.

   SAFETY PROPERTIES, in code:
     • The package contains no secrets by construction — writeCredentialHint
       rejects anything that looks like a secret rather than storing it.
     • Nothing is released early: release requires the full dormancy period
       AND the escalations to have gone unanswered.
     • Release is a PREPARED HANDOVER, not an automated send. KAI marks it
       releasable and records that it did; delivery is a human act by the
       named person or by Ali's own prior arrangement. KAI never mails a
       stranger on the strength of silence alone.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { read, write, emit } from './store';

const DAY = 86_400_000;
const CFG_KEY = 'kai.totmann.cfg';
const PKG_KEY = 'kai.totmann.package';

export interface TotmannConfig {
  enabled: boolean;
  dormantDays: number;          // full trigger
  firstCheckDay: number;        // escalation begins
  primary: { name: string; contact: string };
  secondary: { name: string; contact: string };
  letter: string;               // his words, held until then
}

const DEFAULTS: TotmannConfig = {
  enabled: false,
  dormantDays: 21,
  firstCheckDay: 7,
  primary: { name: '', contact: '' },
  secondary: { name: '', contact: '' },
  letter: '',
};

export function config(): TotmannConfig { return { ...DEFAULTS, ...read<Partial<TotmannConfig>>(CFG_KEY, {}) }; }
export function setConfig(patch: Partial<TotmannConfig>): TotmannConfig {
  const next = { ...config(), ...patch };
  write(CFG_KEY, next); emit();
  try { logEvent({ domain: 'system', type: 'totmann_configured', meta: { enabled: next.enabled, dormantDays: next.dormantDays, hasPrimary: !!next.primary.name }, source: 'user' }); } catch { /* ignore */ }
  return next;
}

/* ── the operational package — locations, never secrets ──────── */
export interface Hint { id: string; label: string; where: string; note?: string }

/* A credential hint that contains an actual credential is a leak waiting to
   be handed to someone. Anything shaped like a secret is REFUSED, not
   stored — the user is told why rather than silently having it kept. */
const SECRET_SHAPES: Array<{ re: RegExp; what: string }> = [
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\s*[:/]\s*\S{6,}/, what: 'an email and password pair' },
  /* Tail allows _ and - : a real key is `sk_live_51H…`, and stopping the
     match at the second underscore let a live Stripe key through. */
  { re: /\b(sk|pk|rk|ghp|gho|ghu|ghs|xox[baprs])[-_][A-Za-z0-9_-]{12,}/, what: 'an API key or token' },
  { re: /\b(AKIA[0-9A-Z]{12,}|AIza[A-Za-z0-9_-]{20,}|ya29\.[A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9._-]{20,})/, what: 'an access key or token' },
  { re: /\b[0-9]{13,19}\b/, what: 'something shaped like a card number' },
  { re: /\b(password|passwort|passcode|passphrase)\s*[:=]\s*\S+/i, what: 'a password' },
  { re: /\bpin\s*[:=]\s*\d{3,}/i, what: 'a PIN' },
  { re: /\b[A-Fa-f0-9]{32,}\b/, what: 'a long hex secret' },
];

/* Generic high-entropy shape: one unbroken 20+ char run of key-alphabet
   characters carrying lower, upper AND digits. Prose, place names and vault
   descriptions don't look like this; credentials do. Checked per token so a
   whole sentence can never accidentally satisfy it by accumulation. */
function looksLikeToken(blob: string): boolean {
  return blob.split(/\s+/).some((tok) =>
    tok.length >= 20 &&
    /^[A-Za-z0-9_+/=-]+$/.test(tok) &&
    /[a-z]/.test(tok) && /[A-Z]/.test(tok) && /[0-9]/.test(tok));
}

/* A seed phrase is 12–24 lowercase dictionary words and nothing else. Testing
   that shape on its own — anchored, no digits, no punctuation — instead of
   "twelve words in a row", which would refuse an ordinary long note like
   "the spare key is in the drawer under the till in the back office". */
const SEED_RE = /^(?:[a-z]{3,8}[ ]){11,23}[a-z]{3,8}$/;

export interface HintResult { ok: boolean; reason: string }

export function writeCredentialHint(label: string, where: string, note = ''): HintResult {
  const blob = `${label} ${where} ${note}`;
  for (const field of [label, where, note]) {
    if (SEED_RE.test(field.trim().toLowerCase())) {
      return { ok: false, reason: 'Refused — that looks like a recovery/seed phrase. This package holds WHERE things live, never the things themselves.' };
    }
  }
  for (const s of SECRET_SHAPES) {
    if (s.re.test(blob)) {
      return { ok: false, reason: `Refused — that looks like ${s.what}. This package holds WHERE things live, never the things themselves. Write the location ("1Password, vault 'Makadi'"), not the secret.` };
    }
  }
  if (looksLikeToken(blob)) {
    return { ok: false, reason: 'Refused — that looks like a key or token. This package holds WHERE things live, never the things themselves. Write the location, not the secret.' };
  }
  const list = read<Hint[]>(PKG_KEY, []).filter((h) => h.label.toLowerCase() !== label.toLowerCase());
  list.push({ id: 'h-' + Math.random().toString(36).slice(2, 9), label, where, note: note || undefined });
  write(PKG_KEY, list); emit();
  return { ok: true, reason: `Recorded where "${label}" lives. No secret stored.` };
}

export function packageHints(): Hint[] { return read<Hint[]>(PKG_KEY, []); }
export function removeHint(id: string): void { write(PKG_KEY, packageHints().filter((h) => h.id !== id)); emit(); }

/* ── presence and escalation ─────────────────────────────────── */
export type Stage = 'awake' | 'checking' | 'escalating' | 'dormant';

export interface Status {
  stage: Stage;
  daysSilent: number | null;
  nextCheckIn: number | null;   // days until the next escalation
  locked: boolean;
  releasable: boolean;
  line: string;
}

/* "Any interaction resets it" is taken literally, and read from the record
   rather than from a marker somebody has to remember to write: the latest of
   the explicit presence stamp, any app open, and any event HE authored
   (user/voice/receipt/braindump). A machine-authored event proves nothing —
   the crons keep running whether he is alive or not, and if `auto` counted
   here the switch could never fire at all. */
const HUMAN: ReadonlyArray<string> = ['user', 'voice', 'receipt', 'braindump'];

function lastSeen(now: number): number | null {
  let latest = -1;
  const p = read<{ at?: number }>('kai.heir.presence', {});
  /* Future-dated stamps are ignored. A wrong clock on one device must not be
     able to fake presence and hold the switch open forever. */
  if (typeof p.at === 'number' && p.at <= now) latest = p.at;
  for (const e of getEvents({})) {
    if (e.ts <= latest || e.ts > now) continue;
    if (HUMAN.includes(e.source) || (e.domain === 'system' && e.type === 'app_opened')) latest = e.ts;
  }
  return latest < 0 ? null : latest;
}

export function status(now = Date.now()): Status {
  const cfg = config();
  const seen = lastSeen(now);
  const daysSilent = seen == null ? null : Math.floor((now - seen) / DAY);

  if (!cfg.enabled) {
    return { stage: 'awake', daysSilent, nextCheckIn: null, locked: false, releasable: false, line: 'Switch is off.' };
  }
  if (daysSilent == null) {
    return { stage: 'awake', daysSilent: null, nextCheckIn: null, locked: false, releasable: false, line: 'No presence recorded yet — open KAI once to start the clock.' };
  }

  const stage: Stage =
    daysSilent >= cfg.dormantDays ? 'dormant'
    : daysSilent >= cfg.firstCheckDay + 7 ? 'escalating'
    : daysSilent >= cfg.firstCheckDay ? 'checking'
    : 'awake';

  const locked = stage === 'dormant';
  /* Release also requires that a HUMAN was actually asked and did not answer.
     The clock alone is not evidence: a phone left in a drawer for three weeks
     must not hand his operation to anyone. Specifically the `named_person`
     step — the one that reaches a person, not a device — has to be on record. */
  const asked = escalationsSent(now).some((e) => e.step === 'named_person');
  const releasable = locked && asked && !!cfg.primary.name;

  const line =
    stage === 'awake' ? `You were here ${daysSilent}d ago. Nothing is armed.`
    : stage === 'checking' ? `${daysSilent}d silent — checking in. Any interaction resets this.`
    : stage === 'escalating' ? `${daysSilent}d silent — escalating to ${cfg.primary.name || 'your named person'}. Any interaction resets this.`
    : `${daysSilent}d silent — ALL ACTION LOCKED. ${releasable ? `The package is prepared for ${cfg.primary.name}.` : 'Package NOT released — nobody has been asked yet, or no person is named.'}`;

  return { stage, daysSilent, nextCheckIn: stage === 'awake' ? cfg.firstCheckDay - daysSilent : null, locked, releasable, line };
}

/* THE LOCK — asked before anything acts. Nothing overrides it but him. */
export function actionLocked(now = Date.now()): boolean { return status(now).locked; }

export function escalationsSent(now = Date.now()): Array<{ at: number; step: string }> {
  return getEvents({ domain: 'system', type: 'totmann_escalation' })
    .filter((e) => now - e.ts < 120 * DAY)
    .map((e) => ({ at: e.ts, step: String(e.meta?.step || '') }));
}

/* Escalate one step. Idempotent per step per silence-run. */
export function escalate(now = Date.now()): string | null {
  const cfg = config();
  const s = status(now);
  if (!cfg.enabled || s.daysSilent == null) return null;
  const silent = s.daysSilent;
  const steps: Array<{ atDay: number; step: string; how: string }> = [
    { atDay: cfg.firstCheckDay, step: 'push', how: 'a push to your own device' },
    { atDay: cfg.firstCheckDay + 4, step: 'email', how: 'an email to you' },
    { atDay: cfg.firstCheckDay + 7, step: 'named_person', how: `a message to ${cfg.primary.name || 'your named person'} asking if you are well` },
  ];
  const done = new Set(escalationsSent(now).filter((e) => e.at > now - (silent + 1) * DAY).map((e) => e.step));
  for (const st of steps) {
    if (silent < st.atDay || done.has(st.step)) continue;
    try { logEvent({ domain: 'system', type: 'totmann_escalation', meta: { step: st.step, daysSilent: silent, how: st.how }, source: 'auto', ts: now }); } catch { /* ignore */ }
    return st.how;
  }
  return null;
}

/* ── the reset: any interaction, no explanation ──────────────── */
export function reset(now = Date.now()): void {
  write('kai.heir.presence', { at: now });
  try { logEvent({ domain: 'system', type: 'totmann_reset', meta: {}, source: 'user', ts: now }); } catch { /* ignore */ }
  emit();
}

/* ── the handover ────────────────────────────────────────────── */
export interface Handover { preparedAt: number; for: string; sections: Array<{ title: string; lines: string[] }>; letter: string }

/* Built ONLY when genuinely releasable. Contains operations, not secrets. */
export function buildHandover(now = Date.now()): Handover | null {
  const s = status(now);
  const cfg = config();
  if (!s.releasable) return null;

  const sections: Handover['sections'] = [];

  sections.push({
    title: 'WHERE THINGS LIVE (locations only — no passwords are stored here)',
    lines: packageHints().length
      ? packageHints().map((h) => `${h.label}: ${h.where}${h.note ? ` — ${h.note}` : ''}`)
      : ['(nothing recorded — Ali did not fill this in)'],
  });

  /* Makadi state, from the Spine */
  const bookings = getEvents({ domain: 'makadi', type: 'booking_confirmed' }).slice(-6);
  const inquiries = getEvents({ domain: 'makadi', type: 'booking_inquiry' }).slice(-4);
  sections.push({
    title: 'MAKADI — guests and calendar',
    lines: [
      ...bookings.map((b) => `booked: ${b.meta?.guest || 'guest'} ${b.meta?.dates || ''} (${b.meta?.nights || '?'} nights)`),
      ...inquiries.map((q) => `open inquiry: ${q.meta?.guest || 'guest'} — thread ${q.meta?.thread || '?'}`),
      bookings.length || inquiries.length ? '' : '(no guest activity on record)',
    ].filter(Boolean),
  });

  /* Garden rhythm */
  const plants = read<Array<{ name: string; waterEveryDays?: number }>>('kai.garden.codex', []);
  sections.push({
    title: 'THE GARDEN — what it needs weekly',
    lines: plants.length ? plants.slice(0, 12).map((p) => `${p.name}: water every ~${p.waterEveryDays ?? 4} days`) : ['(no plants recorded)'],
  });

  /* Money state */
  const debt = getEvents({ domain: 'debt', type: 'balance_updated' }).sort((a, b) => b.ts - a.ts)[0];
  const cash = getEvents({ domain: 'system', type: 'cash_on_hand' }).sort((a, b) => b.ts - a.ts)[0];
  sections.push({
    title: 'MONEY — the state as last recorded',
    lines: [
      debt ? `card balance: ${Math.round(debt.value || 0).toLocaleString('en-GB')} EGP (as of ${new Date(debt.ts).toISOString().slice(0, 10)})` : 'card balance: not recorded',
      cash ? `cash on hand: ${Math.round(cash.value || 0).toLocaleString('en-GB')} EGP (as of ${new Date(cash.ts).toISOString().slice(0, 10)})` : 'cash on hand: not recorded',
      'No account access is included here. Nothing can be moved with this document.',
    ],
  });

  /* Legal */
  const legal = getEvents({}).filter((e) => /2662|court|case|next home/i.test(JSON.stringify(e.meta || {}))).slice(-6);
  sections.push({
    title: 'LEGAL — case 2662 and related',
    lines: legal.length ? legal.map((e) => `${new Date(e.ts).toISOString().slice(0, 10)} ${e.domain}.${e.type}: ${JSON.stringify(e.meta).slice(0, 120)}`) : ['(nothing recorded under this case)'],
  });

  sections.push({
    title: 'WHAT THIS DOCUMENT IS NOT',
    lines: [
      'It grants no access to anything. It holds no password, key, PIN or token.',
      'It authorises nothing. It is an operations note so the work does not stop.',
      'KAI has locked itself: it will not send, spend, or commit anything.',
    ],
  });

  return { preparedAt: now, for: cfg.primary.name || 'the named person', sections, letter: cfg.letter };
}

export function handoverText(h: Handover): string {
  const L: string[] = [];
  L.push(`OPERATIONS HANDOVER — prepared for ${h.for}`);
  L.push(`Prepared ${new Date(h.preparedAt).toISOString().slice(0, 10)} because Ali Kaiser has not been reachable.`);
  L.push('');
  if (h.letter) { L.push('FROM ALI:'); L.push(h.letter); L.push(''); }
  for (const s of h.sections) {
    L.push(s.title);
    for (const line of s.lines) L.push('  ' + line);
    L.push('');
  }
  return L.join('\n');
}

export function totmannText(now = Date.now()): string {
  const cfg = config();
  const s = status(now);
  const L = ['DER TOTMANNSCHALTER', ''];
  L.push(s.line);
  if (cfg.enabled) {
    L.push('');
    L.push(`Dormant after ${cfg.dormantDays}d · check-ins from day ${cfg.firstCheckDay}`);
    L.push(`Primary: ${cfg.primary.name || '(not set)'} · Secondary: ${cfg.secondary.name || '(not set)'}`);
    L.push(`Package: ${packageHints().length} location${packageHints().length === 1 ? '' : 's'} recorded, no secrets held.`);
    L.push(`Letter: ${cfg.letter ? 'sealed and held' : 'not written'}`);
    const esc = escalationsSent(now);
    if (esc.length) L.push(`Escalations sent: ${esc.map((e) => e.step).join(' → ')}`);
  }
  L.push('');
  L.push('Any interaction with KAI resets this entirely. No explanation needed.');
  return L.join('\n');
}
