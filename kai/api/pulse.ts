/* ============================================================
   /api/pulse — DER SCHATTEN heartbeat + THE VOICE (§14.1/§14.2).
   EDGE runtime (function #8) — same proven runtime as every other KAI
   function. §14.2 send is done Edge-native with WebCrypto (see
   _webpush.ts), so no Node-only dependency is needed.

   A daily Vercel cron (vercel.json, 07:30 Cairo) runs the PURE pulse
   core against each registered operator's synced Spine (Upstash), writes
   results back as Spine events, stores the day's dispatch, and SPEAKS:
   up to 3 push notifications/day (morning dispatch + true-alarm
   interrupts). Silence is valid.

   Env: KV_REST_API_* (Upstash), CRON_SECRET (gates the cron),
   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (push). No
   Upstash → dormant + 503. No VAPID → compute + store still run; push
   is skipped and the state reaches devices via §8 sync + Night Ledger.
   ============================================================ */

import { runPulsePhase, type PulseEvent, type PulsePhase } from './_pulse-core';
import { sendPush, type Vapid, type PushSubscription } from './_webpush';

export const config = { runtime: 'edge' };

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;
const VAPID: Vapid | null = (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject: process.env.VAPID_SUBJECT || 'mailto:ali@kai.local' }
  : null;
const TTL = 60 * 60 * 24 * 180;
const REG_KEY = 'kai:pulse:reg';
const MAX_PUSH_PER_DAY = 3;

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

/* ── §25.3 the Council's nightly synthesis ─────────────────────
   ONE call, over a compact digest of the whole synced Spine, asked for the
   cross-domain pattern a single engine cannot see (e.g. "spending rises the
   week after a booking lands"). Returns one sentence or null. Never invents:
   the prompt forbids any claim the digest doesn't support, and a night with
   no real pattern is expected to return NONE. */
async function synthesise(events: PulseEvent[], now: number): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || events.length < 25) return null;                 // too thin to see a pattern

  /* already synthesised tonight? */
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (events.some((e) => e.domain === 'system' && e.type === 'insight' && e.meta?.source === 'council' && e.ts >= start.getTime())) return null;

  /* compact digest: per-domain counts + the money/commitment timeline. */
  const DAYMS = 86_400_000;
  const recent = events.filter((e) => e.ts >= now - 60 * DAYMS);
  const byDomain: Record<string, number> = {};
  for (const e of recent) byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
  const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const timeline = recent
    .filter((e) => ['expense', 'income', 'makadi', 'debt', 'money', 'commitment', 'content', 'garden', 'hunter'].includes(e.domain))
    .slice(-90)
    .map((e) => `${day(e.ts)} ${e.domain}.${e.type}${typeof e.value === 'number' ? ' ' + Math.round(e.value) : ''}${e.ccy ? ' ' + e.ccy : ''}`)
    .join('\n');

  const prompt =
    `You are DER RAT — the council of KAI's engines, meeting at 02:00 over Ali Kaiser's own event log.\n` +
    `Find ONE pattern ACROSS domains that no single engine could see on its own — a relationship ` +
    `between money, bookings, commitments, content or time. Examples of the SHAPE (not the content): ` +
    `"spending rises the week after a booking lands", "you post content only in the days after income arrives".\n\n` +
    `HARD RULES: use ONLY what the log below supports; cite the real direction and rough magnitude; ` +
    `if there is no honest cross-domain pattern, reply exactly NONE. One sentence, max 24 words, ` +
    `plain and specific. No preamble.\n\n` +
    `DOMAIN COUNTS (60d): ${Object.entries(byDomain).map(([d, n]) => `${d}:${n}`).join(' ')}\n\n` +
    `TIMELINE:\n${timeline}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) return null;
  const d: any = await r.json();
  const text = String(d?.content?.[0]?.text || '').trim();
  if (!text || /^none\b/i.test(text)) return null;
  return text.slice(0, 240);
}

async function pulseNamespace(ns: string, now: number, phase: PulsePhase): Promise<{ dispatch: string | null; sent: number }> {
  const evKey = `spine:ev:${ns}`;
  const events = pairsToEvents(await redis(['HGETALL', evKey]));
  const { newEvents, dispatch, pushes } = runPulsePhase(events, now, phase);

  /* §25.3 THE NIGHTLY SYNTHESIS — at 02:00 the Council reads the WHOLE
     shared context in one Claude call and writes what no single module can
     see: the pattern ACROSS domains. Stored as a council insight, which
     bestLine() then prefers for the morning. Deduped per night; a failure is
     silent (the deterministic dream insights already ran). */
  if (phase === 'dream') {
    try {
      const line = await synthesise(events, now);
      if (line) newEvents.push({ ts: now, domain: 'system', type: 'insight', meta: { text: line, source: 'council', phase: 'dream' }, source: 'ai' } as any);
    } catch { /* synthesis is best-effort */ }
  }

  if (newEvents.length) {
    const cmd: (string | number)[] = ['HSET', evKey];
    for (const e of newEvents) { const id = 'pulse-' + crypto.randomUUID().slice(0, 12); cmd.push(id, JSON.stringify({ id, ...e })); }
    await redis(cmd);
    await redis(['EXPIRE', evKey, TTL]);
  }
  /* Only the SPEAK phase owns the stored morning line — other phases must
     not blank it with their own null dispatch. */
  if (phase === 'speak') {
    await redis(['SET', `kai:pulse:dispatch:${ns}`, JSON.stringify({ line: dispatch, ts: now })]);
    await redis(['EXPIRE', `kai:pulse:dispatch:${ns}`, TTL]);
  }

  /* §14.2 — SPEAK, within the 3/day hard cap. */
  let sent = 0;
  if (VAPID && pushes.length) {
    let sub: PushSubscription | null = null;
    try { const raw = await redis(['GET', `kai:pulse:cfg:${ns}`]); if (raw) sub = JSON.parse(raw).subscription || null; } catch { /* ignore */ }
    if (sub && sub.endpoint) {
      const dateKey = new Date(now).toISOString().slice(0, 10);
      const sentKey = `kai:pulse:sent:${ns}:${dateKey}`;
      const already = Number(await redis(['GET', sentKey])) || 0;
      let budget = Math.max(0, MAX_PUSH_PER_DAY - already);
      for (const p of pushes) {
        if (budget <= 0) break;
        try {
          const status = await sendPush(sub, JSON.stringify({ title: p.title, body: p.body, tag: p.tag }), VAPID, now);
          if (status >= 200 && status < 300) { await redis(['INCR', sentKey]); await redis(['EXPIRE', sentKey, 60 * 60 * 48]); budget--; sent++; }
        } catch { /* transient send failure — skip */ }
      }
    }
  }
  return { dispatch, sent };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-kai-sync-key', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return j({ ok: true, configured: false, note: 'pulse dormant — no Upstash wired' }, req.method === 'GET' ? 200 : 503);
  }

  /* ── POST register / test ── */
  if (req.method === 'POST') {
    const key = req.headers.get('x-kai-sync-key') || '';
    if (key.length < 16) return j({ error: 'no_key' }, 401);
    const ns = await nsFromKey(key);
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }

    /* §14.2 — one-tap test push: send an immediate notification to the
       registered subscription so the operator can VERIFY delivery on
       device (bypasses the daily cap; it's a manual check). */
    if (body?.action === 'test') {
      if (!VAPID) return j({ ok: false, reason: 'no_vapid' });
      let sub: PushSubscription | null = null;
      try { const raw = await redis(['GET', `kai:pulse:cfg:${ns}`]); if (raw) sub = JSON.parse(raw).subscription || null; } catch { /* ignore */ }
      if (!sub || !sub.endpoint) return j({ ok: false, reason: 'no_subscription' });
      try {
        const status = await sendPush(sub, JSON.stringify({ title: 'KAI', body: 'Test dispatch — Der Schatten can reach you. ✅', tag: 'test' }), VAPID);
        return j({ ok: status >= 200 && status < 300, status });
      } catch (e: any) { return j({ ok: false, reason: 'send_failed', detail: String(e?.message || e).slice(0, 120) }); }
    }

    /* §14.3 — immediate custom push. The client fires this the instant a
       real event worth a push lands (the first Makadi booking). Bypasses the
       daily cap — a confirmed booking is always worth one. Content is clamped
       and only reaches THIS namespace's own subscription (sync-key gated). */
    if (body?.action === 'push') {
      if (!VAPID) return j({ ok: false, reason: 'no_vapid' });
      let sub: PushSubscription | null = null;
      try { const raw = await redis(['GET', `kai:pulse:cfg:${ns}`]); if (raw) sub = JSON.parse(raw).subscription || null; } catch { /* ignore */ }
      if (!sub || !sub.endpoint) return j({ ok: false, reason: 'no_subscription' });
      const title = String(body.title || 'KAI').slice(0, 80);
      const text = String(body.body || '').slice(0, 180);
      const tag = String(body.tag || 'kai').slice(0, 60);
      try {
        const status = await sendPush(sub, JSON.stringify({ title, body: text, tag }), VAPID);
        return j({ ok: status >= 200 && status < 300, status });
      } catch (e: any) { return j({ ok: false, reason: 'send_failed', detail: String(e?.message || e).slice(0, 120) }); }
    }

    try {
      await redis(['SADD', REG_KEY, ns]);
      await redis(['SET', `kai:pulse:cfg:${ns}`, JSON.stringify({ tz: body?.tz || 'Africa/Cairo', subscription: body?.subscription || null, watches: Array.isArray(body?.watches) ? body.watches.slice(0, 3) : [], ts: Date.now() })]);
      await redis(['EXPIRE', `kai:pulse:cfg:${ns}`, TTL]);
      return j({ ok: true, registered: true, push: !!VAPID });
    } catch (e: any) { return j({ error: 'register_failed', detail: String(e?.message || e).slice(0, 120) }, 502); }
  }

  /* ── GET cron / health ── */
  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('health') != null) return j({ ok: true, configured: true, push: !!VAPID });
    if (CRON_SECRET) {
      const auth = req.headers.get('authorization') || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return j({ error: 'unauthorized' }, 401);
    }
    /* §23.1 — which circadian phase this firing is. The cron URL carries it
       (?phase=wake|speak|midday|evening|dream); default 'speak' keeps the
       legacy single-cron behaviour. */
    const PHASES: PulsePhase[] = ['wake', 'speak', 'midday', 'evening', 'dream'];
    const raw = url.searchParams.get('phase') || 'speak';
    const phase: PulsePhase = (PHASES as string[]).includes(raw) ? (raw as PulsePhase) : 'speak';
    const now = Date.now();
    try {
      const namespaces: string[] = (await redis(['SMEMBERS', REG_KEY])) || [];
      let dispatched = 0, pushed = 0;
      for (const ns of namespaces) {
        try { const r = await pulseNamespace(ns, now, phase); if (r.dispatch) dispatched++; pushed += r.sent; } catch { /* one ns failing shouldn't abort */ }
      }
      return j({ ok: true, phase, ran: namespaces.length, dispatched, pushed, push: !!VAPID, at: now });
    } catch (e: any) {
      return j({ error: 'pulse_error', detail: String(e?.message || e).slice(0, 120) }, 502);
    }
  }

  return j({ error: 'method_not_allowed' }, 405);
}
