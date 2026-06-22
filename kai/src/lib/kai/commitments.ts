/* ============================================================
   The Mirror — commitment-accountability engine.

   Open commitments resolve against the Spine: a commitment with
   metric { domain: 'makadi', event: 'rate_changed', op: '>=',
   target: 55 } is KEPT the moment a real rate_changed event
   with value ≥ 55 lands. No event by the deadline → BROKEN.

   Status transitions emit their own commitment_kept /
   commitment_broken events, so future features (Oracle, Spar)
   can grade trends over the Mirror itself.
   ============================================================ */

import { read, write, uid, emit } from './store';
import { getEvents, logEvent, type Domain } from './events';

export interface CommitmentMetric {
  domain: Domain;
  event: string;
  op: '>=' | '<=' | '==';
  target: number;
}

export interface Commitment {
  id: string;
  text: string;
  metric: CommitmentMetric;
  createdAt: number;
  deadline: number;
  status: 'open' | 'kept' | 'broken';
  source: 'self' | 'kai';
  resolvedAt?: number;
  evidenceEventId?: string;
}

export interface CommitmentInput {
  text: string;
  metric: CommitmentMetric;
  deadline: number;
  source?: 'self' | 'kai';
  createdAt?: number;
}

const KEY = 'kai.commitments';
const DAY = 86_400_000;

export function getCommitments(): Commitment[] { return read<Commitment[]>(KEY, []); }
function save(list: Commitment[]): void { write(KEY, list); emit(); }

export function addCommitment(input: CommitmentInput): Commitment {
  const c: Commitment = {
    id: uid(),
    text: input.text.trim(),
    metric: input.metric,
    createdAt: input.createdAt ?? Date.now(),
    deadline: input.deadline,
    status: 'open',
    source: input.source ?? 'self',
  };
  const list = getCommitments();
  list.push(c);
  save(list);
  logEvent({
    domain: 'commitment', type: 'commitment_made',
    meta: { id: c.id, text: c.text }, source: 'ai',
  });
  return c;
}

export function removeCommitment(id: string): void {
  save(getCommitments().filter((c) => c.id !== id));
}

function satisfies(value: number | undefined, op: CommitmentMetric['op'], target: number): boolean {
  if (value === undefined) return false;
  if (op === '>=') return value >= target;
  if (op === '<=') return value <= target;
  return value === target;
}

/* Grade every open commitment against the Spine. Idempotent —
   safe to call on boot, on visibility change, on a timer. */
export function resolveCommitments(now: number = Date.now()): Commitment[] {
  const list = getCommitments();
  let changed = false;
  for (const c of list) {
    if (c.status !== 'open') continue;
    const evidence = getEvents({
      domain: c.metric.domain, type: c.metric.event, since: c.createdAt,
    }).find((ev) => satisfies(ev.value, c.metric.op, c.metric.target));

    if (evidence) {
      c.status = 'kept';
      c.resolvedAt = evidence.ts;
      c.evidenceEventId = evidence.id;
      changed = true;
      logEvent({
        domain: 'commitment', type: 'commitment_kept',
        value: 1, meta: { id: c.id, text: c.text },
        source: 'auto', ts: now,
      });
    } else if (now > c.deadline) {
      c.status = 'broken';
      c.resolvedAt = now;
      changed = true;
      logEvent({
        domain: 'commitment', type: 'commitment_broken',
        value: 0, meta: { id: c.id, text: c.text },
        source: 'auto', ts: now,
      });
    }
  }
  if (changed) save(list);
  return list;
}

export interface MirrorScore { kept: number; broken: number; total: number; score: number | null; }

export function mirrorScore(now: number = Date.now(), windowDays = 30): MirrorScore {
  const cutoff = now - windowDays * DAY;
  const resolved = getCommitments().filter((c) =>
    c.status !== 'open' && (c.resolvedAt ?? 0) >= cutoff);
  const kept = resolved.filter((c) => c.status === 'kept').length;
  const broken = resolved.filter((c) => c.status === 'broken').length;
  const total = kept + broken;
  return { kept, broken, total, score: total ? Math.round((kept / total) * 100) : null };
}

/* Lines for the daily briefing. Blunt on purpose. */
export function mirrorBriefing(now: number = Date.now()): string[] {
  const list = getCommitments();
  const out: string[] = [];

  const open = list.filter((c) => c.status === 'open').sort((a, b) => a.deadline - b.deadline);
  for (const c of open.slice(0, 3)) {
    const days = Math.ceil((c.deadline - now) / DAY);
    out.push(days < 0 ? `Overdue: ${c.text}` : `${days}d left: ${c.text}`);
  }

  const recentlyBroken = list.filter((c) =>
    c.status === 'broken' && now - (c.resolvedAt ?? 0) < 7 * DAY);
  for (const c of recentlyBroken) {
    out.push(`Broken: ${c.text} — the data says it didn't happen.`);
  }

  const s = mirrorScore(now);
  if (s.total) out.push(`Mirror: ${s.kept}/${s.total} kept (${s.score}%) this month.`);
  return out;
}
