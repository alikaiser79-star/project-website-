/* ============================================================
   §29.7 THE GATE → THE APPRENTICE. Earned autonomy, made mechanical.

   The doctrine's ladder was a principle; this is the machinery. Trust
   accrues per ACTION SHAPE from his real approval history, and KAI may
   only ever ASK for autonomy — granting it is his, per shape, revocable
   in one tap.

   THE HARD LAW, enforced in code and not by good intentions:
     Tier 2 shapes — anything touching MONEY or his NAME — can never be
     granted autonomy. No approval count unlocks them. `canEverAutomate()`
     returns false for them permanently, and grantAutonomy() refuses.
     A guest email is his name. A payment is his money. Those stay gated
     forever, exactly as §22's doctrine says.

   Tier 1 shapes are informational — a local log, a self-directed write.
   After ELIGIBLE_APPROVALS consecutive approvals with zero rejections,
   KAI offers to handle them and report. He decides.

   The ledger is public: what it has earned, what it hasn't, and what it
   can never earn.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { read, write, emit } from './store';
import type { PendingKind } from './pending';

const GRANTS_KEY = 'kai.apprentice.grants';
export const ELIGIBLE_APPROVALS = 20;      // the doctrine's number

/* ── tiers by consequence ────────────────────────────────────── */
export type Tier = 1 | 2;

/* Tier 2 = money or identity. PERMANENTLY gated. */
const TIER: Record<PendingKind, Tier> = {
  email_send: 2,      // his name, to another human
  sms_send: 2,        // his name
  ig_publish: 2,      // his name, in public
  site_commit: 2,     // his name, on his product
  site_deploy: 2,     // his product, live
  log_batch: 1,       // a local write to his own ledger
};

export const TIER_REASON: Record<PendingKind, string> = {
  email_send: 'carries your name to another person',
  sms_send: 'carries your name to another person',
  ig_publish: 'publishes under your name',
  site_commit: 'changes your product',
  site_deploy: 'ships your product',
  log_batch: 'writes only to your own ledger',
};

export function tierOf(kind: PendingKind): Tier { return TIER[kind] ?? 2; }

/* The wall. No history, no streak, no argument moves this. */
export function canEverAutomate(kind: PendingKind): boolean { return tierOf(kind) === 1; }

/* ── the record ──────────────────────────────────────────────── */
export interface ShapeRecord {
  kind: PendingKind;
  approved: number;
  rejected: number;
  streak: number;            // consecutive approvals since the last rejection
  tier: Tier;
  eligible: boolean;         // has earned the OFFER
  granted: boolean;          // he said yes
  everPossible: boolean;
  reason: string;
}

type Grants = Partial<Record<PendingKind, { at: number }>>;
function grants(): Grants { return read<Grants>(GRANTS_KEY, {}); }

export function isAutonomous(kind: PendingKind): boolean {
  if (!canEverAutomate(kind)) return false;         // the wall, checked first — always
  return !!grants()[kind];
}

/* Approval history per shape, from the Spine's own record. */
export function shapeRecord(kind: PendingKind): ShapeRecord {
  const evs = getEvents({ domain: 'system' })
    .filter((e) => (e.type === 'action_approved' || e.type === 'action_rejected') && e.meta?.kind === kind)
    .sort((a, b) => a.ts - b.ts);

  let approved = 0, rejected = 0, streak = 0;
  for (const e of evs) {
    if (e.type === 'action_approved') { approved++; streak++; }
    else { rejected++; streak = 0; }
  }
  const everPossible = canEverAutomate(kind);
  const eligible = everPossible && streak >= ELIGIBLE_APPROVALS;
  const granted = isAutonomous(kind);
  const reason = !everPossible
    ? `Never — ${TIER_REASON[kind]}.`
    : granted ? 'You granted this.'
    : eligible ? `Earned — ${streak} approvals, no rejections.`
    : `${streak}/${ELIGIBLE_APPROVALS} approvals${rejected ? ` (${rejected} rejection${rejected === 1 ? '' : 's'} reset it)` : ''}.`;
  return { kind, approved, rejected, streak, tier: tierOf(kind), eligible, granted, everPossible, reason };
}

const ALL_KINDS: PendingKind[] = ['email_send', 'sms_send', 'ig_publish', 'site_commit', 'site_deploy', 'log_batch'];

/* The trust ledger — what it earned, what it hasn't, what it never can. */
export function trustLedger(): ShapeRecord[] {
  return ALL_KINDS.map(shapeRecord).sort((a, b) => (b.streak - a.streak) || (a.tier - b.tier));
}

/* ── the offer ───────────────────────────────────────────────── */
export interface AutonomyOffer { kind: PendingKind; streak: number; text: string }

/* Shapes that have earned the right to be ASKED about — never granted here. */
export function pendingOffers(): AutonomyOffer[] {
  return trustLedger()
    .filter((r) => r.eligible && !r.granted && !offerDeclinedRecently(r.kind))
    .map((r) => ({
      kind: r.kind, streak: r.streak,
      text: `You've approved ${r.streak} of these with no rejections. Let me handle them and just report?`,
    }));
}

function offerDeclinedRecently(kind: PendingKind, now = Date.now()): boolean {
  const DAY = 86_400_000;
  return getEvents({ domain: 'system', type: 'autonomy_declined', since: now - 30 * DAY })
    .some((e) => e.meta?.kind === kind);
}

/* HIS decision. Refuses tier 2 even if called — the wall is in the setter,
   not only in the UI, so no future caller can route around it. */
export function grantAutonomy(kind: PendingKind, now = Date.now()): boolean {
  if (!canEverAutomate(kind)) {
    try { logEvent({ domain: 'system', type: 'autonomy_refused', meta: { kind, why: TIER_REASON[kind] }, source: 'auto', ts: now }); } catch { /* ignore */ }
    return false;
  }
  const g = grants(); g[kind] = { at: now }; write(GRANTS_KEY, g); emit();
  try { logEvent({ domain: 'system', type: 'autonomy_granted', meta: { kind }, source: 'user', ts: now }); } catch { /* ignore */ }
  return true;
}

/* One tap back. Revocation is always available and always immediate. */
export function revokeAutonomy(kind: PendingKind, now = Date.now()): void {
  const g = grants(); delete g[kind]; write(GRANTS_KEY, g); emit();
  try { logEvent({ domain: 'system', type: 'autonomy_revoked', meta: { kind }, source: 'user', ts: now }); } catch { /* ignore */ }
}

export function declineOffer(kind: PendingKind, now = Date.now()): void {
  try { logEvent({ domain: 'system', type: 'autonomy_declined', meta: { kind }, source: 'user', ts: now }); } catch { /* ignore */ }
}

/* ── what the ledger reads like ──────────────────────────────── */
export function trustLedgerText(): string {
  const rows = trustLedger();
  const out = ['THE TRUST LEDGER', ''];
  for (const r of rows) {
    const mark = r.granted ? '◆' : r.eligible ? '◇' : r.everPossible ? '·' : '✕';
    out.push(`${mark} ${r.kind.padEnd(12)} ${r.reason}`);
  }
  out.push('', '✕ = never automatable: money or your name. No record changes that.');
  return out.join('\n');
}
