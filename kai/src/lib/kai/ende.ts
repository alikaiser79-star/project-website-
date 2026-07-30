/* ============================================================
   §50 DAS ENDE DES BAUENS — the last one, and it is a lock.

   ── WHAT THIS CAN AND CANNOT DO, SAID FIRST ───────────────────
   It cannot stop him. Nothing in a browser tab can stop a man opening
   a terminal and writing §51 tonight, and a file claiming otherwise
   would be theatre in the one section whose entire premise is "not a
   suggestion — a mechanism".

   So this is a COMMITMENT DEVICE, not a cage. Its power is not that
   breaking it is impossible; it is that breaking it is visible, dated,
   and requires a deliberate act rather than a drift. Three real
   mechanisms, in increasing order of teeth:

     1. THE QUEUE REFUSES TO OPEN. Ideas go in and cannot be read back
        until the freeze lifts. Re-reading the list is how you get
        pulled back in, so the list is shut.
     2. KAI DECLINES TO HELP BUILD. That is genuinely enforceable,
        because it is KAI's own behaviour and nothing else's.
     3. PREFLIGHT FAILS THE BUILD on a new section module while frozen.
        This is the one with actual teeth, because preflight is the gate
        every push already goes through. It is overridable — blocking a
        real emergency fix would be worse than the freeze is good — but
        the override is loud and leaves a record.

   FREEZE.json is the single source both this file and preflight read.
   It lives in the repo on purpose: lifting the freeze early is then a
   COMMIT, with a date and a message, rather than a quiet flag flip on
   one device at 2am.

   ── AND THE GATE JUDGES HIM, NOT THE OTHER WAY ROUND ──────────
   Two of the three unlock conditions are computed from the Spine and
   cannot be argued with. The third — every merged branch verified on
   device — is NOT computable: KAI has no view of git, no idea what is
   merged, and no way to confirm a build ran on his phone. It is his
   attestation, it is labelled as his attestation everywhere it appears,
   and an unattested gate is CLOSED. Treating silence as a pass would
   make the whole gate decorative.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { makadiProfit } from './makadiProfit';
import { organUse, ORGANS } from './preis';
import { read, write, emit } from './store';
import FREEZE from '../../../FREEZE.json';

const DAY = 86_400_000;

export const FREEZE_DAYS: number = Number(FREEZE.days) || 90;
export const STREAK_REQUIRED = 60;

/* ── when it started ─────────────────────────────────────────
   The declared ship date from FREEZE.json, but never EARLIER than the
   first time this device saw it: an install that only starts running
   the app in October should not be told it has already served two
   months of a freeze it was never subject to. */

const SEEN_KEY = 'kai.ende.firstSeen';

export function startedAt(now = Date.now()): number {
  const declared = Date.parse(String(FREEZE.startedAt) + 'T00:00:00Z');
  let seen = read<number>(SEEN_KEY, 0);
  if (!seen) {
    seen = now;
    write(SEEN_KEY, seen);
    try { logEvent({ domain: 'system', type: 'freeze_started', meta: { declared: FREEZE.startedAt, sections: FREEZE.sections }, source: 'auto', ts: now }); } catch { /* ignore */ }
  }
  return Math.max(Number.isFinite(declared) ? declared : seen, seen);
}

export function endsAt(now = Date.now()): number { return startedAt(now) + FREEZE_DAYS * DAY; }

/* ── 2. THE PROOF GATE ───────────────────────────────────────── */

export type Known = 'computed' | 'attested';

export interface Criterion {
  key: string;
  label: string;
  met: boolean;
  known: Known;
  detail: string;
}

/* Consecutive days ending today or yesterday. A 60-day run that stopped
   in August is not a habit in November, and counting the longest run
   ever would let one good stretch unlock the gate forever. */
export function streak(now = Date.now()): number {
  const days = new Set(
    getEvents({ since: now - 400 * DAY })
      .filter((e) => e.ts <= now && (e.source === 'user' || e.source === 'voice'))
      .map((e) => new Date(e.ts).toISOString().slice(0, 10)),
  );
  if (!days.size) return 0;

  const key = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  /* Allow the run to end yesterday — asking at 9am before he has logged
     anything should not read as a broken streak. */
  let cursor = days.has(key(now)) ? now : days.has(key(now - DAY)) ? now - DAY : 0;
  if (!cursor) return 0;

  let n = 0;
  while (days.has(key(cursor))) { n++; cursor -= DAY; }
  return n;
}

export interface Attestation { sha: string; note: string; at: number }

export function attestations(now = Date.now()): Attestation[] {
  return getEvents({ domain: 'system', type: 'freeze_verified' })
    .filter((e) => e.ts <= now)
    .map((e) => ({ sha: String(e.meta?.sha || ''), note: String(e.meta?.note || ''), at: e.ts }))
    .sort((a, b) => b.at - a.at);
}

export interface AttestResult { ok: boolean; reason: string }

export function attestVerified(sha: string, note: string, now = Date.now()): AttestResult {
  const s = String(sha || '').trim();
  if (!/^[0-9a-f]{7,40}$/i.test(s)) {
    return { ok: false, reason: 'Give the commit SHA you actually opened on the device. "verified a94d54a everything renders, gmail works".' };
  }
  if (!note.trim()) {
    return { ok: false, reason: 'Say what you checked. "verified" with nothing behind it is the tick-box version of testing, and this gate exists because that version does not work.' };
  }
  try {
    logEvent({ domain: 'system', type: 'freeze_verified', meta: { sha: s.toLowerCase(), note: note.trim().slice(0, 300) }, source: 'user', ts: now });
  } catch { /* ignore */ }
  emit();
  return {
    ok: true,
    reason: `${s.slice(0, 7)} recorded as verified on device. This is the one gate condition I cannot check — I have no view of git and no way to know what ran on your phone, so it stands on your word and is labelled that way wherever it appears.`,
  };
}

export function criteria(now = Date.now()): Criterion[] {
  const from = startedAt(now);
  const st = streak(now);
  const att = attestations(now).filter((a) => a.at >= from);
  const m = makadiProfit(now);

  return [
    {
      key: 'streak', label: `${STREAK_REQUIRED} consecutive days of logging`,
      met: st >= STREAK_REQUIRED, known: 'computed',
      detail: st >= STREAK_REQUIRED
        ? `${st} days and counting.`
        : `${st} of ${STREAK_REQUIRED}. Counted from the Spine, ending today or yesterday — an old run that already broke does not count, or one good fortnight would unlock this forever.`,
    },
    {
      key: 'verified', label: 'Every merged branch verified on device',
      met: att.length > 0, known: 'attested',
      detail: att.length
        ? `${att.length} attestation${att.length === 1 ? '' : 's'} since the freeze began, latest ${att[0].sha.slice(0, 7)}: "${att[0].note}". Your word — I cannot see git and I cannot see your phone.`
        : 'Nothing attested since the freeze began. I cannot compute this one, so silence is a NO rather than a maybe — a gate that passes on missing data is not a gate.',
    },
    {
      key: 'makadi', label: 'The Makadi profit line above zero',
      met: m.net > 0, known: 'computed',
      /* NOTHING LOGGED is not the same fact as NET ZERO. Printing
         "0 EGP — 0 more nights" for an empty record reads as
         break-even, which is the opposite of the truth and exactly the
         kind of nothing-dressed-as-a-result this project keeps
         catching. */
      detail: m.spent === 0 && m.earned === 0
        ? 'Nothing logged — neither spend nor takings. That is not a zero profit line, it is an absent one, and it cannot open a gate.'
        : m.net > 0
          ? `${Math.round(m.net).toLocaleString('en-GB')} EGP above water.`
          : `${Math.round(m.net).toLocaleString('en-GB')} EGP — ${m.nightsToBreakEven} more night${m.nightsToBreakEven === 1 ? '' : 's'} at the realised rate. Computed from bookings that actually happened.`,
    },
  ];
}

export interface Gate { open: boolean; byDate: boolean; byProof: boolean; daysLeft: number; criteria: Criterion[]; line: string }

export function gate(now = Date.now()): Gate {
  const cs = criteria(now);
  const byProof = cs.every((c) => c.met);
  const daysLeft = Math.max(0, Math.ceil((endsAt(now) - now) / DAY));
  const byDate = daysLeft === 0;

  return {
    open: byDate || byProof, byDate, byProof, daysLeft, criteria: cs,
    line: byProof
      ? 'All three are true. The freeze lifts early — that was the deal, and the deal was with the record, not with your mood.'
      : byDate
        ? `${FREEZE_DAYS} days done. It opens on time.`
        : `${daysLeft} days left, or all three below turn true — whichever comes first.`,
  };
}

export function frozen(now = Date.now()): boolean { return !gate(now).open; }

/* ── 1. THE QUEUE — captured, and shut ───────────────────────── */

export interface Idea { text: string; at: number }
const QUEUE_KEY = 'kai.ende.queue';

export function queueCount(): number { return read<Idea[]>(QUEUE_KEY, []).length; }

export function capture(text: string, now = Date.now()): AttestResult {
  const t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'Nothing to hold.' };
  const q = read<Idea[]>(QUEUE_KEY, []);
  q.push({ text: t.slice(0, 600), at: now });
  write(QUEUE_KEY, q); emit();
  try { logEvent({ domain: 'system', type: 'freeze_captured', meta: { chars: t.length }, source: 'user', ts: now }); } catch { /* ignore */ }
  const g = gate(now);
  return {
    ok: true,
    reason: `Held. ${q.length} idea${q.length === 1 ? '' : 's'} in the queue, and none of them are getting built ${g.open ? 'until you open it' : `for ${g.daysLeft} days`}. ` +
      'I am not going to read it back to you either — re-reading the list is how you end up building from it.',
  };
}

export interface QueueRead { ok: boolean; ideas: Idea[] | null; reason: string }

export function readQueue(now = Date.now()): QueueRead {
  const q = read<Idea[]>(QUEUE_KEY, []);
  const g = gate(now);
  if (!g.open) {
    return {
      ok: false, ideas: null,
      reason: `${q.length} idea${q.length === 1 ? '' : 's'} in there and I am not opening it. ${g.line}\n\n` +
        'The queue is shut rather than merely unbuilt because reading it is the first move of building it. You can add to it whenever you like.',
    };
  }
  return { ok: true, ideas: q, reason: `${q.length} idea${q.length === 1 ? '' : 's'}, ${g.byProof ? 'unlocked by the proof gate' : 'unlocked on time'}.` };
}

/* ── 3. WHAT KAI DOES INSTEAD ────────────────────────────────── */

export const INSTEAD = [
  'It runs. That is the whole answer and it is not a small one.',
  'It logs what you actually do, which is the only data that has ever been missing.',
  'It watches the Makadi line, the card, the garden and the calendar without being asked.',
  'It asks one question a week and one a quarter, and records the answers without grading them.',
  'It gets sharper — every threshold in here is guessing until there are ninety days behind it.',
];

/* ── 2b. WHAT KAI WILL NOT DO WHILE FROZEN ───────────────────── */

export function refuseToBuild(what: string, now = Date.now()): string | null {
  const g = gate(now);
  if (g.open) return null;
  return `No. ${g.daysLeft} days left on the freeze, and "${String(what || 'that').slice(0, 80)}" is a new section.\n\n` +
    'Captured if you want it — "capture <the idea>" — but not designed, not planned, and not written. ' +
    'I will not help you spec it either, because a fully specified idea is three quarters built and we both know it.\n\n' +
    'Honest limit: I cannot actually stop you. You can open a terminal tonight and write it, and nothing here will prevent that. ' +
    'What this does is make it a decision with a date on it instead of a Tuesday evening that got away from you.';
}

/* ── 4. THE UNLOCK MESSAGE ───────────────────────────────────── */

/* Written now, rendered on the day — with the count computed AT UNLOCK
   rather than guessed today. The brief's own draft said "used four";
   nobody knows that number yet, and shipping a specific number that
   turns out wrong would undermine the one message meant to land. */
export function unlockMessage(now = Date.now()): string {
  const used = organUse(FREEZE_DAYS, now).filter((o) => o.uses > 0);
  const sections = Number(FREEZE.sections) || 50;
  const L: string[] = [];

  L.push('THE FREEZE IS OVER.');
  L.push('');
  L.push(`You built ${sections} sections in five weeks and used ${used.length === 0 ? 'none of them' : `${used.length} of ${ORGANS.length} organs`}.`);
  if (used.length) L.push(`  ${used.sort((a, b) => b.uses - a.uses).map((o) => `${o.key} (${o.uses})`).join(' · ')}`);
  L.push('');
  L.push(`${FREEZE_DAYS} days of use taught you more about what this needs than five weeks of building did.`);
  L.push('Now build the right thing.');
  L.push('');
  const q = queueCount();
  L.push(q
    ? `${q} idea${q === 1 ? '' : 's'} waited in the queue. Read them now — and notice how many you no longer want.`
    : 'The queue is empty. Ninety days and not one idea survived long enough to be written down. That is worth sitting with.');
  return L.join('\n');
}

export function endeText(now = Date.now()): string {
  const g = gate(now);
  if (g.open) return unlockMessage(now);

  const L = ['DAS ENDE DES BAUENS', ''];
  L.push(`FROZEN — ${g.daysLeft} day${g.daysLeft === 1 ? '' : 's'} left.`);
  L.push(`  Started ${new Date(startedAt(now)).toISOString().slice(0, 10)}, opens ${new Date(endsAt(now)).toISOString().slice(0, 10)}.`);
  L.push('');
  L.push('THE PROOF GATE — all three, and it opens early:');
  for (const c of g.criteria) {
    L.push(`  [${c.met ? '✓' : ' '}] ${c.label}   (${c.known})`);
    L.push(`      ${c.detail}`);
  }
  L.push('');
  L.push(`QUEUE: ${queueCount()} held, and shut. "capture <idea>" adds; nothing opens it early.`);
  L.push('');
  L.push('WHAT I DO INSTEAD:');
  for (const i of INSTEAD) L.push('  · ' + i);
  L.push('');
  L.push('I cannot stop you building. I can make it a decision with a date on it rather than a Tuesday that got away from you — and preflight will fail a new section module until this lifts.');
  return L.join('\n');
}
