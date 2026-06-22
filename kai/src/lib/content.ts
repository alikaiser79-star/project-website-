/* ============================================================
   Content / reel-hook generator.

   One Claude call per Generate tap. We enable Anthropic's
   server-side `web_search` tool so Claude can pull in what's
   actually trending right now, then constrain the output to
   strict JSON — an array of exactly 3 hook objects.

   Routes through the existing /api/claude proxy (the
   Anthropic key never reaches the browser).
   ============================================================ */

import { claudeConfig } from '../kaiConfig';
import { loadState, saveState } from './store';
import { logEvent } from './kai/events';
import type {
  ContentItem, ContentAccount, ContentFormat, ContentStatus,
} from '../types';

export type Account = 'ali' | 'garden';

export type Hook = {
  hook:     string;   // 1st-2-second opening line
  concept:  string;   // one-line "what to film"
  caption:  string;   // ready-to-paste caption
  hashtags: string[]; // 3-5 hashtags
};

const ALI_BRAND =
  "@alikaiser1 — Ali Kaiser's personal brand. Half-German, half-Egyptian, " +
  "based in Maadi, Cairo. Bold, premium, identity-and-presence driven. " +
  "His content already hits 100k+ views. Hooks must be punchy, confident, " +
  "scroll-stopping, direct — zero fluff, zero 'hey guys'. Spoken or on-screen " +
  "text, never a hashtag-as-hook. Reference real cultural / city texture when " +
  "it lands.";

const GARDEN_BRAND =
  "@hiddengarden.eg — a premium organic garden and event space in Maadi, Cairo. " +
  "Boho eco-luxury aesthetic. Plants, growing, seasonal blooms, sunset events, " +
  "intimate gatherings, slow living. Hooks must feel calm, beautiful, " +
  "aspirational — sensory, never salesy. Think editorial captions, not ads.";

function brandFor(acc: Account): string {
  return acc === 'ali' ? ALI_BRAND : GARDEN_BRAND;
}

function nicheFor(acc: Account): string {
  return acc === 'ali'
    ? 'personal-brand creators, identity content, Cairo / MENA lifestyle, ' +
      'masculine style and confidence, Egyptian-German cultural angle'
    : 'plants, urban gardening, eco-luxury, boho aesthetic, plant care, ' +
      'sustainable lifestyle, event-space marketing in Cairo';
}

export async function generateReelHooks(
  account: Account,
  topic: string,
): Promise<Hook[]> {
  if (!claudeConfig.enabled) throw new Error('NO_API_KEY');

  const cleanTopic = (topic || '').trim().slice(0, 240);
  const brand = brandFor(account);
  const niche = nicheFor(account);

  const system =
    `You are KAI's reel-hook engine for Ali Kaiser. You produce ` +
    `scroll-stopping Instagram Reel hooks grounded in what is actually ` +
    `trending RIGHT NOW.\n\n` +
    `BRAND CONTEXT\n${brand}\n\n` +
    `WORKFLOW\n` +
    `1. Use the web_search tool to find what is trending right now in ` +
    `   the niche: ${niche}. Search Cairo / Egypt angles when they fit. ` +
    `   Look for: viral audio, format trends, news beats, seasonal moments. ` +
    `   Run 2-4 targeted searches; do not over-search.\n` +
    `2. Synthesise. Pick the THREE strongest angles for THIS account.\n` +
    `3. Output exactly 3 hooks, on-brand.\n\n` +
    `OUTPUT FORMAT — STRICT\n` +
    `Reply with ONLY a JSON array. No prose, no markdown fences, no ` +
    `preamble. Schema:\n` +
    `[\n` +
    `  {\n` +
    `    "hook":     "<opening line for the first 2 seconds, spoken or on-screen, 4-12 words, punchy>",\n` +
    `    "concept":  "<one short sentence describing what to film — shot, setting, payoff>",\n` +
    `    "caption":  "<ready-to-paste caption, 1-3 sentences, on-brand voice, no hashtag spam>",\n` +
    `    "hashtags": ["#tag1", "#tag2", "#tag3"]\n` +
    `  }, ...\n` +
    `]\n` +
    `Exactly 3 items. 3-5 hashtags per item. No trailing commas. ` +
    `No extra keys. No explanations outside the JSON.`;

  const user = cleanTopic
    ? `Topic / mood to bias toward: "${cleanTopic}". ` +
      `If it doesn't fit one of the hooks, you can ignore it for that one — ` +
      `but at least two of the three should reflect it.`
    : `No specific topic — pick the strongest 3 angles for this account ` +
      `based on what is trending right now.`;

  const res = await fetch(claudeConfig.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: claudeConfig.model,
      max_tokens: 1400,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 4,
        },
      ],
    }),
  });

  if (res.status === 503) throw new Error('NO_API_KEY');
  if (!res.ok) {
    const t = await res.text();
    throw new Error('API_ERROR: ' + res.status + ' ' + t.slice(0, 200));
  }

  const data = await res.json();
  /* Assemble text from all assistant text blocks — server-side tool
     calls live in other blocks we don't need to process. */
  let text = '';
  for (const b of (data?.content || [])) {
    if (b?.type === 'text' && typeof b.text === 'string') text += b.text;
  }
  return parseHooks(text);
}

/* Defensive parser — strips code fences, trims to the first JSON
   array, validates the shape, normalises hashtags. Throws on
   anything we can't safely render. */
export function parseHooks(raw: string): Hook[] {
  let s = String(raw || '').trim();
  if (!s) throw new Error('PARSE_EMPTY');

  /* Strip ```json fences if Claude wraps despite instructions. */
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  /* Find the first '[' and last ']' — tolerate any leading prose. */
  const start = s.indexOf('[');
  const end   = s.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('PARSE_NO_ARRAY');
  const jsonText = s.slice(start, end + 1);

  let arr: any;
  try { arr = JSON.parse(jsonText); }
  catch (e: any) { throw new Error('PARSE_JSON: ' + (e?.message || 'invalid')); }

  if (!Array.isArray(arr)) throw new Error('PARSE_NOT_ARRAY');
  if (arr.length === 0)    throw new Error('PARSE_EMPTY_ARRAY');

  const hooks: Hook[] = [];
  for (const item of arr.slice(0, 5)) {
    if (!item || typeof item !== 'object') continue;
    const hook    = clean(item.hook);
    const concept = clean(item.concept);
    const caption = clean(item.caption);
    let   tags    = item.hashtags;
    if (Array.isArray(tags)) {
      tags = tags
        .map((t: any) => clean(t))
        .filter(Boolean)
        .map((t: string) => t.startsWith('#') ? t : '#' + t.replace(/\s+/g, ''))
        .slice(0, 6);
    } else {
      tags = [];
    }
    if (!hook || !concept || !caption) continue;
    hooks.push({ hook, concept, caption, hashtags: tags });
  }

  if (hooks.length === 0) throw new Error('PARSE_NO_VALID_HOOKS');
  return hooks.slice(0, 3);
}

function clean(v: any): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

/* ════════════════════════════════════════════════════════════
   Week planner — same brand context and web_search, different
   shape. Returns 5-7 ContentItems ready to drop into the queue.
   ══════════════════════════════════════════════════════════ */

export const FORMATS: ContentFormat[] = ['reel', 'carousel', 'story'];
export function isFormat(v: any): v is ContentFormat {
  return v === 'reel' || v === 'carousel' || v === 'story';
}
export function isAccount(v: any): v is ContentAccount {
  return v === 'ali' || v === 'garden';
}
export function isStatus(v: any): v is ContentStatus {
  return v === 'idea' || v === 'shot' || v === 'posted';
}

export type PlannedItem = Omit<ContentItem, 'id' | 'status' | 'createdAt'>;

export async function planWeek(accounts: Account[]): Promise<PlannedItem[]> {
  if (!claudeConfig.enabled) throw new Error('NO_API_KEY');
  if (accounts.length === 0) throw new Error('NO_ACCOUNTS');

  const brandBlock = accounts.map(a =>
    `· ${a === 'ali' ? '@alikaiser1' : '@hiddengarden.eg'}: ${brandFor(a)}`
  ).join('\n');
  const nicheBlock = accounts.map(a => nicheFor(a)).join(' / ');
  const accountList = accounts.map(a => a === 'ali' ? 'ali' : 'garden').join(' or ');
  const count = accounts.length === 1 ? '5-7' : '6-7';

  const system =
    `You are KAI's content planner for Ali Kaiser. You build ` +
    `weekly Instagram content plans grounded in what is actually ` +
    `trending RIGHT NOW.\n\n` +
    `BRAND CONTEXT\n${brandBlock}\n\n` +
    `WORKFLOW\n` +
    `1. Use the web_search tool to find what is trending right now ` +
    `   across these niches: ${nicheBlock}. Search Cairo / Egypt ` +
    `   angles when they fit. Look for viral audio, format trends, ` +
    `   seasonal moments, news beats. 3-5 targeted searches max.\n` +
    `2. Synthesise. Plan a week — ${count} items total — that mixes ` +
    `   formats (reel / carousel / story), spreads the days, and ` +
    `   stays on-brand for each account.\n` +
    (accounts.length > 1
      ? `3. Split the items across both accounts; lean to the format ` +
        `   that fits each account best (reels for @alikaiser1, ` +
        `   carousels for @hiddengarden.eg are great defaults).\n`
      : `3. All items belong to the single chosen account.\n`) +
    `\nOUTPUT FORMAT — STRICT\n` +
    `Reply with ONLY a JSON array. No prose, no markdown fences, no ` +
    `preamble. Schema:\n` +
    `[\n` +
    `  {\n` +
    `    "slot":     "<short day-or-slot label, e.g. 'Mon AM', 'Day 2', 'Wed'>",\n` +
    `    "account":  "<${accountList}>",\n` +
    `    "format":   "<reel | carousel | story>",\n` +
    `    "hook":     "<spoken or on-screen first 2 seconds, 4-12 words, punchy>",\n` +
    `    "shotlist": ["line 1", "line 2", "line 3"],\n` +
    `    "caption":  "<ready-to-paste caption, 1-3 sentences, on-brand voice>",\n` +
    `    "hashtags": ["#tag1", "#tag2", "#tag3"]\n` +
    `  }, ...\n` +
    `]\n` +
    `Exactly ${count} items. shotlist has 2-4 short lines. 3-5 hashtags ` +
    `per item. No extra keys. No commentary outside the JSON.`;

  const user = accounts.length === 1
    ? `Plan the next ${count} content items for the chosen account.`
    : `Plan the next ${count} content items split across both accounts.`;

  const res = await fetch(claudeConfig.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: claudeConfig.model,
      max_tokens: 2400,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    }),
  });
  if (res.status === 503) throw new Error('NO_API_KEY');
  if (!res.ok) {
    const t = await res.text();
    throw new Error('API_ERROR: ' + res.status + ' ' + t.slice(0, 200));
  }

  const data = await res.json();
  let text = '';
  for (const b of (data?.content || [])) {
    if (b?.type === 'text' && typeof b.text === 'string') text += b.text;
  }
  return parsePlan(text, accounts);
}

export function parsePlan(raw: string, allowed: Account[]): PlannedItem[] {
  let s = String(raw || '').trim();
  if (!s) throw new Error('PARSE_EMPTY');
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = s.indexOf('[');
  const end   = s.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('PARSE_NO_ARRAY');

  let arr: any;
  try { arr = JSON.parse(s.slice(start, end + 1)); }
  catch (e: any) { throw new Error('PARSE_JSON: ' + (e?.message || 'invalid')); }
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('PARSE_EMPTY_ARRAY');

  const allowedSet = new Set(allowed);
  const items: PlannedItem[] = [];
  for (const it of arr.slice(0, 10)) {
    if (!it || typeof it !== 'object') continue;
    const slot     = clean(it.slot) || `Item ${items.length + 1}`;
    let account: ContentAccount = isAccount(it.account) ? it.account
                                : allowed[0];
    if (!allowedSet.has(account)) account = allowed[0];
    const format: ContentFormat = isFormat(it.format) ? it.format : 'reel';
    const hook    = clean(it.hook);
    const caption = clean(it.caption);
    const rawShot = Array.isArray(it.shotlist) ? it.shotlist : [];
    const shotlist = rawShot.map((s: any) => clean(s)).filter(Boolean).slice(0, 4);
    const rawTags  = Array.isArray(it.hashtags) ? it.hashtags : [];
    const hashtags = rawTags
      .map((t: any) => clean(t))
      .filter(Boolean)
      .map((t: string) => t.startsWith('#') ? t : '#' + t.replace(/\s+/g, ''))
      .slice(0, 6);

    if (!hook || !caption || shotlist.length === 0) continue;
    items.push({ slot, account, format, hook, shotlist, caption, hashtags });
  }
  if (items.length === 0) throw new Error('PARSE_NO_VALID_ITEMS');
  /* Aim for 5-7 in the queue. Cap at 7 to keep the panel sane. */
  return items.slice(0, 7);
}

/* ── Queue store ─────────────────────────────────────────── */

export function listQueue(): ContentItem[] {
  return [...(loadState().contentQueue || [])];
}

export function queueCount(): { total: number; idea: number; shot: number; posted: number } {
  const q = listQueue();
  return {
    total:  q.length,
    idea:   q.filter(c => c.status === 'idea').length,
    shot:   q.filter(c => c.status === 'shot').length,
    posted: q.filter(c => c.status === 'posted').length,
  };
}

export function addQueueItems(items: PlannedItem[]): ContentItem[] {
  const s = loadState();
  const now = new Date().toISOString();
  const fresh: ContentItem[] = items.map((p, i) => ({
    id: 'c-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 6),
    slot: p.slot,
    account: p.account,
    format: p.format,
    hook: p.hook,
    shotlist: p.shotlist.slice(0, 4),
    caption: p.caption,
    hashtags: p.hashtags.slice(0, 6),
    status: 'idea',
    createdAt: now,
  }));
  s.contentQueue = [...fresh, ...(s.contentQueue || [])];
  saveState(s);
  return fresh;
}

export function updateQueueItem(id: string, patch: Partial<ContentItem>): ContentItem | null {
  const s = loadState();
  const idx = (s.contentQueue || []).findIndex(c => c.id === id);
  if (idx < 0) return null;
  const cur = s.contentQueue[idx];
  const prevStatus = cur.status;
  const next: ContentItem = {
    ...cur,
    ...(typeof patch.slot     === 'string'  ? { slot:     clean(patch.slot) || cur.slot } : {}),
    ...(isAccount(patch.account)            ? { account:  patch.account! } : {}),
    ...(isFormat(patch.format)              ? { format:   patch.format! } : {}),
    ...(typeof patch.hook     === 'string'  ? { hook:     clean(patch.hook) } : {}),
    ...(Array.isArray(patch.shotlist)       ? { shotlist: patch.shotlist.map(String).map(clean).filter(Boolean).slice(0, 4) } : {}),
    ...(typeof patch.caption  === 'string'  ? { caption:  clean(patch.caption) } : {}),
    ...(Array.isArray(patch.hashtags)       ? { hashtags: patch.hashtags.map(String).map(clean).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t.replace(/\s+/g, '')).slice(0, 6) } : {}),
    ...(isStatus(patch.status)              ? { status:   patch.status! } : {}),
  };
  s.contentQueue = s.contentQueue.map(c => c.id === id ? next : c);
  saveState(s);
  /* Spine — when status flips TO posted, emit format-specific
     events so "post N reels" / "post N items" commitments resolve. */
  if (prevStatus !== 'posted' && next.status === 'posted') {
    logEvent({
      domain: 'content', type: 'item_posted', value: 1,
      meta: { format: next.format, account: next.account, hook: next.hook },
      source: 'user',
    });
    if (next.format === 'reel') {
      logEvent({
        domain: 'content', type: 'reel_posted', value: 1,
        meta: { account: next.account, hook: next.hook },
        source: 'user',
      });
    }
  }
  return next;
}

export function advanceStatus(id: string): ContentItem | null {
  const order: ContentStatus[] = ['idea', 'shot', 'posted'];
  const cur = listQueue().find(c => c.id === id);
  if (!cur) return null;
  const i = order.indexOf(cur.status);
  const next = order[(i + 1) % order.length];
  return updateQueueItem(id, { status: next });
}

export function deleteQueueItem(id: string): boolean {
  const s = loadState();
  const before = (s.contentQueue || []).length;
  s.contentQueue = (s.contentQueue || []).filter(c => c.id !== id);
  saveState(s);
  return s.contentQueue.length !== before;
}

export function queueSnapshot() {
  const q = listQueue();
  const counts = queueCount();
  return {
    counts,
    items: q.map(c => ({
      id: c.id, slot: c.slot, account: c.account, format: c.format,
      hook: c.hook, shotlist: c.shotlist, caption: c.caption,
      hashtags: c.hashtags, status: c.status, created_at: c.createdAt,
    })),
  };
}
