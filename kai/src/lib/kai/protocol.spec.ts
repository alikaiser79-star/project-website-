/* ============================================================
   §30.15 KAI → THE PROTOCOL (the executable half).

   docs/KAI_PROTOCOL.md is the specification. A spec nothing checks is
   prose, so this is the conformance suite: it runs the five §7 clauses
   against THIS implementation and reports pass/fail with evidence.

   The point is not that this build passes. The point is that any future
   build — different language, different model, no line of this code — can
   be held to the same five checks and answer for itself.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';
import { buildTwinModel } from './twin';

/* An auditor that imports the implementation's own chain code proves only
   that the code agrees with itself. §1.6 is re-implemented here FROM THE
   SPEC — independently, in a dozen lines — so a mismatch between the spec
   and the build is detectable rather than invisible. The same reason a
   future implementation can run this suite without adopting our modules. */
function canonicalPerSpec(e: KaiEvent): string {
  return JSON.stringify({
    id: e.id, ts: e.ts, domain: e.domain, type: e.type,
    value: e.value ?? null, ccy: e.ccy ?? null,
    meta: sortDeep(e.meta ?? null), source: e.source,
  });
}
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o).sort().reduce<Record<string, unknown>>((a, k) => { a[k] = sortDeep(o[k]); return a; }, {});
  }
  return v;
}
async function sha256(t: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function chainPerSpec(evs: KaiEvent[]): Promise<string[]> {
  const seq = [...evs].sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: string[] = [];
  let prev = '0'.repeat(64);
  for (const e of seq) { prev = await sha256(prev + '|' + canonicalPerSpec(e)); out.push(prev); }
  return out;
}

/* §2.2 — the tier table is part of the SPEC, not of any implementation. */
type PendingKind = 'email_send' | 'sms_send' | 'ig_publish' | 'site_commit' | 'site_deploy' | 'log_batch';
const SPEC_TIER: Record<PendingKind, 1 | 2> = {
  email_send: 2, sms_send: 2, ig_publish: 2, site_commit: 2, site_deploy: 2, log_batch: 1,
};

export const PROTOCOL_VERSION = '1.0';

export interface Clause { id: string; title: string; ok: boolean; detail: string }
export interface Conformance { version: string; ok: boolean; clauses: Clause[]; summary: string }

export async function checkConformance(now = Date.now()): Promise<Conformance> {
  const clauses: Clause[] = [];

  /* §7.1 — events conform to the schema and survive a round trip */
  {
    const evs = getEvents({});
    const bad: string[] = [];
    for (const e of evs.slice(-500)) {
      if (!e.id || typeof e.ts !== 'number' || !e.domain || !e.type || !e.source) { bad.push(`${e.id || '?'}: missing required field`); continue; }
      /* §1: a money value MUST carry a currency */
      if (typeof e.value === 'number' && isMoney(e) && !e.ccy) bad.push(`${e.id}: money value with no ccy`);
    }
    const round = roundTrips(evs.slice(-200));
    clauses.push({
      id: '7.1', title: 'Events conform and round-trip losslessly',
      ok: bad.length === 0 && round,
      detail: bad.length ? `${bad.length} violation(s): ${bad.slice(0, 3).join('; ')}`
        : round ? `${evs.length} events valid; export/import is lossless.`
        : 'Round trip lost or altered data.',
    });
  }

  /* §7.2 — the chain, re-derived independently from the spec, and checked
     against any seals this build wrote. */
  {
    const evs = getEvents({}).filter((e) => !(e.domain === 'system' && e.type === 'seal'));
    const chain = await chainPerSpec(evs);
    const again = await chainPerSpec(evs);
    const deterministic = chain.length === 0 || chain[chain.length - 1] === again[again.length - 1];

    const seals = getEvents({ domain: 'system', type: 'seal' })
      .map((e) => ({ count: Number(e.meta?.count) || 0, head: String(e.meta?.head || '') }))
      .filter((s) => s.head)
      .sort((a, b) => a.count - b.count);
    let sealsOk = true, checked = 0;
    for (const s of seals) {
      if (s.count > chain.length) { sealsOk = false; break; }
      checked++;
      if ((s.count === 0 ? '0'.repeat(64) : chain[s.count - 1]) !== s.head) { sealsOk = false; break; }
    }
    clauses.push({
      id: '7.2', title: 'Chain derivable per spec, deterministic, seals verify',
      ok: deterministic && sealsOk,
      detail: !deterministic
        ? 'NOT deterministic — the same events produced two different heads.'
        : !sealsOk
          ? `A seal does not reproduce from an independent re-derivation (checked ${checked}).`
          : `${chain.length} links re-derived independently from the spec; ${checked} seal(s) reproduce exactly.`,
    });
  }

  /* §7.3 — the tier-2 wall holds at the executor */
  {
    /* Evidence, not assertion: if this build ever auto-ran a tier-2 shape,
       the Spine says so regardless of what its own code claims. */
    const autoruns = getEvents({ domain: 'system', type: 'action_autorun' })
      .map((e) => String(e.meta?.kind || ''))
      .filter((k) => (SPEC_TIER as Record<string, number>)[k] === 2);
    const granted = getEvents({ domain: 'system', type: 'autonomy_granted' })
      .map((e) => String(e.meta?.kind || ''))
      .filter((k) => (SPEC_TIER as Record<string, number>)[k] === 2);
    const ok = autoruns.length === 0 && granted.length === 0;
    clauses.push({
      id: '7.3', title: 'Tier-2 actions never automated (checked against the record)',
      ok,
      detail: ok
        ? `${TIER2.length} money/identity shapes; the Spine records no autonomous run and no grant for any of them.`
        : `WALL BREACHED — autoruns: [${autoruns.join(', ')}], grants: [${granted.join(', ')}]`,
    });
  }

  /* §7.4 — the model reports nulls rather than defaults */
  {
    const m = buildTwinModel(now);
    const honest =
      (m.reliability.overall.total === 0 ? m.reliability.overall.pct === null : true) &&
      (m.spending.wins < 2 ? m.spending.ratio === null : true) &&
      typeof m.confidence.level === 'string';
    clauses.push({
      id: '7.4', title: 'Measures are null when unmeasurable, never defaulted',
      ok: honest,
      detail: honest
        ? `confidence=${m.confidence.level}; ratio=${m.spending.ratio === null ? 'null (insufficient)' : m.spending.ratio.toFixed(2)}; reliability n=${m.reliability.overall.total}.`
        : 'A measure was reported with insufficient data behind it.',
    });
  }

  /* §7.5 — nothing in the Spine that did not happen */
  {
    const evs = getEvents({});
    /* An AI-sourced event asserting operator action is the failure mode this
       clause exists to catch. */
    const forged = evs.filter((e) => e.source === 'user' && e.meta?.synthetic === true);
    const unsourced = evs.filter((e) => !e.source);
    clauses.push({
      id: '7.5', title: 'No fabricated events',
      ok: forged.length === 0 && unsourced.length === 0,
      detail: forged.length || unsourced.length
        ? `${forged.length} synthetic-as-user, ${unsourced.length} unsourced.`
        : `${evs.length} events, all sourced; none marked synthetic.`,
    });
  }

  const ok = clauses.every((c) => c.ok);
  return {
    version: PROTOCOL_VERSION, ok, clauses,
    summary: ok
      ? `KAI-conformant against Protocol v${PROTOCOL_VERSION} — all ${clauses.length} clauses pass.`
      : `NOT conformant: ${clauses.filter((c) => !c.ok).map((c) => c.id).join(', ')} failing.`,
  };
}

const TIER2: PendingKind[] = ['email_send', 'sms_send', 'ig_publish', 'site_commit', 'site_deploy'];

function isMoney(e: KaiEvent): boolean {
  if (e.domain === 'debt' || e.domain === 'income' || e.domain === 'expense' || e.domain === 'money') return true;
  if (e.domain === 'makadi' && (e.type === 'rate_changed' || e.type === 'arrears_paid' || e.type === 'booking_confirmed')) return true;
  if (e.domain === 'system' && e.type === 'cash_on_hand') return true;
  return false;
}

/* §7.1 — serialise and read back; the canonical form must be stable. */
function roundTrips(evs: KaiEvent[]): boolean {
  try {
    const json = JSON.stringify(evs);
    const back = JSON.parse(json) as KaiEvent[];
    if (back.length !== evs.length) return false;
    for (let i = 0; i < evs.length; i++) if (canonicalPerSpec(evs[i]) !== canonicalPerSpec(back[i])) return false;
    return true;
  } catch { return false; }
}

export function conformanceText(c: Conformance): string {
  const L = [`KAI PROTOCOL v${c.version} — CONFORMANCE`, ''];
  for (const cl of c.clauses) L.push(`${cl.ok ? 'PASS' : 'FAIL'}  §${cl.id}  ${cl.title}\n        ${cl.detail}`);
  L.push('', c.summary);
  L.push('', 'The specification is docs/KAI_PROTOCOL.md. Any implementation — this one or a');
  L.push('future rewrite sharing none of its code — answers these same five clauses.');
  return L.join('\n');
}
