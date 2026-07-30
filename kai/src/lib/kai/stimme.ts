/* ============================================================
   §40.1 DIE STIMME — the voice that speaks first.

   The default interaction stops being "open an app". KAI says one
   sentence at the moment it matters, and the screen is only for arguing
   with it.

   ── THE ONLY HARD PROBLEM HERE IS RESTRAINT ───────────────────
   A machine that can speak unprompted will, unless something stops it.
   Every notification system ever built began as "only when it matters"
   and ended as noise the owner swipes away without reading. Once that
   happens the channel is dead, and the one message that actually
   mattered dies with it.

   So the interruption has to EARN itself, and the bar is in code:

     1. ACTIONABLE OR SILENT. If there is nothing to answer yes or no
        to, it is not worth a sentence in his ear. No status updates,
        no "just so you know", no encouragement.
     2. QUIET HOURS ARE QUIET. Nothing between 23:00 and 06:00 unless
        the thing genuinely dies before morning.
     3. THREE A DAY, MAXIMUM. A budget is what makes the fourth thing
        worth hearing. When the budget is spent it waits.
     4. NEVER THE SAME THING TWICE. Spoken once, by subject, ever.
     5. ONE BREATH. Hard character cap — if it does not fit, it is not
        a sentence, it is a briefing, and briefings belong on screen.

   ── §40.5, ENFORCED WHERE IT MATTERS MOST ─────────────────────
   Every interruption that PROPOSES something carries its own
   counter-argument. Not behind a tap — attached, in the same object.
   The moment KAI interrupts a man to suggest an action is exactly the
   moment a machine that only agrees becomes dangerous, so the counter
   is a required field and an interruption cannot be built without one.

   ── WHAT THIS FILE DOES NOT DO ────────────────────────────────
   It does not deliver. It decides WHAT is worth saying and WHEN, and
   returns it. Delivery is the platform's problem — web push where it
   works, the app's own voice when open — and on iOS a PWA cannot speak
   into a walk to the car. That limit is real and is not papered over
   here.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { type CouncilContext } from './council';
import { dueToday, isHeatwave, getCachedTempC } from './garden';
import { getPending } from './pending';

const DAY = 86_400_000;
const HOUR = 3_600_000;

const MAX_PER_DAY = 3;
const ONE_BREATH = 96;        // characters
const QUIET_FROM = 23;
const QUIET_UNTIL = 6;

export interface Interruption {
  /* The subject. Spoken once by this key, ever. */
  key: string;
  text: string;
  /* §40.5 — the counter-argument, attached, always. Required by the
     type: an interruption literally cannot be constructed without one. */
  counter: string;
  why: string;
  evidence: string[];
  /* Does it die before morning? Only these may break quiet hours. */
  perishable: boolean;
  urgency: number;
}

/* ── the ledger of what has been said ────────────────────────── */

export function spokenKeys(now = Date.now()): Set<string> {
  return new Set(
    getEvents({ domain: 'system', type: 'stimme_spoke' })
      .filter((e) => e.ts <= now)
      .map((e) => String(e.meta?.key || '')),
  );
}

export function spokenToday(now = Date.now()): number {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return getEvents({ domain: 'system', type: 'stimme_spoke', since: start.getTime() })
    .filter((e) => e.ts <= now).length;
}

export function recordSpoken(i: Interruption, now = Date.now()): void {
  try {
    logEvent({
      domain: 'system', type: 'stimme_spoke',
      meta: { key: i.key, text: i.text, counter: i.counter, urgency: i.urgency },
      source: 'auto', ts: now,
    });
  } catch { /* ignore */ }
}

/* ── the candidates ──────────────────────────────────────────── */

type Maker = (ctx: CouncilContext, now: number) => Interruption | null;

/* The brief's first example, built on the same honest predicate as §39:
   the second clause is an ABSENCE and is only said once looked for. */
const turnover: Maker = (_ctx, now) => {
  const bookings = getEvents({ domain: 'makadi', type: 'booking_confirmed' });
  for (const b of bookings) {
    const raw = b.meta?.checkout ?? b.meta?.endsAt ?? b.meta?.until;
    const out = typeof raw === 'number' ? raw : Date.parse(String(raw ?? ''));
    if (!isFinite(out)) continue;
    const days = Math.round((out - now) / DAY);
    if (days < 0 || days > 1) continue;
    const guest = String(b.meta?.guest || '').trim();
    if (!guest) continue;                       // cannot check silence → say nothing

    const told = getEvents({ since: b.ts }).some((e) => {
      if (!/email_sent|sms_sent|message_sent/.test(e.type)) return false;
      const blob = JSON.stringify(e.meta || {}).toLowerCase();
      return blob.includes(guest.toLowerCase()) || /clean|turnover|housekeep/.test(blob);
    });
    if (told) return null;

    return {
      key: 'turnover:' + b.id,
      text: `${guest} checks out ${days === 0 ? 'today' : 'tomorrow'}, the cleaner doesn't know.`,
      counter: 'Unless you already told them by phone — nothing on the record proves you did or did not.',
      why: 'A confirmed booking ending, with no outbound message about the turnover since it was booked.',
      evidence: [b.id], perishable: days === 0, urgency: 800 + (days === 0 ? 100 : 0),
    };
  }
  return null;
};

/* The brief's second example. Heat is a real cached reading, not a guess. */
const heat: Maker = (_ctx, now) => {
  if (!isHeatwave()) return null;
  const t = getCachedTempC();
  const due = dueToday(now);
  if (!due.length) return null;
  const worst = due[0];
  return {
    key: 'heat:' + new Date(now).toISOString().slice(0, 10),
    text: `${t} degrees. ${due.length === 1 ? worst.name : `${due.length} plants`} needs water tonight.`,
    counter: `The heat reading is cached, not live — if it has broken since, tonight can wait for morning.`,
    why: `Cached temperature at or above the heatwave threshold, which tightens every watering interval by 40%.`,
    evidence: [], perishable: true, urgency: 700 + due.length,
  };
};

/* A guest waiting. Perishable by definition — this is the one that pays. */
const waiting: Maker = (ctx, now) => {
  const open = ctx.openInquiries || [];
  if (!open.length) return null;
  const oldest = open.reduce((a, b) => (a.ts < b.ts ? a : b));
  const hours = Math.floor((now - oldest.ts) / HOUR);
  if (hours < 2) return null;
  const guest = String(oldest.meta?.guest || '').trim() || 'Someone';
  return {
    key: 'waiting:' + oldest.id,
    text: `${guest} has been waiting ${hours} hours. Send the reply?`,
    counter: `Replying fast wins the booking, but a rushed price is harder to undo than a slow answer.`,
    why: 'A booking inquiry with no reply and no booking against it.',
    evidence: [oldest.id], perishable: true, urgency: 900 + Math.min(hours, 100),
  };
};

/* §40.3 — something already drafted, sitting one tap from done. The
   interruption exists because the WORK is finished, not to ask for it. */
const ready: Maker = (_ctx, now) => {
  const pending = getPending();
  if (!pending.length) return null;
  const p = pending[0];
  return {
    key: 'ready:' + p.id,
    text: `${p.summary} — drafted and waiting. Send it?`,
    counter: `I wrote it, so I am the wrong one to judge it. Read it before you say yes.`,
    why: 'An action is already composed and sitting at the Gate.',
    evidence: [], perishable: false, urgency: 600,
  };
};

/* A date that does not move, arriving tomorrow. */
const tomorrow: Maker = (_ctx, now) => {
  const dls = (() => {
    try { return JSON.parse(localStorage.getItem('kai.deadlines') || '[]') as Array<{ id: string; text: string; date: number }>; }
    catch { return []; }
  })();
  const next = dls.filter((d) => d.date > now && d.date - now <= 2 * DAY).sort((a, b) => a.date - b.date)[0];
  if (!next) return null;
  return {
    key: 'deadline:' + next.id,
    text: `${next.text} — tomorrow.`,
    counter: `You may already have this handled; I only know it has a date, not whether you are ready.`,
    why: 'A hard date you set, inside 48 hours.',
    evidence: [], perishable: false, urgency: 750,
  };
};

const MAKERS: Maker[] = [waiting, turnover, heat, tomorrow, ready];

/* ── the gate ─────────────────────────────────────────────────
   Everything above is a candidate. This decides whether ANY of it has
   earned a sentence in his ear right now. */

export interface Silence { silent: true; reason: string }
export type Verdict = Interruption | Silence;

export function isSilent(v: Verdict): v is Silence { return (v as Silence).silent === true; }

export function worthSpeaking(ctx: CouncilContext, now = Date.now()): Verdict {
  const hour = new Date(now).getHours();
  const quiet = hour >= QUIET_FROM || hour < QUIET_UNTIL;

  const said = spokenKeys(now);
  const candidates = MAKERS
    .map((m) => { try { return m(ctx, now); } catch { return null; } })
    .filter((i): i is Interruption => i !== null)
    .filter((i) => !said.has(i.key))
    .filter((i) => i.text.length <= ONE_BREATH)
    .sort((a, b) => b.urgency - a.urgency);

  if (!candidates.length) return { silent: true, reason: 'nothing on the record has earned a sentence' };

  /* Quiet hours: only what dies before morning may wake him. */
  const allowed = quiet ? candidates.filter((i) => i.perishable) : candidates;
  if (!allowed.length) {
    return { silent: true, reason: `quiet hours — ${candidates.length} thing(s) waiting, none of which dies before morning` };
  }

  /* The budget is what makes the next one worth hearing. */
  const used = spokenToday(now);
  if (used >= MAX_PER_DAY) {
    return { silent: true, reason: `already said ${used} things today — the rest waits, or the channel becomes noise` };
  }

  return allowed[0];
}

/* ── the readout ─────────────────────────────────────────────── */

export function stimmeText(ctx: CouncilContext, now = Date.now()): string {
  const v = worthSpeaking(ctx, now);
  const L: string[] = ['DIE STIMME', ''];
  if (isSilent(v)) {
    L.push('Silent.');
    L.push(`  ${v.reason}.`);
    L.push('');
    L.push('Silence is the default state, not a failure to find something.');
    return L.join('\n');
  }
  L.push(`"${v.text}"`);
  L.push('');
  L.push(`  against it: ${v.counter}`);
  L.push(`  because:    ${v.why}`);
  L.push(`  ${v.perishable ? 'perishable — may break quiet hours' : 'can wait for morning'}`);
  L.push('');
  L.push(`Said ${spokenToday(now)} of ${MAX_PER_DAY} today.`);
  return L.join('\n');
}

/* What it has ever said, so the record shows every interruption. */
export function spokenLog(now = Date.now(), limit = 20): Array<{ at: number; text: string }> {
  return getEvents({ domain: 'system', type: 'stimme_spoke' })
    .filter((e) => e.ts <= now)
    .slice(-limit)
    .map((e) => ({ at: e.ts, text: String(e.meta?.text || '') }));
}
