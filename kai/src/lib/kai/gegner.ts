/* ============================================================
   §33.3 DER GEGNER — the adversary.

   Every other surface in KAI works for Ali. This one works against him.
   It reads the same Spine and asks a single question: if I wanted this
   operation to fail inside ninety days, where would I push?

   Five vectors, ranked by probability × damage. Then, separately and
   unconditionally, THE AVOIDANCE — the one thing the record shows he is
   walking around. That section is not ranked and cannot be outranked,
   because the thing you are avoiding is never the thing you'd rank first.

   HONESTY RULES, enforced in code rather than intention:

     • A "probability" is the easiest place in this whole app to invent
       precision. So none is invented. Every one is a FRACTION OF COUNTED
       EVENTS and carries that fraction in its own text — "4 of the last 6
       months", not "67% likely". If the denominator is too small to mean
       anything, the vector returns nothing instead of guessing.
     • Damage is in EGP where the Spine holds money, and in days where it
       holds time. Never a made-up severity score.
     • Every vector cites the event ids it stands on.
     • A vector with no evidence returns null. Silence is the correct
       output for an operation with no visible weak point, and staying
       silent is what makes the loud cases worth reading.
     • The adversary does not propose. It has no hands and reaches nothing
       — it returns text. The Gate never sees this file.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';
import { getCommitments } from './commitments';
import { computeRunway } from './runway';
import { read } from './store';

const DAY = 86_400_000;

export interface Attack {
  id: string;
  vector: string;             // how it kills him, in one line
  /* p is a real fraction of counted events; num/den are shown to him so
     the number can never pass itself off as a forecast. */
  p: number;
  pBasis: string;             // "4 of the last 6 months"
  /* damage is null when the record genuinely cannot cost it. A zero would
     read as "costs nothing", which is a different and false claim. */
  damage: number | null;      // EGP, or days when unit === 'days'
  unit: 'EGP' | 'days';
  damageBasis: string;
  /* THE RANKING QUANTITY, in EGP, so days and money are never compared as
     if they were the same thing. Days become EGP only through the Spine's
     own measured daily burn — never through a constant I picked. When it
     cannot be derived, this is null and the vector is NOT ranked: it is
     reported separately, saying so. */
  damageEgp: number | null;
  score: number | null;       // p × damageEgp — an ordering key, never printed
  evidence: string[];         // event ids
  cheapestDefence: string;
}

function ids(evs: KaiEvent[], n = 6): string[] { return evs.slice(-n).map((e) => e.id); }
function egp(n: number): string { return Math.round(n).toLocaleString('en-GB') + ' EGP'; }
function monthKey(ts: number): string { return new Date(ts).toISOString().slice(0, 7); }

/* ── 1. CONCENTRATION ─────────────────────────────────────────
   One source carries the operation. Kill it and the rest is noise. */
function concentration(now: number): Attack | null {
  const since = now - 180 * DAY;
  const income = getEvents({ domain: 'income', since }).filter((e) => typeof e.value === 'number' && e.value > 0);
  if (income.length < 6) return null;                    // too thin to claim anything

  const bySource = new Map<string, { total: number; evs: KaiEvent[] }>();
  for (const e of income) {
    const k = String(e.meta?.label || e.meta?.source || e.type || 'unlabelled');
    const cur = bySource.get(k) || { total: 0, evs: [] };
    cur.total += e.value as number; cur.evs.push(e);
    bySource.set(k, cur);
  }
  if (bySource.size < 2) return null;                    // nothing to compare against

  const total = income.reduce((s, e) => s + (e.value as number), 0);
  const [name, top] = [...bySource.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  const share = top.total / total;
  if (share < 0.6) return null;                          // not concentrated enough to be the story

  /* Probability = how often this source has ALREADY missed a month, counted
     over the CALENDAR span of the record. The first version built the month
     list out of months that had income in them, which made a month where
     nothing at all arrived invisible — the exact month a missed payment
     lives in. It could therefore only ever report zero misses. */
  const first = Math.min(...income.map((e) => e.ts));
  const span: string[] = [];
  for (let t = first; t <= now; t += 28 * DAY) {
    const k = monthKey(t);
    if (!span.includes(k)) span.push(k);
  }
  const nowKey = monthKey(now);
  if (!span.includes(nowKey)) span.push(nowKey);
  if (span.length < 3) return null;

  const monthsWithTop = new Set(top.evs.map((e) => monthKey(e.ts)));
  const missed = span.filter((m) => !monthsWithTop.has(m)).length;
  const monthly = top.total / Math.max(1, monthsWithTop.size);

  /* Never produced a miss? Then the record holds no failure rate, and
     multiplying by zero would rank a 93%-of-income dependency last. Report
     it — but outside the ranking, saying exactly why. */
  const rankable = missed > 0;
  return {
    id: 'concentration',
    vector: `Cut "${name}" and ${Math.round(share * 100)}% of your income stops at once.`,
    p: missed / span.length,
    pBasis: rankable
      ? `it already produced nothing in ${missed} of the ${span.length} months on record`
      : `it has never missed a month in the ${span.length} on record, so the record gives no failure rate to multiply — the ${Math.round(share * 100)}% exposure is the whole finding`,
    damage: monthly,
    unit: 'EGP',
    damageBasis: `${egp(monthly)} a month, its own average across the ${monthsWithTop.size} months it paid`,
    damageEgp: rankable ? monthly : null,
    score: rankable ? (missed / span.length) * monthly : null,
    evidence: ids(top.evs),
    cheapestDefence: `A second source that covers your burn floor. Not a bigger "${name}" — a different one.`,
  };
}

/* ── 2. THE SQUEEZE ───────────────────────────────────────────
   Burn outruns cash. Damage measured in days, because that is the unit
   the loss actually arrives in. */
function squeeze(now: number): Attack | null {
  const r = computeRunway(now);
  if (r.runwayDays === null || r.sampleCount < 8) return null;   // no honest burn signal
  if (r.runwayDays > 120) return null;                            // not the pressure point

  /* Probability = how many of the last 6 months ended with more going out
     than coming in. Counted months, not a model. */
  const since = now - 180 * DAY;
  const outs = getEvents({ domain: 'expense', since });
  const ins = getEvents({ domain: 'income', since });
  const keys = [...new Set([...outs, ...ins].map((e) => monthKey(e.ts)))].sort();
  if (keys.length < 3) return null;
  const negative = keys.filter((k) => {
    const o = outs.filter((e) => monthKey(e.ts) === k).reduce((s, e) => s + (e.value || 0), 0);
    const i = ins.filter((e) => monthKey(e.ts) === k).reduce((s, e) => s + (e.value || 0), 0);
    return o > i;
  }).length;
  if (negative === 0) return null;

  return {
    id: 'squeeze',
    vector: `Do nothing and you run out in ${Math.floor(r.runwayDays)} days. The adversary here is arithmetic.`,
    p: negative / keys.length,
    pBasis: `${negative} of the last ${keys.length} months on record spent more than they earned`,
    damage: r.runwayDays,
    unit: 'days',
    damageBasis: `${egp(r.liquidCash)} liquid against ${egp(r.dailyBurn)}/day burn, from ${r.sampleCount} logged expenses`,
    /* Days become comparable to money only through the Spine's own burn:
       the cash that has to be found to cover the gap to 120 days. */
    damageEgp: Math.max(0, 120 - r.runwayDays) * r.dailyBurn,
    score: (negative / keys.length) * Math.max(0, 120 - r.runwayDays) * r.dailyBurn,
    evidence: ids(outs),
    cheapestDefence: `The single largest recurring line in that burn. Cut one, not ten.`,
  };
}

/* ── 3. THE UNATTENDED ASSET ──────────────────────────────────
   Makadi earns only while someone tends it. Silence there is not neutral;
   it is a slow loss with a fixed monthly cost attached. */
function unattended(now: number): Attack | null {
  const bookings = getEvents({ domain: 'makadi', type: 'booking_confirmed' });
  if (bookings.length < 3) return null;
  const last = bookings.reduce((m, e) => Math.max(m, e.ts), 0);
  const quietDays = Math.floor((now - last) / DAY);
  if (quietDays < 30) return null;

  /* What a month of it has been worth, from its own record. */
  const months = new Set(bookings.map((e) => monthKey(e.ts))).size || 1;
  const earned = bookings.reduce((s, e) => s + (e.value || 0), 0);
  const perMonth = earned / months;
  if (perMonth <= 0) return null;

  /* Probability = how much of its own history has been dead air. */
  const span = Math.max(1, Math.floor((now - Math.min(...bookings.map((b) => b.ts))) / DAY));
  const gap = Math.min(1, quietDays / span);

  return {
    id: 'unattended',
    vector: `Makadi has been quiet ${quietDays} days. An empty unit still costs; it just stops arguing back.`,
    p: gap,
    pBasis: `${quietDays} of the ${span} days since your first booking have been the current silence`,
    damage: perMonth,
    unit: 'EGP',
    damageBasis: `${egp(perMonth)} per active month across ${months} month${months === 1 ? '' : 's'} of real bookings`,
    damageEgp: perMonth,
    score: gap * perMonth,
    evidence: ids(bookings),
    cheapestDefence: `One message to the guests already on record. The list exists; it is not being used.`,
  };
}

/* ── 4. THE SINGLE THREAD ─────────────────────────────────────
   One account, one channel, one login. Lose it and everything downstream
   of it stops on the same afternoon. */
function singleThread(now: number): Attack | null {
  const since = now - 180 * DAY;
  const evs = getEvents({ since }).filter((e) => /email|gmail|mail_|instagram|reel|dm_/i.test(e.type) || e.domain === 'instagram');
  if (evs.length < 10) return null;

  const byChannel = new Map<string, KaiEvent[]>();
  for (const e of evs) {
    const k = e.domain === 'instagram' ? 'Instagram' : /mail/i.test(e.type) ? 'Gmail' : e.domain;
    byChannel.set(k, [...(byChannel.get(k) || []), e]);
  }
  const [name, list] = [...byChannel.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const share = list.length / evs.length;
  if (share < 0.7) return null;

  /* Probability here is NOT invented. It is the share of the operation that
     runs through the one thread — stated as exactly that, and nothing more.
     Nobody can count "chance Google locks the account" from this Spine, and
     pretending otherwise would be the lie this whole file exists to avoid. */
  return {
    id: 'single_thread',
    vector: `${Math.round(share * 100)}% of everything KAI touches runs through ${name}. Lose that login and the operation is blind.`,
    p: share,
    pBasis: `${list.length} of ${evs.length} channel events went through ${name} — this is exposure, NOT a probability of failure. Nothing in the record can tell you how likely a lockout is`,
    /* NOT zero. Zero would read as "this costs nothing", which is the
       opposite of true. The record simply cannot price it, and the first
       version of this ranked it top of the list on a constant I made up. */
    damage: null,
    unit: 'days',
    damageBasis: `not measurable from the record — it would take out the inbox, the guest thread and the booking trail on the same afternoon`,
    damageEgp: null,
    score: null,
    evidence: ids(list),
    cheapestDefence: `A recovery route on that account that isn't the account itself, and the guest list held somewhere else.`,
  };
}

/* ── 5. THE BROKEN WORD ───────────────────────────────────────
   Not moralising. A pattern of commitments dying at the same stage is a
   structural fact, and it predicts the next one. */
function brokenWord(now: number): Attack | null {
  const all = getCommitments();
  const closed = all.filter((c) => c.status === 'kept' || c.status === 'broken');
  if (closed.length < 4) return null;
  const broken = closed.filter((c) => c.status === 'broken');
  if (broken.length === 0) return null;

  const open = all.filter((c) => c.status === 'open');
  const rate = broken.length / closed.length;
  if (rate < 0.4) return null;

  /* Damage in days: the time already committed to things that then died. */
  const wasted = broken.reduce((s, c) => s + Math.max(0, ((c.resolvedAt || now) - c.createdAt) / DAY), 0);
  /* Priced through the Spine's own burn — what those days cost to live
     through. Null when there is no burn signal, rather than a guess. */
  const r = computeRunway(now);
  const burn = r.sampleCount >= 8 ? r.dailyBurn : null;
  const dEgp = burn === null ? null : wasted * burn;

  return {
    id: 'broken_word',
    vector: `${broken.length} of your last ${closed.length} finished commitments broke. ${open.length} more are open on the same terms.`,
    p: rate,
    pBasis: `${broken.length} of ${closed.length} resolved commitments ended broken`,
    damage: wasted,
    unit: 'days',
    damageBasis: `${Math.round(wasted)} days were spent inside commitments that did not land${burn === null ? ' (no burn signal yet to price them)' : ''}`,
    damageEgp: dEgp,
    score: dEgp === null ? null : rate * dEgp,
    evidence: broken.slice(-6).map((c) => c.evidenceEventId || c.id),
    cheapestDefence: `Close one of the ${open.length} open ones this week — either keep it or kill it out loud. Both end the bleed.`,
  };
}

/* ── THE AVOIDANCE ────────────────────────────────────────────
   The brief for this module was explicit: it must name one thing he is
   avoiding. So this is not one of the ranked five and cannot be outranked
   by them — the thing you avoid is precisely the thing that never comes
   top of a list.

   "Avoided" is defined structurally, never psychologically: a subject that
   is OPEN, OLD, and has had NO event touch it since it was raised, while
   the domains around it kept moving. KAI cannot see reluctance. It can see
   a thing that everything else has been busier than. */
export interface Avoidance {
  what: string;
  openDays: number;
  untouchedDays: number;
  movedElsewhere: number;
  evidence: string[];
  line: string;
}

export function avoidance(now = Date.now()): Avoidance | null {
  type C = { what: string; since: number; domain: string; id: string };
  const cands: C[] = [];

  for (const c of getCommitments()) {
    if (c.status !== 'open') continue;
    cands.push({ what: c.text, since: c.createdAt, domain: c.metric.domain, id: c.id });
  }
  for (const d of read<Array<{ id: string; text: string; date: number; createdAt: number }>>('kai.deadlines', [])) {
    if (d.date < now) cands.push({ what: d.text, since: d.createdAt, domain: 'deadline', id: d.id });
  }
  if (!cands.length) return null;

  const all = getEvents({});
  let best: (Avoidance & { rank: number }) | null = null;

  for (const c of cands) {
    /* Did anything at all touch this subject after it was raised? */
    const words = c.what.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    if (!words.length) continue;
    const touching = all.filter((e) => {
      if (e.ts <= c.since) return false;
      const blob = (e.type + ' ' + JSON.stringify(e.meta || {})).toLowerCase();
      return words.some((w) => blob.includes(w));
    });
    if (touching.length) continue;                       // it's being worked on — not avoided

    const openDays = Math.floor((now - c.since) / DAY);
    if (openDays < 14) continue;                          // too new to mean anything

    /* How busy was he everywhere else in the same window? That contrast is
       the whole claim: not "you did nothing", but "you did plenty, elsewhere". */
    const elsewhere = all.filter((e) => e.ts > c.since && (e.source === 'user' || e.source === 'voice')).length;
    if (elsewhere < 5) continue;                          // he was simply not using KAI

    const rank = openDays * elsewhere;
    if (!best || rank > best.rank) {
      best = {
        rank,
        what: c.what,
        openDays,
        untouchedDays: openDays,
        movedElsewhere: elsewhere,
        evidence: [c.id],
        line: `You raised "${c.what}" ${openDays} days ago and nothing has touched it since. In the same ${openDays} days you logged ${elsewhere} other things yourself. It isn't that you've been idle. It's that everything else has been easier.`,
      };
    }
  }
  if (!best) return null;
  const { rank: _rank, ...out } = best;
  return out;
}

/* ── the assembled adversary ──────────────────────────────────
   Ranked by probability × damage. Vectors carrying different units are
   NOT compared as if they were the same thing — score orders the list and
   is never printed as a quantity, because "0.4 × 30 days" is not a number
   that means anything on its own. */
function allVectors(now: number): Attack[] {
  return [concentration(now), squeeze(now), unattended(now), singleThread(now), brokenWord(now)]
    .filter((a): a is Attack => a !== null);
}

/* The ranked list — every member priced in the same unit (EGP), derived. */
export function attacks(now = Date.now()): Attack[] {
  return allVectors(now)
    .filter((a) => a.score !== null)
    .sort((a, b) => (b.score as number) - (a.score as number));
}

/* Real weaknesses the record cannot cost. They are NOT dropped — dropping
   them would hide the largest one — and NOT ranked, because ranking them
   would mean inventing the number that does the ranking. */
export function unrankable(now = Date.now()): Attack[] {
  return allVectors(now).filter((a) => a.score === null);
}

function block(a: Attack, label: string, L: string[]): void {
  L.push(`${label} ${a.vector}`);
  L.push(`   likelihood: ${a.pBasis}`);
  L.push(a.damage === null
    ? `   damage: ${a.damageBasis}`
    : `   damage: ${a.unit === 'EGP' ? egp(a.damage) : `${Math.round(a.damage)} days`} — ${a.damageBasis}`);
  L.push(`   cheapest defence: ${a.cheapestDefence}`);
  L.push(`   evidence: ${a.evidence.length} event${a.evidence.length === 1 ? '' : 's'}`);
  L.push('');
}

export function gegnerText(now = Date.now()): string {
  const list = attacks(now);
  const loose = unrankable(now);
  const av = avoidance(now);
  const L: string[] = ['DER GEGNER', ''];

  if (!list.length && !loose.length) {
    L.push('No attack vector is visible in the record. That is not the same as being safe —');
    L.push('it means the Spine does not yet hold enough to find one. Keep logging.');
    L.push('');
  } else {
    L.push(`If I wanted this to fail inside ninety days, here is where I would push.`);
    L.push('');
  }

  if (list.length) {
    L.push(`RANKED — how often it has already happened, times what that costs in EGP:`);
    L.push('');
    list.forEach((a, i) => block(a, `${i + 1}.`, L));
  }

  if (loose.length) {
    L.push(`OUTSIDE THE RANKING — real, and the record cannot put a price on ${loose.length === 1 ? 'it' : 'them'}.`);
    L.push(`I could rank ${loose.length === 1 ? 'it' : 'them'} by inventing the number that does the ranking. I won't.`);
    L.push('');
    loose.forEach((a) => block(a, '·', L));
  }

  L.push('— AND THE ONE YOU ARE WALKING AROUND —');
  if (av) {
    L.push(av.line);
  } else {
    L.push('Nothing in the record shows a subject you are avoiding: every open thing has');
    L.push('been touched since you raised it. If that feels wrong, the record is thin —');
    L.push('not the finding. I will not invent one to make this section land.');
  }
  L.push('');
  L.push('I have no hands here. This is the only thing I can do with it: say it.');
  return L.join('\n');
}
