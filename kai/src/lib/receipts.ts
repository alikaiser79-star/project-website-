/* ============================================================
   Receipt vision extraction.

   Client-side: downscale the upload to ≤ 1500px JPEG to keep
   the payload small. Server-side: POST through /api/claude
   with a single user message containing an image block + a
   tight JSON-only instruction. Parse defensively.

   Anthropic key never reaches the browser — same proxy as the
   rest of KAI.
   ============================================================ */

import { claudeConfig } from '../kaiConfig';
import { CATEGORIES, isCategory } from './expenses';
import type { Expense, ExpenseCategory } from '../types';

const MAX_DIM = 1500;
const JPEG_QUALITY = 0.82;

export type Compressed = { b64: string; mime: 'image/jpeg' };

export async function compressImage(file: File): Promise<Compressed> {
  if (!/^image\//i.test(file.type)) throw new Error('NOT_AN_IMAGE');

  const bitmap = await loadBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS_CONTEXT');
  ctx.drawImage(bitmap, 0, 0, w, h);
  try { (bitmap as ImageBitmap).close?.(); } catch { /* fine */ }

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('TOBLOB_FAILED')),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
  const b64 = await blobToBase64(blob);
  return { b64, mime: 'image/jpeg' };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('IMG_DECODE')); };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => {
      const s = String(r.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error('READ_FAILED'));
    r.readAsDataURL(blob);
  });
}

/* ── Vision extraction ─────────────────────────────────── */

export type ExtractedReceipt =
  | { ok: true; data: Omit<Expense, 'id'> }
  | { ok: false; reason: 'unreadable'; message: string };

const SYSTEM = `You are KAI's receipt OCR. You will be shown ONE receipt photo.
Return ONLY a JSON object. No prose, no markdown fences, no commentary.

Schema:
{
  "readable": true | false,
  "merchant": "<store / restaurant / vendor name as printed; short>",
  "date":     "<YYYY-MM-DD>",
  "total":    <number, the grand total the customer paid; tax included>,
  "currency": "<ISO-4217 code, e.g. EGP, EUR, USD, AED, GBP — best guess from symbols, language, or location>",
  "category": "<one of: ${CATEGORIES.join(' | ')}>"
}

Rules:
- If the image isn't a receipt, is blurry, or the total can't be found, return: { "readable": false, "merchant": "", "date": "", "total": 0, "currency": "", "category": "other" } and nothing else.
- "total" is a number, not a string. No currency symbol inside the number.
- "date" must be YYYY-MM-DD. If only month + day are printed, use the current year.
- Pick the SINGLE best category from the fixed set. Use "other" if uncertain.
- merchant ≤ 60 chars. Strip phone numbers, addresses, tagline text.`;

export async function extractReceipt(img: Compressed): Promise<ExtractedReceipt> {
  if (!claudeConfig.enabled) throw new Error('NO_API_KEY');

  const res = await fetch(claudeConfig.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: claudeConfig.model,
      max_tokens: 400,
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
            text: 'Read this receipt and respond with the JSON object only.',
          },
        ],
      }],
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
  return parseReceipt(text);
}

export function parseReceipt(raw: string): ExtractedReceipt {
  let s = String(raw || '').trim();
  if (!s) return { ok: false, reason: 'unreadable', message: 'Empty reply from model.' };
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return { ok: false, reason: 'unreadable', message: "Couldn't find a JSON object in the reply." };
  }
  let obj: any;
  try { obj = JSON.parse(s.slice(start, end + 1)); }
  catch { return { ok: false, reason: 'unreadable', message: 'Reply was not valid JSON.' }; }

  if (obj?.readable === false) {
    return { ok: false, reason: 'unreadable', message: "KAI couldn't read this receipt clearly." };
  }

  const merchant = clean(obj?.merchant);
  const total    = Number(obj?.total);
  const currency = String(obj?.currency || 'EGP').toUpperCase().slice(0, 6).trim() || 'EGP';
  const date     = normDate(obj?.date);
  const category: ExpenseCategory = isCategory(obj?.category) ? obj.category : 'other';

  if (!merchant || !Number.isFinite(total) || total <= 0) {
    return {
      ok: false, reason: 'unreadable',
      message: "Couldn't pull a merchant and total out of this receipt.",
    };
  }

  return { ok: true, data: { merchant, total: round2(total), currency, date, category } };
}

function clean(s: any): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
}
function normDate(d: any): string {
  const s = String(d ?? '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
