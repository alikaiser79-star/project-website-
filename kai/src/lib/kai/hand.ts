/* ============================================================
   §44.2 DIE HAND — one tap fires the whole chain.

   Not one message, one price, one action. Tap "fill September" and the
   whole campaign goes: reprice, draft, broadcast, block the cleaner's
   calendar, set the follow-up.

   ── WHY THIS IS THE MOST DANGEROUS FILE IN THE PROJECT ────────
   Every safeguard built so far assumes a human sees each action before
   it fires. A chain breaks that assumption by design: one tap, five
   consequences. So the safeguards have to be stronger here, not
   weaker, and they are enforced structurally:

     1. ONE APPROVAL, FULL DISCLOSURE. The chain is shown as a list of
        every step with its own payload BEFORE the tap. There is no
        "and 3 more" — a step he has not seen cannot be in a chain he
        approves.
     2. A CHAIN CANNOT CONTAIN WHAT A CHAIN MAY NOT DO. Money and
        identity actions are refused at BUILD time, not filtered at
        run time. site_deploy and anything the Apprentice may never
        automate cannot enter a chain at all — if a step needs its own
        judgement it gets its own tap, forever.
     3. EVERY STEP IS REVERSIBLE OR IT IS NOT A STEP. A step declares
        how it is undone. A step with no undo is refused at build time.
     4. IT STOPS ON THE FIRST FAILURE. A half-fired chain that keeps
        going is worse than one that stops and says where.
     5. EVERY STEP IS LOGGED INDIVIDUALLY under the chain's id, so
        "one tap" never means "one line in the record".
   ============================================================ */

import { logEvent, getEvents } from './events';
import { proposeAction, type PendingKind } from './pending';

/* Kinds a chain may contain. Deliberately a SHORT allow-list rather
   than a block-list: a new action kind is excluded until someone
   decides it belongs, which is the safe direction to fail. */
const CHAINABLE: PendingKind[] = ['email_send', 'log_batch'];

export interface Step {
  kind: PendingKind | 'local';
  summary: string;
  payload: unknown;
  /* How this step is undone. A step that cannot say is refused. */
  undo: string;
}

export interface Chain {
  id: string;
  name: string;
  steps: Step[];
  why: string;
}

export interface BuildResult { chain: Chain | null; refused: string[] }

export function buildChain(name: string, why: string, steps: Step[], now = Date.now()): BuildResult {
  const refused: string[] = [];
  const ok: Step[] = [];

  for (const s of steps) {
    if (!s.undo || !s.undo.trim()) {
      refused.push(`"${s.summary}" — no undo declared. A step that cannot be reversed does not go in a chain; it gets its own tap.`);
      continue;
    }
    if (s.kind !== 'local' && !CHAINABLE.includes(s.kind)) {
      refused.push(`"${s.summary}" (${s.kind}) — this kind is never chainable. It touches money, identity, or the live site, and it keeps its own approval forever.`);
      continue;
    }
    ok.push(s);
  }

  if (!ok.length) return { chain: null, refused };
  return {
    chain: { id: 'chain-' + Math.random().toString(36).slice(2, 9), name, why, steps: ok },
    refused,
  };
}

/* The full disclosure. Everything he is about to authorise, in one
   place, with no summarisation and no truncation. */
export function chainText(c: Chain, refused: string[] = []): string {
  const L = [`ONE TAP · ${c.name.toUpperCase()}`, '', c.why, '', `${c.steps.length} steps, all reversible:`];
  c.steps.forEach((s, i) => {
    L.push(`  ${i + 1}. ${s.summary}`);
    L.push(`      undo: ${s.undo}`);
  });
  if (refused.length) {
    L.push('');
    L.push('NOT IN THIS CHAIN:');
    for (const r of refused) L.push(`  ${r}`);
  }
  L.push('');
  L.push('Approving fires all of them in order and stops at the first failure.');
  return L.join('\n');
}

export interface FireResult { fired: number; stoppedAt: string | null; chainId: string }

/* Fires the chain. Each step that reaches the outside world goes
   through proposeAction — the Gate is not bypassed, it is fed. */
export function fireChain(c: Chain, now = Date.now()): FireResult {
  try {
    logEvent({ domain: 'system', type: 'chain_fired', meta: { id: c.id, name: c.name, steps: c.steps.length }, source: 'user', ts: now });
  } catch { /* ignore */ }

  let fired = 0;
  for (const s of c.steps) {
    try {
      if (s.kind !== 'local') proposeAction(s.kind, `[${c.name}] ${s.summary}`, s.payload);
      logEvent({
        domain: 'system', type: 'chain_step',
        meta: { chain: c.id, step: s.summary, kind: s.kind, undo: s.undo },
        source: 'user', ts: now,
      });
      fired++;
    } catch (e: any) {
      /* Stop. A half-fired chain that keeps going is worse than one
         that stops and names the step. */
      try {
        logEvent({ domain: 'system', type: 'chain_stopped',
          meta: { chain: c.id, at: s.summary, error: String(e?.message || e).slice(0, 160) }, source: 'auto', ts: now });
      } catch { /* ignore */ }
      return { fired, stoppedAt: s.summary, chainId: c.id };
    }
  }
  return { fired, stoppedAt: null, chainId: c.id };
}

/* What a chain did, step by step. "One tap" must never mean one line
   in the record. */
export function chainLog(chainId: string, now = Date.now()): string[] {
  return getEvents({ domain: 'system', type: 'chain_step' })
    .filter((e) => e.ts <= now && e.meta?.chain === chainId)
    .map((e) => `${String(e.meta?.step)} — undo: ${String(e.meta?.undo)}`);
}

/* ── the campaign the brief asked for ────────────────────────── */

export function fillMonthChain(month: string, openNights: number, avgEgp: number): BuildResult {
  return buildChain(
    `fill ${month}`,
    `${openNights} nights open in ${month}. At your realised ${Math.round(avgEgp).toLocaleString('en-GB')} EGP a night that is money the calendar is currently not asking for.`,
    [
      { kind: 'email_send', summary: `Broadcast the ${month} gap to past direct guests`,
        payload: { template: 'direct_broadcast', month }, undo: 'Nothing sends until the Gate approves each mail; reject them there.' },
      { kind: 'log_batch', summary: `Block the likely turnover days for the cleaner`,
        payload: { entries: [], note: `${month} turnovers` }, undo: 'Delete the blocked days from the calendar.' },
      { kind: 'log_batch', summary: 'Set a 5-day follow-up on anyone who does not reply',
        payload: { entries: [], note: `${month} follow-up` }, undo: 'Remove the follow-up from the queue.' },
      /* Deliberately included so the refusal is VISIBLE in the chain
         he reads, rather than silently absent: a rate change is money. */
      { kind: 'site_deploy', summary: `Reprice the empty ${month} nights against comps`,
        payload: { month }, undo: 'Set the rate back.' },
    ],
  );
}
