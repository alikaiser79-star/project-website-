/* ============================================================
   POST /api/gmail/send

   The write side. Only ever reached from the executor in
   src/lib/kai/pending.ts AFTER the ConfirmationGate approval —
   the LLM has no tool that calls this endpoint directly. The gate
   is the human-in-the-loop check; we still sanity-check shape so a
   malformed payload returns a clean 400.

   Edge-native: no Buffer. UTF-8 → base64 via TextEncoder + btoa.
   ============================================================ */

import { getAccessToken, gmailApi, json, gmailErr, explain } from './_client.js';

/* Standard base64 of raw bytes (btoa is latin1-only, so feed it bytes). */
function b64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
/* base64url of a UTF-8 string, no padding — the Gmail `raw` encoding. */
function b64urlUtf8(s: string): string {
  return b64(new TextEncoder().encode(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* RFC 2047 encoded-word for a non-ASCII header value (German/Russian/Arabic
   subjects). Chunks by whole characters so each encoded-word stays within the
   75-char header limit; ASCII passes through untouched. */
function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const enc = new TextEncoder();
  const words: string[] = [];
  let chunk = '';
  const flush = () => { if (chunk) { words.push('=?UTF-8?B?' + b64(enc.encode(chunk)) + '?='); chunk = ''; } };
  for (const ch of Array.from(value)) {           // surrogate-safe iteration
    const nextBytes = enc.encode(chunk + ch).length;
    if (Math.ceil(nextBytes / 3) * 4 > 63) flush();  // keep base64 ≤ 63 (word ≤ 75)
    chunk += ch;
  }
  flush();
  return words.join('\r\n ');                     // folding whitespace between words
}

export async function send(req: Request): Promise<Response> {
  let body: any = {};
  try { body = await req.json(); } catch { /* empty/invalid → validated below */ }

  const to = String(body?.to || '').trim();
  const subject = String(body?.subject || '').trim();
  const text = String(body?.body || '').trim();

  if (!to || !subject || !text) {
    return json({ error: 'bad_request', message: 'to / subject / body all required' }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return json({ error: 'bad_recipient', message: 'recipient does not look like an email address' }, 400);
  }

  try {
    const token = await getAccessToken();

    /* RFC 5322 envelope → base64url raw, exactly as the Gmail API expects. */
    const raw = b64urlUtf8([
      `To: ${to}`,
      `Subject: ${encodeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      text,
    ].join('\r\n'));

    const res = await gmailApi('/users/me/messages/send', token, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) return gmailErr(res, 'gmail send');

    const d: any = await res.json();
    return json({ ok: true, id: d?.id || null, threadId: d?.threadId || null });
  } catch (e) {
    return explain(e);
  }
}
