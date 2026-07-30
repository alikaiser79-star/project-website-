/* ============================================================
   §48 DIE ÜBERGABE — the handover. KAI becomes the institution.

   The point of this file is that Ali stops being the courier. Every
   model that touches this project reads the same file first, and what
   it reads is a record rather than somebody's recollection.

   ── THE CLAIM IN THE BRIEF THAT IS ONLY HALF TRUE ─────────────
   "Computed from the Spine, so it can never go stale."

   That is true of the numbers and false of everything that matters
   most. The Spine holds events: money in, money out, promises kept,
   nights booked, doses logged. It does not hold — and cannot hold —
   why the heart rests at 48, what the U+2028 nights cost, which
   architecture was tried and abandoned, or what a previous model was
   wrong about. Those live in git history, in code comments, and in
   conversations that end.

   So a "canonical brief" that claimed to be fully computed would be an
   authoritative-looking document silently missing precisely the things
   the brief says the next model won't know. It would be worse than no
   document, because it would be trusted.

   This file therefore keeps THREE sources apart and labels every line
   with which one it came from:

     COMPUTED   — read at call time from the Spine and from live
                  modules. Cannot go stale. Also cannot hold a reason.
     RECORDED   — written down at the time by whoever knew (§48.2).
                  Carries a date and an author, because it CAN go stale
                  and a reader must be able to see how old it is.
     UNKNOWN    — the explicit list of what neither half can supply.

   The third section is the most important one in the document. A
   handover that does not say what it is missing is how the next model
   confidently repeats a mistake that was already paid for.

   ── AND ONE RULE THAT OUTRANKS EVERY MODEL ────────────────────
   A decision recorded by Ali outranks advice recorded by any
   assistant, including me, permanently and regardless of how well
   argued the advice was. That is not politeness. It happened: a model
   ranked a rate rise as the top move off a comp median that pooled
   2-bedroom sea-view units with his 1-bedroom, and he was the one who
   caught it. The ledger marks author on every entry so a future model
   cannot quietly weigh its predecessor's opinion equal to his call.
   ============================================================ */

import { getEvents, logEvent, CAP } from './events';
import { getCommitments } from './commitments';
import { computeRunway } from './runway';
import { doctrineText } from './doctrine';
import { PROTOCOL_VERSION } from './protocol.spec';
import { survival } from './brief';
import { read, write, emit } from './store';

const DAY = 86_400_000;

/* ── 2. THE SESSION LEDGER ───────────────────────────────────── */

export type EntryKind = 'decision' | 'lesson' | 'warning' | 'failure' | 'open';
export type Author = 'user' | 'assistant' | 'kai';

export interface Entry {
  id: string;
  kind: EntryKind;
  /* What. One line, so it survives being read quickly. */
  text: string;
  /* Why. The reason is the part that stops it being repeated, and an
     entry without one is refused. */
  why: string;
  by: Author;
  /* Which model or person, verbatim. "an AI said" is useless in 2030. */
  who: string;
  at: number;
  /* Where it can be checked: a file:line, a branch, an event id. An
     entry that cites nothing is still allowed — some things are only
     ever a conversation — but it is marked as uncited on read. */
  cites?: string;
  /* Reconstructed from the repo after the fact rather than logged as it
     happened. A reader is entitled to know the difference. */
  seeded?: boolean;
  /* Set when a later entry overrules this one. */
  supersededBy?: string;
  keywords: string[];
}

const KEY = 'kai.uebergabe.ledger';

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'is', 'was', 'are', 'were', 'be', 'been', 'being', 'it', 'its', 'to', 'of', 'in', 'on', 'at',
  'for', 'with', 'from', 'by', 'as', 'not', 'no', 'do', 'does', 'did', 'has', 'have', 'had',
  'will', 'would', 'can', 'could', 'should', 'you', 'your', 'his', 'him', 'he', 'we', 'i',
  'so', 'because', 'when', 'what', 'which', 'who', 'how', 'why', 'all', 'any', 'one', 'more',
  'about', 'into', 'over', 'under', 'up', 'down', 'out', 'off', 'very', 'just', 'also', 'them',
  /* Longer function words. They pass the length filter, appear in almost
     every sentence, and each one silently inflates the overlap score —
     two of them alone are enough to fire a false contradiction. */
  'before', 'after', 'again', 'every', 'both', 'each', 'other', 'while', 'where', 'there',
  'their', 'they', 'since', 'until', 'unless', 'though', 'however', 'upon', 'onto', 'within',
  'across', 'during', 'between', 'against', 'through', 'still', 'such', 'only', 'even', 'same',
  'without', 'because', 'therefore', 'instead', 'always',
]);

/* Crude ON PURPOSE and labelled as crude everywhere it surfaces. A
   stemmer or an embedding would match better and would also make the
   matching unexplainable — and an unexplainable contradiction warning
   is one a future model will learn to ignore. */
export function keywordsOf(text: string): string[] {
  return [...new Set(
    String(text || '').toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  )];
}

const SECRETY = /(sk_live|sk_test|ghp_|gho_|AKIA|AIza|ya29\.|-----BEGIN|Bearer\s+[A-Za-z0-9._-]{16,}|eyJ[A-Za-z0-9._-]{20,})/i;

export function ledger(now = Date.now()): Entry[] {
  return read<Entry[]>(KEY, []).filter((e) => e.at <= now).sort((a, b) => b.at - a.at);
}

export interface RecordResult { ok: boolean; reason: string; entry: Entry | null }

export function recordEntry(
  kind: EntryKind, text: string, why: string,
  by: Author, who: string,
  opts: { cites?: string; supersedes?: string; seeded?: boolean; at?: number } = {},
): RecordResult {
  const now = opts.at ?? Date.now();
  const t = String(text || '').trim();
  const w = String(why || '').trim();

  if (!t) return { ok: false, reason: 'Nothing to record.', entry: null };
  /* THE REASON IS MANDATORY. "Don't do X" without why is an entry the
     next model can only obey or ignore, and it will ignore it. The
     reason is the whole mechanism by which a lesson survives. */
  if (!w) {
    return {
      ok: false,
      reason: 'Refused — no reason given. "Do not do X" with no why behind it cannot be argued with, so the next model will either obey it blindly or bin it. The reason is the part that travels.',
      entry: null,
    };
  }
  if (!who.trim()) {
    return { ok: false, reason: 'Refused — say who. "An AI told me" is worth nothing in 2030; name the model or the person.', entry: null };
  }
  if (SECRETY.test(t) || SECRETY.test(w)) {
    return {
      ok: false,
      reason: 'Refused — that contains something shaped like a credential. This ledger is written to be handed to whoever works on this next. Record where the key lives, never the key.',
      entry: null,
    };
  }

  const entry: Entry = {
    id: `${kind}-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind, text: t, why: w, by, who: who.trim(), at: now,
    cites: opts.cites?.trim() || undefined,
    seeded: opts.seeded || undefined,
    keywords: [...new Set([...keywordsOf(t), ...keywordsOf(w)])],
  };

  const list = read<Entry[]>(KEY, []);
  if (opts.supersedes) {
    const target = list.find((e) => e.id === opts.supersedes);
    if (!target) return { ok: false, reason: `Nothing on record with id ${opts.supersedes}.`, entry: null };
    target.supersededBy = entry.id;
  }
  list.push(entry);
  write(KEY, list); emit();

  try {
    logEvent({ domain: 'system', type: 'uebergabe_entry',
      meta: { id: entry.id, kind, by, who: entry.who, cites: entry.cites }, source: by === 'user' ? 'user' : 'ai', ts: now });
  } catch { /* ignore */ }

  return {
    ok: true,
    entry,
    reason: `Recorded as ${kind} by ${entry.who}${by === 'user' ? ' (yours — this outranks any model on the same subject)' : ''}. ${entry.cites ? `Cites ${entry.cites}.` : 'No citation: this one is only a conversation, and it is marked as such.'}`,
  };
}

/* ── 3. THE CONTRADICTION CHECK ──────────────────────────────── */

export interface Conflict {
  entry: Entry;
  overlap: string[];
  superseded: boolean;
  line: string;
}

/* Two overlapping content words. One is noise — "rate" alone would fire
   on every pricing sentence ever typed. This threshold is a judgement
   and it is stated rather than hidden, because a reader needs to know
   whether silence here means agreement or means the matcher missed it. */
const MIN_OVERLAP = 2;

export function checkAdvice(advice: string, now = Date.now()): Conflict[] {
  const ks = new Set(keywordsOf(advice));
  if (!ks.size) return [];

  return ledger(now)
    .filter((e) => e.kind === 'warning' || e.kind === 'decision' || e.kind === 'failure')
    .map((e) => {
      const overlap = e.keywords.filter((k) => ks.has(k));
      return { e, overlap };
    })
    .filter((x) => x.overlap.length >= MIN_OVERLAP)
    .sort((a, b) => b.overlap.length - a.overlap.length)
    .slice(0, 5)
    .map(({ e, overlap }) => {
      const when = new Date(e.at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const superseded = !!e.supersededBy;
      /* The reason is quoted, never paraphrased. A summarised reason is
         a reason a future model can argue with on a technicality. */
      const line = superseded
        ? `Superseded — ${e.who} recorded in ${when}: "${e.text}" (${e.why}) That was later overruled, so it is history rather than an objection.`
        : e.by === 'user'
          /* "The reason on record" rather than "Your reason" — entries are
             written to be read by a future model, so their `why` is in the
             third person, and "Your reason: he caught it" reads as a
             machine that has lost track of who it is talking to. */
          ? `You decided the opposite in ${when}: "${e.text}" The reason on record: ${e.why} That was your call, not a model's, so it stands until you change it. Has it changed?`
          : `You were told the opposite in ${when} by ${e.who}: "${e.text}" The reason given was: ${e.why} Has that changed?`;
      return { entry: e, overlap, superseded, line };
    });
}

export const MATCH_CAVEAT =
  'This is word-overlap matching, not comprehension: it needs ' + MIN_OVERLAP +
  ' shared words to fire, so it misses anything phrased differently and sometimes flags things that only sound related. ' +
  'Silence here is not agreement — it means nothing matched. It never blocks anything; it asks.';

export function contradictionText(advice: string, now = Date.now()): string {
  const cs = checkAdvice(advice, now);
  if (!cs.length) {
    return `Nothing on record contradicts that.\n\n${MATCH_CAVEAT}`;
  }
  const live = cs.filter((c) => !c.superseded);
  const L = [live.length
    ? `${live.length} thing${live.length === 1 ? ' on record says' : 's on record say'} otherwise:`
    : 'Only superseded history matched — nothing live contradicts that:', ''];
  for (const c of cs) { L.push('  ' + c.line); L.push(`      [${c.entry.kind}${c.entry.cites ? ' · ' + c.entry.cites : ''}${c.entry.seeded ? ' · reconstructed from the repo, not logged live' : ''}]`); L.push(''); }
  L.push(MATCH_CAVEAT);
  return L.join('\n');
}

/* ── 1. THE CANONICAL BRIEF ──────────────────────────────────── */

export interface Computed { label: string; value: string }

/* Read live. Every one of these is arithmetic on the record and none of
   them can explain itself — which is exactly why the RECORDED half
   exists underneath. */
export function computed(now = Date.now()): Computed[] {
  const out: Computed[] = [];
  const push = (label: string, fn: () => string) => {
    try { const v = fn(); if (v) out.push({ label, value: v }); } catch { /* a module that cannot answer says nothing rather than zero */ }
  };

  const spine = getEvents({});
  push('Spine', () => {
    if (!spine.length) return 'empty — nothing has been logged on this device.';
    const from = new Date(Math.min(...spine.map((e) => e.ts))).toISOString().slice(0, 10);
    return `${spine.length} events (cap ${CAP}), reaching back to ${from}.` +
      (spine.length >= CAP ? ' AT THE CAP — the oldest events are being dropped, so anything computed over a long window is understated.' : '');
  });
  push('Runway', () => {
    const r = computeRunway(now);
    return r.runwayDays === null ? 'not computable from what is logged.' : `${Math.floor(r.runwayDays)} days at the current burn.`;
  });
  push('Promises', () => {
    const cs = getCommitments();
    if (!cs.length) return 'none on record.';
    return `${cs.length} made · ${cs.filter((c) => c.status === 'kept').length} kept · ${cs.filter((c) => c.status === 'broken').length} broken · ${cs.filter((c) => c.status === 'open').length} open.`;
  });
  push('Sealed letters', () => survival(now).line);
  push('Protocol', () => `v${PROTOCOL_VERSION}.`);
  push('Ledger', () => {
    const l = ledger(now);
    if (!l.length) return 'EMPTY. Nothing has been handed over, so everything below the computed half is missing.';
    const newest = Math.floor((now - l[0].at) / DAY);
    return `${l.length} entries · newest ${newest} day${newest === 1 ? '' : 's'} old · ${l.filter((e) => e.by === 'user').length} of them yours.`;
  });
  return out;
}

/* WHAT THIS DOCUMENT CANNOT TELL YOU. Fixed list, because these are
   structural limits of the record rather than gaps that get filled in.
   Anything that becomes knowable moves out of here and into COMPUTED. */
const UNKNOWN: string[] = [
  'Whether anything here is DEPLOYED. The Spine is per-browser; it knows what this device did, not what is live. Check the running build, never this file.',
  'Anything that happened on a device or a branch other than this one. Storage is per-origin and most of this project sits on unmerged branches.',
  'Any conversation that was not written into the ledger. If a model warned about something and nobody recorded it, that warning is gone and this document cannot tell you it ever existed.',
  'Whether a recorded reason is still TRUE. Entries are dated, not re-verified. A lesson from a year ago may have been fixed upstream since.',
  'Anything about his health, his medication, or his weekly answers. §46 holds those and they are deliberately not in the handover — a new assistant does not need them to write code.',
  'What the property case actually says. The law pack was left empty on purpose and must be filled from his lawyer\'s text, never from a model\'s memory of Egyptian statute.',
];

export function canonicalBrief(now = Date.now()): string {
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const L: string[] = [];
  const l = ledger(now);

  L.push('KAI — CANONICAL BRIEF');
  L.push(`Generated ${iso(now)}. Read this before you advise on anything.`);
  L.push('');
  L.push('HOW TO READ IT, AND WHAT IT IS NOT');
  L.push('  This is generated, not maintained by hand, so the numbers cannot rot. The');
  L.push('  REASONS can: they were written down by whoever knew at the time and nothing');
  L.push('  re-checks them. Every recorded line carries a date and an author — use them.');
  L.push('');
  L.push('  One rule that overrides everything else in here: a decision recorded by Ali');
  L.push('  outranks advice recorded by any assistant, however well argued. If you find');
  L.push('  yourself about to explain why his call was wrong, read its reason first.');
  L.push('');
  L.push('='.repeat(70));
  L.push('');
  L.push('1. COMPUTED — read live from the record. Cannot be stale. Cannot explain itself.');
  L.push('');
  for (const c of computed(now)) L.push(`  ${c.label.padEnd(16)} ${c.value}`);
  L.push('');
  L.push('='.repeat(70));
  L.push('');
  L.push('2. RECORDED — written down at the time. Dated, because it can go out of date.');
  L.push('');
  if (!l.length) {
    L.push('  NOTHING RECORDED. This is the failure mode §48 exists to prevent: the numbers');
    L.push('  survive and every reason behind them is gone. Do not read the emptiness as');
    L.push('  "no decisions were made" — read it as "nobody wrote them down".');
  } else {
    for (const kind of ['decision', 'warning', 'failure', 'lesson', 'open'] as EntryKind[]) {
      const group = l.filter((e) => e.kind === kind && !e.supersededBy);
      if (!group.length) continue;
      L.push(`  ${kind.toUpperCase()}${kind === 'open' ? ' QUESTIONS' : 'S'}:`);
      for (const e of group) {
        L.push(`    · ${e.text}`);
        L.push(`        why: ${e.why}`);
        L.push(`        ${iso(e.at)} · ${e.who}${e.by === 'user' ? ' (HIS CALL — outranks model advice)' : ''}${e.cites ? ` · ${e.cites}` : ' · uncited'}${e.seeded ? ' · reconstructed from the repo, not logged live' : ''}`);
      }
      L.push('');
    }
    const dead = l.filter((e) => e.supersededBy);
    if (dead.length) {
      L.push('  SUPERSEDED — kept so nobody re-argues a settled point:');
      for (const e of dead) L.push(`    · ${e.text} (${iso(e.at)}, overruled)`);
      L.push('');
    }
  }
  L.push('='.repeat(70));
  L.push('');
  L.push('3. WHAT THIS DOCUMENT CANNOT TELL YOU');
  L.push('   The most important section. Everything here is a limit of the record, not a');
  L.push('   gap somebody forgot to fill.');
  L.push('');
  for (const u of UNKNOWN) L.push(`  · ${u}`);
  L.push('');
  L.push('='.repeat(70));
  L.push('');
  L.push('4. THE DOCTRINE — not advisory.');
  L.push('');
  for (const line of doctrineText().split('\n')) L.push('  ' + line);
  L.push('');
  L.push('='.repeat(70));
  L.push(`End of brief. Generated ${iso(now)} from ${getEvents({}).length} events and ${l.length} recorded entries.`);
  return L.join('\n');
}

/* ── 4. THE EXPORT ───────────────────────────────────────────── */

export function exportBrief(now = Date.now()): string {
  const L = [canonicalBrief(now), '', '='.repeat(70), '', 'HOW TO USE THIS FILE IF KAI IS GONE', ''];
  L.push('It is plain text. Nothing needs installing and there is no key. Hand it to');
  L.push('whoever or whatever is helping next and ask them to read it before advising.');
  L.push('');
  L.push('If the app still runs, regenerate rather than trusting this copy — the computed');
  L.push('half will have moved. If the app does not run, the RECORDED half is still the');
  L.push('most valuable thing here, because reasons do not expire as fast as numbers.');
  try {
    logEvent({ domain: 'system', type: 'uebergabe_exported', meta: { entries: ledger(now).length }, source: 'user', ts: now });
  } catch { /* ignore */ }
  return L.join('\n');
}

/* ── THE FOUNDING ENTRIES ────────────────────────────────────
   Reconstructed from this working tree, not from recollection: every
   one cites a file and line that can be opened and checked, and every
   one is flagged `seeded` so a reader knows it was written after the
   fact rather than logged as it happened.

   Anything I could not verify HERE was left out — including the lesson
   that a JavaScript word boundary cannot match Arabic, which is real
   but lives on an unmerged branch. An unverifiable entry in a handover
   is worse than a missing one, because the next model has no way to
   tell them apart. */

/* No `daysAgo`, deliberately. I do not know which night the U+2028 bug
   was found, and back-dating these to plausible-looking dates would put
   invented precision on the one document that exists to stop the next
   model trusting invented things. They are stamped when they are seeded
   and flagged as reconstructed; the CITATION is the evidence, not the
   date. */
const FOUNDING: Array<Omit<Entry, 'id' | 'at' | 'keywords'>> = [
  {
    kind: 'lesson', by: 'assistant', who: 'Claude (Opus)', seeded: true,
    text: 'Never let a raw U+2028 or U+2029 reach a source file — sweep for them before every push.',
    why: 'They are legal JavaScript line terminators inside string literals, so the file looks correct and the bundle breaks. It cost multiple nights before the sweep existed; the sweep now runs first in preflight and takes a second.',
    cites: 'scripts/preflight.mjs:33',
  },
  {
    kind: 'decision', by: 'assistant', who: 'Claude (Opus)', seeded: true,
    text: 'The heart rests at 48 BPM and peaks at 134. Do not lower the floor.',
    why: 'Verbatim from the code: "Below ~45 the lub-dub stops reading as a heartbeat. Calm = a big powerful animal at deep rest, not a slow machine." It is a perceptual floor, not a health figure.',
    cites: 'src/lib/kai/commandCore.ts:182-186',
  },
  {
    kind: 'warning', by: 'assistant', who: 'Claude (Opus)', seeded: true,
    text: 'There are TWO heart-rate systems and they use different numbers. Do not reconcile them.',
    why: 'commandCore.ts drives the animation and rests at 48. being.ts assigns a bpm per state — STEADY 58 through WOUNDED 88 — which is the readout, not the animation. They are different layers; "fixing" one to match the other breaks whichever you did not read.',
    cites: 'src/lib/kai/commandCore.ts:185 and src/lib/kai/being.ts:74-108',
  },
  {
    kind: 'failure', by: 'assistant', who: 'Claude (Opus)', seeded: true,
    text: 'Six cron entries were committed to vercel.json on a plan that allows two, and production silently froze.',
    why: 'Vercel REJECTS the whole deployment, so the last good build keeps serving with no error anywhere in the app. Everything looked fine for days while nothing shipped. Preflight now fails the build on more than two crons for exactly this reason.',
    cites: 'scripts/preflight.mjs:43-57',
  },
  {
    kind: 'decision', by: 'assistant', who: 'Claude (Opus)', seeded: true,
    text: 'Stay under 12 serverless functions. Every API route counts.',
    why: 'Vercel Hobby caps it at 12 and the deployment fails past that. Routes are collapsed behind [...path].ts handlers to stay under it, which is why the api/ tree looks unusually flat.',
    cites: 'scripts/preflight.mjs:36-41',
  },
  {
    kind: 'decision', by: 'user', who: 'Ali Kaiser', seeded: true,
    text: 'Do not surface a rate rise off a pooled comp median. His $55 is correct for a 1-bedroom.',
    why: 'A $75.55 median was ranked as the top move; it pooled 2-bedrooms, sea-view chalets and Phase 2 new-builds with his 1-bedroom. He caught it. Comps are now class-matched and rate moves are withheld until the set is filtered.',
    cites: 'src/lib/kai/comps.ts:151 (classedMedian)',
  },
  {
    kind: 'decision', by: 'user', who: 'Ali Kaiser', seeded: true,
    text: 'Anything touching money or his name stays gated forever, no matter how good the track record gets.',
    why: 'His words: it never spends, signs, sells, or speaks as him to anyone who does not know it is a machine, and it never claims to BE Kaiser — it represents, it does not replace. No amount of accumulated trust unlocks this; it is not a threshold, it is a boundary.',
    cites: 'src/lib/kai/pending.ts:45 (proposeAction) and src/lib/kai/doctrine.ts',
  },
  {
    kind: 'lesson', by: 'assistant', who: 'Claude (Opus)', seeded: true,
    text: 'Read the rendered output. Do not assert around the code you just wrote.',
    why: 'Three separate bugs measured the wrong thing while passing their own tests — a volume test splitting by count, a rate whose denominator was months-with-income, and a listing included in its own median. All three were found by printing the text a human would read, none by an assertion.',
    cites: 'git log — commits e44d65b (§46) and d025b34 (§47) list the bugs and how each was found',
  },
  {
    kind: 'open', by: 'assistant', who: 'Claude (Opus)', seeded: true,
    text: 'Is production actually building? It last reported fd29547 while main had moved well past it.',
    why: 'The six-cron rejection explains the original freeze and is fixed, but nobody has confirmed a green deployment since. Until the footer SHA matches main, assume nothing shipped — and check this before believing any claim in the COMPUTED half about what is live.',
    cites: 'scripts/preflight.mjs:43-57',
  },
];

export interface SeedResult { added: number; skipped: number; reason: string }

/* Idempotent: seeding twice does not double the founding entries. */
export function seedFounding(now = Date.now()): SeedResult {
  const existing = read<Entry[]>(KEY, []);
  let added = 0, skipped = 0;
  for (const f of FOUNDING) {
    if (existing.some((e) => e.text === f.text)) { skipped++; continue; }
    const r = recordEntry(f.kind, f.text, f.why, f.by, f.who, { cites: f.cites, seeded: true, at: now });
    if (r.ok) added++;
  }
  return {
    added, skipped,
    reason: added
      ? `${added} founding entries recorded${skipped ? `, ${skipped} already present` : ''}. Each cites a file you can open — none of it is from anybody's memory, and what could not be verified in this tree was left out. ` +
        'Their dates are today, because that is when they were written down; when each thing actually happened is not something I can honestly claim, so the citation is the evidence rather than the timestamp.'
      : `Nothing added; all ${skipped} founding entries are already on record.`,
  };
}

export function uebergabeText(now = Date.now()): string {
  const l = ledger(now);
  const L = ['DIE ÜBERGABE', ''];
  L.push(`Ledger: ${l.length} entries${l.length ? ` · newest ${Math.floor((now - l[0].at) / DAY)}d old · ${l.filter((e) => e.by === 'user').length} yours` : ' — EMPTY'}`);
  L.push('');
  for (const kind of ['open', 'warning', 'decision', 'failure', 'lesson'] as EntryKind[]) {
    const g = l.filter((e) => e.kind === kind && !e.supersededBy);
    if (g.length) L.push(`  ${g.length} ${kind}${g.length === 1 ? '' : 's'}`);
  }
  L.push('');
  L.push('"handover" writes the full brief. "handover <advice>" checks it against the record first.');
  L.push('You are no longer the only continuous memory here — but only for what got written down.');
  return L.join('\n');
}
