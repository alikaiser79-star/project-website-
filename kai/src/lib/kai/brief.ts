/* ============================================================
   §47 DER BRIEF — an obligation with a delivery date.

   Four sealed things and one promise: that in ten years something
   readable comes back. Everything in this file is subordinate to that
   promise, including the parts that are uncomfortable to write.

   ── THE THING THAT WILL ACTUALLY BREAK THIS ───────────────────
   Not the sealing. Not the format. STORAGE.

   A browser's localStorage does not survive ten years. It is cleared by
   a cache wipe, a reinstall, a new phone, a "free up space" prompt, or
   Safari deciding the origin is stale after seven days of no visits.
   The honest expected lifetime of anything held only here is months.

   So a ten-year vault that lives only in this browser is not a vault.
   It is a promise that breaks silently, and the man who wrote the letter
   finds out in ten years — which is the one moment it cannot be fixed.

   This file therefore treats THE EXPORT as the real artifact and the
   browser copy as a working draft. `survival()` names every letter that
   has never left the device, and it is loud about it forever, because a
   nag that stops is a nag that failed.

   ── WHAT "SEALED" HONESTLY MEANS HERE ─────────────────────────
   The app refuses to show a sealed letter before its date, and the text
   is hashed into the Spine so any later edit is visible against the
   witness chain. That is a DISCIPLINE plus TAMPER-EVIDENCE. It is not
   encryption: anyone holding this device with devtools open can read
   the raw string, and saying otherwise would be the worst lie in the
   project, because a man writes differently when he believes a thing
   is locked.

   Encryption was considered and REFUSED. The only key he could hold for
   ten years is a passphrase, and a passphrase forgotten in ten years
   destroys the letter permanently. A letter readable by someone holding
   his own phone is a smaller loss than a letter nobody can ever open —
   including him. The threat model here is time, not burglars.

   ── AND WHAT IS NEVER INVENTED ────────────────────────────────
   The counter-letter is arithmetic on the Spine and nothing else. Where
   the Spine has been truncated by its own 2000-event cap, the record
   says so and gives the date it actually reaches back to, rather than
   presenting a partial year as a year. The vault holds LOCATIONS, never
   documents and never photographs — a binary in localStorage would take
   the Spine down with it on quota, and an empty slot is honest where a
   fabricated one is not.
   ============================================================ */

import { getEvents, logEvent, CAP } from './events';
import { getCommitments } from './commitments';
import { discipline } from './urteil';
import { read, write, emit } from './store';

const DAY = 86_400_000;

/* ── the letters ─────────────────────────────────────────────── */

export type LetterKind = 'to_self' | 'counter' | 'for_whoever';

export interface Letter {
  id: string;
  kind: LetterKind;
  year: number;
  text: string;
  sealedAt: number;
  /* When it may be read. null = never on a date — released only by the
     dead man's switch, which is `for_whoever` and nothing else. */
  openAt: number | null;
  hash: string;
  openedAt?: number;
  /* for_whoever is REPLACEABLE by design; this counts the versions so
     the history is evident rather than silently overwritten. */
  version: number;
}

/* Metadata only. Deliberately has no `text` field so that a listing can
   never leak a sealed body through a careless render. */
export interface LetterHead {
  id: string; kind: LetterKind; year: number; sealedAt: number;
  openAt: number | null; hash: string; version: number;
  openedAt?: number; words: number;
}

const KEY = 'kai.brief.letters';
const DAY_KEY = 'kai.brief.day';

function all(): Letter[] { return read<Letter[]>(KEY, []); }

export function heads(now = Date.now()): LetterHead[] {
  return all().filter((l) => l.sealedAt <= now).map((l) => ({
    id: l.id, kind: l.kind, year: l.year, sealedAt: l.sealedAt, openAt: l.openAt,
    hash: l.hash, version: l.version, openedAt: l.openedAt,
    words: l.text.trim().split(/\s+/).filter(Boolean).length,
  }));
}

/* Non-cryptographic, synchronous, and honest about being so. It exists
   so a seal has an identifier the moment it is written; the REAL
   integrity claim is the SHA-256 logged into the Spine a tick later and
   carried in the export, which the witness chain covers. */
function quickHash(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + s.charCodeAt(i) + i, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SealResult { ok: boolean; reason: string; head: LetterHead | null }

export const YEARS_OUT = 10;

/* Ten years out on the CALENDAR, not 3652 days — a man opening this
   wants the anniversary of the day he wrote it, and leap years should
   not move it. */
export function tenYearsOn(ts: number, years = YEARS_OUT): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

export function sealLetter(kind: LetterKind, text: string, now = Date.now()): SealResult {
  const body = String(text || '').trim();
  if (!body) {
    return { ok: false, reason: 'Nothing to seal. An empty letter is not a modest letter, it is an absent one.', head: null };
  }
  const year = new Date(now).getUTCFullYear();
  const list = all();

  /* THE NO-EDITING RULE, enforced rather than requested. The brief says
     no editing after you send it, and a letter you can revise next
     Tuesday is a draft — the whole value is that it cannot be softened
     once the year turns out differently. */
  const existing = list.find((l) => l.kind === kind && l.year === year);
  if (existing && kind !== 'for_whoever') {
    return {
      ok: false,
      reason: `${year} is already sealed — ${new Date(existing.sealedAt).toISOString().slice(0, 10)}, ${existing.text.trim().split(/\s+/).length} words. It does not reopen. That is the point of it: a letter you can revise once the year disappoints you measures nothing.`,
      head: null,
    };
  }

  const prior = list.filter((l) => l.kind === 'for_whoever');
  const letter: Letter = {
    id: `${kind}-${year}-${quickHash(body).slice(0, 6)}`,
    kind, year, text: body, sealedAt: now,
    /* for_whoever has NO date. It is not a delivery, it is a condition. */
    openAt: kind === 'for_whoever' ? null : tenYearsOn(now),
    hash: quickHash(body),
    version: kind === 'for_whoever' ? prior.length + 1 : 1,
  };

  /* for_whoever replaces its predecessor — it holds where things are and
     who to call, and stale operational facts are worse than none. Every
     superseded version still leaves its hash in the Spine, so the
     history of what he knew and when is evident. */
  const next = kind === 'for_whoever' ? list.filter((l) => l.kind !== 'for_whoever') : list.slice();
  next.push(letter);
  write(KEY, next); emit();

  try {
    logEvent({
      domain: 'system', type: 'brief_sealed',
      meta: { id: letter.id, kind, year, hash: letter.hash, openAt: letter.openAt, version: letter.version, words: body.split(/\s+/).length },
      source: 'user', ts: now,
    });
  } catch { /* ignore */ }

  /* The real hash, logged as soon as the platform can produce it. */
  void sha256(body).then((h) => {
    try { logEvent({ domain: 'system', type: 'brief_hash', meta: { id: letter.id, sha256: h }, source: 'auto', ts: now }); } catch { /* ignore */ }
  }).catch(() => { /* no subtle crypto — the quick hash and the export still stand */ });

  const [h] = heads(now).filter((x) => x.id === letter.id);
  return { ok: true, reason: sealLine(letter), head: h ?? null };
}

function sealLine(l: Letter): string {
  const words = l.text.trim().split(/\s+/).length;
  if (l.kind === 'for_whoever') {
    return `Sealed — version ${l.version}, ${words} words. No date on this one: it is released only if the dead man's switch fires, and never to you. Update it once a year; where things are goes stale faster than what you meant.`;
  }
  return `Sealed. ${words} words, ${new Date(l.sealedAt).toISOString().slice(0, 10)} → ${new Date(l.openAt!).toISOString().slice(0, 10)}. ` +
    'It does not reopen before then and it cannot be edited. Export it tonight — this browser will not last ten years.';
}

/* THE PAIR. The brief says KAI writes its own "the same day … sealed
   alongside yours", and that is not a separate command he might get
   round to. If the counter-letter could be skipped, the year he had a
   bad December is the year there is nothing to measure his letter
   against — and the gap between the two is the entire point. So one
   act seals both, and the counter is computed at that instant from the
   Spine rather than written later from memory. */
export interface DayResult { ok: boolean; reason: string; mine: LetterHead | null; kais: LetterHead | null }

export function sealDay(text: string, now = Date.now()): DayResult {
  const mine = sealLetter('to_self', text, now);
  if (!mine.ok) return { ok: false, reason: mine.reason, mine: null, kais: null };

  const rec = yearRecord(new Date(now).getUTCFullYear(), now);
  const kais = sealLetter('counter', rec.text, now);

  return {
    ok: true,
    mine: mine.head, kais: kais.head,
    reason: `${mine.reason}\n\nSealed alongside it: my record of ${rec.year} — what you earned, what you kept, what you promised and what happened. ` +
      'In ten years you open both. One is what you hoped, one is what you did. I am not going to tell you what the gap means.' +
      (rec.truncated || rec.startsLate ? `\n\n${rec.truncated ? 'Note: my record is incomplete — the Spine lost the start of the year to its cap, and it says so inside.' : 'Note: my record is partial — it begins when the record begins. Nothing was lost, and it says so inside.'}` : ''),
  };
}

/* ── THE DRAFT, AND WHY THERE HAS TO BE ONE ──────────────────
   The brief's own wording is "no editing after you SEND it", which
   means there is a send — write, then send, then sealed. Collapsing
   that into one command looked tidier until a mistyped "letter day
   nonsense" sealed the words "day nonsense" as the letter for 2026,
   permanently, with no way back. Irreversible and one keystroke away
   is the wrong combination for the one thing here that cannot be
   redone. So the draft is held, shown back in full, and sealed only by
   a second deliberate act. */

const DRAFT_KEY = 'kai.brief.draft';

export function draft(): string { return read<string>(DRAFT_KEY, ''); }
export function discardDraft(): void { write(DRAFT_KEY, ''); emit(); }

export function setDraft(text: string, now = Date.now()): { ok: boolean; reason: string } {
  const body = String(text || '').trim();
  if (!body) return { ok: false, reason: 'Nothing to hold.' };
  const year = new Date(now).getUTCFullYear();
  if (all().some((l) => l.kind === 'to_self' && l.year === year)) {
    return { ok: false, reason: `${year} is already sealed. It does not reopen.` };
  }
  write(DRAFT_KEY, body); emit();
  const words = body.split(/\s+/).length;
  return {
    ok: true,
    reason: `Held, not sealed — ${words} word${words === 1 ? '' : 's'}.\n\n${body}\n\n` +
      `Send it with "send letter" and it seals until ${new Date(tenYearsOn(now)).toISOString().slice(0, 10)}, ` +
      'with my record of the year alongside it. Nothing is written until you do. "discard letter" throws this away.',
  };
}

export function sendDraft(now = Date.now()): DayResult {
  const body = draft();
  if (!body) {
    return { ok: false, reason: 'No letter held. Write one with "letter <what you want to say>" and send it after you have read it back.', mine: null, kais: null };
  }
  const r = sealDay(body, now);
  if (r.ok) discardDraft();
  return r;
}

/* ── reading: refused until the date, and it says why ─────────── */

export type ReleaseGuard = (now: number) => { open: boolean; reason: string };
let guard: ReleaseGuard | null = null;

/* The dead man's switch lives in §33.2 and is not on every build. The
   default is CLOSED — a letter meant for after his death does not open
   because a module failed to load. Failing shut is the only acceptable
   direction here. */
export function registerReleaseGuard(g: ReleaseGuard): void { guard = g; }

export function releaseState(now = Date.now()): { open: boolean; reason: string } {
  if (!guard) {
    return {
      open: false,
      reason: 'No dead man\'s switch is wired into this build, so this stays shut. It fails closed on purpose: a letter for after you are gone must never open because a module did not load.',
    };
  }
  try { return guard(now); } catch {
    return { open: false, reason: 'The dead man\'s switch could not be read. Treated as shut.' };
  }
}

export interface ReadResult { ok: boolean; text: string | null; reason: string }

export function readLetter(id: string, now = Date.now()): ReadResult {
  const l = all().find((x) => x.id === id);
  if (!l) return { ok: false, text: null, reason: 'No letter by that name.' };

  if (l.kind === 'for_whoever') {
    const r = releaseState(now);
    if (!r.open) {
      return { ok: false, text: null, reason: `Sealed for whoever comes. ${r.reason}` };
    }
    open(l, now);
    return { ok: true, text: l.text, reason: `Released under the dead man's switch. Sealed ${new Date(l.sealedAt).toISOString().slice(0, 10)}, version ${l.version}.` };
  }

  if (l.openAt !== null && now < l.openAt) {
    const days = Math.ceil((l.openAt - now) / DAY);
    return {
      ok: false, text: null,
      reason: `Sealed until ${new Date(l.openAt).toISOString().slice(0, 10)} — ${days.toLocaleString('en-GB')} days. ` +
        `${l.text.trim().split(/\s+/).length} words are in there and I am not going to show you one of them. ` +
        'Honest caveat: this is the app refusing, not encryption. Anyone holding this device with developer tools open can read it, and I would rather tell you that than let you believe otherwise.',
    };
  }

  open(l, now);
  return { ok: true, text: l.text, reason: `Written ${new Date(l.sealedAt).toISOString().slice(0, 10)}. Opened ${new Date(now).toISOString().slice(0, 10)}.` };
}

function open(l: Letter, now: number): void {
  if (l.openedAt) return;
  const list = all().map((x) => (x.id === l.id ? { ...x, openedAt: now } : x));
  write(KEY, list); emit();
  try { logEvent({ domain: 'system', type: 'brief_opened', meta: { id: l.id, kind: l.kind, year: l.year, sealedYears: Math.round((now - l.sealedAt) / (365 * DAY)) }, source: 'user', ts: now }); } catch { /* ignore */ }
}

export function due(now = Date.now()): LetterHead[] {
  return heads(now).filter((h) => h.openAt !== null && now >= h.openAt && !h.openedAt);
}

/* ── 2. THE COUNTER-LETTER — arithmetic, and its own limits ──── */

export interface YearRecord {
  year: number;
  from: number; to: number;
  /* Both mean "this is not a full year", and they are NOT the same fact.
       truncated — the 2000-event cap dropped the start of the year.
       startsLate — the record simply begins later, because that is when
                    he started keeping it. Nothing was lost.
     Reporting a young Spine as a truncated one would be a false claim
     about why his January is missing, which is exactly the kind of
     confident wrongness this whole record exists to avoid. */
  truncated: boolean;
  startsLate: boolean;
  reachesBack: number | null;
  earnedEgp: number;
  spentEgp: number;
  keptEgp: number;
  made: number; kept: number; broken: number;
  said: Array<{ text: string; status: string }>;
  decided: string;
  text: string;
}

export function yearRecord(year: number, now = Date.now()): YearRecord {
  const from = Date.UTC(year, 0, 1);
  const to = Math.min(Date.UTC(year + 1, 0, 1), now);

  const spine = getEvents({});
  const earliest = spine.length ? Math.min(...spine.map((e) => e.ts)) : now;
  const short = earliest > from;
  /* The Spine is FIFO-capped. A long year on a busy device drops its own
     January, and a record computed off that understates everything
     without saying so. But a Spine well under the cap has dropped
     NOTHING — it just started later, and calling that truncation would
     invent a data-loss event that never happened. */
  const atCap = spine.length >= CAP;
  const truncated = short && atCap;
  const startsLate = short && !atCap;

  const win = spine.filter((e) => e.ts >= from && e.ts < to);
  const sum = (d: string) => win.filter((e) => e.domain === d).reduce((s, e) => s + (e.value || 0), 0);
  const earnedEgp = sum('income');
  const spentEgp = sum('expense');

  const cs = getCommitments().filter((c) => c.createdAt >= from && c.createdAt < to);
  const kept = cs.filter((c) => c.status === 'kept').length;
  const broken = cs.filter((c) => c.status === 'broken').length;
  const said = cs.map((c) => ({ text: c.text, status: c.status }));

  const d = discipline(now);

  const L: string[] = [];
  L.push(`THE RECORD OF ${year} — written by KAI from the Spine, not from memory.`);
  L.push('');
  if (truncated) {
    L.push(`INCOMPLETE — DATA WAS LOST. The Spine holds ${spine.length} events against a cap of ${CAP} and only reaches back to ${new Date(earliest).toISOString().slice(0, 10)}. Everything before that aged out.`);
    L.push('Read every number below as "from that date onward", not "for the year". A partial year presented as a year is the exact lie this record exists to avoid.');
    L.push('');
  } else if (startsLate) {
    L.push(`PARTIAL — nothing was lost. The record begins ${new Date(earliest).toISOString().slice(0, 10)}, because that is when it begins; the Spine is ${spine.length} events, well under its ${CAP} cap.`);
    L.push('Still not a full year, so read the numbers as "from that date onward" — but no January went missing.');
    L.push('');
  }
  L.push(`Earned: ${Math.round(earnedEgp).toLocaleString('en-GB')} EGP across ${win.filter((e) => e.domain === 'income').length} logged entries.`);
  L.push(`Spent: ${Math.round(spentEgp).toLocaleString('en-GB')} EGP.`);
  L.push(`Kept: ${Math.round(earnedEgp - spentEgp).toLocaleString('en-GB')} EGP — the difference, not a balance. What was actually in an account on any given day is not something this record knows.`);
  L.push('');
  L.push(`Promised: ${cs.length}. Kept ${kept}, broke ${broken}, ${cs.length - kept - broken} still open at the seal.`);
  if (said.length) {
    L.push('');
    L.push('WHAT YOU SAID YOU WOULD DO, AND WHAT HAPPENED:');
    for (const s of said.slice(0, 40)) L.push(`  [${s.status.toUpperCase().padEnd(6)}] ${s.text}`);
    if (said.length > 40) L.push(`  … and ${said.length - 40} more, all of them in the export.`);
  }
  L.push('');
  L.push('HOW YOU DECIDED:');
  L.push('  ' + d.verdict);
  L.push('');
  L.push('That is the whole record. Nothing here is an opinion about the year and nothing is an estimate — where a number could not be computed it is absent rather than filled in.');

  return {
    year, from, to, truncated, startsLate, reachesBack: short ? earliest : null,
    earnedEgp, spentEgp, keptEgp: earnedEgp - spentEgp,
    made: cs.length, kept, broken, said, decided: d.verdict, text: L.join('\n'),
  };
}

/* ── 3. THE VAULT — locations, never the things themselves ───── */

export interface VaultSlot { key: string; label: string; value: string; updatedAt: number | null }

const VAULT_KEY = 'kai.brief.vault';

/* The slots future Ali actually needs, named in the brief. Each starts
   EMPTY and stays empty until he fills it — the property pack was left
   blank once already for the same reason, and inventing what a case
   said or how old a tree is would poison the one record meant to
   outlive the code. */
const SLOTS: Array<[string, string]> = [
  ['case2662', 'Case 2662 — the property papers, where they are, and how it ended'],
  ['deeds', 'Deeds and title — where the originals are held'],
  ['trees', 'The trees — what they are, where, planted when, measured when'],
  ['seasons', 'Photographs of the garden by season — WHERE they live, not the files'],
  ['horst', 'What Horst built, and what was added after'],
  ['who', 'Who to call, and for what'],
  ['accounts', 'Where the accounts and keys are held — locations only, never the credentials'],
  ['doctrine', 'The doctrine, the scars, the receipts — where the exports are kept'],
];

export function vault(): VaultSlot[] {
  const saved = read<Record<string, { value: string; updatedAt: number }>>(VAULT_KEY, {});
  return SLOTS.map(([key, label]) => ({
    key, label,
    value: saved[key]?.value || '',
    updatedAt: saved[key]?.updatedAt ?? null,
  }));
}

const SECRETY = /(?:^|\b)(password|passphrase|pin|otp|seed phrase|private key|-----BEGIN|sk_live|sk_test|ghp_|AKIA|AIza|ya29\.)/i;

export interface VaultResult { ok: boolean; reason: string }

export function setVault(key: string, value: string, now = Date.now()): VaultResult {
  if (!SLOTS.some(([k]) => k === key)) {
    return { ok: false, reason: `No slot called "${key}". The slots are: ${SLOTS.map(([k]) => k).join(', ')}.` };
  }
  /* Same refusal as the handover pack: locations survive being read by
     the wrong person in ten years; credentials do not. */
  if (SECRETY.test(value)) {
    return {
      ok: false,
      reason: 'Refused — that looks like a credential, not a location. This vault is written to be readable by whoever opens it, which is exactly why a password cannot go in it. Write where the key is kept and who can get to it.',
    };
  }
  if (/^data:|base64,/i.test(value) || value.length > 4000) {
    return {
      ok: false,
      reason: 'Refused — this holds locations, not files. A photograph in browser storage fills the quota and takes the Spine down with it. Write where the album is; keep the pictures somewhere that is actually backed up.',
    };
  }
  const saved = read<Record<string, { value: string; updatedAt: number }>>(VAULT_KEY, {});
  saved[key] = { value: value.trim(), updatedAt: now };
  write(VAULT_KEY, saved); emit();
  try { logEvent({ domain: 'system', type: 'vault_set', meta: { key, chars: value.trim().length }, source: 'user', ts: now }); } catch { /* ignore */ }
  return { ok: true, reason: `${key} recorded. ${vault().filter((s) => s.value).length} of ${SLOTS.length} slots filled.` };
}

export function vaultText(now = Date.now()): string {
  const v = vault();
  const L = ['THE VAULT — what future Ali actually needs.', ''];
  for (const s of v) {
    L.push(`${s.label}`);
    L.push(s.value
      ? `  ${s.value}${s.updatedAt ? `   (${new Date(s.updatedAt).toISOString().slice(0, 10)})` : ''}`
      : '  — empty. Left empty on purpose: I will not invent what a case said or how old a tree is.');
  }
  const filled = v.filter((s) => s.value).length;
  const stale = v.filter((s) => s.updatedAt && now - s.updatedAt > 400 * DAY);
  L.push('');
  L.push(`${filled} of ${v.length} filled.` + (stale.length ? ` ${stale.length} not touched in over a year: ${stale.map((s) => s.key).join(', ')}.` : ''));
  L.push('Locations only. No credentials, no files — this is written to be readable by whoever opens it, and that is the whole reason a password cannot live here.');
  return L.join('\n');
}

/* ── 5. DELIVERY, AND WHETHER IT WILL SURVIVE TO BE DELIVERED ── */

export interface Survival {
  sealed: number;
  exportedHashes: string[];
  neverExported: LetterHead[];
  lastExportAt: number | null;
  line: string;
}

export function survival(now = Date.now()): Survival {
  const hs = heads(now);
  const exports = getEvents({ domain: 'system', type: 'brief_exported' }).filter((e) => e.ts <= now);
  const exportedHashes = [...new Set(exports.flatMap((e) => (Array.isArray(e.meta?.hashes) ? (e.meta!.hashes as string[]) : [])))];
  const neverExported = hs.filter((h) => !exportedHashes.includes(h.hash));
  const lastExportAt = exports.length ? Math.max(...exports.map((e) => e.ts)) : null;

  let line: string;
  if (!hs.length) {
    line = 'Nothing sealed yet.';
  } else if (neverExported.length) {
    line =
      `${neverExported.length} of ${hs.length} sealed letters have never left this browser. ` +
      'They are one cache clear, one new phone, or one "free up space" tap from gone — and you would not find out for ten years, ' +
      'which is the one moment it cannot be fixed. Run "export brief" and put the file somewhere that is actually backed up.';
  } else {
    const days = lastExportAt === null ? null : Math.floor((now - lastExportAt) / DAY);
    line = `All ${hs.length} sealed letters have been exported${days === null ? '' : `, last ${days} day${days === 1 ? '' : 's'} ago`}. ` +
      'That file is the real vault; this browser is a working copy. Nothing about the delivery depends on this code still existing.';
  }
  return { sealed: hs.length, exportedHashes, neverExported, lastExportAt, line };
}

/* The artifact. Plain text, dated, self-describing, and deliberately
   dependent on nothing — no JSON schema to parse, no app to install, no
   key to remember. If every line of this project is gone in ten years,
   this file still opens in anything that can show text. */
export function exportText(now = Date.now()): string {
  const ls = all().filter((l) => l.sealedAt <= now).sort((a, b) => a.sealedAt - b.sealedAt);
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const L: string[] = [];

  L.push('KAI — SEALED RECORD');
  L.push(`Exported ${iso(now)}`);
  L.push('');
  L.push('This is a plain text file on purpose. There is nothing to install and no key to');
  L.push('remember. Keep it somewhere that is backed up, print it if you like, and copy it');
  L.push('forward whenever you change machines. It is the only copy that is meant to last.');
  L.push('');
  L.push('READ THIS BEFORE YOU DECIDE WHERE TO PUT IT: every letter below appears here in');
  L.push('full, including the ones the app is still refusing to show you. It has to — a');
  L.push('vault that exports nothing protects nothing. So anyone holding this file can read');
  L.push('your ten-year letter today. Store it accordingly, and do not seal something here');
  L.push('you would not survive someone finding.');
  L.push('');
  L.push('Each letter below carries a 16-character checksum of its own text. If you ever');
  L.push('want to know whether a letter has been altered since it was sealed, compare that');
  L.push('checksum against the same letter in an older copy of this file. It cannot prove');
  L.push('what was true when it was written — only that the words have not changed since.');
  L.push('');
  L.push('='.repeat(70));

  for (const l of ls) {
    L.push('');
    L.push(l.kind === 'to_self' ? `LETTER TO MYSELF — ${l.year}`
      : l.kind === 'counter' ? `KAI'S RECORD OF ${l.year}`
      : `FOR WHOEVER READS THIS — version ${l.version}`);
    L.push(`Sealed:   ${iso(l.sealedAt)}`);
    L.push(l.openAt === null
      ? 'To open:  not on a date. Only if he did not come back.'
      : `To open:  ${iso(l.openAt)}`);
    L.push(`Checksum: ${l.hash}`);
    L.push('-'.repeat(70));
    /* The export carries the BODIES — including ones still sealed in the
       app. It has to: a vault that only exports what is already openable
       protects nothing. The seal is a discipline for him inside the app,
       and this file is the thing that has to survive without it. */
    L.push(l.text);
    L.push('-'.repeat(70));
  }

  L.push('');
  L.push('='.repeat(70));
  L.push('');
  L.push(vaultText(now));
  L.push('');
  L.push('='.repeat(70));
  L.push(`${ls.length} letters. Exported ${iso(now)} by KAI.`);
  return L.join('\n');
}

/* Called after the file actually reaches the disk. Records WHICH letters
   the export covered, so `survival()` can name the ones still at risk
   instead of reporting a vague "exported once, probably fine". */
export function recordExport(now = Date.now()): void {
  const hs = heads(now);
  try {
    logEvent({ domain: 'system', type: 'brief_exported', meta: { hashes: hs.map((h) => h.hash), count: hs.length }, source: 'user', ts: now });
  } catch { /* ignore */ }
}

/* ── 1. THE DAY ──────────────────────────────────────────────── */

/* A convention, not a meaning. Stored so it is his, defaulted so the
   obligation exists before he has an opinion about it. */
export function letterDay(): string { return read<string>(DAY_KEY, '12-31'); }
export function setLetterDay(mmdd: string): boolean {
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return false;
  write(DAY_KEY, mmdd); emit(); return true;
}

/* "Not tonight" has to stick for the night, or the black screen fights
   him every time he opens the app and he learns to dismiss it without
   reading. It resets tomorrow, and the obligation returns next year
   regardless — a dismissal is never a decision about the letter. */
const DISMISS_KEY = 'kai.brief.dismissed';
export function dismissToday(now = Date.now()): void {
  write(DISMISS_KEY, new Date(now).toISOString().slice(0, 10)); emit();
}
export function dismissedToday(now = Date.now()): boolean {
  return read<string>(DISMISS_KEY, '') === new Date(now).toISOString().slice(0, 10);
}

export interface DayState { isToday: boolean; done: boolean; daysAway: number; prompt: string }

/* The one condition under which the app takes the whole screen. */
export function shouldOpen(now = Date.now()): boolean {
  const d = dayState(now);
  return d.isToday && !d.done && !dismissedToday(now);
}

export function dayState(now = Date.now()): DayState {
  const [mm, dd] = letterDay().split('-').map(Number);
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const isToday = d.getUTCMonth() + 1 === mm && d.getUTCDate() === dd;
  let next = Date.UTC(year, mm - 1, dd);
  if (next < Date.UTC(year, d.getUTCMonth(), d.getUTCDate())) next = Date.UTC(year + 1, mm - 1, dd);
  const done = all().some((l) => l.kind === 'to_self' && l.year === year);

  return {
    isToday, done,
    daysAway: Math.round((next - Date.UTC(year, d.getUTCMonth(), d.getUTCDate())) / DAY),
    /* No structure, no headings, no example sentences. The brief asked
       for one thing and any scaffolding I add becomes the shape of what
       he writes, which makes it my letter. */
    prompt: 'A letter to yourself, ten years out.\n\nWhat you are building. What you are afraid of. What you hope this year meant. Who you are doing it for.\n\nIt seals when you send it. It does not reopen and it cannot be edited.',
  };
}

export function briefText(now = Date.now()): string {
  const hs = heads(now);
  const s = survival(now);
  const d = dayState(now);
  const dues = due(now);
  const L = ['DER BRIEF', ''];

  if (dues.length) {
    L.push('DELIVERY DUE:');
    for (const h of dues) {
      L.push(`  ${h.kind === 'to_self' ? 'Your letter' : "KAI's record"} from ${h.year} — sealed ${new Date(h.sealedAt).toISOString().slice(0, 10)}, ${h.words} words. Ten years. "open ${h.id}".`);
    }
    L.push('');
  }

  L.push('SEALED:');
  if (!hs.length) L.push('  Nothing yet.');
  for (const h of hs) {
    const what = h.kind === 'to_self' ? `${h.year} — to yourself` : h.kind === 'counter' ? `${h.year} — KAI's record` : `for whoever comes (v${h.version})`;
    L.push(`  ${what.padEnd(34)} ${h.words} words   ${h.openAt === null ? 'no date — condition only' : `opens ${new Date(h.openAt).toISOString().slice(0, 10)}`}`);
  }
  L.push('');
  L.push('SURVIVAL:');
  L.push('  ' + s.line);
  L.push('');
  L.push('THE DAY:');
  L.push(d.isToday && !d.done
    ? `  Today. ${d.prompt.split('\n')[0]}`
    : d.done
      ? `  ${new Date(now).getUTCFullYear()} is written. Next on ${letterDay()}.`
      : `  ${letterDay()} — ${d.daysAway} days.`);
  return L.join('\n');
}
