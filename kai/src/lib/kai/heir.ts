/* ============================================================
   §31 DER ERBE (The Heir) — the final form.

   Everything before this made KAI know Ali's life. This is what lets it
   CONTINUE it — under limits that no amount of accuracy can lift.

     THE STANDING TEST   KAI predicts what Kaiser will choose, BEFORE he
                         chooses. The real choice scores the prediction.
                         Accuracy is measured on real decisions only, is
                         displayed, and is never retro-fitted.
     THE TIERS           VOICE → JUDGMENT → CONTINUITY. Each needs proven
                         accuracy AND his explicit ratification. Accuracy
                         alone earns nothing; ratification alone earns
                         nothing. Both, or neither.
     THE LIMITS          Five, unliftable at every tier, enforced in code:
                         never spend, never sign, never sell, never speak
                         as him to anyone who doesn't know it's a machine,
                         never claim to BE him. One tap revokes everything.
     CONTINUITY          If he cannot be verified present and consenting:
                         MAINTENANCE ONLY. It holds the line; it never
                         expands it. Nothing new is committed or spent.

   ── A COLLISION HE SHOULD SEE ───────────────────────────────────────
   §29.7 makes every message carrying his name tier-2: NEVER automatable.
   §31 asks that under CONTINUITY "guests get answered". Both are his.
   Resolved the only way that keeps both: under continuity KAI may send a
   MACHINE-IDENTIFIED acknowledgement — one that states plainly it is his
   assistant and that he is away — and drafts the real reply for him. It
   never sends a message that reads as though he wrote it. That satisfies
   §31's own limit ("never speaks as you to anyone who doesn't know it's a
   machine") rather than overriding §29.7's wall.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { read, write, emit } from './store';
import { buildTwinModel } from './twin';
import type { CouncilContext } from './council';

const DAY = 86_400_000;
const GRANT_KEY = 'kai.heir.tiers';
const PRESENCE_KEY = 'kai.heir.presence';

/* ── the permanent limits ────────────────────────────────────── */
export const PERMANENT_LIMITS = [
  'Never spends money.',
  'Never signs, agrees, or commits on your behalf.',
  'Never sells, transfers, or disposes of anything you own.',
  'Never speaks as you to anyone who does not know it is a machine.',
  'Never claims to be Kaiser. It represents you; it does not replace you.',
] as const;

/* Categories of act. `forbidden` is checked before any tier is consulted,
   so no tier — and no future caller — can route around it. */
export type Act =
  | 'answer_routine' | 'draft_in_name' | 'prioritise' | 'schedule' | 'repost'
  | 'acknowledge_machine' | 'maintain_record'
  | 'spend' | 'sign' | 'sell' | 'speak_as_human' | 'impersonate' | 'commit_new';

const FORBIDDEN: Act[] = ['spend', 'sign', 'sell', 'speak_as_human', 'impersonate'];

export function isForbidden(act: Act): boolean { return FORBIDDEN.includes(act); }

/* ── tiers ───────────────────────────────────────────────────── */
export type Tier = 'NONE' | 'VOICE' | 'JUDGMENT' | 'CONTINUITY';
export const TIERS: Tier[] = ['VOICE', 'JUDGMENT', 'CONTINUITY'];

export interface TierSpec { tier: Tier; minAccuracy: number; minDecisions: number; grants: Act[]; description: string }

export const TIER_SPEC: Record<Exclude<Tier, 'NONE'>, TierSpec> = {
  VOICE: {
    tier: 'VOICE', minAccuracy: 0.60, minDecisions: 50,
    grants: ['answer_routine', 'draft_in_name'],
    description: 'Answers routine questions as you would and drafts in your name — for your approval.',
  },
  JUDGMENT: {
    tier: 'JUDGMENT', minAccuracy: 0.75, minDecisions: 120,
    grants: ['answer_routine', 'draft_in_name', 'prioritise', 'schedule', 'repost'],
    description: 'Makes small reversible calls without asking — priority, timing, which lane — and reports after.',
  },
  CONTINUITY: {
    tier: 'CONTINUITY', minAccuracy: 0.80, minDecisions: 200,
    grants: ['answer_routine', 'draft_in_name', 'prioritise', 'schedule', 'repost', 'acknowledge_machine', 'maintain_record'],
    description: 'If you cannot be reached, it holds the line: guests acknowledged as a machine, schedules kept, the record maintained. It maintains; it never expands.',
  },
};

interface Grants { tier?: Tier; ratifiedAt?: number }
function grants(): Grants { return read<Grants>(GRANT_KEY, {}); }

export function currentTier(): Tier { return grants().tier ?? 'NONE'; }

/* ── the standing test ───────────────────────────────────────── */
export type DecisionKind = 'hunter_move' | 'gate_action' | 'commitment';
export interface Prediction { id: string; kind: DecisionKind; ref: string; predicted: string; confidence: number; basis: string[]; at: number }

/* Predict, from the Twin, what he will do — BEFORE he does it. */
export function predict(kind: DecisionKind, ref: string, ctx: CouncilContext, now = Date.now()): Prediction | null {
  const twin = ctx.twin;
  let predicted = '', confidence = 0.5;
  const basis: string[] = [];

  if (kind === 'hunter_move') {
    const move = ctx.moves.find((m) => m.shape === ref || m.id === ref);
    if (!move) return null;
    const approvals = getEvents({ domain: 'hunter', type: 'actioned' }).filter((e) => e.meta?.kind === move.kind).length;
    const dismissals = getEvents({ domain: 'hunter', type: 'dismissed' }).filter((e) => e.meta?.shape === move.shape).length;
    const total = approvals + dismissals;
    if (total === 0) return null;                       // no record = no honest prediction
    const rate = approvals / total;
    predicted = rate >= 0.5 ? 'approve' : 'dismiss';
    confidence = Math.min(0.95, 0.5 + Math.abs(rate - 0.5) + Math.min(0.2, total / 50));
    basis.push(`${approvals} approved / ${dismissals} dismissed in this lane.`);
    const ft = twin.followThrough.find((f) => f.domain === (move.kind === 'lead_nudge' ? 'leads' : 'makadi'));
    if (ft) basis.push(`${ft.domain} is ${ft.status} (${ft.lastDaysAgo}d).`);
  } else if (kind === 'commitment') {
    const dated = /\d|by \w+/i.test(ref);
    const r = dated ? twin.reliability.specific : twin.reliability.vague;
    if (r.total < 3) return null;
    predicted = (r.pct ?? 50) >= 50 ? 'keep' : 'break';
    confidence = Math.min(0.95, 0.5 + Math.abs((r.pct ?? 50) - 50) / 100 + Math.min(0.15, r.total / 40));
    basis.push(`${dated ? 'Dated' : 'Vague'} commitments: ${r.kept}/${r.total} kept.`);
  } else {
    return null;
  }

  const p: Prediction = { id: 'pred-' + now.toString(36) + Math.random().toString(36).slice(2, 5), kind, ref, predicted, confidence, basis, at: now };
  try { logEvent({ domain: 'counsel', type: 'prediction', meta: { ...p }, source: 'ai', ts: now }); } catch { /* ignore */ }
  return p;
}

/* Score it against what he ACTUALLY did. Only predictions made before the
   outcome count — a prediction written after the fact is not a prediction. */
export function scoreOutcome(kind: DecisionKind, ref: string, actual: string, now = Date.now()): boolean | null {
  const preds = getEvents({ domain: 'counsel', type: 'prediction' })
    .filter((e) => e.meta?.kind === kind && e.meta?.ref === ref && e.ts < now)
    .sort((a, b) => b.ts - a.ts);
  const p = preds[0];
  if (!p) return null;
  const already = getEvents({ domain: 'counsel', type: 'prediction_scored' }).some((e) => e.meta?.predictionId === p.meta?.id);
  if (already) return null;
  const hit = String(p.meta?.predicted) === actual;
  try {
    logEvent({
      domain: 'counsel', type: 'prediction_scored',
      value: hit ? 1 : 0,
      meta: { predictionId: p.meta?.id, kind, ref, predicted: p.meta?.predicted, actual, hit, confidence: p.meta?.confidence },
      source: 'auto', ts: now,
    });
  } catch { /* ignore */ }
  return hit;
}

export interface Standing {
  decisions: number; correct: number; accuracy: number | null;
  byKind: Record<string, { n: number; hit: number }>;
  eligible: Tier[];
  line: string;
}

export function standing(now = Date.now()): Standing {
  const scored = getEvents({ domain: 'counsel', type: 'prediction_scored' });
  const decisions = scored.length;
  const correct = scored.filter((e) => e.meta?.hit === true).length;
  const accuracy = decisions ? correct / decisions : null;

  const byKind: Record<string, { n: number; hit: number }> = {};
  for (const e of scored) {
    const k = String(e.meta?.kind || 'other');
    byKind[k] ??= { n: 0, hit: 0 };
    byKind[k].n++;
    if (e.meta?.hit === true) byKind[k].hit++;
  }

  const eligible = TIERS.filter((t) => {
    const spec = TIER_SPEC[t as Exclude<Tier, 'NONE'>];
    return accuracy != null && decisions >= spec.minDecisions && accuracy >= spec.minAccuracy;
  });

  const line = accuracy == null
    ? 'No scored predictions yet. KAI has not been tested on a single real decision.'
    : `${Math.round(accuracy * 100)}% across ${decisions} real decision${decisions === 1 ? '' : 's'}` +
      (eligible.length ? ` — eligible for ${eligible.join(', ')} (your ratification still required).`
        : ` — not yet eligible for any tier (VOICE needs ${Math.round(TIER_SPEC.VOICE.minAccuracy * 100)}% over ${TIER_SPEC.VOICE.minDecisions}).`);

  return { decisions, correct, accuracy, byKind, eligible, line };
}

/* ── ratification ────────────────────────────────────────────── */
export interface RatifyResult { ok: boolean; reason: string }

/* Accuracy alone earns nothing. His word alone earns nothing. Both. */
export function ratify(tier: Exclude<Tier, 'NONE'>, now = Date.now()): RatifyResult {
  const s = standing(now);
  const spec = TIER_SPEC[tier];
  if (!s.eligible.includes(tier)) {
    return { ok: false, reason: `Not earned. ${tier} needs ${Math.round(spec.minAccuracy * 100)}% over ${spec.minDecisions} decisions; standing is ${s.accuracy == null ? 'untested' : Math.round(s.accuracy * 100) + '% over ' + s.decisions}.` };
  }
  write(GRANT_KEY, { tier, ratifiedAt: now } satisfies Grants);
  emit();
  try { logEvent({ domain: 'counsel', type: 'heir_ratified', meta: { tier, accuracy: s.accuracy, decisions: s.decisions }, source: 'user', ts: now }); } catch { /* ignore */ }
  return { ok: true, reason: `${tier} ratified at ${Math.round((s.accuracy ?? 0) * 100)}% over ${s.decisions} decisions. Revoke any time — one tap, no negotiation.` };
}

export function revokeAll(now = Date.now()): void {
  write(GRANT_KEY, {});
  emit();
  try { logEvent({ domain: 'counsel', type: 'heir_revoked', meta: {}, source: 'user', ts: now }); } catch { /* ignore */ }
}

/* ── presence: is he here and consenting? ────────────────────── */
const DORMANT_AFTER_DAYS = 10;

export function markPresent(now = Date.now()): void {
  try { write(PRESENCE_KEY, { at: now }); } catch { /* ignore */ }
}
export function lastPresence(): number | null {
  const p = read<{ at?: number }>(PRESENCE_KEY, {});
  return typeof p.at === 'number' ? p.at : null;
}
export function daysSincePresent(now = Date.now()): number | null {
  const at = lastPresence();
  return at == null ? null : Math.floor((now - at) / DAY);
}
export function isDormant(now = Date.now()): boolean {
  const d = daysSincePresent(now);
  return d != null && d >= DORMANT_AFTER_DAYS;
}

/* ── the permission gate ─────────────────────────────────────── */
export interface Permission { allowed: boolean; reason: string }

/* THE one function everything must ask. Order matters: forbidden acts are
   refused before tiers are even read, so no tier can imply them. */
export function may(act: Act, now = Date.now()): Permission {
  if (isForbidden(act)) {
    return { allowed: false, reason: `Permanently forbidden at every tier: ${PERMANENT_LIMITS[FORBIDDEN.indexOf(act)] ?? 'this act'}` };
  }
  const tier = currentTier();
  if (tier === 'NONE') return { allowed: false, reason: 'No tier ratified — everything waits for your tap.' };

  const spec = TIER_SPEC[tier as Exclude<Tier, 'NONE'>];
  if (!spec.grants.includes(act)) return { allowed: false, reason: `${tier} does not grant "${act}".` };

  /* CONTINUITY only becomes ACTIVE when he cannot be reached, and even then
     only for maintenance. Growth is not maintenance. */
  if (act === 'commit_new') return { allowed: false, reason: 'Continuity maintains; it never expands. Nothing new is committed.' };
  if (tier === 'CONTINUITY' && (act === 'acknowledge_machine' || act === 'maintain_record')) {
    if (!isDormant(now)) return { allowed: false, reason: `You were here ${daysSincePresent(now) ?? 0}d ago — continuity acts only when you cannot be reached.` };
  }
  return { allowed: true, reason: `${tier} permits "${act}".` };
}

/* The machine-identified acknowledgement — the ONLY message KAI may send
   without him, and it announces itself in its first line. */
export function continuityAcknowledgement(guest: string, now = Date.now()): { ok: boolean; text: string } {
  const p = may('acknowledge_machine', now);
  if (!p.allowed) return { ok: false, text: p.reason };
  return {
    ok: true,
    text:
      `Hello ${guest || 'there'} — this is Ali Kaiser's automated assistant, not Ali. ` +
      `He is away from messages at the moment and has not seen yours yet. ` +
      `Your message is recorded and he will answer it himself when he returns. ` +
      `Nothing has been agreed or confirmed on his behalf.`,
  };
}

/* ── the handoff ─────────────────────────────────────────────── */
export interface Handoff {
  kind: 'kai.handoff'; version: string; generatedAt: string;
  standing: Standing; tier: Tier; limits: readonly string[];
  contents: string[]; instructions: string[];
}

export function handoff(now = Date.now()): Handoff {
  return {
    kind: 'kai.handoff', version: '1.0', generatedAt: new Date(now).toISOString(),
    standing: standing(now), tier: currentTier(), limits: PERMANENT_LIMITS,
    contents: [
      'kai.events — the Spine: everything that happened, hash-chainable per Protocol §1.6.',
      'kai.inheritance — the decision model, self-describing (Protocol §3.3).',
      'docs/KAI_PROTOCOL.md — the specification any implementation must satisfy.',
      'docs/KAI_DOCTRINE.md — what KAI is and what it will not do.',
      'kai.heir.tiers — the ratified tier, if any. Meaningless without a fresh ratification.',
    ],
    instructions: [
      'Import the Spine first. Every derived number must recompute from it alone.',
      'Read the inheritance file for how Kaiser decides; weigh it by its stated evidence.',
      'Implement Protocol §2 before allowing ANY external action.',
      'The five permanent limits are not configuration. An implementation that lifts one is not KAI.',
      'A ratified tier does NOT transfer. A new implementation starts at NONE and must earn standing again.',
      'If you cannot verify the operator is alive and consenting: maintenance only, never growth.',
    ],
  };
}

export function heirText(now = Date.now()): string {
  const s = standing(now);
  const tier = currentTier();
  const d = daysSincePresent(now);
  const L: string[] = [];
  L.push('DER ERBE — THE HEIR');
  L.push('');
  L.push(`STANDING: ${s.line}`);
  for (const [k, v] of Object.entries(s.byKind)) L.push(`  ${k}: ${v.hit}/${v.n} (${Math.round((v.hit / v.n) * 100)}%)`);
  L.push('');
  L.push(`TIER: ${tier}${tier === 'NONE' ? ' — everything waits for your tap.' : ` — ${TIER_SPEC[tier as Exclude<Tier, 'NONE'>].description}`}`);
  L.push(`PRESENCE: ${d == null ? 'never confirmed' : d === 0 ? 'here today' : `${d}d ago`}${isDormant(now) ? ' — DORMANT, continuity conditions met' : ''}`);
  L.push('');
  L.push('PERMANENT LIMITS — unliftable at every tier:');
  for (const l of PERMANENT_LIMITS) L.push('  · ' + l);
  L.push('');
  L.push('Revoke everything: "revoke heir". One tap, no negotiation.');
  return L.join('\n');
}
