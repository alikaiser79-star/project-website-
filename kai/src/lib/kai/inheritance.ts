/* ============================================================
   §30.12 THE TWIN → THE INHERITANCE.

   The Twin models Kaiser inside a session, in this codebase, on this
   device. All three are temporary. This makes the model portable:

     EXPORT   one self-describing JSON file — the measured patterns, the
              evidence behind each, and a plain-language rendering that a
              human (or any future model) can read cold.
     IMPORT   the same file read back, so a rebuilt KAI resumes knowing
              him rather than starting blank.
     ENDURE   it carries its own schema and its own explanation, so it is
              readable without this code. If the app dies in five years,
              the model doesn't.

   Written to be read by three audiences at once: a future AI, a future
   system, and a person — his brother, a partner, or himself at 45. The
   plain-language section exists for the third.

   HONEST BOUND: this exports what was MEASURED, with sample sizes and the
   window each figure came from. It is not a personality portrait and does
   not claim to be — a model with 12 resolved commitments behind it says
   so, so a future reader can weigh it correctly.
   ============================================================ */

import { getEvents } from './events';
import { buildTwinModel, type TwinModel } from './twin';
import { adaptationProfile } from './adaptation';
import { makadiProfit } from './makadiProfit';

export const INHERITANCE_VERSION = '1.0.0';
const DAY = 86_400_000;

export interface InheritanceFile {
  kind: 'kai.inheritance';
  version: string;
  subject: string;
  generatedAt: string;
  /* what the model rests on — so a reader can weigh it */
  evidence: {
    events: number;
    spanDays: number;
    firstEvent: string | null;
    resolvedCommitments: number;
    confidence: TwinModel['confidence']['level'];
    caveat: string;
  };
  /* the measured model */
  decisionModel: {
    reliability: { dated: Rate; vague: Rate; overall: Rate; reading: string };
    spendingAfterWin: { ratio: number | null; wins: number; reading: string };
    failurePrecursors: Array<{ pattern: string; occurred: number; ofBroken: number }>;
    followThrough: Array<{ domain: string; status: string; lastActiveDaysAgo: number }>;
    rhythm: { usualHour: number | null; opens: number; reading: string };
    lanesApproved: Record<string, number>;
    shapesDismissed: string[];
  };
  /* what he was building, in numbers, at the time of export */
  standing: Record<string, string>;
  /* for the human reader */
  inPlainWords: string[];
  /* for the machine reader */
  schema: Record<string, string>;
  howToUse: string[];
}

interface Rate { kept: number; total: number; pct: number | null }

export function buildInheritance(now = Date.now()): InheritanceFile {
  const twin = buildTwinModel(now);
  const adapt = safe(() => adaptationProfile(now), null);
  const events = getEvents({});
  const first = events.length ? events.reduce((a, b) => (a.ts < b.ts ? a : b)) : null;
  const spanDays = first ? Math.floor((now - first.ts) / DAY) : 0;
  const profit = safe(() => makadiProfit(now), null);

  const rel = twin.reliability;
  const relReading = rel.specific.total && rel.vague.total
    ? `He keeps ${rel.specific.pct}% of commitments that carry a date or a number, and ${rel.vague.pct}% of those that don't. Give him a deadline and he performs; leave it open and he drifts.`
    : rel.overall.total
      ? `${rel.overall.kept} of ${rel.overall.total} commitments kept on record — too few to separate dated from vague.`
      : 'No resolved commitments on record yet.';

  const spendReading = twin.spending.ratio != null
    ? `After money arrives he spends about ${twin.spending.ratio.toFixed(1)}x his usual daily rate for the next three days${twin.spending.flags ? ' — a real reward reflex, not noise' : ''}.`
    : 'Not enough wins and baseline spending on record to measure a post-win pattern.';

  const rhythmReading = adapt?.openHour != null
    ? `He works to KAI around ${adapt.openHour}:00, across ${adapt.opens} recorded opens.`
    : 'No settled daily rhythm on record yet.';

  const plain: string[] = [];
  plain.push(relReading);
  if (twin.spending.ratio != null) plain.push(spendReading);
  for (const p of twin.precursors.slice(0, 3)) plain.push(`When he breaks his word, it usually followed this: ${p.label} (${p.occurrences} of ${p.ofBroken} broken commitments).`);
  const abandoned = twin.followThrough.filter((f) => f.status === 'abandoned').map((f) => f.domain);
  if (abandoned.length) plain.push(`He starts more than he finishes in: ${abandoned.join(', ')}.`);
  const sustained = twin.followThrough.filter((f) => f.status === 'sustained').map((f) => f.domain);
  if (sustained.length) plain.push(`He sustains: ${sustained.join(', ')}.`);
  if (adapt?.openHour != null) plain.push(rhythmReading);
  if (!plain.length) plain.push('Too little history to say anything honest about how he decides.');

  const standing: Record<string, string> = {};
  if (profit) {
    standing['makadi_invested_egp'] = String(Math.round(profit.spent));
    standing['makadi_earned_egp'] = String(Math.round(profit.earned));
    standing['makadi_net_egp'] = String(Math.round(profit.net));
    standing['makadi_nights_booked'] = String(profit.nightsBooked);
  }

  return {
    kind: 'kai.inheritance',
    version: INHERITANCE_VERSION,
    subject: 'Ali Kaiser',
    generatedAt: new Date(now).toISOString(),
    evidence: {
      events: events.length,
      spanDays,
      firstEvent: first ? new Date(first.ts).toISOString() : null,
      resolvedCommitments: twin.confidence.resolved,
      confidence: twin.confidence.level,
      caveat: twin.confidence.honest,
    },
    decisionModel: {
      reliability: { dated: rel.specific, vague: rel.vague, overall: rel.overall, reading: relReading },
      spendingAfterWin: { ratio: twin.spending.ratio, wins: twin.spending.wins, reading: spendReading },
      failurePrecursors: twin.precursors.map((p) => ({ pattern: p.label, occurred: p.occurrences, ofBroken: p.ofBroken })),
      followThrough: twin.followThrough.map((f) => ({ domain: f.domain, status: f.status, lastActiveDaysAgo: f.lastDaysAgo })),
      rhythm: { usualHour: adapt?.openHour ?? null, opens: adapt?.opens ?? 0, reading: rhythmReading },
      lanesApproved: adapt?.preferredLanes ?? {},
      shapesDismissed: adapt?.suppressedShapes ?? [],
    },
    standing,
    inPlainWords: plain,
    schema: {
      'decisionModel.reliability': 'kept/total/percent for commitments that carried a date or number (dated) versus those that did not (vague).',
      'decisionModel.spendingAfterWin.ratio': 'daily spend in the 3 days after income/booking/milestone, divided by the everyday baseline. null = insufficient data.',
      'decisionModel.failurePrecursors': 'conditions observed before broken commitments, with how often out of how many.',
      'decisionModel.followThrough': 'per domain: sustained (<10d since activity), fading (<30d), abandoned (>=30d).',
      'decisionModel.rhythm.usualHour': 'modal local hour of app opens, 0-23.',
      'evidence.confidence': 'seed <14d, forming <60d, sharpening <120d, sharp >=120d of recorded history.',
      standing: 'position at export time, for context only — not part of the behavioural model.',
    },
    howToUse: [
      'This file describes how one person decides, measured from his own recorded history.',
      'Weigh every figure against evidence.resolvedCommitments and evidence.spanDays before relying on it.',
      'A null or absent figure means it was never measurable — do not substitute an assumption.',
      'inPlainWords is the same model in language, for a human reader or a model with no schema.',
      'To act on it: hold him to dated commitments, expect drift on vague ones, and watch the days after money arrives.',
      'Nothing here is inferred from personality, self-report, or anything he said about himself. Only from what he did.',
    ],
  };
}

/* ── portability ─────────────────────────────────────────────── */
export function inheritanceJson(now = Date.now()): string {
  return JSON.stringify(buildInheritance(now), null, 2);
}

/* The human-readable letter — the version his brother could read. */
export function inheritanceLetter(now = Date.now()): string {
  const f = buildInheritance(now);
  const L: string[] = [];
  L.push('HOW KAISER MOVES');
  L.push(`Measured from ${f.evidence.events} recorded events across ${f.evidence.spanDays} days.`);
  L.push(`Confidence: ${f.evidence.confidence} — ${f.evidence.caveat}`);
  L.push('');
  for (const line of f.inPlainWords) L.push('• ' + line);
  L.push('');
  L.push('This was not written by him about himself. It was measured from what he did.');
  L.push(`KAI inheritance v${f.version} · ${f.generatedAt}`);
  return L.join('\n');
}

/* ── reading one back ────────────────────────────────────────── */
export interface ImportResult { ok: boolean; version?: string; subject?: string; spanDays?: number; error?: string }

export function readInheritance(text: string): ImportResult {
  try {
    const f = JSON.parse(text) as InheritanceFile;
    if (f?.kind !== 'kai.inheritance') return { ok: false, error: 'Not a KAI inheritance file.' };
    const [major] = String(f.version || '0').split('.');
    if (Number(major) > Number(INHERITANCE_VERSION.split('.')[0])) {
      return { ok: false, error: `File is version ${f.version}; this build reads ${INHERITANCE_VERSION}. The schema block inside it describes every field — a newer reader is not required to understand it.` };
    }
    return { ok: true, version: f.version, subject: f.subject, spanDays: f.evidence?.spanDays };
  } catch (e: any) {
    return { ok: false, error: 'Could not parse: ' + String(e?.message || e).slice(0, 120) };
  }
}

function safe<T>(fn: () => T, fallback: T): T { try { return fn(); } catch { return fallback; } }
