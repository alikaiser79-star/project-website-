/* ============================================================
   /api/pulse — DER SCHATTEN heartbeat (§14), server-side (Edge).
   Function #8 (under the Hobby cap).

   Hobby has no daemons, so work happens on a heartbeat: a Vercel cron
   (see vercel.json) hits this route once a day. It runs the PURE pulse
   core against each registered operator's synced Spine (Upstash), writes
   the results back as Spine events, and stores the day's one-line
   dispatch — so when KAI opens on ANY device the morning state is
   already computed, and the Night Ledger can show what moved.

   Auth:
     GET  (cron)      — Authorization: Bearer $CRON_SECRET (Vercel sets
                        this automatically when CRON_SECRET is in env).
     POST register    — x-kai-sync-key; adds the caller's namespace to the
                        pulse registry so the cron includes it, and stores
                        its config (timezone, push subscription).

   The Upstash REST creds stay server-side (same as /api/spine). No
   Upstash configured → 503 and the pulse is simply dormant.

   NOTE: the morning PUSH notification (§14.2) requires VAPID keys and is
   sent from a separate step; here the pulse writes events + stores the
   dispatch, which the client reads on next sync. See README / Settings.
   ============================================================ */

import { runPulseCore, type PulseEvent } from './_pulse-core';

export const config = { runtime: 'edge' };

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;
const TTL = 60 * 60 * 24 * 180;
const REG_KEY = 'kai:pulse:reg';

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

async function nsFromKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pairsToEvents(flat: any): PulseEvent[] {
  const out: PulseEvent[] = [];
  if (!Array.isArray(flat)) return out;
  for (let i = 1; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i])); } catch { /* skip */ } }
  return out;
}

/* Run the pulse for one namespace: read events, compute, append the new
   events, store the dispatch. Returns the dispatch line (or null). */
async function pulseNamespace(ns: string, now: number): Promise<string | null> {
  const evKey = `spine:ev:${ns}`;
  const events = pairsToEvents(await redis(['HGETALL', evKey]));
  const { newEvents, dispatch } = runPulseCore(events, now);

  if (newEvents.length) {
    const cmd: (string | number)[] = ['HSET', evKey];
    for (const e of newEvents) {
      const id = 'pulse-' + crypto.randomUUID().slice(0, 12);
      cmd.push(id, JSON.stringify({ id, ...e }));
    }
    await redis(cmd);
    await redis(['EXPIRE', evKey, TTL]);
  }
  await redis(['SET', `kai:pulse:dispatch:${ns}`, JSON.stringify({ line: dispatch, ts: now })]);
  await redis(['EXPIRE', `kai:pulse:dispatch:${ns}`, TTL]);
  return dispatch;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-kai-sync-key', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return j({ ok: true, configured: false, note: 'pulse dormant — no Upstash wired' }, req.method === 'GET' ? 200 : 503);
  }

  /* ── POST register — a device opts into the daily pulse ── */
  if (req.method === 'POST') {
    const key = req.headers.get('x-kai-sync-key') || '';
    if (key.length < 16) return j({ error: 'no_key' }, 401);
    const ns = await nsFromKey(key);
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    try {
      await redis(['SADD', REG_KEY, ns]);
      await redis(['SET', `kai:pulse:cfg:${ns}`, JSON.stringify({ tz: body?.tz || 'Africa/Cairo', subscription: body?.subscription || null, watches: Array.isArray(body?.watches) ? body.watches.slice(0, 3) : [], ts: Date.now() })]);
      await redis(['EXPIRE', `kai:pulse:cfg:${ns}`, TTL]);
      return j({ ok: true, registered: true });
    } catch (e: any) { return j({ error: 'register_failed', detail: String(e?.message || e).slice(0, 120) }, 502); }
  }

  /* ── GET — the cron heartbeat ── */
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('health') != null) return j({ ok: true, configured: true });

    /* Vercel sets Authorization: Bearer $CRON_SECRET for scheduled
       invocations. Reject anything else when a secret is configured. */
    if (CRON_SECRET) {
      const auth = req.headers.get('authorization') || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return j({ error: 'unauthorized' }, 401);
    }

    const now = Date.now();
    try {
      const namespaces: string[] = (await redis(['SMEMBERS', REG_KEY])) || [];
      let dispatched = 0;
      for (const ns of namespaces) {
        try { const d = await pulseNamespace(ns, now); if (d) dispatched++; } catch { /* one ns failing shouldn't abort the pulse */ }
      }
      return j({ ok: true, ran: namespaces.length, dispatched, at: now });
    } catch (e: any) {
      return j({ error: 'pulse_error', detail: String(e?.message || e).slice(0, 120) }, 502);
    }
  }

  return j({ error: 'method_not_allowed' }, 405);
}
