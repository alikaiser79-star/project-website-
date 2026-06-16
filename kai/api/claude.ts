/* ============================================================
   /api/claude — Vercel Edge proxy for the Anthropic Messages API.

   The Anthropic key lives ONLY in server env (ANTHROPIC_API_KEY).
   The client posts the same body shape it used to send straight to
   Anthropic; we forward it with the key attached and stream the
   SSE response straight back. No key ever reaches the browser.
   ============================================================ */

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    /* 503 is the contract the client checks for to surface
       "no key wired" — same UX as before. */
    return json({ error: 'no_api_key' }, 503);
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return json({ error: 'bad_body' }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
  } catch (e: any) {
    return json({ error: 'upstream_unreachable', message: String(e?.message || e) }, 502);
  }

  /* Pipe SSE / JSON through untouched. */
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'no-cache',
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  /* Same-origin in production; permissive in case the user wires up
     a separate dev origin (e.g. vite on :5173 + vercel dev on :3000). */
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}
