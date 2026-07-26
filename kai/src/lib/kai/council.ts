/* ============================================================
   §25 DER RAT (The Council) — the modules confer before anyone speaks.

   Before this, every engine read the Spine alone and reported alone: the
   Hunter didn't know the Twin thinks you abandon a lane, the Twin's drift
   didn't know what the lane was worth, and NOW/Schatten each ranked their
   own needs — so the same fact could reach you twice, from two mouths.

   The Council fixes that with one shared pass:

     assembleContext()  gathers Spine, Twin, Hunter, commitments, Radar,
                        Ambassador, runway, profit and signals ONCE. Each
                        engine runs a single time per assembly; every
                        surface reads the same snapshot, so two surfaces
                        can never disagree.
     annotatedMoves()   Hunter moves filtered THROUGH the Twin.
     annotatedDrift()   Twin warnings that cite what the lane is worth.
     councilQueue()     ONE ranked, deduped queue of everything that needs
                        him — across every engine.
     bestLine()         the single best sentence any engine has tonight.

   Deterministic. The only LLM call in the Council is the nightly synthesis
   (server-side, §25.3). Nothing here fabricates.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';
import { getVersion } from './store';
import { getCommandSignals } from './commandSignals';
import { getCommitments, type Commitment } from './commitments';
import { buildTwinModel, detectDrift, type TwinModel, type DriftWarning } from './twin';
import { generateOpportunities, hunterLedger, type Opportunity, type HunterLedger } from './hunter';
import { computeRunway, type Runway } from './runway';
import { makadiProfit, type MakadiProfit } from './makadiProfit';
import { getPending } from './pending';
import type { KaiAction } from '../actions';

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface CouncilContext {
  now: number;
  events: KaiEvent[];
  signals: ReturnType<typeof getCommandSignals>;
  twin: TwinModel;
  drift: DriftWarning[];
  moves: Opportunity[];
  ledger: HunterLedger;
  commitments: Commitment[];
  overdue: Commitment[];
  openInquiries: KaiEvent[];
  radar: KaiEvent[];
  ambassadorPending: number;
  runway: Runway;
  profit: MakadiProfit;
}

/* ── the single pass ───────────────────────────────────────────
   Memoised against the Spine's version counter so every surface in a
   render tick shares ONE assembly instead of each re-running the engines. */
let cached: { ctx: CouncilContext; version: number; at: number } | null = null;

export function assembleContext(now = Date.now(), force = false): CouncilContext {
  const version = safe(() => getVersion(), 0);
  if (!force && cached && cached.version === version && Math.abs(now - cached.at) < 5_000) return cached.ctx;

  const events = safe(() => getEvents({}), [] as KaiEvent[]);
  const commitments = safe(() => getCommitments(), [] as Commitment[]);
  const twin = safe(() => buildTwinModel(now), emptyTwin());

  /* Answered = replied to, or already became a booking. */
  const replied = new Set(events.filter((e) => e.domain === 'makadi' && e.type === 'booking_replied').map((e) => String(e.meta?.thread)));
  const confirmed = new Set(events.filter((e) => e.domain === 'makadi' && e.type === 'booking_confirmed').map((e) => String(e.meta?.thread)));

  const ctx: CouncilContext = {
    now,
    events,
    signals: safe(() => getCommandSignals(), {} as any),
    twin,
    drift: safe(() => detectDrift(now), [] as DriftWarning[]),
    moves: safe(() => generateOpportunities(now), [] as Opportunity[]),
    ledger: safe(() => hunterLedger(now), { proposed: 0, taps: 0, attributedEgp: 0, line: '' }),
    commitments,
    overdue: commitments.filter((c) => c.status === 'open' && c.deadline < now).sort((a, b) => a.deadline - b.deadline),
    openInquiries: events.filter((e) => e.domain === 'makadi' && e.type === 'booking_inquiry'
      && !replied.has(String(e.meta?.thread || e.id)) && !confirmed.has(String(e.meta?.thread || e.id))
      && now - e.ts > 2 * HOUR).sort((a, b) => a.ts - b.ts),
    radar: events.filter((e) => e.domain === 'radar' && e.ts >= now - 14 * DAY),
    ambassadorPending: safe(() => getPending().filter((a) => a.summary?.startsWith('Ambassador')).length, 0),
    runway: safe(() => computeRunway(now), { runwayDays: null, liquidCash: 0, dailyBurn: 0 } as Runway),
    profit: safe(() => makadiProfit(now), {} as MakadiProfit),
  };

  cached = { ctx, version, at: now };
  return ctx;
}

export function invalidateCouncil(): void { cached = null; }

/* ── CROSS-REFERENCE 1 — Hunter moves, filtered through the Twin ──
   A move in a lane the operator's own record says he abandons carries that
   warning on the card. His history, not an opinion. */
const LANE_DOMAIN: Record<string, string> = {
  broadcast: 'makadi', pricing: 'makadi', inquiry: 'makadi', chase: 'makadi', lead_nudge: 'leads',
};

export interface AnnotatedMove extends Opportunity { twinNote?: string }

export function annotatedMoves(ctx: CouncilContext): AnnotatedMove[] {
  return ctx.moves.map((m) => {
    const domain = LANE_DOMAIN[m.kind];
    const ft = ctx.twin.followThrough.find((f) => f.domain === domain);
    let twinNote: string | undefined;
    if (ft && ft.status === 'abandoned') twinNote = `Your record: ${domain} has been silent ${ft.lastDaysAgo}d — you start this lane more than you finish it.`;
    else if (ft && ft.status === 'fading') twinNote = `Your record: ${domain} is fading (${ft.lastDaysAgo}d quiet).`;
    /* A vague-commitment habit is worth flagging on multi-step moves. */
    if (!twinNote && m.minutes >= 3 && (ctx.twin.reliability.vague.pct ?? 100) < 60) {
      twinNote = `Your record: you keep only ${ctx.twin.reliability.vague.pct}% of vague commitments — put a date on this one.`;
    }
    return twinNote ? { ...m, twinNote } : { ...m };
  });
}

/* ── CROSS-REFERENCE 2 — drift warnings that cite the money ──
   "You're drifting on content, and the content lane is worth X." */
export interface AnnotatedDrift extends DriftWarning { worthEgp?: number; laneText?: string }

export function annotatedDrift(ctx: CouncilContext): AnnotatedDrift[] {
  return ctx.drift.map((d) => {
    /* value the lane this drift touches, from the Hunter's live moves */
    const domain = /content|instagram/i.test(d.text) ? 'content'
      : /makadi|booking|listing/i.test(d.text) ? 'makadi'
      : /lead|client/i.test(d.text) ? 'leads' : null;
    if (!domain) return { ...d };
    const worth = ctx.moves
      .filter((m) => LANE_DOMAIN[m.kind] === domain)
      .reduce((s, m) => s + m.expectedEgp, 0);
    if (worth <= 0) return { ...d };
    return { ...d, worthEgp: worth, laneText: `The ${domain} lane is worth ~${Math.round(worth).toLocaleString('en-GB')} EGP right now.` };
  });
}

/* ── CROSS-REFERENCE 3 — ONE queue, every engine, deduped ──────
   Each need carries a semantic `key`; a fact can enter the queue once no
   matter how many engines noticed it. This is the single source both the
   NOW block and the morning dispatch draw from — so you never hear the
   same thing twice from two mouths. */
export type NeedTone = 'crimson' | 'gold' | 'amber';
export interface Need {
  key: string;              // semantic identity — the dedupe unit
  text: string;
  tone: NeedTone;
  urgency: number;          // higher = sooner
  source: 'inquiry' | 'commitment' | 'hunter' | 'organ' | 'drift' | 'ambassador';
  action?: KaiAction;
}

const ORGAN_LABEL: Record<string, string> = {
  '01': 'Income', '02': 'Debt', '03': 'Garden', '04': 'Makadi', '05': 'Instagram',
  '06': 'Priorities', '07': 'Expenses', '08': 'Content', '09': 'Mirror', '10': 'Ledger',
  '11': 'Tollgate', '12': 'Inbox',
};

export function councilQueue(ctx: CouncilContext): Need[] {
  const out: Need[] = [];
  const seen = new Set<string>();
  const push = (n: Need) => { if (seen.has(n.key)) return; seen.add(n.key); out.push(n); };

  /* 1. unanswered inquiry — the most expensive silence */
  for (const e of ctx.openInquiries) {
    const thread = String(e.meta?.thread || e.id);
    push({
      key: 'inquiry:' + thread, source: 'inquiry', tone: 'crimson', urgency: 100,
      text: `Answer ${e.meta?.guest || 'a guest'}'s inquiry — waiting ${Math.round((ctx.now - e.ts) / HOUR)}h.`,
      action: { type: 'open-hunter' },
    });
  }

  /* 2. overdue commitments */
  for (const c of ctx.overdue) {
    push({
      key: 'commitment:' + c.id, source: 'commitment', tone: 'crimson', urgency: 90,
      text: `Overdue: "${(c.text || '').slice(0, 44)}".`,
      action: { type: 'ping-panel', panel: '09' },
    });
  }

  /* 3. Hunter's time-sensitive money (standing broadcasts aren't "today";
        the inquiry lane is already represented above — dedupe by thread). */
  for (const m of ctx.moves) {
    if (m.kind === 'broadcast') continue;
    if (m.expectedEgp < 1000) continue;
    const key = m.kind === 'inquiry' && m.meta?.thread ? 'inquiry:' + m.meta.thread : 'hunter:' + m.shape;
    push({
      key, source: 'hunter', tone: 'gold', urgency: 70 + Math.min(15, m.egpPerMin / 500),
      text: `${m.title} · +${Math.round(m.expectedEgp).toLocaleString('en-GB')} EGP`,
      action: { type: 'open-hunter' },
    });
  }

  /* 4. drift forming — the Twin's early warning, with the lane's value */
  for (const d of annotatedDrift(ctx)) {
    if (d.severity !== 'warn') continue;
    push({
      key: 'drift:' + d.key, source: 'drift', tone: 'crimson', urgency: 60,
      text: d.laneText ? `${d.text} ${d.laneText}` : d.text,
      action: { type: 'open-twin' },
    });
  }

  /* 5. calling organs — a domain that genuinely needs him */
  for (const id of Object.keys(ctx.signals)) {
    if (!ctx.signals[id]?.calling) continue;
    push({
      key: 'organ:' + id, source: 'organ', tone: 'amber', urgency: 40,
      text: `${ORGAN_LABEL[id] || id} needs you — ${ctx.signals[id]?.formatted ?? ''}`.trim().replace(/\s+—\s*$/, ''),
      action: { type: 'ping-panel', panel: id },
    });
  }

  /* 6. the Ambassador is holding drafts for a tap */
  if (ctx.ambassadorPending > 0) {
    push({
      key: 'ambassador:queue', source: 'ambassador', tone: 'gold', urgency: 50,
      text: `${ctx.ambassadorPending} guest message${ctx.ambassadorPending === 1 ? '' : 's'} drafted — one tap to send.`,
    });
  }

  return out.sort((a, b) => b.urgency - a.urgency);
}

/* ── CROSS-REFERENCE 4 — the single best sentence tonight ──────
   Der Schatten's morning line is the best output of ALL engines, not just
   its own scan. Prefers the Council's nightly synthesis when one exists. */
export function bestLine(ctx: CouncilContext): string | null {
  const synth = ctx.events
    .filter((e) => e.domain === 'system' && e.type === 'insight' && e.meta?.source === 'council' && ctx.now - e.ts < 36 * HOUR)
    .sort((a, b) => a.ts - b.ts).slice(-1)[0];
  if (synth?.meta?.text) return String(synth.meta.text);
  const top = councilQueue(ctx)[0];
  return top ? top.text : null;
}

function safe<T>(fn: () => T, fallback: T): T { try { return fn(); } catch { return fallback; } }

function emptyTwin(): TwinModel {
  const r = { kept: 0, total: 0, pct: null };
  return {
    reliability: { specific: { ...r }, vague: { ...r }, overall: { ...r } },
    spending: { wins: 0, postWinAvgEgp: 0, baselineAvgEgp: 0, ratio: null, flags: false },
    precursors: [], followThrough: [],
    confidence: { days: 0, events: 0, resolved: 0, level: 'seed', honest: 'No history yet.' },
    insights: [],
  };
}
