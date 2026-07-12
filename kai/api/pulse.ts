/* ============================================================
   /api/pulse — DER SCHATTEN heartbeat + THE VOICE (§14.1/§14.2).
   Node serverless (web-push is Node-only). Function #8 (under cap).

   A daily Vercel cron (vercel.json, 07:30 Cairo) runs the PURE pulse
   core against each registered operator's synced Spine (Upstash),
   writes results back as Spine events, stores the day's dispatch, and
   — §14.2 — SPEAKS: sends up to 3 push notifications (morning dispatch +
   true-alarm interrupts) to the device's subscription. Hard cap 3/day.

   Env:
     KV_REST_API_URL / KV_REST_API_TOKEN   Upstash (from §8)
     CRON_SECRET                            gates the cron GET
     VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   Web Push signing (§14.2)
     VAPID_SUBJECT                          mailto: (optional)

   No Upstash / no VAPID → the pulse still writes events; push is simply
   skipped. The morning state always reaches every device via §8 sync +
   the Night Ledger regardless.
   ============================================================ */

import webpush from 'web-push';
import { runPulseCore, type PulseEvent } from './_pulse-core';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:ali@kai.local';
const TTL = 60 * 60 * 24 * 180;
const REG_KEY = 'kai:pulse:reg';
const MAX_PUSH_PER_DAY = 3;

const pushReady = !!(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushReady) { try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!); } catch { /* ignore bad keys at boot */ } }

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

/* Run + speak for one namespace. Returns { dispatch, sent }. */
async function pulseNamespace(ns: string, now: number): Promise<{ dispatch: string | null; sent: number }> {
  const evKey = `spine:ev:${ns}`;
  const events = pairsToEvents(await redis(['HGETALL', evKey]));
  const { newEvents, dispatch, pushes } = runPulseCore(events, now);

  if (newEvents.length) {
    const cmd: (string | number)[] = ['HSET', evKey];
    for (const e of newEvents) { const id = 'pulse-' + crypto.randomUUID().slice(0, 12); cmd.push(id, JSON.stringify({ id, ...e })); }
    await redis(cmd);
    await redis(['EXPIRE', evKey, TTL]);
  }
  await redis(['SET', `kai:pulse:dispatch:${ns}`, JSON.stringify({ line: dispatch, ts: now })]);
  await redis(['EXPIRE', `kai:pulse:dispatch:${ns}`, TTL]);

  /* §14.2 — SPEAK, within the 3/day hard cap. */
  let sent = 0;
  if (pushReady && pushes.length) {
    let cfg: any = null;
    try { const raw = await redis(['GET', `kai:pulse:cfg:${ns}`]); if (raw) cfg = JSON.parse(raw); } catch { /* ignore */ }
    const sub = cfg?.subscription;
    if (sub) {
      const dateKey = new Date(now).toISOString().slice(0, 10);
      const sentKey = `kai:pulse:sent:${ns}:${dateKey}`;
      const already = Number(await redis(['GET', sentKey])) || 0;
      let budget = Math.max(0, MAX_PUSH_PER_DAY - already);
      for (const p of pushes) {
        if (budget <= 0) break;
        try {
          await webpush.sendNotification(sub, JSON.stringify({ title: p.title, body: p.body, tag: p.tag }));
          await redis(['INCR', sentKey]); await redis(['EXPIRE', sentKey, 60 * 60 * 48]);
          budget--; sent++;
        } catch { /* expired/invalid subscription — skip */ }
      }
    }
  }
  return { dispatch, sent };
}

function send(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any): Promise<void> {
  const method = req.method || 'GET';
  if (method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  if (!REDIS_URL || !REDIS_TOKEN) { send(res, method === 'GET' ? 200 : 503, { ok: true, configured: false, note: 'pulse dormant — no Upstash wired' }); return; }

  /* ── POST register ── */
  if (method === 'POST') {
    const key = String(req.headers['x-kai-sync-key'] || '');
    if (key.length < 16) { send(res, 401, { error: 'no_key' }); return; }
    const ns = await nsFromKey(key);
    let body: any = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    try {
      await redis(['SADD', REG_KEY, ns]);
      await redis(['SET', `kai:pulse:cfg:${ns}`, JSON.stringify({ tz: body.tz || 'Africa/Cairo', subscription: body.subscription || null, watches: Array.isArray(body.watches) ? body.watches.slice(0, 3) : [], ts: Date.now() })]);
      await redis(['EXPIRE', `kai:pulse:cfg:${ns}`, TTL]);
      send(res, 200, { ok: true, registered: true, push: pushReady });
    } catch (e: any) { send(res, 502, { error: 'register_failed', detail: String(e?.message || e).slice(0, 120) }); }
    return;
  }

  /* ── GET cron / health ── */
  if (method === 'GET') {
    const url = new URL(req.url || '/', 'http://x');
    if (url.searchParams.get('health') != null) { send(res, 200, { ok: true, configured: true, push: pushReady }); return; }
    if (CRON_SECRET) {
      const auth = String(req.headers['authorization'] || '');
      if (auth !== `Bearer ${CRON_SECRET}`) { send(res, 401, { error: 'unauthorized' }); return; }
    }
    const now = Date.now();
    try {
      const namespaces: string[] = (await redis(['SMEMBERS', REG_KEY])) || [];
      let dispatched = 0, pushed = 0;
      for (const ns of namespaces) {
        try { const r = await pulseNamespace(ns, now); if (r.dispatch) dispatched++; pushed += r.sent; } catch { /* one ns failing shouldn't abort */ }
      }
      send(res, 200, { ok: true, ran: namespaces.length, dispatched, pushed, push: pushReady, at: now });
    } catch (e: any) { send(res, 502, { error: 'pulse_error', detail: String(e?.message || e).slice(0, 120) }); }
    return;
  }

  send(res, 405, { error: 'method_not_allowed' });
}
