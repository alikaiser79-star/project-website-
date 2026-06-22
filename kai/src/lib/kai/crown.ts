/* ============================================================
   The Crown — life becomes legend.

   Watches the Spine for milestones (value thresholds + first-of-
   a-kind events) and emits "beats" — chapters in Ali's real arc.
   Each beat can be drafted into 2-3 on-brand story posts in his
   @alikaiser1 voice, holding the through-line (half-German, the
   Maadi trees his father planted, the KAISER crown), then sent
   one-tap to the Content Queue.

   Beats are DERIVED from the Spine each read — no separate event
   store to drift. A tiny kai.crown store only remembers which
   beats were dismissed or already queued, so the timeline stays
   honest without re-nagging.
   ============================================================ */

import { read, write, emit } from './store';
import { getEvents, type Domain } from './events';
import { addQueueItems, type PlannedItem } from '../content';
import { debt } from '../../kaiConfig';

const KEY = 'kai.crown';

export type BeatStatus = 'new' | 'queued' | 'dismissed';

export interface Beat {
  key: string;               // stable id — same milestone never re-emits
  ts: number;                // when the proving event landed
  kind: string;
  title: string;             // headline for the timeline
  detail: string;            // one-line context fed to the drafter
  domain: Domain;
}

interface CrownState { handled: Record<string, 'queued' | 'dismissed'> }

function loadCrown(): CrownState {
  const s = read<CrownState>(KEY, { handled: {} });
  return { handled: s?.handled ?? {} };
}
function saveCrown(s: CrownState) { write(KEY, s); emit(); }

export function dismissBeat(key: string) {
  const s = loadCrown(); s.handled[key] = 'dismissed'; saveCrown(s);
}
export function markBeatQueued(key: string) {
  const s = loadCrown(); s.handled[key] = 'queued'; saveCrown(s);
}
export function beatStatus(key: string): BeatStatus {
  const h = loadCrown().handled[key];
  return h === 'queued' ? 'queued' : h === 'dismissed' ? 'dismissed' : 'new';
}

/* ── Detection ─────────────────────────────────────────── */

export function detectBeats(now: number = Date.now()): Beat[] {
  void now;
  const beats: Beat[] = [];
  const all = getEvents().slice().sort((a, b) => a.ts - b.ts);

  /* Instagram follower tiers, per handle. */
  const IG_TIERS = [1000, 2000, 5000, 10000, 25000, 50000, 100000];
  const igByHandle = new Map<string, typeof all>();
  for (const ev of all) {
    if (ev.domain === 'instagram' && ev.type === 'follower_synced') {
      const handle = String((ev.meta?.handle as string) || '@account');
      if (!igByHandle.has(handle)) igByHandle.set(handle, []);
      igByHandle.get(handle)!.push(ev);
    }
  }
  for (const [handle, evs] of igByHandle) {
    crossing(evs, e => num(e.value), IG_TIERS, (tier, e) => beats.push({
      key: `ig:${handle}:${tier}`,
      ts: e.ts,
      kind: 'ig_followers',
      title: `${fmt(tier)} followers on ${handle}`,
      detail: `${handle} crossed ${fmt(tier)} followers — a real audience milestone.`,
      domain: 'instagram',
    }));
  }

  /* Debt paydown — percent cleared against the original balance. */
  const debtEvs = all.filter(e => e.domain === 'debt' && e.type === 'balance_updated');
  const original = debt.original > 0 ? debt.original : 1;
  crossing(
    debtEvs,
    e => { const bal = num(e.value); return bal == null ? null : ((original - bal) / original) * 100; },
    [25, 50, 75, 100],
    (tier, e) => beats.push({
      key: `debt:${tier}`,
      ts: e.ts,
      kind: tier >= 100 ? 'debt_cleared' : 'debt_progress',
      title: tier >= 100 ? 'Credit card cleared' : `Debt ${tier}% cleared`,
      detail: tier >= 100
        ? 'The credit card is fully cleared — zeroed out. A weight gone.'
        : `Credit-card paydown crossed ${tier}% cleared. Momentum made visible.`,
      domain: 'debt',
    }),
  );

  /* Hidden Garden plant count tiers. */
  const plantEvs = all.filter(e => e.domain === 'garden' && e.type === 'plant_added');
  crossing(plantEvs, e => num(e.value), [100, 150, 200, 250, 300], (tier, e) => beats.push({
    key: `plants:${tier}`,
    ts: e.ts,
    kind: 'plants',
    title: `${tier} plants in Hidden Garden`,
    detail: `Hidden Garden passed ${tier} plants — the temple keeps growing.`,
    domain: 'garden',
  }));

  /* First-of-a-kind chapters. */
  firstOf(all, 'content', 'reel_posted', e => beats.push({
    key: 'first:reel',
    ts: e.ts, kind: 'first_reel', domain: 'content',
    title: 'First reel posted', detail: 'The first reel went out — the documentation begins.',
  }));
  firstOf(all, 'commitment', 'commitment_kept', e => beats.push({
    key: 'first:kept',
    ts: e.ts, kind: 'first_kept', domain: 'commitment',
    title: 'First commitment kept', detail: 'First self-commitment the data confirms Ali actually kept.',
  }));
  firstOf(all, 'people', 'delivered', e => beats.push({
    key: 'first:delivered',
    ts: e.ts, kind: 'first_delivered', domain: 'people',
    title: 'First promise delivered to you', detail: 'Someone on the Ledger came through for the first time.',
  }));

  /* Content volume milestones — Nth post published. */
  const postEvs = all.filter(e => e.domain === 'content' && e.type === 'item_posted');
  for (const tier of [10, 25, 50, 100]) {
    if (postEvs.length >= tier) {
      const e = postEvs[tier - 1];
      beats.push({
        key: `posts:${tier}`,
        ts: e.ts, kind: 'content_count', domain: 'content',
        title: `${tier} posts published`, detail: `${tier} content pieces shipped — consistency compounding.`,
      });
    }
  }

  /* Mirror — Nth commitment kept. */
  const keptEvs = all.filter(e => e.domain === 'commitment' && e.type === 'commitment_kept');
  for (const tier of [5, 10, 25]) {
    if (keptEvs.length >= tier) {
      const e = keptEvs[tier - 1];
      beats.push({
        key: `kept:${tier}`,
        ts: e.ts, kind: 'kept_count', domain: 'commitment',
        title: `${tier} commitments kept`, detail: `${tier} promises to himself, kept and proven. Discipline documented.`,
      });
    }
  }

  /* Newest first. */
  return beats.sort((a, b) => b.ts - a.ts);
}

/* Beats the user hasn't dismissed — what the panel shows. */
export function liveBeats(now: number = Date.now()): Array<Beat & { status: BeatStatus }> {
  return detectBeats(now)
    .map(b => ({ ...b, status: beatStatus(b.key) }))
    .filter(b => b.status !== 'dismissed');
}

/* ── Drafting via /api/claude ──────────────────────────── */

const THROUGH_LINE =
  "Ali Kaiser — half-German, half-Egyptian, building in Maadi, Cairo. The " +
  "name carries a crown; the brand carries the myth. His father planted trees " +
  "in Maadi; Ali plants a whole life. Hidden Garden is the temple, the Makadi " +
  "Airbnb the outpost, the native-German edge the unfair advantage. Bold, " +
  "premium, identity-and-presence driven, already hitting 100k+ views. Every " +
  "milestone is a chapter in a legend documented AS IT HAPPENS — earned, never " +
  "manufactured, never 'hey guys'.";

export interface BeatDraft {
  hook: string;
  shotlist: string[];
  caption: string;
  hashtags: string[];
}

export async function draftBeat(beat: Beat): Promise<BeatDraft[]> {
  const system =
    `You turn a real milestone from Ali Kaiser's life into Instagram story ` +
    `beats for @alikaiser1, in his voice.\n\n` +
    `THROUGH-LINE\n${THROUGH_LINE}\n\n` +
    `THE MILESTONE\n${beat.title} — ${beat.detail}\n\n` +
    `Write 2-3 ways to post THIS milestone. Each must feel like a chapter in ` +
    `the legend, not an announcement. Hook in the first 2 seconds, punchy, ` +
    `confident, scroll-stopping. Tie back to the through-line when it lands ` +
    `(the crown, the trees, half-German, building in Cairo) — never forced.\n\n` +
    `OUTPUT — STRICT\n` +
    `Reply with ONLY a JSON array, no prose, no fences:\n` +
    `[\n` +
    `  {\n` +
    `    "hook":     "<spoken/on-screen opening, 4-12 words>",\n` +
    `    "shotlist": ["what to film line 1", "line 2", "line 3"],\n` +
    `    "caption":  "<ready-to-paste caption in Ali's voice, 1-3 sentences>",\n` +
    `    "hashtags": ["#tag1", "#tag2", "#tag3"]\n` +
    `  }, ...\n` +
    `]\n` +
    `2-3 items. shotlist 2-4 lines. 3-5 hashtags. No commentary.`;

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1100,
      system,
      messages: [{ role: 'user', content: `Draft the posts for: ${beat.title}.` }],
    }),
  });
  if (res.status === 503) throw new Error('NO_API_KEY');
  if (!res.ok) {
    const t = await res.text();
    throw new Error('API_ERROR: ' + res.status + ' ' + t.slice(0, 160));
  }
  const data = await res.json();
  let raw = '';
  for (const b of (data?.content || [])) {
    if (b?.type === 'text' && typeof b.text === 'string') raw += b.text;
  }
  return parseBeatDrafts(raw);
}

export function parseBeatDrafts(raw: string): BeatDraft[] {
  let s = String(raw || '').trim();
  if (!s) throw new Error('PARSE_EMPTY');
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = s.indexOf('['), end = s.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('PARSE_NO_ARRAY');
  let arr: any;
  try { arr = JSON.parse(s.slice(start, end + 1)); }
  catch (e: any) { throw new Error('PARSE_JSON: ' + (e?.message || 'invalid')); }
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('PARSE_EMPTY_ARRAY');

  const out: BeatDraft[] = [];
  for (const it of arr.slice(0, 3)) {
    if (!it || typeof it !== 'object') continue;
    const hook    = clean(it.hook);
    const caption = clean(it.caption);
    const shotlist = (Array.isArray(it.shotlist) ? it.shotlist : [])
      .map((x: any) => clean(x)).filter(Boolean).slice(0, 4);
    const hashtags = (Array.isArray(it.hashtags) ? it.hashtags : [])
      .map((x: any) => clean(x)).filter(Boolean)
      .map((t: string) => t.startsWith('#') ? t : '#' + t.replace(/\s+/g, '')).slice(0, 6);
    if (!hook || !caption || shotlist.length === 0) continue;
    out.push({ hook, shotlist, caption, hashtags });
  }
  if (out.length === 0) throw new Error('PARSE_NO_VALID');
  return out;
}

/* Push a chosen draft into the Content Queue as an @alikaiser1 reel. */
export function queueBeatDraft(beat: Beat, draft: BeatDraft) {
  const item: PlannedItem = {
    slot: 'Legend',
    account: 'ali',
    format: 'reel',
    hook: draft.hook,
    shotlist: draft.shotlist.length ? draft.shotlist : ['Capture the moment'],
    caption: draft.caption,
    hashtags: draft.hashtags,
  };
  addQueueItems([item]);
  markBeatQueued(beat.key);
}

/* Snapshot for a Claude tool. */
export function crownSnapshot() {
  const beats = liveBeats();
  return {
    new_count: beats.filter(b => b.status === 'new').length,
    beats: beats.map(b => ({
      key: b.key, title: b.title, detail: b.detail,
      kind: b.kind, status: b.status,
      at: new Date(b.ts).toISOString().slice(0, 10),
    })),
  };
}

/* ── Helpers ───────────────────────────────────────────── */

function crossing<E extends { ts: number }>(
  events: E[],
  metric: (e: E) => number | null,
  tiers: number[],
  emitBeat: (tier: number, e: E) => void,
) {
  const fired = new Set<number>();
  for (const ev of events) {
    const m = metric(ev);
    if (m == null) continue;
    for (const tier of tiers) {
      if (m >= tier && !fired.has(tier)) { fired.add(tier); emitBeat(tier, ev); }
    }
  }
}

function firstOf<E extends { domain: string; type: string }>(
  events: E[], domain: Domain, type: string, emitBeat: (e: E) => void,
) {
  const e = events.find(x => x.domain === domain && x.type === type);
  if (e) emitBeat(e);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function fmt(n: number): string {
  return n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : n.toLocaleString('en-GB');
}
function clean(v: any): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}
