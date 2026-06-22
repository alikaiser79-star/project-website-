/* ============================================================
   POST /api/ingest

   The phone bridge. The OS share sheet (iOS / Android), an iOS
   Shortcut, or a manual fetch can POST text and/or an image to
   this endpoint. We route:

     - image  → Anthropic vision (same schema as receipts.ts) →
                stash the extracted draft for ExpensesPanel.
     - text   → stash the combined title + text + url for the
                Brain Dump sorter.

   The response is a tiny HTML page that writes the payload to
   sessionStorage and redirects to /. The app picks it up on
   mount and opens the right surface — BrainDump prefilled, or
   ReceiptConfirm with the draft.

   We deliberately do NOT take any external action here — we
   just stage data for the existing client-side flows so the
   user still owns every send / file / approve.

   Edge runtime — multipart/form-data parses cleanly via
   req.formData().
   ============================================================ */

export const config = { runtime: 'edge' };

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const RECEIPT_SYSTEM = `You are KAI's receipt OCR. You will be shown ONE photo.
Return ONLY a JSON object. No prose, no markdown fences.

Schema:
{
  "readable": true | false,
  "merchant": "<short merchant name>",
  "date":     "<YYYY-MM-DD>",
  "total":    <number>,
  "currency": "<ISO-4217, e.g. EGP, EUR, USD, AED, GBP>",
  "category": "<groceries | dining | fuel | transport | shopping | bills | other>"
}

Rules:
- If the image isn't a receipt or the total can't be found, return readable:false with empty / 0 fields.
- total is a number, no currency symbol.
- date must be YYYY-MM-DD; if only month/day printed, use current year.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (req.method !== 'POST') return jsonRes({ error: 'method_not_allowed' }, 405);

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e: any) {
    return htmlRes(staticShell('Bad request — expected multipart/form-data.', null), 400);
  }

  const title = String(form.get('title') || '').trim().slice(0, 240);
  const text  = String(form.get('text')  || '').trim().slice(0, 8000);
  const url   = String(form.get('url')   || '').trim().slice(0, 1000);
  const files = form.getAll('media').filter(f => typeof f === 'object' && (f as any).arrayBuffer) as Array<File>;

  /* Image path: take the first image-typed file. */
  const image = files.find(f => /^image\//i.test(f.type)) ||
                files.find(f => f.size > 0 && f.type === '');
  if (image) {
    let draft: any = null;
    let extractionError: string | null = null;
    try {
      draft = await extractReceipt(image);
    } catch (e: any) {
      extractionError = String(e?.message || e || 'unknown').slice(0, 240);
    }
    return htmlRes(stash({
      kind: 'receipt',
      draft,
      extraction_error: extractionError,
      ingested_at: Date.now(),
    }), 200);
  }

  /* Text path: combine title + text + url into one dump. */
  const parts = [title, text, url].filter(Boolean);
  const combined = parts.join('\n\n').trim();
  if (combined) {
    return htmlRes(stash({
      kind: 'text',
      text: combined,
      ingested_at: Date.now(),
    }), 200);
  }

  return htmlRes(staticShell('Nothing to ingest — no text, URL, or image found in the share.', null), 400);
}

/* ── Anthropic vision call (server-side) ──────────────── */

async function extractReceipt(file: File): Promise<any | null> {
  const key = (globalThis as any).process?.env?.ANTHROPIC_API_KEY;
  if (!key) throw new Error('NO_API_KEY');

  const mime = file.type || 'image/jpeg';
  const buf = new Uint8Array(await file.arrayBuffer());
  /* btoa-friendly base64 encode in chunks to avoid stack blow-up. */
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
  }
  const b64 = btoa(bin);

  const r = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: RECEIPT_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text',  text: 'Read this receipt and respond with the JSON object only.' },
        ],
      }],
    }),
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const data = await r.json();
  let raw = '';
  for (const b of (data?.content || [])) {
    if (b?.type === 'text' && typeof b.text === 'string') raw += b.text;
  }
  return parseReceipt(raw);
}

function parseReceipt(raw: string): any | null {
  let s = String(raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: any;
  try { obj = JSON.parse(s.slice(start, end + 1)); } catch { return null; }
  if (obj?.readable === false) return null;
  const total = Number(obj?.total);
  const merchant = String(obj?.merchant || '').trim().slice(0, 60);
  if (!merchant || !Number.isFinite(total) || total <= 0) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(obj?.date || ''))
    ? String(obj.date)
    : new Date().toISOString().slice(0, 10);
  const currency = String(obj?.currency || 'EGP').toUpperCase().slice(0, 6) || 'EGP';
  const cats = ['groceries','dining','fuel','transport','shopping','bills','other'];
  const category = cats.includes(obj?.category) ? obj.category : 'other';
  return { merchant, total: Math.round(total * 100) / 100, currency, date, category };
}

/* ── HTML responses ──────────────────────────────────── */

function stash(payload: any): string {
  /* Embed the payload as a JSON string the inline script writes
     to sessionStorage, then redirects to /. The app's <App> picks
     it up on mount via the share handler in App.tsx. */
  const json = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/ /g, '\\u2028').replace(/ /g, '\\u2029');
  return `<!doctype html><html><head><meta charset="utf-8"><title>KAI · ingesting…</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{background:#0A0E14;color:#E6E1D7;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh}p{opacity:.7;letter-spacing:.04em;font-size:14px}</style>
</head><body><p>◊ ingesting…</p>
<script>try{sessionStorage.setItem('kai.pendingShare',${JSON.stringify(json)});}catch(e){}location.replace('/');</script>
</body></html>`;
}

function staticShell(message: string, _extra: any): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>KAI</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{background:#0A0E14;color:#E6E1D7;font-family:-apple-system,system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}p{opacity:.85;max-width:32ch;line-height:1.5}a{color:#FFB300;text-decoration:none;border:1px solid rgba(255,179,0,.4);padding:8px 14px;border-radius:6px;display:inline-block;margin-top:18px}</style>
</head><body><div><p>${escapeHtml(message)}</p><a href="/">open KAI</a></div></body></html>`;
}

function htmlRes(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...cors() },
  });
}
function jsonRes(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...cors() },
  });
}
function cors(): Record<string, string> {
  return {
    'access-control-allow-origin':  '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
