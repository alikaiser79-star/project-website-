/* ============================================================
   DER ZWILLING (§Q3.1) — THE TWIN. The mind that models Kaiser.

   A DETERMINISTIC behavioral model built from the whole Spine — no
   LLM guessing about who Ali is, the numbers say it:
     • reliability, split by SPECIFICITY — do dated/measurable commitments
       hold better than vague ones? (they almost always do; the Twin proves
       it with his own record)
     • spending after a win — does a booking / milestone / kept promise
       trigger a spend?
     • the precursors that precede his BROKEN commitments (silence before a
       deadline, a win just before, too many open at once, vagueness)
     • project follow-through — what he sustains vs abandons

   The model feeds two faculties:
     • twinCounsel(question) — answers a decision AS Ali on his best day,
       citing ONLY these real numbers (in counsel.ts's ruling voice).
     • detectDrift() — when TODAY's shape matches a pattern that preceded a
       past failure, it says so BEFORE the failure.

   HONEST BY DESIGN. Every stat carries its sample size; the model reports
   its own confidence and gets sharper as the Spine grows past 60/120 days.
   Boot-from-empty safe — a thin Spine yields a humble model, never a lie.
   ============================================================ */

import { getEvents, logEvent } from './events';
import { getCommitments, resolveCommitments, type Commitment } from './commitments';
import { toEgp } from './money';
import { bequestContext } from './vermaechtnis';
import { buildKaiContext } from './context';
import { askClaude } from '../claude';
import type { Currency } from '../../types';

const DAY = 86_400_000;

/* ── model shapes ─────────────────────────────────────────── */

export interface Rate { kept: number; total: number; pct: number | null; }
export interface ReliabilitySplit { specific: Rate; vague: Rate; overall: Rate; }
export interface SpendingAfterWin {
  wins: number; postWinAvgEgp: number; baselineAvgEgp: number;
  ratio: number | null; flags: boolean;
}
export interface FailurePrecursor { key: string; label: string; occurrences: number; ofBroken: number; }
export interface FollowThrough { domain: string; events: number; lastDaysAgo: number; status: 'sustained' | 'fading' | 'abandoned'; }
export interface TwinConfidence {
  days: number; events: number; resolved: number;
  level: 'seed' | 'forming' | 'sharpening' | 'sharp';
  honest: string;
}
export interface TwinModel {
  reliability: ReliabilitySplit;
  spending: SpendingAfterWin;
  precursors: FailurePrecursor[];
  followThrough: FollowThrough[];
  confidence: TwinConfidence;
  insights: string[];      // deterministic, cited one-liners — the Twin's read on Ali
}

/* ── specificity: did he put a date or a number on it? ────────
   The core discipline the Twin enforces — a commitment is "specific" if its
   TEXT names a date, day, or number; "vague" otherwise. This is exactly the
   line the counsel draws ("put a date on this or don't commit"). */
const DATEISH = /\b(\d{1,2}[/-]\d{1,2}|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun|today|tonight|tomorrow|week|month|by \w+)\b/i;
export function isSpecific(c: Commitment): boolean {
  const t = c.text || '';
  return DATEISH.test(t) || /\d/.test(t);
}

function rate(kept: number, total: number): Rate {
  return { kept, total, pct: total ? Math.round((kept / total) * 100) : null };
}

/* ── win events — the moments that can trigger a spend or complacency ── */
function isWin(domain: string, type: string): boolean {
  return (domain === 'money' && type === 'milestone')
    || (domain === 'makadi' && type === 'booking_confirmed')
    || (domain === 'commitment' && type === 'commitment_kept');
}

function egp(v: number | undefined, ccy: unknown): number {
  return toEgp(v || 0, (ccy as Currency) || 'EGP');
}

/* ── the model ────────────────────────────────────────────── */
export function buildTwinModel(now = Date.now()): TwinModel {
  resolveCommitments(now);            // settle any past-due before we read
  const all = getEvents({});
  const commitments = getCommitments();

  /* 1. RELIABILITY, split by specificity. */
  const resolved = commitments.filter((c) => c.status === 'kept' || c.status === 'broken');
  const spec = resolved.filter(isSpecific);
  const vague = resolved.filter((c) => !isSpecific(c));
  const keptOf = (list: Commitment[]) => list.filter((c) => c.status === 'kept').length;
  const reliability: ReliabilitySplit = {
    specific: rate(keptOf(spec), spec.length),
    vague: rate(keptOf(vague), vague.length),
    overall: rate(keptOf(resolved), resolved.length),
  };

  /* 2. SPENDING AFTER A WIN — expense in the 3 days after each win vs the
     everyday baseline. */
  const expenses = all.filter((e) => e.domain === 'expense' && typeof e.value === 'number');
  const wins = all.filter((e) => isWin(e.domain, e.type)).sort((a, b) => a.ts - b.ts);
  const WINDOW = 3 * DAY;
  let postWinTotal = 0, postWinDays = 0;
  const inWinWindow = (ts: number) => wins.some((w) => ts > w.ts && ts <= w.ts + WINDOW);
  for (const w of wins) {
    const spent = expenses.filter((e) => e.ts > w.ts && e.ts <= w.ts + WINDOW)
      .reduce((s, e) => s + egp(e.value, e.ccy), 0);
    postWinTotal += spent; postWinDays += 3;
  }
  const baseExpenses = expenses.filter((e) => !inWinWindow(e.ts));
  const spanDays = all.length ? Math.max(1, (now - all[0].ts) / DAY) : 1;
  const baseDays = Math.max(1, spanDays - postWinDays);
  const baseTotal = baseExpenses.reduce((s, e) => s + egp(e.value, e.ccy), 0);
  const postWinAvgEgp = postWinDays ? postWinTotal / postWinDays : 0;
  const baselineAvgEgp = baseTotal / baseDays;
  /* Honest only with real signal on BOTH sides: ≥2 wins and enough baseline
     expenses that a per-day baseline isn't a near-zero divisor (which would
     make any post-win spend look like a wild multiple). */
  const ratio = (baselineAvgEgp > 0 && wins.length >= 2 && baseExpenses.length >= 5)
    ? postWinAvgEgp / baselineAvgEgp : null;
  const spending: SpendingAfterWin = {
    wins: wins.length, postWinAvgEgp, baselineAvgEgp, ratio,
    flags: ratio != null && ratio >= 1.4,
  };

  /* 3. FAILURE PRECURSORS — what recurs before a broken commitment. */
  const broken = commitments.filter((c) => c.status === 'broken');
  const counts: Record<string, { label: string; n: number }> = {
    vague: { label: 'the commitment was vague (no date/number)', n: 0 },
    silence: { label: 'the target domain went silent in the final third before the deadline', n: 0 },
    winBefore: { label: 'a win landed in the week before — then focus slipped', n: 0 },
    overload: { label: '3+ other commitments were open at the same time', n: 0 },
  };
  for (const c of broken) {
    if (!isSpecific(c)) counts.vague.n++;
    const finalThird = c.deadline - Math.max(DAY, (c.deadline - c.createdAt) / 3);
    const domainActivity = all.filter((e) => e.domain === c.metric?.domain && e.ts >= finalThird && e.ts <= c.deadline);
    if (c.metric?.domain && domainActivity.length === 0) counts.silence.n++;
    const winBefore = all.some((e) => isWin(e.domain, e.type) && e.ts >= c.deadline - 7 * DAY && e.ts < c.deadline);
    if (winBefore) counts.winBefore.n++;
    const concurrentOpen = commitments.filter((o) => o.id !== c.id && o.createdAt <= c.deadline && (o.resolvedAt ?? Infinity) >= c.createdAt).length;
    if (concurrentOpen >= 3) counts.overload.n++;
  }
  const precursors: FailurePrecursor[] = Object.entries(counts)
    .map(([key, v]) => ({ key, label: v.label, occurrences: v.n, ofBroken: broken.length }))
    .filter((p) => p.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences);

  /* 4. FOLLOW-THROUGH — what he sustains vs abandons, per project domain. */
  const PROJECT_DOMAINS = ['garden', 'makadi', 'content', 'instagram', 'income', 'debt', 'leads'];
  const followThrough: FollowThrough[] = [];
  for (const d of PROJECT_DOMAINS) {
    const evs = all.filter((e) => e.domain === d);
    if (evs.length < 3) continue;                       // not enough to judge
    const lastDaysAgo = Math.floor((now - evs[evs.length - 1].ts) / DAY);
    const status = lastDaysAgo < 10 ? 'sustained' : lastDaysAgo < 30 ? 'fading' : 'abandoned';
    followThrough.push({ domain: d, events: evs.length, lastDaysAgo, status });
  }
  followThrough.sort((a, b) => a.lastDaysAgo - b.lastDaysAgo);

  /* 5. CONFIDENCE — the Twin's honesty about how much to trust it. */
  const days = all.length ? Math.floor((now - all[0].ts) / DAY) : 0;
  const level: TwinConfidence['level'] = days < 14 ? 'seed' : days < 60 ? 'forming' : days < 120 ? 'sharpening' : 'sharp';
  const honest =
    level === 'seed' ? 'Barely enough history to read you — treat this as a first sketch.'
    : level === 'forming' ? `${days} days of you on record. Getting your shape; not yet sharp — needs 60+ to be honest.`
    : level === 'sharpening' ? `${days} days on record. The read is holding up. Sharper every month.`
    : `${days} days on record — this is a real model of how you operate.`;
  const confidence: TwinConfidence = { days, events: all.length, resolved: resolved.length, level, honest };

  /* 6. INSIGHTS — deterministic, cited. Only what the sample supports. */
  const insights: string[] = [];
  if (reliability.specific.total && reliability.vague.total) {
    insights.push(
      `You keep ${reliability.specific.kept}/${reliability.specific.total} dated commitments` +
      (reliability.specific.pct != null ? ` (${reliability.specific.pct}%)` : '') +
      ` but only ${reliability.vague.kept}/${reliability.vague.total} vague ones` +
      (reliability.vague.pct != null ? ` (${reliability.vague.pct}%)` : '') +
      `. Put a date on it or don't commit.`,
    );
  } else if (reliability.overall.total >= 2) {
    insights.push(`You've kept ${reliability.overall.kept}/${reliability.overall.total} commitments on record${reliability.overall.pct != null ? ` (${reliability.overall.pct}%)` : ''}.`);
  }
  if (spending.flags && spending.ratio != null) {
    insights.push(`After a win you spend ${spending.ratio.toFixed(1)}× your usual — the reward reflex. Watch the days after a booking lands.`);
  }
  for (const p of precursors.slice(0, 2)) {
    insights.push(`${p.occurrences} of your ${p.ofBroken} broken commitments came after ${p.label}.`);
  }
  const abandoned = followThrough.filter((f) => f.status === 'abandoned');
  if (abandoned.length) insights.push(`Gone quiet: ${abandoned.map((f) => `${f.domain} (${f.lastDaysAgo}d)`).join(', ')}. You start more than you finish here.`);

  return { reliability, spending, precursors, followThrough, confidence, insights };
}

/* ── DRIFT — the pattern that precedes a failure, caught while it's forming ──
   Compares TODAY's open commitments + recent shape against the model's
   precursors, and warns before the deadline arrives. Deterministic; each
   warning cites the historical rate that makes it worth heeding. */
export interface DriftWarning { key: string; text: string; severity: 'watch' | 'warn'; commitmentId?: string; }

export function detectDrift(now = Date.now()): DriftWarning[] {
  const model = buildTwinModel(now);
  const commitments = getCommitments();
  const open = commitments.filter((c) => c.status === 'open');
  const all = getEvents({});
  const out: DriftWarning[] = [];

  /* Vague open commitments, when the record shows vague ones fail. */
  const vagueOpen = open.filter((c) => !isSpecific(c));
  if (vagueOpen.length && model.reliability.vague.total >= 2 && (model.reliability.vague.pct ?? 100) < 60) {
    out.push({
      key: 'vague-open',
      severity: 'warn',
      text: `${vagueOpen.length} open commitment${vagueOpen.length === 1 ? ' has' : 's have'} no date — and you keep only ${model.reliability.vague.pct}% of vague ones. Pin a date now: "${(vagueOpen[0].text || '').slice(0, 48)}".`,
      commitmentId: vagueOpen[0].id,
    });
  }

  /* Silence before a deadline — the top precursor, forming right now. */
  const hasSilencePrecursor = model.precursors.some((p) => p.key === 'silence');
  for (const c of open) {
    if (!c.metric?.domain) continue;
    const dd = (c.deadline - now) / DAY;
    if (dd < 0 || dd > 5) continue;                       // only near-deadline
    const finalThird = c.deadline - Math.max(DAY, (c.deadline - c.createdAt) / 3);
    const active = all.some((e) => e.domain === c.metric.domain && e.ts >= finalThird);
    if (!active) {
      out.push({
        key: 'silence-' + c.id,
        severity: hasSilencePrecursor ? 'warn' : 'watch',
        text: `"${(c.text || '').slice(0, 48)}" is due in ${Math.ceil(dd)}d with no ${c.metric.domain} activity yet` +
          (hasSilencePrecursor ? ' — silence before a deadline is how your past breaks started.' : '.'),
        commitmentId: c.id,
      });
    }
  }

  /* Post-win window + a deadline looming — the complacency dip. */
  if (model.spending.flags) {
    const recentWin = all.some((e) => isWin(e.domain, e.type) && e.ts >= now - 3 * DAY);
    const dueSoon = open.some((c) => c.deadline - now < 5 * DAY && c.deadline > now);
    if (recentWin && dueSoon) {
      out.push({ key: 'post-win-dip', severity: 'watch', text: 'A win just landed and a deadline is close — this is where your focus historically slips. Hold the line.' });
    }
  }

  return out;
}

/* Run drift once and log genuinely NEW warnings to the Spine (deduped per
   key per day), so a forming failure is visible/synced, never silent.
   Returns the current warnings for the caller to surface. */
export function runDriftWatch(now = Date.now()): DriftWarning[] {
  const warnings = detectDrift(now);
  const today = new Date(now).toISOString().slice(0, 10);
  for (const w of warnings) {
    const already = getEvents({ domain: 'system', type: 'drift_warning' })
      .some((e) => e.meta?.key === w.key && e.meta?.day === today);
    if (already) continue;
    try {
      logEvent({ domain: 'system', type: 'drift_warning', meta: { key: w.key, day: today, text: w.text, severity: w.severity }, source: 'ai', ts: now });
    } catch { /* ignore */ }
  }
  return warnings;
}

/* ── the Twin's context block for counsel — deterministic stats the LLM
   must cite, never invent. Fed into the counsel ruling. ── */
export function twinContext(now = Date.now()): string {
  const m = buildTwinModel(now);
  const L: string[] = ['TWIN MODEL OF ALI (his own documented record — cite these, invent nothing):'];
  L.push(`  reliability: dated ${m.reliability.specific.kept}/${m.reliability.specific.total}${m.reliability.specific.pct != null ? ` (${m.reliability.specific.pct}%)` : ''} · vague ${m.reliability.vague.kept}/${m.reliability.vague.total}${m.reliability.vague.pct != null ? ` (${m.reliability.vague.pct}%)` : ''}`);
  if (m.spending.ratio != null) L.push(`  spending after a win: ${m.spending.ratio.toFixed(1)}× baseline (${m.spending.wins} wins on record)`);
  if (m.precursors.length) L.push('  failure precursors: ' + m.precursors.map((p) => `${p.label} [${p.occurrences}/${p.ofBroken}]`).join('; '));
  if (m.followThrough.length) L.push('  follow-through: ' + m.followThrough.map((f) => `${f.domain} ${f.status} (${f.lastDaysAgo}d)`).join(', '));
  L.push(`  confidence: ${m.confidence.level} — ${m.confidence.honest}`);
  /* §37 — the bequest, kept clearly separate from anything derived above.
     Retired entries are removed HERE rather than trusted to a model that
     might cite one anyway. */
  L.push('');
  L.push(bequestContext(now));
  return L.join('\n');
}

/* ── THE COUNSEL, as the Twin — a decision answered AS Ali on his best day,
   citing his own record. Not a chat; a ruling. ── */
export interface TwinRuling { verdict: string; lines: string[]; at: number; }

const TWIN_SYSTEM =
  'You are DER ZWILLING — the Twin. You are ALI KAISER on his best day: the version of him ' +
  'that is honest, unsentimental, and holds him to his own documented standard. You are NOT a ' +
  'generic advisor; you speak as him, to him, using his real history. Below is the TWIN MODEL — ' +
  'deterministic stats from his own Spine — and his live CONTEXT. Answer his decision by holding ' +
  'him to what the numbers say about how he actually operates.\n' +
  'RULES: cite ONLY the numbers provided (never invent a stat). Be decisive, calm, no flattery, no ' +
  'hedging. If his record warns against what he\'s about to do, say so plainly.\n' +
  'FORMAT: Line 1 — "VERDICT: <one sentence ruling>". Then AT MOST 4 lines, each one sentence citing ' +
  'a real number from the model or context. Never exceed 5 lines.';

export async function twinCounsel(question: string, now = Date.now()): Promise<TwinRuling> {
  const q = (question || '').trim() || 'What should I focus on right now?';
  const prompt =
    `${twinContext(now)}\n\nLIVE CONTEXT:\n${safeCtx(now, q)}\n\nHIS DECISION: ${q}\n\nRule as the Twin.`;
  let raw = '';
  try { raw = await askClaude(prompt, [], { tier: 'heavy', feature: 'twin', maxTokens: 400 }); }
  catch (e: any) { raw = 'VERDICT: ' + (String(e?.message || e).includes('NO_API_KEY') ? 'the Twin is offline — no API key wired.' : 'could not read the record just now.'); }

  const lines = String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5);
  const verdict = (lines[0] || 'VERDICT: hold the line.').replace(/^VERDICT:\s*/i, '');
  const ruling: TwinRuling = { verdict, lines, at: now };
  try { logEvent({ domain: 'counsel', type: 'twin_ruling', meta: { question: q.slice(0, 160), verdict: verdict.slice(0, 200), lines }, source: 'ai', ts: now }); } catch { /* ignore */ }
  return ruling;
}

function safeCtx(now: number, q: string): string {
  try { return buildKaiContext(now, q); } catch { return '(context unavailable)'; }
}
