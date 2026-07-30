/* ============================================================
   THE GATE ON THE SERVER — one shared caller check.

   Before this, /api/site/commit and /api/site/deploy would take a
   request from anyone on the internet and write to Ali's GitHub with a
   read+write PAT, and /api/claude would spend his Anthropic balance for
   whoever asked. Neither checked anything at all.

   ── WHAT THIS IS, AND THE ONE THING IT IS NOT ─────────────────
   It is a shared secret in a header. That stops an unauthenticated
   caller — a scan, a leaked URL, anyone who did not get the secret from
   Ali. It is NOT a login and it never becomes one: there are no users
   here, no sessions, and nothing on the server knows who is holding the
   string.

   Critically, the secret MUST NOT be baked into the front-end bundle.
   A Vite `VITE_*` value ships to every visitor in plain text, so a
   "secret" set that way is a public constant with a scary name. This
   one is pasted into Settings once per device and lives in that
   device's localStorage — the bundle never carries it, so reading the
   JavaScript gets an attacker nothing.

   ── IT FAILS CLOSED, INCLUDING WHEN UNCONFIGURED ──────────────
   If KAI_API_SECRET is not set in the environment, every guarded route
   answers 503 and says exactly what to set. That is deliberate and it
   is the whole point: a security control that quietly does nothing
   when misconfigured is worse than no control, because it converts a
   known hole into a hole everybody believes is closed.

   The cost of that choice is real and is stated here so nobody is
   surprised: deploying this WITHOUT setting KAI_API_SECRET takes Gmail,
   Instagram, Claude, the agent, the calendar and site deploys offline
   until the variable exists. The 503 body says so in words.
   ============================================================ */

export const KEY_HEADER = 'x-kai-key';

/* Compares in constant time with respect to content. Length still
   leaks, which is acceptable for a fixed-length shared secret and is
   noted rather than hidden. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function secret(): string | null {
  const s = process.env.KAI_API_SECRET;
  return s && s.trim().length >= 16 ? s.trim() : null;
}

const UNCONFIGURED = {
  error: 'not_configured',
  message:
    'KAI_API_SECRET is not set on the server, so this route refuses every caller. ' +
    'Set it in the Vercel project environment (Production) to a random string of at least 16 characters, redeploy, ' +
    'then paste the same string into KAI under Settings so this device can send it. ' +
    'It fails closed on purpose — an unset secret must never read as "no protection needed".',
};

const DENIED = {
  error: 'unauthorized',
  message:
    'Missing or wrong ' + KEY_HEADER + '. If this is your own device, paste your KAI_API_SECRET into Settings.',
};

/* ── CORS ────────────────────────────────────────────────────
   Echo the caller's origin only when it is this same deployment.
   The old header was a flat `*`, which invited any website in a
   logged-in browser to call these routes directly. There is no
   hardcoded domain here because the production hostname is not
   knowable from inside the repo — the request's own Host is. */
export function corsFor(req: { headers: any }, methods = 'GET,POST,OPTIONS'): Record<string, string> {
  const get = (k: string): string =>
    (typeof req.headers?.get === 'function' ? req.headers.get(k) : req.headers?.[k]) || '';
  const origin = get('origin');
  const host = get('host');

  let allow = '';
  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host === host || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(o.host)) allow = origin;
    } catch { /* malformed Origin — allow nothing */ }
  }

  const h: Record<string, string> = {
    'access-control-allow-methods': methods,
    'access-control-allow-headers': `content-type,${KEY_HEADER},x-kai-sync-key`,
    'access-control-max-age': '600',
    vary: 'Origin',
  };
  if (allow) h['access-control-allow-origin'] = allow;
  return h;
}

/* ── EDGE (Request → Response|null) ──────────────────────────
   Returns a Response to send, or null when the caller may proceed. */
export function guardEdge(req: Request): Response | null {
  const cors = corsFor(req as any);
  const j = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors },
    });

  /* Preflight carries no custom headers by design — it is the browser
     ASKING whether the header is allowed. Blocking it would block the
     very request that is about to authenticate. */
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const want = secret();
  if (!want) return j(UNCONFIGURED, 503);

  const got = req.headers.get(KEY_HEADER) || '';
  if (!got || !sameSecret(got, want)) return j(DENIED, 401);
  return null;
}

/* ── NODE (req, res → boolean) ───────────────────────────────
   Returns true when the caller may proceed. When false, a response
   has already been written. */
export function guardNode(req: any, res: any): boolean {
  const cors = corsFor(req);
  for (const [k, v] of Object.entries(cors)) { try { res.setHeader(k, v); } catch { /* ignore */ } }

  if (req.method === 'OPTIONS') { res.status(204).end(); return false; }

  const want = secret();
  if (!want) { res.status(503).json(UNCONFIGURED); return false; }

  const raw = req.headers?.[KEY_HEADER] ?? req.headers?.[KEY_HEADER.toUpperCase()];
  const got = Array.isArray(raw) ? raw[0] : (raw || '');
  if (!got || !sameSecret(String(got), want)) { res.status(401).json(DENIED); return false; }
  return true;
}

/* ── RATE LIMIT ──────────────────────────────────────────────
   Only the two routes that spend money need this. Upstash when it is
   configured; otherwise a per-instance counter, which is weak across
   Edge instances and SAYS SO rather than implying a guarantee it
   cannot make. */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const local = new Map<string, { n: number; resetAt: number }>();

export interface Limit { ok: boolean; used: number; max: number; resetInSec: number; exact: boolean }

export async function rateLimit(bucket: string, max: number, windowSec: number): Promise<Limit> {
  const slot = Math.floor(Date.now() / (windowSec * 1000));
  const key = `kai:rl:${bucket}:${slot}`;
  const resetInSec = windowSec - Math.floor((Date.now() / 1000) % windowSec);

  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const call = async (cmd: (string | number)[]) => {
        const r = await fetch(REDIS_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${REDIS_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify(cmd),
        });
        if (!r.ok) throw new Error('redis ' + r.status);
        return (await r.json())?.result;
      };
      const n = Number(await call(['INCR', key])) || 0;
      if (n === 1) await call(['EXPIRE', key, windowSec + 5]);
      return { ok: n <= max, used: n, max, resetInSec, exact: true };
    } catch {
      /* fall through to the local counter rather than failing the
         request — a rate limiter that 500s is a denial of service. */
    }
  }

  const cur = local.get(key);
  const n = (cur?.n ?? 0) + 1;
  local.set(key, { n, resetAt: Date.now() + windowSec * 1000 });
  if (local.size > 500) for (const [k, v] of local) if (v.resetAt < Date.now()) local.delete(k);
  return { ok: n <= max, used: n, max, resetInSec, exact: false };
}

export function limitBody(l: Limit) {
  return {
    error: 'rate_limited',
    message:
      `${l.used} calls in this window; the cap is ${l.max}. Try again in ${l.resetInSec}s.` +
      (l.exact ? '' : ' (Counted per server instance because Upstash is not configured, so the real cap may be higher.)'),
  };
}
