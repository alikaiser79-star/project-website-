/* ============================================================
   WAR CHEST (§9) — freed money gets marching orders.

   Trigger-driven: when a money milestone lands (debt crosses a
   threshold DOWN, a money commitment resolves KEPT, or a recurring
   income source logs its first event) KAI fires a money/milestone
   event, the DEBT/LEDGER organ pulses GOLD (a victory, not a crimson
   alarm), and a War Chest session unlocks.

   §9.2 — the freed-cashflow math is DETERMINISTIC and computed here
   from the Spine, before any model is involved. If the math isn't
   real, the session doesn't open. Every figure carries its currency.
   ============================================================ */

import { getEvents, logEvent, type Domain } from './events';
import { getCommitments } from './commitments';
import { loadState } from '../store';
import { debt as DEBT } from '../../kaiConfig';
import { toEgp } from './money';
import { makadiProfit } from './makadiProfit';
import type { Currency } from '../../types';

const DAY = 86_400_000;
const FIRED_KEY = 'kai.warchest.fired';
const ACK_KEY = 'kai.warchest.acked';

/* Debt thresholds, crossed going DOWN. */
const THRESHOLDS = [50_000, 40_000, 30_000, 20_000, 10_000, 0];

export type MilestoneKind = 'debt_threshold' | 'debt_cleared' | 'commitment_kept' | 'income_added' | 'makadi_breakeven';

export interface Milestone {
  id: string;                 // stable dedupe key
  kind: MilestoneKind;
  label: string;              // human headline
  freedEgp: number;           // monthly cashflow freed, in EGP
  ccy: Currency;              // always 'EGP' here (the headline currency)
  detail: string;             // the math, shown
  ts: number;
}

/* ── dedupe / ack bookkeeping ─────────────────────────────── */
function firedKeys(): string[] { try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'); } catch { return []; } }
function markFired(key: string) { try { const s = new Set(firedKeys()); s.add(key); localStorage.setItem(FIRED_KEY, JSON.stringify([...s])); } catch { /* ignore */ } }
function ackedKeys(): string[] { try { return JSON.parse(localStorage.getItem(ACK_KEY) || '[]'); } catch { return []; } }
export function acknowledgeMilestone(id: string) { try { const s = new Set(ackedKeys()); s.add(id); localStorage.setItem(ACK_KEY, JSON.stringify([...s])); } catch { /* ignore */ } }

/* ── §9.2 freed-cashflow math (deterministic) ─────────────── */

/* Average monthly payment the operator routinely sends to the card,
   from payment_logged over the trailing 90 days. This is the cash that
   frees up as the balance falls (minimum + habitual overpayment). */
function avgMonthlyDebtPayment(now = Date.now()): number {
  const pays = getEvents({ domain: 'debt', type: 'payment_logged', since: now - 90 * DAY });
  if (!pays.length) return 0;
  const total = pays.reduce((s, e) => s + (e.value || 0), 0);
  return total / 3;   // 90d ≈ 3 months
}

/* Monthly interest no longer accruing on the principal just cleared. */
function interestSavedMonthly(reduced: number): number {
  return (DEBT.apr / 100 / 12) * Math.max(0, reduced);
}

function freedForDebt(prev: number, next: number, now = Date.now()): { egp: number; detail: string } {
  const cleared = next <= 0;
  const interest = interestSavedMonthly(prev - next);
  if (cleared) {
    const avg = avgMonthlyDebtPayment(now);
    const egp = Math.round(avg + interest);
    return { egp, detail: `Card cleared. Freed = your ~${Math.round(avg).toLocaleString()} EGP/mo of payments + ${Math.round(interest).toLocaleString()} EGP/mo of interest that stops accruing.` };
  }
  const egp = Math.round(interest);
  return { egp, detail: `Balance down ${Math.round(prev - next).toLocaleString()} EGP → ~${egp.toLocaleString()} EGP/mo of interest (${DEBT.apr}% APR) stops burning.` };
}

/* ── milestone scan — idempotent, safe on boot/visibility ─── */

/* Detect debt-threshold crossings from the balance_updated series. */
function scanDebtMilestones(now: number): Milestone[] {
  const out: Milestone[] = [];
  const evs = getEvents({ domain: 'debt', type: 'balance_updated' }).sort((a, b) => a.ts - b.ts);
  if (evs.length < 1) return out;
  const fired = new Set(firedKeys());
  for (let i = 1; i < evs.length; i++) {
    const prev = evs[i - 1].value ?? 0;
    const next = evs[i].value ?? 0;
    if (next >= prev) continue;                         // only downward moves
    for (const t of THRESHOLDS) {
      if (prev > t && next <= t) {
        const key = `debt.${t}`;
        if (fired.has(key)) continue;
        const { egp, detail } = freedForDebt(prev, next, evs[i].ts);
        if (egp <= 0) continue;                          // real math or nothing
        out.push({
          id: key, kind: t === 0 ? 'debt_cleared' : 'debt_threshold',
          label: t === 0 ? 'Credit card CLEARED' : `Debt under ${(t / 1000)}K EGP`,
          freedEgp: egp, ccy: 'EGP', detail, ts: evs[i].ts,
        });
      }
    }
  }
  return out;
}

/* Money commitments that resolved KEPT (debt/income metric). */
function scanCommitmentMilestones(_now: number): Milestone[] {
  const out: Milestone[] = [];
  const fired = new Set(firedKeys());
  const kept = getCommitments().filter((c) => c.status === 'kept' && (c.metric.domain === 'debt' || c.metric.domain === 'income'));
  for (const c of kept) {
    const key = `commitment.${c.id}`;
    if (fired.has(key)) continue;
    const avg = avgMonthlyDebtPayment();
    const egp = c.metric.domain === 'debt' ? Math.round(avg || interestSavedMonthly(c.metric.target)) : Math.round(c.metric.target);
    if (egp <= 0) continue;
    out.push({
      id: key, kind: 'commitment_kept', label: `Kept: ${c.text.slice(0, 40)}`,
      freedEgp: egp, ccy: 'EGP', detail: `Commitment resolved KEPT — the cashflow behind it is now yours to redeploy.`,
      ts: c.resolvedAt ?? Date.now(),
    });
  }
  return out;
}

/* A recurring income source logging its first event. */
function scanIncomeMilestones(_now: number): Milestone[] {
  const out: Milestone[] = [];
  const fired = new Set(firedKeys());
  const s = loadState();
  const firstBooking = getEvents({ domain: 'makadi', type: 'nights_booked' }).find((e) => (e.value ?? 0) > 0);
  if (firstBooking && !fired.has('income.makadi_first')) {
    const mk = s.makadi;
    const nights = firstBooking.value ?? 0;
    const egp = Math.round(nights * toEgp(mk?.nightlyRate ?? 0, (mk?.rateCcy ?? 'USD') as Currency));
    if (egp > 0) out.push({ id: 'income.makadi_first', kind: 'income_added', label: 'Makadi: first booking', freedEgp: egp, ccy: 'EGP', detail: `${nights} night(s) booked at ${mk?.nightlyRate} ${mk?.rateCcy} — new recurring cashflow.`, ts: firstBooking.ts });
  }
  return out;
}

/* Makadi break-even — the apartment has paid for itself (earned ≥ invested).
   A real threshold crossing, from the Profit Line's pure Spine arithmetic. */
function scanMakadiBreakEven(now: number): Milestone[] {
  const out: Milestone[] = [];
  if (new Set(firedKeys()).has('makadi.breakeven')) return out;
  const p = makadiProfit(now);
  if (p.brokeEven && p.spent > 0) {
    out.push({
      id: 'makadi.breakeven', kind: 'makadi_breakeven', label: 'Makadi PAID FOR ITSELF',
      freedEgp: Math.round(p.net), ccy: 'EGP',
      detail: `${Math.round(p.spent).toLocaleString()} EGP invested — now +${Math.round(p.net).toLocaleString()} EGP clear across ${p.nightsBooked} nights. Every night from here is profit.`,
      ts: now,
    });
  }
  return out;
}

/* Fire any new milestones to the Spine and return the full pending set
   (fired, not yet acknowledged). Idempotent via the fired-keys store. */
export function scanMilestones(now = Date.now()): Milestone[] {
  const found = [...scanDebtMilestones(now), ...scanCommitmentMilestones(now), ...scanIncomeMilestones(now), ...scanMakadiBreakEven(now)];
  for (const m of found) {
    markFired(m.id);
    try {
      logEvent({ domain: 'money', type: 'milestone', value: m.freedEgp, ccy: 'EGP',
        meta: { key: m.id, kind: m.kind, label: m.label, detail: m.detail }, source: 'auto', ts: m.ts });
    } catch { /* ignore */ }
  }
  return pendingMilestones();
}

/* All fired milestones not yet acknowledged, newest first. */
export function pendingMilestones(): Milestone[] {
  const acked = new Set(ackedKeys());
  const evs = getEvents({ domain: 'money', type: 'milestone' });
  const seen = new Set<string>();
  const out: Milestone[] = [];
  for (const e of evs) {
    const key = String(e.meta?.key || '');
    if (!key || acked.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: key, kind: (e.meta?.kind as MilestoneKind) || 'debt_threshold',
      label: String(e.meta?.label || 'Milestone'), freedEgp: e.value || 0, ccy: (e.ccy as Currency) || 'EGP',
      detail: String(e.meta?.detail || ''), ts: e.ts,
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/* The DEBT/LEDGER organ pulses GOLD while a milestone is unacknowledged. */
export function hasVictory(): boolean { return pendingMilestones().length > 0; }

/* §9.4 — one nag in the daily brief for a milestone fired in the last
   2 days with no deployment logged yet. Nags once, then archives. */
export function warChestBrief(now = Date.now()): string | null {
  const since = now - 2 * DAY;
  const ms = getEvents({ domain: 'money', type: 'milestone', since });
  const deps = getEvents({ domain: 'money', type: 'deployment', since: now - 30 * DAY });
  const undeployed = ms.filter((e) => !deps.some((d) => String(d.meta?.milestone || '') === String(e.meta?.key || '')));
  if (!undeployed.length) return null;
  const e = undeployed[undeployed.length - 1];
  return `War Chest: ${(e.value || 0).toLocaleString()} EGP/mo freed by "${e.meta?.label}" is still unallocated — open the War Chest and give it orders.`;
}

/* Latest freed-cashflow figure — heads the War Chest session. */
export function latestMilestone(): Milestone | null { return pendingMilestones()[0] ?? null; }

/* ── §9.3 THE COUNCIL — options, never orders ─────────────── */

export type Risk = 'LOW' | 'MED' | 'HIGH';
export type OptionKind = 'debt' | 'asset' | 'floor' | 'market';
export interface DeployOption {
  name: string;
  what: string[];            // 1-2 lines
  math: string;              // projected monthly return/saving, from real numbers
  risk: Risk;
  riskLine: string;          // one honest line on what kills it
  effort: string;            // hours/week
  ttfc: string;              // time to first cash
  firstMove: string;         // one concrete action
  kind: OptionKind;
  market?: boolean;          // market-based → MARKET EYE research, never a committed number
  marketQuery?: string;      // seed for the MARKET EYE mission
}

/* The guaranteed-return option KAI always leads with while debt exists.
   Deterministic — not left to the model (doctrine #1). */
function debtOption(freedEgp: number): DeployOption {
  const bal = loadState().debtCurrent || 0;
  const perkYr = Math.round((DEBT.apr / 100) * 1000);
  return {
    name: 'Kill the card',
    what: [`Throw the freed ~${freedEgp.toLocaleString()} EGP/mo at the ${DEBT.apr}% APR card.`, 'A guaranteed return — nothing else is risk-free at that rate.'],
    math: `${bal.toLocaleString()} EGP left · every 1,000 EGP paid saves ~${perkYr.toLocaleString()} EGP/yr in interest.`,
    risk: 'LOW', riskLine: 'The only risk is not doing it.',
    effort: '0 h/wk', ttfc: 'immediate', firstMove: `Pay ${freedEgp.toLocaleString()} EGP at the card now.`,
    kind: 'debt',
  };
}

const DISCLAIMER = 'KAI is not a licensed advisor. These are researched options with math — the decision is the operator\'s.';
export function warChestDisclaimer(): string { return DISCLAIMER; }

const DOCTRINE =
  `DEPLOYMENT DOCTRINE, in priority order:\n` +
  `1. Remaining debt is a GUARANTEED return — killing it leads while ANY debt exists.\n` +
  `2. Income-producing assets the operator CONTROLS (Makadi upgrades that raise the nightly rate, ` +
  `FRISCH build-out, agency capacity, Hidden Gärten) before anything passive.\n` +
  `3. An emergency floor (3 months of burn) before any risk asset.\n` +
  `4. Market-based ideas (funds, gold, crypto) appear ONLY as a CATEGORY flagged "market": true with a ` +
  `marketQuery — never invent prices or returns; a MARKET EYE agent fetches sourced data on request.`;

/* One Claude call → 3-5 deployment options. Doctrine #1 (debt first) is
   enforced client-side by prepending debtOption when debt remains, so
   the model is asked for the REST. Falls back to a deterministic set
   with no key. */
export async function requestCouncil(m: Milestone): Promise<{ options: DeployOption[]; reason?: string }> {
  const bal = loadState().debtCurrent || 0;
  const lead = bal > 0 ? [debtOption(m.freedEgp)] : [];

  let modelOptions: DeployOption[] = [];
  try {
    const { claudeConfig } = await import('../../kaiConfig');
    const { buildKaiContext } = await import('./context');
    if (claudeConfig.enabled) {
      const want = bal > 0 ? '3-4' : '4-5';
      const system = `You are KAI's War Chest council for Ali Kaiser (Cairo — Hidden Gärten, Makadi Airbnb, a German CX agency, FRISCH). Options, never orders. Use ONLY his real numbers. ${DOCTRINE}`;
      const prompt =
        `A money milestone just landed: ${m.label}. FREED: ${m.freedEgp.toLocaleString()} EGP/month (${m.detail}).\n\n` +
        `CONTEXT:\n${buildKaiContext()}\n\n` +
        `Return ${want} deployment options${bal > 0 ? ' (do NOT include paying the card — that is already option one)' : ''}. ` +
        `ONLY a JSON array; each object exactly:\n` +
        `{ "name": string, "what": [string,string], "math": string (projected monthly return/saving from HIS numbers), ` +
        `"risk": "LOW"|"MED"|"HIGH", "riskLine": string, "effort": string, "ttfc": string, "firstMove": string, ` +
        `"kind": "asset"|"floor"|"market", "market": boolean, "marketQuery": string }`;
      const res = await fetch(claudeConfig.endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: claudeConfig.modelHeavy, max_tokens: 1500, system, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) {
        const data = await res.json();
        try { const u = data?.usage; const { logTokens } = await import('./tokens'); logTokens('council', u?.input_tokens || 0, u?.output_tokens || 0, claudeConfig.modelHeavy); } catch { /* ignore */ }
        const text = (data?.content?.[0]?.text || '').trim();
        let arr: any = null;
        try { arr = JSON.parse(text); } catch { const mm = text.match(/\[[\s\S]*\]/); if (mm) { try { arr = JSON.parse(mm[0]); } catch { /* ignore */ } } }
        if (Array.isArray(arr)) modelOptions = arr.map(normalizeOption).filter(Boolean) as DeployOption[];
      }
    }
  } catch { /* fall through to fallback */ }

  if (!modelOptions.length) modelOptions = fallbackOptions();
  const options = [...lead, ...modelOptions].slice(0, 5);
  return { options };
}

function normalizeOption(o: any): DeployOption | null {
  if (!o || typeof o.name !== 'string') return null;
  const risk: Risk = ['LOW', 'MED', 'HIGH'].includes(o.risk) ? o.risk : 'MED';
  const kind: OptionKind = ['debt', 'asset', 'floor', 'market'].includes(o.kind) ? o.kind : 'asset';
  return {
    name: String(o.name).slice(0, 60),
    what: Array.isArray(o.what) ? o.what.map(String).slice(0, 2) : [String(o.what || '')],
    math: String(o.math || '—'), risk, riskLine: String(o.riskLine || ''),
    effort: String(o.effort || '—'), ttfc: String(o.ttfc || '—'), firstMove: String(o.firstMove || '—'),
    kind, market: !!o.market || kind === 'market', marketQuery: o.marketQuery ? String(o.marketQuery) : undefined,
  };
}

/* Deterministic council when the model is unavailable — doctrine-shaped. */
function fallbackOptions(): DeployOption[] {
  return [
    { name: 'Raise the Makadi rate', kind: 'asset', what: ['Small upgrades (photos, AC, essentials) to lift the nightly rate.', 'An asset you control — compounds every booked night.'],
      math: 'Each +5 USD/night × ~15 nights ≈ +75 USD/mo (~3,750 EGP).', risk: 'LOW', riskLine: 'Occupancy has to hold.', effort: '3 h/wk', ttfc: '2-4 weeks', firstMove: 'List the three cheapest rate-raising fixes.' },
    { name: 'Emergency floor', kind: 'floor', what: ['Bank 3 months of burn before any risk asset.', 'The floor that lets everything else be aggressive.'],
      math: 'Target = 3 × monthly burn (see Tollgate).', risk: 'LOW', riskLine: 'Opportunity cost while it sits.', effort: '0 h/wk', ttfc: 'n/a', firstMove: 'Move the freed cash to a separate account.' },
    { name: 'Market assets (research)', kind: 'market', market: true, marketQuery: 'current EGP-denominated options for a small monthly allocation: gold, T-bills, index funds — with real yields and risks, sourced', what: ['Funds, gold, T-bills — only with sourced, current numbers.', 'KAI never invents prices; MARKET EYE fetches them.'],
      math: 'Run MARKET EYE for live, sourced figures.', risk: 'MED', riskLine: 'Markets move — no guarantees.', effort: '1 h/wk', ttfc: 'varies', firstMove: 'Launch MARKET EYE for current sourced data.' },
  ];
}

/* ── §9.4 COMMIT THE CHOICE ───────────────────────────────── */
export async function commitDeployment(opt: DeployOption, m: Milestone): Promise<void> {
  const { addCommitment } = await import('./commitments');
  const s = loadState();
  const now = Date.now();
  const deadline = now + 30 * DAY;
  const metric = opt.kind === 'debt'
    ? { domain: 'debt' as Domain, event: 'balance_updated', op: '<=' as const, target: Math.max(0, (s.debtCurrent || 0) - m.freedEgp) }
    : { domain: 'money' as Domain, event: 'deployment_progress', op: '>=' as const, target: 1 };
  const c = addCommitment({ text: `War Chest: ${opt.name} — ${opt.firstMove}`.slice(0, 120), metric, deadline, source: 'kai' });
  try {
    logEvent({ domain: 'money', type: 'deployment', value: m.freedEgp, ccy: 'EGP',
      meta: { option: opt.name, kind: opt.kind, milestone: m.id, commitment: c.id }, source: 'user' });
  } catch { /* ignore */ }
  acknowledgeMilestone(m.id);
}

/* ── §9.5 LEDGER OF WINS ──────────────────────────────────── */
export interface WinRow { at: number; milestone: string; freedEgp: number; deployedInto: string | null; returnedEgp: number; }

export function ledgerOfWins(): WinRow[] {
  const milestones = getEvents({ domain: 'money', type: 'milestone' });
  const deployments = getEvents({ domain: 'money', type: 'deployment' });
  const returns = getEvents({ domain: 'money', type: 'deployment_return' });
  return milestones.map((ms) => {
    const key = String(ms.meta?.key || '');
    const dep = deployments.find((d) => String(d.meta?.milestone || '') === key);
    const retTotal = returns.filter((r) => String(r.meta?.milestone || '') === key).reduce((s, r) => s + (r.value || 0), 0);
    return {
      at: ms.ts, milestone: String(ms.meta?.label || 'Milestone'), freedEgp: ms.value || 0,
      deployedInto: dep ? String(dep.meta?.option || '—') : null, returnedEgp: retTotal,
    };
  }).sort((a, b) => b.at - a.at);
}
