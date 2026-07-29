/* ============================================================
   §45 DER ORDEN — the method, on someone who is not you.

   TIER 1 ONLY. The brief sets its own gate — "don't touch tier 2 or 3
   until tier 1 proves it" — and that gate is enforced here in code
   rather than left as an intention, because it is the correct rule and
   the most likely one to be quietly skipped in a good mood.

   ── WHAT TIER 1 ACTUALLY NEEDS, WHICH IS NOT MUCH CODE ────────
   Five people each need their own Spine, and they already get one:
   storage is per-browser, so five people on five devices are five
   isolated instances without a line of multi-tenancy.

   The real blocker is that a fresh instance is ALI'S. kaiConfig names
   him, his flat, his garden, his card. Katie opening it is greeted by
   somebody else's life, and she closes it. So this file holds an
   instance IDENTITY that overrides the personal defaults, and an
   onboarding that refuses to be finished half-done.

   ── THE PROOF, AND THE ONE THING IT CANNOT MEASURE ────────────
   "Useful" is not observable. This can count days used, commitments
   made, promises resolved, returns after a gap — all real. None of it
   is usefulness. A person can use a thing daily and resent it.

   So the proof has TWO halves and needs both:
     · MEASURED — from their Spine, automatically
     · THEIR VERDICT — in their words, recorded by them

   And Ali cannot supply the second. `recordVerdict` refuses anything
   not authored by the member, for the same reason an advisor cannot
   mark its own homework: the person with the most to gain from a yes
   is exactly the person whose yes means nothing.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { getCommitments } from './commitments';
import { read, write, emit } from './store';

const DAY = 86_400_000;
const PROOF_DAYS = 30;
const MIN_ACTIVE = 12;        // days they actually touched it, of 30

/* ── the instance ────────────────────────────────────────────
   Whose life is this? Unset means Ali's defaults, which is correct for
   his own device and wrong for everybody else's. */

export interface Identity {
  name: string;
  /* Which organs this person actually has. Ali's flat and garden are
     not universal, and showing empty ones is how a tool feels like it
     was built for somebody else. */
  organs: string[];
  startedAt: number;
  invitedBy?: string;
}

const ID_KEY = 'kai.orden.identity';

export function identity(): Identity | null {
  const i = read<Identity | null>(ID_KEY, null);
  return i && typeof i.name === 'string' && i.name.trim() ? i : null;
}

export interface SetResult { ok: boolean; reason: string }

/* Onboarding refuses to finish half-done. A member with a name and no
   organs gets a dashboard of somebody else's assets, which is the exact
   failure this tier exists to avoid. */
export function onboard(name: string, organs: string[], invitedBy = '', now = Date.now()): SetResult {
  if (!name.trim()) return { ok: false, reason: 'A name. Without it every line reads as somebody else.' };
  if (!organs.length) {
    return {
      ok: false,
      reason: 'Refused — no organs chosen. An instance with none shows Ali\'s flat and Ali\'s garden, and the person closes it in ten seconds. Pick what THEY actually have, even if it is one thing.',
    };
  }
  const id: Identity = { name: name.trim(), organs, startedAt: now, invitedBy: invitedBy || undefined };
  write(ID_KEY, id); emit();
  try { logEvent({ domain: 'system', type: 'orden_onboarded', meta: { name: id.name, organs: organs.length }, source: 'user', ts: now }); } catch { /* ignore */ }
  return { ok: true, reason: `${id.name}'s instance. ${organs.length} organ${organs.length === 1 ? '' : 's'}. Their Spine starts empty and stays theirs.` };
}

/* ── the measured half ───────────────────────────────────────── */

export interface Use {
  daysSinceStart: number;
  activeDays: number;
  commitmentsMade: number;
  commitmentsResolved: number;
  longestGapDays: number;
  returnedAfterGap: boolean;
}

function dayKey(ts: number): string { return new Date(ts).toISOString().slice(0, 10); }

export function measuredUse(now = Date.now()): Use {
  const id = identity();
  const start = id?.startedAt ?? (() => {
    const all = getEvents({});
    return all.length ? Math.min(...all.map((e) => e.ts)) : now;
  })();

  const theirs = getEvents({ since: start }).filter((e) => e.ts <= now && (e.source === 'user' || e.source === 'voice'));
  const days = [...new Set(theirs.map((e) => dayKey(e.ts)))].sort();

  let longestGap = 0;
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round((Date.parse(days[i]) - Date.parse(days[i - 1])) / DAY) - 1;
    longestGap = Math.max(longestGap, gap);
  }
  /* Coming back after a real gap is the strongest usage signal there is
     — anyone can use a new thing for four days. */
  const returnedAfterGap = longestGap >= 3 && days.length > 0 &&
    Date.parse(days[days.length - 1]) > Date.parse(days[0]) + longestGap * DAY;

  const cs = getCommitments();
  return {
    daysSinceStart: Math.floor((now - start) / DAY),
    activeDays: days.length,
    commitmentsMade: cs.length,
    commitmentsResolved: cs.filter((c) => c.status !== 'open').length,
    longestGapDays: longestGap,
    returnedAfterGap,
  };
}

/* ── their verdict — and only theirs ─────────────────────────── */

export interface Verdict { useful: boolean; words: string; at: number }

export function verdict(now = Date.now()): Verdict | null {
  const e = getEvents({ domain: 'system', type: 'orden_verdict' }).filter((x) => x.ts <= now).slice(-1)[0];
  if (!e) return null;
  return { useful: e.meta?.useful === true, words: String(e.meta?.words || ''), at: e.ts };
}

export function recordVerdict(useful: boolean, words: string, by: 'member' | 'owner', now = Date.now()): SetResult {
  if (by !== 'member') {
    return {
      ok: false,
      reason: 'Refused — you cannot record their verdict. The person with the most to gain from a yes is exactly the person whose yes means nothing. They say it, in their words, on their device.',
    };
  }
  if (!words.trim()) {
    return { ok: false, reason: 'Refused — a yes with no words behind it is a politeness. What did it actually do for them?' };
  }
  try {
    logEvent({ domain: 'system', type: 'orden_verdict', meta: { useful, words: words.slice(0, 400) }, source: 'user', ts: now });
  } catch { /* ignore */ }
  return { ok: true, reason: 'Recorded, in their words.' };
}

/* ── the proof ───────────────────────────────────────────────── */

export interface Proof {
  use: Use;
  verdict: Verdict | null;
  /* null = not yet decidable. Never defaults to true. */
  passed: boolean | null;
  line: string;
}

export function proof(now = Date.now()): Proof {
  const use = measuredUse(now);
  const v = verdict(now);

  let passed: boolean | null = null;
  let line: string;

  if (!identity()) {
    line = 'No instance onboarded. Tier 1 has not started — this is still your own device, and it cannot prove anything about anyone else.';
  } else if (use.daysSinceStart < PROOF_DAYS) {
    line = `Day ${use.daysSinceStart} of ${PROOF_DAYS}. ${use.activeDays} active days so far. Nothing is decided until the thirty are done — a good first week is what every abandoned app also had.`;
  } else if (!v) {
    line = `${PROOF_DAYS} days done · ${use.activeDays} active days${use.returnedAfterGap ? ' · they came back after a gap' : ''}. The measurement is in; their verdict is not. Ask them, and let them answer.`;
  } else {
    /* BOTH halves. Usage alone cannot pass it and neither can a kind word. */
    passed = v.useful && use.activeDays >= MIN_ACTIVE;
    line = passed
      ? `PASSED. ${use.activeDays} active days of ${PROOF_DAYS}, and they said it was useful: "${v.words}"`
      : v.useful
        ? `NOT PASSED. They said it was useful — "${v.words}" — but they only opened it ${use.activeDays} days of ${PROOF_DAYS}. A kind word is not a habit, and this is the gentler failure, not a pass.`
        : `NOT PASSED. They used it ${use.activeDays} days and said it was not useful: "${v.words}". That is the finding. It is worth more than a year of building.`;
  }

  return { use, verdict: v, passed, line };
}

/* ── THE GATE ON TIERS 2 AND 3 ───────────────────────────────
   His own rule, made mechanical. A function rather than a comment so
   that any future code asking the question gets the same answer, and
   so that skipping it requires editing this file on purpose. */

export interface TierGate { open: boolean; reason: string }

export function mayProductize(now = Date.now()): TierGate {
  const p = proof(now);
  if (p.passed === true) {
    return { open: true, reason: `Tier 1 passed. ${p.line} Tier 2 is now a decision rather than a hope.` };
  }
  return {
    open: false,
    reason: `Tier 2 and 3 are closed. ${p.line}\n\nThis is your own gate, not mine: one person outside your head using it for 30 days and finding it useful is worth more than any amount of building. Nothing here stops you overriding it — but you would be overriding a rule you wrote while thinking clearly.`,
  };
}

export function ordenText(now = Date.now()): string {
  const id = identity();
  const p = proof(now);
  const g = mayProductize(now);
  const L = ['DER ORDEN', ''];

  L.push('TIER 1 — THE CIRCLE');
  L.push(id
    ? `  ${id.name}'s instance · ${id.organs.length} organ${id.organs.length === 1 ? '' : 's'} · day ${p.use.daysSinceStart}`
    : '  Not started. This is still your own device.');
  L.push('');
  L.push('THE PROOF:');
  L.push('  ' + p.line);
  if (id) {
    L.push('');
    L.push(`  measured: ${p.use.activeDays} active days · ${p.use.commitmentsMade} commitments, ${p.use.commitmentsResolved} resolved · longest gap ${p.use.longestGapDays}d${p.use.returnedAfterGap ? ' · returned after it' : ''}`);
    L.push('  Usage is not usefulness. A person can use a thing daily and resent it, so their own verdict is required and cannot be supplied for them.');
  }
  L.push('');
  L.push('TIER 2 & 3:');
  L.push('  ' + g.reason.split('\n')[0]);
  return L.join('\n');
}
