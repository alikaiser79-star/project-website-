/* ============================================================
   The Ledger — the Mirror, pointed outward.

   People you depend on (renters, contractors, friends, court
   allies) and the promises they made. The resolver grades each
   promise against the same Spine the Mirror uses, but with the
   evidence coming from events you log when *they* deliver — or
   the deadline passing without it.

     promise.metric → Spine event with value satisfying op/target
     no event by deadline → flaked

   Reliability per person = delivered ÷ (delivered + flaked) over
   the last 6 months. Boot-from-empty safe: no people → empty
   state, no promises → empty list, no resolved → reliability null.
   ============================================================ */

import { read, write, uid, emit } from './store';
import { getEvents, logEvent, type Domain } from './events';

const KEY_PEOPLE   = 'kai.people';
const KEY_PROMISES = 'kai.promises';
const DAY = 86_400_000;
const RELIABILITY_WINDOW_DAYS = 180;

/* ── People ────────────────────────────────────────────── */

export interface Person {
  id: string;
  name: string;
  role: string;          // 'Honda renter', 'Court ally', 'Contractor', 'Guest'…
  notes?: string;
  createdAt: number;
}

export function listPeople(): Person[] {
  return read<Person[]>(KEY_PEOPLE, []);
}

export function getPerson(id: string): Person | undefined {
  return listPeople().find(p => p.id === id);
}

export function addPerson(input: { name: string; role?: string; notes?: string }): Person {
  const p: Person = {
    id: uid(),
    name: clean(input.name) || 'Unknown',
    role: clean(input.role) || 'Contact',
    notes: input.notes ? clean(input.notes) : undefined,
    createdAt: Date.now(),
  };
  const list = listPeople();
  list.push(p);
  write(KEY_PEOPLE, list);
  emit();
  return p;
}

export function updatePerson(id: string, patch: Partial<Pick<Person, 'name' | 'role' | 'notes'>>): Person | null {
  const list = listPeople();
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return null;
  const cur = list[idx];
  const next: Person = {
    ...cur,
    ...(patch.name  !== undefined ? { name:  clean(patch.name)  || cur.name  } : {}),
    ...(patch.role  !== undefined ? { role:  clean(patch.role)  || cur.role  } : {}),
    ...(patch.notes !== undefined ? { notes: clean(patch.notes) || undefined } : {}),
  };
  list[idx] = next;
  write(KEY_PEOPLE, list);
  emit();
  return next;
}

export function removePerson(id: string): void {
  write(KEY_PEOPLE, listPeople().filter(p => p.id !== id));
  /* Tombstone promises tied to a deleted person — easier to
     audit than orphan rows. Mark them broken if still open. */
  const promises = listPromises();
  let changed = false;
  for (const pr of promises) {
    if (pr.personId === id && pr.status === 'open') {
      pr.status = 'flaked';
      pr.resolvedAt = Date.now();
      changed = true;
    }
  }
  if (changed) write(KEY_PROMISES, promises);
  emit();
}

/* ── Promises ──────────────────────────────────────────── */

export interface PromiseMetric {
  domain: Domain;
  event: string;
  op: '>=' | '<=' | '==';
  target: number;
}

export type PromiseStatus = 'open' | 'delivered' | 'flaked';

export interface LedgerPromise {
  id: string;
  personId: string;
  text: string;
  metric: PromiseMetric;
  createdAt: number;
  deadline: number;
  status: PromiseStatus;
  resolvedAt?: number;
  evidenceEventId?: string;
  /* If true, on resolve the resolver clones the next instance
     of this promise shifted by one cadence. cadence = days. */
  recurringDays?: number;
}

export interface PromiseInput {
  personId: string;
  text: string;
  metric: PromiseMetric;
  deadline: number;
  recurringDays?: number;
}

export function listPromises(): LedgerPromise[] {
  return read<LedgerPromise[]>(KEY_PROMISES, []);
}

function savePromises(list: LedgerPromise[]): void {
  write(KEY_PROMISES, list);
  emit();
}

export function addPromise(input: PromiseInput): LedgerPromise {
  const p: LedgerPromise = {
    id: uid(),
    personId: input.personId,
    text: clean(input.text),
    metric: input.metric,
    createdAt: Date.now(),
    deadline: input.deadline,
    status: 'open',
    recurringDays: input.recurringDays,
  };
  const list = listPromises();
  list.push(p);
  savePromises(list);
  /* Spine — someone promised something. */
  logEvent({
    domain: 'people', type: 'promised',
    meta: { id: p.id, personId: p.personId, text: p.text }, source: 'user',
  });
  return p;
}

export function removePromise(id: string): void {
  savePromises(listPromises().filter(p => p.id !== id));
}

export function updatePromise(id: string, patch: Partial<Pick<LedgerPromise, 'text' | 'deadline' | 'metric' | 'recurringDays'>>): LedgerPromise | null {
  const list = listPromises();
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return null;
  const cur = list[idx];
  list[idx] = {
    ...cur,
    ...(patch.text          !== undefined ? { text: clean(patch.text) } : {}),
    ...(patch.deadline      !== undefined ? { deadline: patch.deadline } : {}),
    ...(patch.metric        !== undefined ? { metric: patch.metric } : {}),
    ...(patch.recurringDays !== undefined ? { recurringDays: patch.recurringDays } : {}),
  };
  savePromises(list);
  return list[idx];
}

function satisfies(value: number | undefined, op: PromiseMetric['op'], target: number): boolean {
  if (value === undefined) return false;
  if (op === '>=') return value >= target;
  if (op === '<=') return value <= target;
  return value === target;
}

/* Grade open promises against the Spine. Idempotent. */
export function resolvePromises(now: number = Date.now()): LedgerPromise[] {
  const list = listPromises();
  let changed = false;
  const toClone: LedgerPromise[] = [];

  for (const p of list) {
    if (p.status !== 'open') continue;
    const evidence = getEvents({
      domain: p.metric.domain, type: p.metric.event, since: p.createdAt,
    }).find(ev => satisfies(ev.value, p.metric.op, p.metric.target));

    if (evidence) {
      p.status = 'delivered';
      p.resolvedAt = evidence.ts;
      p.evidenceEventId = evidence.id;
      changed = true;
      logEvent({
        domain: 'people', type: 'delivered', value: 1,
        meta: { id: p.id, personId: p.personId, text: p.text },
        source: 'auto', ts: now,
      });
      if (p.recurringDays && p.recurringDays > 0) toClone.push(p);
    } else if (now > p.deadline) {
      p.status = 'flaked';
      p.resolvedAt = now;
      changed = true;
      logEvent({
        domain: 'people', type: 'flaked', value: 0,
        meta: { id: p.id, personId: p.personId, text: p.text },
        source: 'auto', ts: now,
      });
      if (p.recurringDays && p.recurringDays > 0) toClone.push(p);
    }
  }

  for (const p of toClone) {
    const next: LedgerPromise = {
      id: uid(),
      personId: p.personId,
      text: p.text,
      metric: p.metric,
      createdAt: now,
      deadline: p.deadline + (p.recurringDays ?? 0) * DAY,
      status: 'open',
      recurringDays: p.recurringDays,
    };
    list.push(next);
  }

  if (changed || toClone.length) savePromises(list);
  return list;
}

/* ── Reliability ───────────────────────────────────────── */

export interface Reliability {
  delivered: number;
  flaked: number;
  total: number;
  score: number | null;     // null when nothing resolved in window
  openCount: number;
  overdueCount: number;
}

export function reliabilityFor(personId: string, now: number = Date.now(), windowDays = RELIABILITY_WINDOW_DAYS): Reliability {
  const cutoff = now - windowDays * DAY;
  const all = listPromises().filter(p => p.personId === personId);
  const resolved = all.filter(p => p.status !== 'open' && (p.resolvedAt ?? 0) >= cutoff);
  const delivered = resolved.filter(p => p.status === 'delivered').length;
  const flaked    = resolved.filter(p => p.status === 'flaked').length;
  const total = delivered + flaked;
  const open = all.filter(p => p.status === 'open');
  return {
    delivered, flaked, total,
    score: total ? Math.round((delivered / total) * 100) : null,
    openCount: open.length,
    overdueCount: open.filter(p => p.deadline < now).length,
  };
}

/* ── Briefing + snapshot ───────────────────────────────── */

export function ledgerBriefing(now: number = Date.now()): string[] {
  const out: string[] = [];
  const open = listPromises().filter(p => p.status === 'open');

  /* Overdue first — these are people who owe you something. */
  const overdue = open.filter(p => p.deadline < now);
  for (const p of overdue.slice(0, 2)) {
    const person = getPerson(p.personId);
    out.push(`Owed: ${person?.name ?? 'someone'} — ${p.text}. Past due.`);
  }

  /* Flakes you're about to lean on — warn before the ask. Anyone
     with a soon-due open promise whose 6-month reliability is < 50%
     and has at least 2 flakes. */
  for (const p of open) {
    if (p.deadline < now) continue;
    if (p.deadline > now + 7 * DAY) continue;
    const r = reliabilityFor(p.personId, now);
    if (r.flaked >= 2 && r.score !== null && r.score < 50) {
      const person = getPerson(p.personId);
      out.push(`${person?.name ?? 'Someone'}'s flaked ${r.flaked} of the last ${r.total}. Get insurance up front on "${p.text}".`);
    }
  }

  return out.slice(0, 3);
}

export function ledgerSnapshot() {
  const people = listPeople();
  return {
    people: people.map(p => {
      const r = reliabilityFor(p.id);
      return {
        id: p.id, name: p.name, role: p.role,
        reliability_pct: r.score,
        delivered: r.delivered, flaked: r.flaked, resolved: r.total,
        open: r.openCount, overdue: r.overdueCount,
      };
    }),
    promises: listPromises().map(p => ({
      id: p.id, person_id: p.personId, text: p.text,
      status: p.status,
      deadline: new Date(p.deadline).toISOString().slice(0, 10),
      metric: p.metric,
      recurring_days: p.recurringDays ?? null,
    })),
  };
}

/* ── Helper ────────────────────────────────────────────── */

function clean(s: any): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}
