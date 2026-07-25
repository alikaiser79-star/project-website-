/* ============================================================
   Shared Gmail client — server-side, EDGE-native.

   Rewritten off `googleapis` (a ~116MB Node dependency that never
   bundled small enough to deploy — the function 404'd and the app
   "fell back to the SPA"). This version speaks the Google OAuth +
   Gmail REST endpoints directly over `fetch`, so it runs on the
   Edge runtime and actually ships. Same secrets, same posture:

     GOOGLE_CLIENT_ID
     GOOGLE_CLIENT_SECRET
     GOOGLE_REFRESH_TOKEN

   live ONLY in Vercel env. We mint a short-lived access token from
   the refresh token per request; nothing sensitive reaches the
   browser. Single-user app: one refresh token = Ali's account.
   ============================================================ */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1';

interface Creds { id: string; secret: string; refresh: string; }

export function gmailCreds(): Creds | null {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return null;
  return { id, secret, refresh };
}

/* Exchange the long-lived refresh token for a short-lived access token
   via the OAuth endpoint. Throws typed errors the dispatcher maps to the
   same JSON contract the client already handles. */
export async function getAccessToken(): Promise<string> {
  const c = gmailCreds();
  if (!c) throw new Error('NO_GMAIL_CREDS');

  const body = new URLSearchParams({
    client_id: c.id,
    client_secret: c.secret,
    refresh_token: c.refresh,
    grant_type: 'refresh_token',
  });

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) {
    const t = await r.text();
    /* invalid_grant = the refresh token was revoked/expired → auth error. */
    throw new Error('TOKEN_' + r.status + ':' + t.slice(0, 160));
  }
  const d: any = await r.json();
  if (!d?.access_token) throw new Error('TOKEN_NO_ACCESS');
  return d.access_token as string;
}

/* One authenticated call to the Gmail REST API. `path` is everything after
   /gmail/v1 (e.g. "/users/me/messages?q=..."). */
export function gmailApi(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(GMAIL_BASE + path, {
    ...init,
    headers: { authorization: 'Bearer ' + token, ...(init?.headers || {}) },
  });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/* Map a non-OK Gmail REST response to the client contract. 401/403 →
   'gmail_auth' (the watcher keys on 401/403 to report auth trouble). */
export function gmailErr(res: Response, what: string): Response {
  const auth = res.status === 401 || res.status === 403;
  return json(
    { error: auth ? 'gmail_auth' : 'gmail_error', message: `${what} ${res.status}` },
    auth ? 401 : 502,
  );
}

/* Map a thrown error to the same JSON shapes the old googleapis path
   produced. NO secret values ever leak. */
export function explain(e: any): Response {
  const msg = String(e?.message || e || 'unknown');
  if (msg === 'NO_GMAIL_CREDS') {
    return json({
      error: 'no_gmail_creds',
      message: 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Vercel.',
    }, 503);
  }
  if (/^TOKEN_(400|401|403)\b|invalid_grant|invalid_client/i.test(msg)) {
    return json({ error: 'gmail_auth', message: 'Gmail authorization failed — re-authorize the refresh token.' }, 401);
  }
  return json({ error: 'gmail_error', message: msg.slice(0, 240) }, 502);
}
