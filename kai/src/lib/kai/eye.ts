/* ============================================================
   §22.3 — DIE AUGEN (The Eyes). A capture→ask flow: Ali sends
   one image (glasses / phone camera / upload) and a spoken or
   typed question. KAI reads the image with FULL Spine context
   (buildKaiContext) — so "what's this plant doing?" is answered
   by the same eye that knows Hidden Garten, the Codex, and every
   organ value, not a blind OCR pass.

   Reuses the receipts vision pipeline: compressImage() downscales
   client-side, then an image content block + a text block go
   through the existing /api/claude proxy. No new function, no key
   in the browser. The answer is spoken via Phase-2 TTS at the
   call site.

   Doctrine: async and consent-bound. Nothing is captured until
   Ali points the camera and presses. KAI never watches the room.
   ============================================================ */

import { claudeConfig } from '../../kaiConfig';
import { buildKaiContext } from './context';
import { priorReadingNote } from './observations';
import type { Compressed } from '../receipts';

const SYSTEM =
  `You are KAI — Ali Kaiser's command core, now with eyes. You are shown ONE ` +
  `image Ali just captured (through glasses, a phone, or an upload) and a question ` +
  `about it. Below the question is Ali's live CONTEXT — his real organ values, open ` +
  `commitments, and recent Spine events. Answer from what you can ACTUALLY see in the ` +
  `image, grounded in that context where it applies (a plant → Hidden Garten in Maadi's ` +
  `hot arid climate; a document → his finances; the apartment → Makadi).\n\n` +
  `Be honest about uncertainty: if the image is blurry or the answer isn't visible, ` +
  `say so and ask for a specific closer shot — never be confidently wrong. Flat, direct ` +
  `tone; no praise, no padding. Under 120 words. This will likely be read aloud, so ` +
  `write it to be heard: plain sentences, no markdown, no lists.`;

/* Ask KAI's eye about a captured image. Returns the spoken-ready answer text. */
export async function askKaiEye(img: Compressed, question: string, now = Date.now()): Promise<string> {
  if (!claudeConfig.enabled) throw new Error('NO_API_KEY');
  const q = (question || '').trim() || 'What am I looking at, and what should I do about it?';

  const res = await fetch(claudeConfig.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: claudeConfig.modelHeavy,
      max_tokens: 500,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: img.mime, data: img.b64 },
          },
          {
            type: 'text',
            text: `QUESTION: ${q}${safePrior(q, now)}\n\nCONTEXT (Ali's live numbers — use only if relevant):\n${safeContext(now, q)}`,
          },
        ],
      }],
    }),
  });

  if (res.status === 503) throw new Error('NO_API_KEY');
  if (!res.ok) throw new Error('API_ERROR: ' + res.status + ' ' + (await res.text()).slice(0, 160));

  const data = await res.json();
  let text = '';
  for (const b of (data?.content || [])) {
    if (b?.type === 'text' && typeof b.text === 'string') text += b.text;
  }
  text = text.trim();
  if (!text) throw new Error('EMPTY_REPLY');
  return text;
}

/* Context must never sink the call — a fresh install with a thin Spine
   still gets a working eye. */
/* §29.8 — if the eye has seen this subject before, the prompt carries the
   prior reading so the answer is a COMPARISON, not a fresh first look. */
function safePrior(q: string, now: number): string {
  try { return priorReadingNote(q, now); } catch { return ''; }
}

function safeContext(now: number, query: string): string {
  try { return buildKaiContext(now, query); } catch { return '(context unavailable)'; }
}
