/* ============================================================
   /api/spine — SPINE EVERYWHERE sync (§8.1), server-side (Edge).

   Append-only, conflict-free multi-device sync for the KAI Spine.
   The Upstash Redis REST credentials live ONLY here (server env);
   the browser never sees them. Function #7 (one catch-all).

   AUTH — unguessable namespace key. Every request carries the
   operator's sync key in `x-kai-sync-key`. The server hashes it
   (SHA-256) to derive a Redis namespace; the raw key is never
   stored. No key → 401. A wrong key simply lands on an empty,
   foreign namespace — it can't read the operator's data. This is
   the privacy model the local-only WebAuthn lock can actually
   back: the key is only reachable while the app is unlocked.

   DATA MODEL
     spine:ev:<ns>   HASH  field=eventId  value=event JSON   (append-only,
                           dedup by id — pushing the same event twice is
                           idempotent; devices pull what they lack)
     spine:set:<ns>  STRING JSON { data, ts }  (non-Spine settings,
                           last-write-wins by ts)
   Both carry a rolling TTL so an abandoned namespace self-expires.

   ROUTES
     GET  /api/spine/health    → { ok, configured }
     GET  /api/spine/pull      → { events: [...] }
     POST /api/spine/push      { events } → { ok, stored }
     GET  /api/spine/settings  → { data, ts } | { data:null }
     POST /api/spine/settings  { data, ts } → { ok, applied }

   Not configured (no Upstash env) → 503 { error:'not_configured' }
   so the client degrades cleanly to local-only.
   ============================================================ */

export const config = { runtime: 'edge' };

/* Vercel's Upstash KV integration provisions KV_REST_API_URL /
   KV_REST_API_TOKEN; a standalone Upstash database uses the
   UPSTASH_REDIS_REST_* names. Accept either — KV names first. */
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_SECONDS = 60 * 60 * 24 * 180;   // 180d rolling — abandoned namespaces expire
const PUSH_CHUNK = 200;                    // HSET fields per request
const MAX_EVENTS = 5000;                   // safety bound on a namespace

function j(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type,x-kai-sync-key',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'cache-control': 'no-store',
    },
  });
}

async function redis(cmd: (string | number)[]): Promise<any> {
  const r = await fetch(REDIS_URL!, {
    method: 'POST',
    headers: { authorization: `Bearer ${REDIS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const d: any = await r.json();
  if (d && d.error) throw new Error('redis: ' + d.error);
  return d?.result;
}

async function redisPipe(cmds: (string | number)[][]): Promise<any[]> {
  if (!cmds.length) return [];
  const r = await fetch(REDIS_URL! + '/pipeline', {
    method: 'POST',
    headers: { authorization: `Bearer ${REDIS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis-pipe ' + r.status);
  const d: any = await r.json();
  return Array.isArray(d) ? d.map((x) => x?.result) : [];
}

async function nsFromKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* HGETALL over Upstash returns a flat [f1,v1,f2,v2,...] array. */
function pairsToEvents(flat: any): any[] {
  const out: any[] = [];
  if (!Array.isArray(flat)) return out;
  for (let i = 1; i < flat.length; i += 2) {
    try { out.push(JSON.parse(flat[i])); } catch { /* skip a corrupt field */ }
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type,x-kai-sync-key',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
      },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api\/spine\/?/, '').replace(/\/+$/, '') || 'health';

  if (!REDIS_URL || !REDIS_TOKEN) {
    /* health always answers so the client can show "sync available? no". */
    if (path === 'health') return j({ ok: true, configured: false });
    return j({ error: 'not_configured' }, 503);
  }

  if (path === 'health') return j({ ok: true, configured: true });

  /* ── auth: unguessable sync key, hashed to a namespace ── */
  const key = req.headers.get('x-kai-sync-key') || '';
  if (key.length < 16) return j({ error: 'no_key' }, 401);
  const ns = await nsFromKey(key);
  const evKey = `spine:ev:${ns}`;
  const setKey = `spine:set:${ns}`;

  try {
    if (path === 'pull' && req.method === 'GET') {
      const flat = await redis(['HGETALL', evKey]);
      return j({ events: pairsToEvents(flat) });
    }

    if (path === 'push' && req.method === 'POST') {
      const body: any = await req.json().catch(() => ({}));
      const events: any[] = Array.isArray(body?.events) ? body.events : [];
      const valid = events.filter((e) => e && typeof e.id === 'string');
      if (!valid.length) return j({ ok: true, stored: 0 });

      /* Bound the namespace: if it's already at the cap, refuse new
         fields rather than growing unbounded (client is FIFO-capped
         at 2000, so this only trips on abuse). */
      const count = Number(await redis(['HLEN', evKey])) || 0;
      let stored = 0;
      for (let i = 0; i < valid.length && count + stored < MAX_EVENTS; i += PUSH_CHUNK) {
        const slice = valid.slice(i, i + PUSH_CHUNK);
        const cmd: (string | number)[] = ['HSET', evKey];
        for (const e of slice) { cmd.push(e.id, JSON.stringify(e)); }
        await redis(cmd);
        stored += slice.length;
      }
      await redis(['EXPIRE', evKey, TTL_SECONDS]);
      return j({ ok: true, stored });
    }

    if (path === 'settings' && req.method === 'GET') {
      const raw = await redis(['GET', setKey]);
      if (!raw) return j({ data: null, ts: 0 });
      try { return j(JSON.parse(raw)); } catch { return j({ data: null, ts: 0 }); }
    }

    if (path === 'settings' && req.method === 'POST') {
      const body: any = await req.json().catch(() => ({}));
      const ts = Number(body?.ts) || 0;
      /* last-write-wins: only overwrite if the incoming stamp is newer. */
      const existingRaw = await redis(['GET', setKey]);
      let existingTs = 0;
      if (existingRaw) { try { existingTs = Number(JSON.parse(existingRaw).ts) || 0; } catch { /* ignore */ } }
      if (ts <= existingTs) return j({ ok: true, applied: false, ts: existingTs });
      await redis(['SET', setKey, JSON.stringify({ data: body?.data ?? null, ts })]);
      await redis(['EXPIRE', setKey, TTL_SECONDS]);
      return j({ ok: true, applied: true, ts });
    }

    return j({ error: 'not_found', path }, 404);
  } catch (e: any) {
    return j({ error: 'sync_error', detail: String(e?.message || e).slice(0, 120) }, 502);
  }
}
