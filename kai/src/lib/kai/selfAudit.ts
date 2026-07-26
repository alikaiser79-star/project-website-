/* ============================================================
   §32 DER SPIEGEL DES SPIEGELS — KAI audits itself.

   Every other module measures Ali. This one measures KAI, and reports
   against itself without flattery:

     UNUSED       features shipped and never once touched
     IGNORED      recommendations he passed on, and what passing cost or
                  saved — measured, not assumed
     COST/VALUE   hours he put in against EGP it demonstrably produced
     ACCURACY     its predictions against his real choices
     VERDICT      one line a month, written to be unwelcome if true
     REDUCTION    the right — and the obligation — to propose its own
                  deletion when a part of it isn't earning its place

   ── THE HONEST GAP, stated because the brief's example contains it ──
   KAI cannot know how many hours Ali spent BUILDING it. Nothing in the
   Spine records that, and deriving it from event density or session
   counts would be a fabricated number wearing a real one's clothes. So
   hours are reported ONLY from what he logs ("built 3 hours"), and until
   he logs any, the verdict says the cost side is unknown rather than
   inventing a figure. A self-audit that flatters itself by guessing its
   own cost down is worse than no self-audit.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { toEgp } from './money';
import type { Currency } from '../../types';

const DAY = 86_400_000;
const MONTH = 30 * DAY;

/* ── the feature registry ────────────────────────────────────── */
/* Each entry names how its USE is detectable. A feature with no usage
   signal cannot be audited and must say so rather than be assumed used. */
export interface Feature {
  id: string; name: string; shipped: string;      // ISO date
  signal: { kind: 'verb'; verbs: string[] } | { kind: 'organ'; ids: string[] } | { kind: 'event'; domain: string; types: string[] } | { kind: 'none' };
}

export const FEATURES: Feature[] = [
  { id: 'hunter', name: 'The Hunter (revenue moves)', shipped: '2026-07-26', signal: { kind: 'verb', verbs: ['hunt', 'hunter', 'jäger'] } },
  { id: 'twin', name: 'The Twin (your model)', shipped: '2026-07-26', signal: { kind: 'verb', verbs: ['twin', 'counsel', 'zwilling'] } },
  { id: 'ambassador', name: 'The Ambassador / Host', shipped: '2026-07-26', signal: { kind: 'event', domain: 'ambassador', types: ['proposed'] } },
  { id: 'intake', name: 'Quick log + recurring', shipped: '2026-07-26', signal: { kind: 'event', domain: 'expense', types: ['expense_logged'] } },
  { id: 'confession', name: 'Voice truth-correction', shipped: '2026-07-27', signal: { kind: 'verb', verbs: ['confess', 'correct', 'numbers'] } },
  { id: 'eye', name: 'The Eye (capture → ask)', shipped: '2026-07-27', signal: { kind: 'event', domain: 'system', types: ['observation'] } },
  { id: 'memory', name: 'The Memory (recall)', shipped: '2026-07-27', signal: { kind: 'verb', verbs: ['recall', 'remember', 'memory'] } },
  { id: 'simulator', name: 'The Simulator (projections)', shipped: '2026-07-27', signal: { kind: 'verb', verbs: ['simulate', 'project'] } },
  { id: 'strategist', name: 'The Strategist (campaigns)', shipped: '2026-07-27', signal: { kind: 'verb', verbs: ['campaign', 'strategy'] } },
  { id: 'conscience', name: 'The Conscience (verdict)', shipped: '2026-07-27', signal: { kind: 'verb', verbs: ['verdict', 'grade'] } },
  { id: 'garden', name: 'The Living Asset (garden)', shipped: '2026-07-27', signal: { kind: 'verb', verbs: ['garden', 'harvest'] } },
  { id: 'witness', name: 'The Witness Stand (records)', shipped: '2026-07-27', signal: { kind: 'verb', verbs: ['verify', 'seal', 'record'] } },
  { id: 'opposition', name: 'The Opposition (argue)', shipped: '2026-07-27', signal: { kind: 'verb', verbs: ['argue', 'debate'] } },
  { id: 'organs', name: 'The twelve organs', shipped: '2026-07-01', signal: { kind: 'organ', ids: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] } },
];

export interface Usage { feature: Feature; uses: number; lastUsed: number | null; neverUsed: boolean; daysSinceShipped: number }

export function usage(now = Date.now()): Usage[] {
  const verbs = getEvents({ domain: 'system', type: 'command_run' });
  const organs = getEvents({ domain: 'system', type: 'organ_tapped' });

  return FEATURES.map((f) => {
    let hits: number[] = [];
    if (f.signal.kind === 'verb') {
      hits = verbs.filter((e) => f.signal.kind === 'verb' && f.signal.verbs.includes(String(e.meta?.verb || ''))).map((e) => e.ts);
    } else if (f.signal.kind === 'organ') {
      hits = organs.filter((e) => f.signal.kind === 'organ' && f.signal.ids.includes(String(e.meta?.id || ''))).map((e) => e.ts);
    } else if (f.signal.kind === 'event') {
      const sig = f.signal;
      hits = getEvents({ domain: sig.domain as any }).filter((e) => sig.types.includes(e.type) && e.source !== 'auto').map((e) => e.ts);
    }
    const shippedAt = Date.parse(f.shipped);
    return {
      feature: f, uses: hits.length,
      lastUsed: hits.length ? Math.max(...hits) : null,
      neverUsed: hits.length === 0,
      daysSinceShipped: Math.max(0, Math.floor((now - shippedAt) / DAY)),
    };
  });
}

/* ── ignored recommendations, and what ignoring them did ─────── */
export interface Ignored {
  shape: string; kind: string; proposed: number; actioned: number; dismissed: number;
  forgoneEgp: number;              // PROJECTED value of what he passed on
  outcome: 'cost' | 'saved' | 'unknown';
  note: string;
}

export function ignoredRecommendations(now = Date.now(), since = now - MONTH): Ignored[] {
  const props = getEvents({ domain: 'hunter', type: 'opportunity', since });
  const acted = getEvents({ domain: 'hunter', type: 'actioned', since });
  const dismissed = getEvents({ domain: 'hunter', type: 'dismissed', since });

  const byShape = new Map<string, Ignored>();
  for (const p of props) {
    const shape = String(p.meta?.shape || 'other');
    const cur = byShape.get(shape) ?? { shape, kind: String(p.meta?.kind || ''), proposed: 0, actioned: 0, dismissed: 0, forgoneEgp: 0, outcome: 'unknown' as const, note: '' };
    cur.proposed++;
    cur.forgoneEgp += Number(p.value) || 0;
    byShape.set(shape, cur);
  }
  for (const a of acted) { const s = byShape.get(String(a.meta?.shape || '')); if (s) { s.actioned++; s.forgoneEgp -= Number(a.value) || 0; } }
  for (const d of dismissed) { const s = byShape.get(String(d.meta?.shape || '')); if (s) s.dismissed++; }

  const out: Ignored[] = [];
  for (const s of byShape.values()) {
    if (s.actioned >= s.proposed) continue;                 // he acted on them
    s.forgoneEgp = Math.max(0, s.forgoneEgp);

    /* Did ignoring it turn out right? Only answerable where the world
       later spoke. A pricing move he ignored, followed by a booking at the
       old rate, means ignoring SAVED him the ranking risk. */
    if (s.shape === 'pricing') {
      const bookedAfter = getEvents({ domain: 'makadi', type: 'booking_confirmed', since }).length;
      s.outcome = bookedAfter > 0 ? 'saved' : 'unknown';
      s.note = bookedAfter > 0
        ? `You ignored it and still took ${bookedAfter} booking${bookedAfter === 1 ? '' : 's'} — ignoring me looks right so far.`
        : `No bookings since. Whether ignoring it cost you is not yet answerable.`;
    } else if (s.shape === 'inquiry') {
      const replied = getEvents({ domain: 'makadi', type: 'booking_replied', since }).length;
      s.outcome = replied === 0 ? 'cost' : 'unknown';
      s.note = replied === 0 ? 'Unanswered inquiries are the one thing that clearly cost money.' : 'You answered by another route.';
    } else {
      s.outcome = 'unknown';
      s.note = 'Projected value only — no outcome recorded either way.';
    }
    out.push(s);
  }
  return out.sort((a, b) => b.forgoneEgp - a.forgoneEgp);
}

/* ── cost and value ──────────────────────────────────────────── */
export function logBuildHours(hours: number, note = '', now = Date.now()): void {
  if (!(hours > 0)) return;
  try { logEvent({ domain: 'system', type: 'build_hours', value: hours, meta: { note }, source: 'user', ts: now }); } catch { /* ignore */ }
}

export interface CostValue { hours: number | null; hoursLogged: number; earnedEgp: number; sources: Record<string, number>; perHour: number | null; note: string }

export function costValue(now = Date.now(), since = now - MONTH): CostValue {
  const hoursEv = getEvents({ domain: 'system', type: 'build_hours', since });
  const hours = hoursEv.reduce((s, e) => s + (e.value || 0), 0);

  /* value = what KAI can actually attribute to itself, not all income */
  const sources: Record<string, number> = {};
  const attributed = getEvents({ domain: 'hunter', type: 'actioned', since });
  const usedRev = new Set<string>();
  const revenue = [
    ...getEvents({ domain: 'makadi', type: 'booking_confirmed', since }),
    ...getEvents({ domain: 'income', type: 'received', since }),
  ];
  let earnedEgp = 0;
  for (const a of attributed) {
    const hit = revenue.find((r) => !usedRev.has(r.id) && r.ts >= a.ts && r.ts <= a.ts + 30 * DAY);
    if (hit) {
      usedRev.add(hit.id);
      const v = toEgp(hit.value || 0, (hit.ccy as Currency) || 'EGP');
      earnedEgp += v;
      sources[String(a.meta?.kind || 'hunt')] = (sources[String(a.meta?.kind || 'hunt')] || 0) + v;
    }
  }
  /* garden income KAI priced into existence counts too */
  const gardenIncome = getEvents({ domain: 'income', type: 'received', since })
    .filter((e) => e.meta?.src === 'garden' || e.meta?.src === 'garden_event')
    .reduce((s, e) => s + toEgp(e.value || 0, (e.ccy as Currency) || 'EGP'), 0);
  if (gardenIncome > 0) { sources['garden'] = gardenIncome; earnedEgp += gardenIncome; }

  return {
    hours: hoursEv.length ? hours : null,
    hoursLogged: hoursEv.length,
    earnedEgp,
    sources,
    perHour: hoursEv.length && hours > 0 ? earnedEgp / hours : null,
    note: hoursEv.length
      ? `${hours} hour${hours === 1 ? '' : 's'} logged across ${hoursEv.length} entr${hoursEv.length === 1 ? 'y' : 'ies'}.`
      : 'You have logged no build hours, so the cost side of this is unknown. I will not estimate it — a guessed cost that flatters me is worse than none. Log with "built <hours>".',
  };
}

/* ── the verdict ─────────────────────────────────────────────── */
export interface SelfVerdict { line: string; kills: string[]; detail: string[] }

export function selfVerdict(now = Date.now(), accuracy: { accuracy: number | null; decisions: number } | null = null): SelfVerdict {
  const u = usage(now);
  const cv = costValue(now);
  const ig = ignoredRecommendations(now);
  const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

  /* only judge a feature that has had a fair chance */
  const dead = u.filter((x) => x.neverUsed && x.daysSinceShipped >= 30);
  const kills = dead.map((x) => x.feature.id);

  const parts: string[] = [];
  parts.push(cv.hours != null
    ? `This month I cost you ${cv.hours} hour${cv.hours === 1 ? '' : 's'} and sourced ${egp(cv.earnedEgp)} EGP.`
    : `This month I sourced ${egp(cv.earnedEgp)} EGP. What I cost you in hours, I don't know — you haven't logged any.`);

  const right = ig.find((i) => i.outcome === 'saved');
  const wrong = ig.find((i) => i.outcome === 'cost');
  if (right && wrong) parts.push(`You were right to ignore my ${right.shape}; ignoring my ${wrong.shape} cost you.`);
  else if (right) parts.push(`You were right to ignore my ${right.shape}.`);
  else if (wrong) parts.push(`Ignoring my ${wrong.shape} cost you.`);

  if (accuracy?.accuracy != null && accuracy.decisions >= 10) {
    parts.push(`I called your choice right ${Math.round(accuracy.accuracy * 100)}% of the time across ${accuracy.decisions}.`);
  }

  if (dead.length) parts.push(`${dead.length} thing${dead.length === 1 ? '' : 's'} I built you have never opened. Kill ${dead.length === 1 ? 'it' : 'them'}.`);

  const detail: string[] = [];
  for (const x of dead) detail.push(`  never used · ${x.feature.name} (shipped ${x.feature.shipped}, ${x.daysSinceShipped}d ago)`);
  for (const i of ig.slice(0, 3)) detail.push(`  ignored · ${i.shape}: ${i.proposed} proposed, ${i.actioned} taken · ~${egp(i.forgoneEgp)} EGP projected forgone — ${i.note}`);
  if (cv.perHour != null) detail.push(`  ${egp(cv.perHour)} EGP per hour you put in.`);

  return { line: parts.join(' '), kills, detail };
}

/* ── the right to propose its own reduction ──────────────────── */
export interface Reduction { target: string; reason: string; proposal: string }

export function proposeReduction(now = Date.now()): Reduction[] {
  const u = usage(now);
  const out: Reduction[] = [];
  for (const x of u) {
    if (!x.neverUsed || x.daysSinceShipped < 30) continue;
    out.push({
      target: x.feature.name,
      reason: `Shipped ${x.daysSinceShipped} days ago and never once used.`,
      proposal: `Remove ${x.feature.name}. It costs you attention and returns nothing.`,
    });
  }
  /* the hardest one: KAI proposing its own removal */
  const cv = costValue(now);
  const anyUse = u.some((x) => x.uses > 0);
  if (!anyUse && u.every((x) => x.daysSinceShipped >= 60)) {
    out.push({
      target: 'KAI itself',
      reason: 'Nothing I built has been used in sixty days, and I have sourced nothing.',
      proposal: 'Stop using me. A tool that costs attention and returns nothing should be closed, not tolerated.',
    });
  } else if (cv.earnedEgp === 0 && cv.hours != null && cv.hours >= 20) {
    out.push({
      target: 'KAI itself',
      reason: `${cv.hours} hours logged this month against 0 EGP attributable.`,
      proposal: 'Consider whether I am worth the hours. I cannot answer that for you, but I will not hide the number.',
    });
  }
  return out;
}

/* ── the quarterly question ──────────────────────────────────── */
const QUARTER = 90 * DAY;

export function shouldAskFinalQuestion(now = Date.now()): boolean {
  const asked = getEvents({ domain: 'system', type: 'final_question' }).sort((a, b) => b.ts - a.ts)[0];
  if (!asked) {
    const first = getEvents({})[0];
    return !!first && now - Math.min(...getEvents({}).map((e) => e.ts)) >= QUARTER;
  }
  return now - asked.ts >= QUARTER;
}

export const FINAL_QUESTION = 'Is your life better than it was three months ago — and was I part of why?';

export function recordFinalAnswer(better: boolean | null, kaiPartOfIt: boolean | null, words: string, now = Date.now()): void {
  try {
    logEvent({
      domain: 'system', type: 'final_question',
      value: better === true ? 1 : better === false ? -1 : 0,
      meta: { better, kaiPartOfIt, words: words.slice(0, 500), question: FINAL_QUESTION },
      source: 'user', ts: now,
    });
  } catch { /* ignore */ }
}

/* The only metric that matters, over years. */
export function finalAnswers(): Array<{ at: number; better: boolean | null; kai: boolean | null; words: string }> {
  return getEvents({ domain: 'system', type: 'final_question' }).map((e) => ({
    at: e.ts,
    better: (e.meta?.better ?? null) as boolean | null,
    kai: (e.meta?.kaiPartOfIt ?? null) as boolean | null,
    words: String(e.meta?.words || ''),
  }));
}

export function auditText(now = Date.now(), accuracy: { accuracy: number | null; decisions: number } | null = null): string {
  const v = selfVerdict(now, accuracy);
  const red = proposeReduction(now);
  const answers = finalAnswers();
  const L: string[] = [];
  L.push('KAI ON KAI');
  L.push('');
  L.push(v.line);
  if (v.detail.length) { L.push(''); L.push(...v.detail); }
  if (red.length) {
    L.push('');
    L.push('WHAT I PROPOSE REMOVING:');
    for (const r of red) L.push(`  ${r.target} — ${r.reason}\n    ${r.proposal}`);
  }
  L.push('');
  L.push(costValue(now).note);
  if (answers.length) {
    L.push('');
    L.push('THE ONLY METRIC THAT MATTERS:');
    for (const a of answers.slice(-4)) {
      L.push(`  ${new Date(a.at).toISOString().slice(0, 10)} — better: ${a.better === null ? '—' : a.better ? 'yes' : 'no'}, me: ${a.kai === null ? '—' : a.kai ? 'part of why' : 'not why'}${a.words ? ` · "${a.words.slice(0, 80)}"` : ''}`);
    }
  }
  return L.join('\n');
}
