/* ============================================================
   §33.5 DAS GEDÄCHTNIS DER RATGEBER — the memory of the advisors.

   KAI is advised by models. Models get replaced. Sessions end and take
   their context with them, and the next one arrives with no idea what the
   last one told him or whether it was right. Ali is then the only place
   that memory lives — which means in practice it doesn't.

   This ledger is model-independent by construction: it records the ADVICE
   and WHO GAVE IT, in the Spine, outliving any particular model. When the
   advisor changes, nothing is wiped. The new one inherits the record of
   what its predecessors — and it — got wrong.

   THE HARD PART IS NOT STORING ADVICE. It is scoring it honestly.

     • Most counsel is never resolvable. "Focus on Makadi this month" has
       no event that proves it right. So a track record is computed ONLY
       from rulings a human explicitly judged, and the denominator is
       printed every single time. A 3-for-3 advisor is 3 of 3 JUDGED out
       of maybe ninety — and the ledger says the ninety out loud.
     • KAI does not decide whether its own advice was right. Only a
       `counsel_judged` event, authored by Ali, resolves anything. Letting
       the advisor mark its own homework is the failure mode this whole
       file exists to prevent.
     • Where two rulings cover the same subject, they are placed side by
       side and NOT labelled contradictory. Deciding that two pieces of
       prose disagree is an inference this module cannot make honestly —
       so it surfaces them and says plainly that the comparison is his.

   AND THE LIMIT THAT DOES NOT MOVE: a good track record earns an advisor
   NOTHING. It does not widen what may run unattended, and it never
   ungates money or identity. Reputation is not permission. That is
   enforced below as a function that cannot return anything else.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent } from './events';

const DAY = 86_400_000;

export type Judgement = 'confirmed' | 'contradicted';

export interface CounselRecord {
  id: string;
  at: number;
  advisor: string;          // which model, or 'kai:deterministic'
  claim: string;
  subject: string;
  judgement: Judgement | null;
  judgedAt: number | null;
  note: string;
}

/* The subject key. Deliberately crude — the domains KAI actually reasons
   about — because a clever key that silently mis-groups two rulings is
   worse than a blunt one that groups nothing. */
const SUBJECTS: Array<[RegExp, string]> = [
  [/\bmakadi|guest|booking|nightly|occupanc/i, 'Makadi'],
  [/\bdebt|card|instal+ment|interest|repay/i, 'the card'],
  [/\brunway|burn|cash|liquid|spend/i, 'runway'],
  [/\bgarden|plant|water|lemon|jasmin/i, 'the garden'],
  [/\b2662|court|case|lawyer|legal/i, 'case 2662'],
  [/\binstagram|reel|post|content|follow/i, 'content'],
  [/\bprice|pricing|rate|raise|discount/i, 'pricing'],
];

export function subjectOf(text: string): string {
  for (const [re, name] of SUBJECTS) if (re.test(text)) return name;
  return 'unfiled';
}

/* ── reading the ledger ──────────────────────────────────────── */

function judgements(): Map<string, { j: Judgement; at: number; note: string }> {
  const m = new Map<string, { j: Judgement; at: number; note: string }>();
  for (const e of getEvents({ domain: 'counsel', type: 'counsel_judged' })) {
    const id = String(e.meta?.rulingId || '');
    const j = String(e.meta?.judgement || '');
    if (!id || (j !== 'confirmed' && j !== 'contradicted')) continue;
    m.set(id, { j: j as Judgement, at: e.ts, note: String(e.meta?.note || '') });
  }
  return m;
}

export function ledger(now = Date.now()): CounselRecord[] {
  const judged = judgements();
  return getEvents({ domain: 'counsel', type: 'ruling' })
    .filter((e) => e.ts <= now)
    .map((e: KaiEvent) => {
      const claim = String(e.meta?.verdict || '').trim();
      const j = judged.get(e.id);
      return {
        id: e.id,
        at: e.ts,
        /* Rulings logged before advisors were recorded genuinely have no
           advisor. "unrecorded advisor" is the truth; guessing which model
           it was would forge attribution into the permanent record. */
        advisor: String(e.meta?.advisor || 'unrecorded advisor'),
        claim,
        subject: String(e.meta?.subject || subjectOf(claim + ' ' + JSON.stringify(e.meta?.lines || ''))),
        judgement: j ? j.j : null,
        judgedAt: j ? j.at : null,
        note: j ? j.note : '',
      };
    });
}

/* ── writing to it ───────────────────────────────────────────── */

/* Attach the advisor's identity to a ruling as it is made. Called by the
   counsel path; kept here so the ledger owns its own schema. */
export function stampAdvisor(verdict: string, advisor: string): { advisor: string; subject: string } {
  return { advisor, subject: subjectOf(verdict) };
}

export interface JudgeResult { ok: boolean; reason: string }

/* ONLY Ali resolves a ruling. `source: 'user'` is not decoration — it is
   the whole guarantee, and an advisor-authored judgement is refused. */
export function judgeCounsel(rulingId: string, judgement: Judgement, note = '', by: 'user' | 'ai' = 'user', now = Date.now()): JudgeResult {
  if (by !== 'user') {
    return { ok: false, reason: 'Refused — an advisor cannot mark its own advice right or wrong. Only you resolve a ruling.' };
  }
  const exists = getEvents({ domain: 'counsel', type: 'ruling' }).some((e) => e.id === rulingId);
  if (!exists) return { ok: false, reason: 'No ruling with that id is on the record.' };
  if (judgements().has(rulingId)) return { ok: false, reason: 'That ruling has already been judged. The first judgement stands on the record; nothing here is overwritten.' };

  logEvent({
    domain: 'counsel', type: 'counsel_judged',
    meta: { rulingId, judgement, note: note.slice(0, 300) },
    source: 'user', ts: now,
  });
  return { ok: true, reason: `Recorded: that ruling was ${judgement}.` };
}

/* ── the track record ────────────────────────────────────────── */

export interface AdvisorRecord {
  advisor: string;
  total: number;            // everything it ever said
  judged: number;           // everything that could be checked
  confirmed: number;
  contradicted: number;
  /* null when nothing has been judged. A rate over zero judgements is not
     100% and is not 0% — it is unknown, and must render as unknown. */
  rate: number | null;
  line: string;
}

export function advisors(now = Date.now()): AdvisorRecord[] {
  const byAdvisor = new Map<string, CounselRecord[]>();
  for (const r of ledger(now)) byAdvisor.set(r.advisor, [...(byAdvisor.get(r.advisor) || []), r]);

  return [...byAdvisor.entries()].map(([advisor, rs]) => {
    const judged = rs.filter((r) => r.judgement !== null);
    const confirmed = judged.filter((r) => r.judgement === 'confirmed').length;
    const contradicted = judged.length - confirmed;
    const rate = judged.length ? confirmed / judged.length : null;
    const line = rate === null
      ? `${advisor}: ${rs.length} ruling${rs.length === 1 ? '' : 's'}, none ever judged. No track record exists — not a good one, not a bad one.`
      : `${advisor}: ${confirmed} of ${judged.length} judged ruling${judged.length === 1 ? '' : 's'} held up — out of ${rs.length} given. ${rs.length - judged.length} ${rs.length - judged.length === 1 ? 'was' : 'were'} never checked and probably never can be.`;
    return { advisor, total: rs.length, judged: judged.length, confirmed, contradicted, rate, line };
  }).sort((a, b) => b.total - a.total);
}

/* ── the same subject, ruled twice ───────────────────────────── */

export interface Divergence {
  subject: string;
  rulings: CounselRecord[];
  advisorCount: number;
  line: string;
}

/* Deliberately NOT called "contradictions". Deciding that two pieces of
   prose disagree is an inference this module cannot make honestly, and
   labelling them contradictory when they merely differ in emphasis would
   manufacture a conflict. It puts them side by side and says the reading
   is his. */
export function divergences(now = Date.now()): Divergence[] {
  const bySubject = new Map<string, CounselRecord[]>();
  for (const r of ledger(now)) {
    if (r.subject === 'unfiled' || !r.claim) continue;
    bySubject.set(r.subject, [...(bySubject.get(r.subject) || []), r]);
  }

  const out: Divergence[] = [];
  for (const [subject, rs] of bySubject) {
    const advisorSet = new Set(rs.map((r) => r.advisor));
    if (rs.length < 2 || advisorSet.size < 2) continue;
    const sorted = [...rs].sort((a, b) => a.at - b.at);
    const spanDays = Math.floor((sorted[sorted.length - 1].at - sorted[0].at) / DAY);
    out.push({
      subject,
      rulings: sorted,
      advisorCount: advisorSet.size,
      line: `${subject}: ${rs.length} rulings from ${advisorSet.size} different advisors over ${spanDays} days. Whether they actually disagree is yours to read — I am not going to decide that for you.`,
    });
  }
  return out.sort((a, b) => b.rulings.length - a.rulings.length);
}

/* ── the limit that does not move ────────────────────────────── */

/* A track record earns an advisor nothing. Not a wider lane, not one
   ungated action, not for money and not for anything carrying his name.
   This is a function rather than a comment so that any future code that
   asks the question gets the same answer, permanently. */
export function mayAutomateOnRecord(): false { return false; }

export const REPUTATION_RULE =
  'A good track record widens nothing. Money and identity stay gated no matter what this ledger says — ' +
  'an advisor that has been right forty times is an advisor that has been right forty times, not a signature.';

/* ── the readout ─────────────────────────────────────────────── */

export function ratgeberText(now = Date.now()): string {
  const all = ledger(now);
  const recs = advisors(now);
  const divs = divergences(now);
  const L: string[] = ['DAS GEDÄCHTNIS DER RATGEBER', ''];

  if (!all.length) {
    L.push('No counsel on record yet. When a model rules on something, it lands here');
    L.push('with its name attached and stays after that model is gone.');
    L.push('');
    L.push(REPUTATION_RULE);
    return L.join('\n');
  }

  const judged = all.filter((r) => r.judgement !== null).length;
  L.push(`${all.length} ruling${all.length === 1 ? '' : 's'} on record from ${recs.length} advisor${recs.length === 1 ? '' : 's'}. ${judged} ${judged === 1 ? 'has' : 'have'} been judged.`);
  if (judged === 0) {
    L.push('Nothing has been judged, so nothing below is a track record. It is just a list.');
  } else if (judged < 10 || judged * 2 < all.length) {
    /* The danger is a rate read off a small denominator — "1 of 1" looks
       like a flawless advisor. So this keys on the size of the judged
       sample itself, not on its ratio to the total. */
    L.push(`That is a thin base — ${judged} judged, ${all.length - judged} never checked. Read the rates as a small sample, not a verdict.`);
  }
  L.push('');

  L.push('THE ADVISORS:');
  for (const r of recs) L.push('  ' + r.line);
  L.push('');

  if (divs.length) {
    L.push('THE SAME SUBJECT, RULED MORE THAN ONCE:');
    for (const d of divs) {
      L.push('  ' + d.line);
      for (const r of d.rulings.slice(-3)) {
        L.push(`    ${new Date(r.at).toISOString().slice(0, 10)} · ${r.advisor}: ${r.claim.slice(0, 120)}`);
      }
    }
    L.push('');
  }

  const wrong = all.filter((r) => r.judgement === 'contradicted').slice(-3);
  if (wrong.length) {
    L.push('WHAT THE ADVICE GOT WRONG:');
    for (const r of wrong) {
      L.push(`  ${new Date(r.at).toISOString().slice(0, 10)} · ${r.advisor}: ${r.claim.slice(0, 120)}`);
      if (r.note) L.push(`    you said: ${r.note}`);
    }
    L.push('');
  }

  L.push(REPUTATION_RULE);
  return L.join('\n');
}
