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
