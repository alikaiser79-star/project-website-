/* ============================================================
   §33.1 DER UNBEQUEME SPIEGEL — the truths he didn't ask for.

   Every other surface answers a question. This one doesn't wait to be
   asked. Monthly, from the Spine alone, it states three things about his
   patterns that he never queried.

   THE RULES, enforced in code because they are the whole point:
     • Only claims the ledger can PROVE. Each observation carries the ids
       of the events that produce it. No inference beyond arithmetic.
     • NO ADVICE. Observation only. The moment it says "you should", it
       becomes another engine competing for his attention; this one exists
       to be a mirror, not a coach.
     • Flat register. No cruelty, no comfort, no praise.
     • An acknowledged observation does not repeat — unless the pattern
       RECURS with new events behind it.
     • Dismissal is logged. Repeated dismissal of the same truth is itself
       an observation, and it is the one observation that cannot be
       dismissed away.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';
import { getCommitments } from './commitments';
import { toEgp } from './money';
import type { Currency } from '../../types';

const DAY = 86_400_000;

export interface Observation {
  key: string;             // stable identity for acknowledgement/dedup
  text: string;            // the claim, flat
  cites: string[];         // event ids that prove it
  strength: number;        // how much evidence stands behind it
}

/* ── the observers ───────────────────────────────────────────── */
/* Each returns an observation only when the ledger supports it. Returning
   null is the normal case and must stay comfortable. */
type Observer = (evs: KaiEvent[], now: number) => Observation | null;

/* 1. Ventures begun in the week money landed, and how they ended. */
const venturesAfterMoney: Observer = (evs, now) => {
  const money = evs.filter((e) => (e.domain === 'income' && (e.type === 'received' || e.type === 'salary_logged'))
    || (e.domain === 'makadi' && e.type === 'booking_confirmed'));
  if (money.length < 2) return null;
  const commitments = getCommitments();
  const started = commitments.filter((c) => money.some((m) => c.createdAt >= m.ts && c.createdAt <= m.ts + 7 * DAY));
  if (started.length < 3) return null;
  const stopped = started.filter((c) => c.status === 'broken');
  if (!stopped.length) return null;
  return {
    key: 'ventures-after-money',
    text: `You start ventures the week money lands. ${started.length} of your commitments began within seven days of income arriving; ${stopped.length} of those ${stopped.length === 1 ? 'is' : 'are'} the ${stopped.length === 1 ? 'one' : 'ones'} you stopped.`,
    cites: [...started.slice(0, 4).map((c) => c.id), ...money.slice(0, 2).map((m) => m.id)],
    strength: started.length,
  };
};

/* 2. The oldest open commitment, and how long since it was touched. */
const forgottenCommitment: Observer = (evs, now) => {
  const open = getCommitments().filter((c) => c.status === 'open').sort((a, b) => a.createdAt - b.createdAt);
  const oldest = open[0];
  if (!oldest) return null;
  const ageDays = Math.floor((now - oldest.createdAt) / DAY);
  if (ageDays < 21) return null;
  /* "mentioned" = any event in its domain since it was made */
  const touched = evs.filter((e) => e.domain === oldest.metric?.domain && e.ts > oldest.createdAt).sort((a, b) => b.ts - a.ts)[0];
  const silentDays = touched ? Math.floor((now - touched.ts) / DAY) : ageDays;
  if (silentDays < 14) return null;
  return {
    key: 'forgotten-commitment:' + oldest.id,
    text: `Your longest open commitment is ${ageDays} days old and its domain hasn't moved in ${silentDays}: "${(oldest.text || '').slice(0, 60)}".`,
    cites: [oldest.id, ...(touched ? [touched.id] : [])],
    strength: Math.floor(silentDays / 7),
  };
};

/* 3. Building clusters after an unanswered obligation. */
const buildAfterAvoidance: Observer = (evs, now) => {
  const builds = evs.filter((e) => e.domain === 'system' && (e.type === 'build_hours' || e.type === 'command_run'));
  const obligations = evs.filter((e) => (e.domain === 'makadi' && e.type === 'booking_inquiry')
    || (e.domain === 'commitment' && e.type === 'commitment_broken')
    || (e.domain === 'deadline' && e.type === 'escalated'));
  if (builds.length < 8 || obligations.length < 2) return null;
  const within48 = builds.filter((b) => obligations.some((o) => b.ts > o.ts && b.ts <= o.ts + 2 * DAY));
  const rate = within48.length / builds.length;
  /* only worth saying when the clustering is real, not incidental */
  if (within48.length < 4 || rate < 0.3) return null;
  return {
    key: 'build-after-avoidance',
    text: `${Math.round(rate * 100)}% of your activity in KAI falls in the 48 hours after an unanswered obligation (${within48.length} of ${builds.length}).`,
    cites: [...within48.slice(0, 3).map((b) => b.id), ...obligations.slice(0, 2).map((o) => o.id)],
    strength: within48.length,
  };
};

/* 4. Money that leaves right after money arrives. */
const spendAfterIncome: Observer = (evs, now) => {
  const income = evs.filter((e) => e.domain === 'income' && typeof e.value === 'number');
  const spend = evs.filter((e) => e.domain === 'expense' && typeof e.value === 'number');
  if (income.length < 2 || spend.length < 6) return null;
  const after = spend.filter((s) => income.some((i) => s.ts > i.ts && s.ts <= i.ts + 3 * DAY));
  if (after.length < 3) return null;
  const afterEgp = after.reduce((s, e) => s + toEgp(e.value || 0, (e.ccy as Currency) || 'EGP'), 0);
  const allEgp = spend.reduce((s, e) => s + toEgp(e.value || 0, (e.ccy as Currency) || 'EGP'), 0);
  const share = afterEgp / (allEgp || 1);
  if (share < 0.35) return null;
  return {
    key: 'spend-after-income',
    text: `${Math.round(share * 100)}% of everything you've spent left within three days of money arriving — ${Math.round(afterEgp).toLocaleString('en-GB')} of ${Math.round(allEgp).toLocaleString('en-GB')} EGP.`,
    cites: after.slice(0, 4).map((e) => e.id),
    strength: after.length,
  };
};

/* 5. A domain that only moves when he is watched. */
const quietWhenUnobserved: Observer = (evs, now) => {
  const domains = ['content', 'garden', 'instagram', 'leads'];
  for (const d of domains) {
    const acts = evs.filter((e) => e.domain === d).sort((a, b) => a.ts - b.ts);
    if (acts.length < 5) continue;
    const gaps: number[] = [];
    for (let i = 1; i < acts.length; i++) gaps.push(acts[i].ts - acts[i - 1].ts);
    const longest = Math.max(...gaps) / DAY;
    const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] / DAY;
    if (longest < 21 || longest < median * 5) continue;
    return {
      key: 'burst-then-silence:' + d,
      text: `Your ${d} work runs in bursts: typically ${Math.round(median)} days between moves, but once ${Math.round(longest)} days passed with nothing.`,
      cites: acts.slice(-4).map((e) => e.id),
      strength: Math.round(longest / 7),
    };
  }
  return null;
};

const OBSERVERS: Observer[] = [venturesAfterMoney, forgottenCommitment, buildAfterAvoidance, spendAfterIncome, quietWhenUnobserved];

/* ── acknowledgement + dismissal memory ──────────────────────── */
interface Seen { key: string; at: number; strength: number; dismissed: boolean }

function history(): Seen[] {
  return getEvents({ domain: 'system' })
    .filter((e) => e.type === 'observation_shown' || e.type === 'observation_dismissed')
    .map((e) => ({
      key: String(e.meta?.key || ''), at: e.ts,
      strength: Number(e.meta?.strength) || 0,
      dismissed: e.type === 'observation_dismissed',
    }))
    .filter((s) => s.key);
}

/* An observation returns only if it is new, or if the pattern has GROWN
   since he last saw it — the same truth with more evidence behind it is a
   different statement. */
function isDue(o: Observation, seen: Seen[]): boolean {
  const prior = seen.filter((s) => s.key === o.key).sort((a, b) => b.at - a.at)[0];
  if (!prior) return true;
  return o.strength > prior.strength;
}

/* ── the monthly three ───────────────────────────────────────── */
export function observations(now = Date.now(), max = 3): Observation[] {
  const evs = getEvents({});
  const seen = history();
  const found: Observation[] = [];

  for (const fn of OBSERVERS) {
    try {
      const o = fn(evs, now);
      if (o && isDue(o, seen)) found.push(o);
    } catch { /* an observer that throws simply observes nothing */ }
  }

  /* The one that cannot be dismissed away: repeated dismissal of the same
     truth is itself a pattern, and stating it is the mirror's whole job. */
  const dismissals = seen.filter((s) => s.dismissed);
  const byKey = new Map<string, number>();
  for (const d of dismissals) byKey.set(d.key, (byKey.get(d.key) || 0) + 1);
  for (const [key, n] of byKey) {
    if (n < 3) continue;
    found.unshift({
      key: 'dismissed-repeatedly:' + key,
      text: `You have dismissed the same observation ${n} times: "${key}".`,
      cites: [],
      /* Dominant by construction: this is the one truth that cannot be
         dismissed out of view, so it must never sort below the others. */
      strength: 1_000 + n,
    });
  }

  return found.sort((a, b) => b.strength - a.strength).slice(0, max);
}

export function showObservations(now = Date.now()): Observation[] {
  const list = observations(now);
  for (const o of list) {
    try { logEvent({ domain: 'system', type: 'observation_shown', meta: { key: o.key, strength: o.strength, text: o.text, cites: o.cites }, source: 'auto', ts: now }); } catch { /* ignore */ }
  }
  return list;
}

export function dismissObservation(key: string, now = Date.now()): void {
  try { logEvent({ domain: 'system', type: 'observation_dismissed', meta: { key }, source: 'user', ts: now }); } catch { /* ignore */ }
}

const MONTH = 30 * DAY;
export function shouldShowMonthly(now = Date.now()): boolean {
  const last = getEvents({ domain: 'system', type: 'observation_shown' }).sort((a, b) => b.ts - a.ts)[0];
  return !last || now - last.ts >= MONTH;
}

export function spiegelText(now = Date.now()): string {
  const list = observations(now);
  if (!list.length) return 'Nothing the ledger can prove that you have not already been told.';
  const L = ['WHAT THE RECORD SHOWS', ''];
  for (const o of list) {
    L.push('· ' + o.text);
    if (o.cites.length) L.push(`    ${o.cites.length} event${o.cites.length === 1 ? '' : 's'} behind this.`);
  }
  L.push('');
  L.push('No advice attached. Dismiss with "dismiss <key>" — dismissals are recorded.');
  return L.join('\n');
}
