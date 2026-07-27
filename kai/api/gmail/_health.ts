/* ============================================================
   /api/gmail/health — the end of guessing.

   Two evenings were spent on an invisible failure: the Inbox panel said
   "error" and nothing said WHY. This reports, in one call, everything a
   human needs to tell the difference between a missing env var, a wrong
   env var, a value with a stray newline in it, a refresh token minted
   against the wrong client, and a Google-side scope problem.

   ── WHAT IT WILL AND WILL NOT SAY ─────────────────────────────
   It NEVER returns a secret value. Not truncated, not masked, not
   "first four characters". A masked secret is still a secret leak with
   a smaller blast radius, and this endpoint is unauthenticated.

   What it returns instead is SHAPE:
     • present / missing, and the length
     • whether the value differs from its own trim() — a trailing newline
       pasted into the Vercel dashboard is invisible in the UI and breaks
       the token exchange with a completely unrelated-looking error
     • whether the value matches the documented prefix/suffix for its kind
   Shape is enough to identify every failure of this class and discloses
   nothing that a leaked response could be used with.

   Google's own error codes ARE echoed (error + error_description only,
   truncated). Those are diagnostic strings — "invalid_grant",
   "unauthorized_client" — and carry no credential material.
   ============================================================ */

import { json } from './_client.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface VarReport {
  name: string;
  present: boolean;
  length: number;
  /* A pasted value with a trailing newline or space. Invisible in the
     Vercel UI, fatal at the token endpoint, and the single most common
     cause of "I set it correctly and it still fails". */
  hasSurroundingWhitespace: boolean;
  shapeOk: boolean | null;
  shapeNote: string;
}

function report(name: string, expect?: { suffix?: string; prefix?: string; label: string }): VarReport {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return { name, present: false, length: 0, hasSurroundingWhitespace: false, shapeOk: null, shapeNote: 'not set on this deployment' };
  }
  const trimmed = raw.trim();
  const ws = trimmed !== raw;
  let shapeOk: boolean | null = null;
  let note = 'no shape check for this variable';
  if (expect?.suffix) {
    shapeOk = trimmed.endsWith(expect.suffix);
    note = shapeOk ? `ends with ${expect.suffix} as expected` : `does NOT end with ${expect.suffix} — ${expect.label}`;
  } else if (expect?.prefix) {
    shapeOk = trimmed.startsWith(expect.prefix);
    note = shapeOk ? `starts with ${expect.prefix} as expected` : `does NOT start with ${expect.prefix} — ${expect.label}`;
  }
  return { name, present: true, length: raw.length, hasSurroundingWhitespace: ws, shapeOk, shapeNote: note };
}

export async function health(): Promise<Response> {
  const vars = [
    report('GOOGLE_CLIENT_ID', { suffix: '.apps.googleusercontent.com', label: 'a Google OAuth client ID always ends with this' }),
    report('GOOGLE_CLIENT_SECRET', { prefix: 'GOCSPX-', label: 'current Google client secrets start with GOCSPX-' }),
    report('GOOGLE_REFRESH_TOKEN', { prefix: '1//', label: 'Google refresh tokens start with 1//' }),
  ];

  const missing = vars.filter((v) => !v.present).map((v) => v.name);
  const whitespace = vars.filter((v) => v.hasSurroundingWhitespace).map((v) => v.name);
  const badShape = vars.filter((v) => v.shapeOk === false).map((v) => v.name);

  const deployment = {
    vercelEnv: process.env.VERCEL_ENV ?? '(not set — not running on Vercel?)',
    runtime: 'edge',
    /* Answers "are they set for Production?" directly, rather than by
       inference from whether it works. */
    note: process.env.VERCEL_ENV === 'production'
      ? 'This IS the Production deployment — the values above are the Production ones.'
      : `This is the "${process.env.VERCEL_ENV ?? 'unknown'}" environment. Env vars are scoped per environment in Vercel: setting one for Preview does NOT set it for Production.`,
  };

  /* Stop here if we cannot even attempt the exchange. */
  if (missing.length) {
    return json({
      ok: false, stage: 'env', deployment, vars,
      diagnosis: `Missing on this deployment: ${missing.join(', ')}. Set them in Vercel for the Production environment, then REDEPLOY — env changes do not apply to an existing deployment.`,
    }, 200);
  }

  /* STAGE 2 — the token exchange. This is where invalid_grant lives. */
  let tokenStatus = 0;
  let googleError = '';
  let googleDescription = '';
  let accessOk = false;
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: (process.env.GOOGLE_CLIENT_ID || '').trim(),
        client_secret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
        refresh_token: (process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
        grant_type: 'refresh_token',
      }),
    });
    tokenStatus = r.status;
    const body: any = await r.json().catch(() => ({}));
    googleError = String(body?.error || '').slice(0, 80);
    googleDescription = String(body?.error_description || '').slice(0, 200);
    accessOk = !!body?.access_token;

    if (accessOk) {
      /* STAGE 3 — a real, minimal Gmail call. Proves the SCOPES too: a
         token can mint fine and still be refused by Gmail. */
      const p = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { authorization: 'Bearer ' + body.access_token },
      });
      const profile: any = await p.json().catch(() => ({}));
      return json({
        ok: p.ok, stage: 'gmail', deployment, vars,
        token: { status: tokenStatus, minted: true },
        gmail: {
          status: p.status,
          /* The address confirms WHICH account the token belongs to — the
             thing you cannot see from the Vercel dashboard. */
          emailAddress: p.ok ? profile?.emailAddress : undefined,
          messagesTotal: p.ok ? profile?.messagesTotal : undefined,
          error: p.ok ? undefined : String(profile?.error?.message || '').slice(0, 200),
        },
        diagnosis: p.ok
          ? `Working. Token mints and Gmail answers for ${profile?.emailAddress}. If the Inbox panel still errors, the fault is client-side, not here.`
          : `The token mints, but Gmail refused the call (${p.status}). That is a SCOPE or account problem, not a credentials problem — the refresh token is probably missing gmail.readonly, or belongs to a different account than the mailbox you expect.`,
      }, 200);
    }
  } catch (e: any) {
    return json({
      ok: false, stage: 'network', deployment, vars,
      diagnosis: `Could not reach Google at all: ${String(e?.message || e).slice(0, 160)}`,
    }, 200);
  }

  /* Token exchange failed — name the specific cause. */
  const known: Record<string, string> = {
    invalid_grant:
      'The refresh token is not valid for this client. Most common cause: the token was minted in the OAuth Playground WITHOUT ticking "Use your own OAuth credentials", so it belongs to the Playground\'s client, not yours. It can also mean the token was revoked, expired (unused 6 months), or the app is still in Testing mode where refresh tokens expire after 7 days.',
    invalid_client:
      'The client ID or client secret is wrong, or they are from different OAuth clients. Re-copy BOTH from the same credential in Google Cloud Console.',
    unauthorized_client:
      'This client is not authorised for the refresh_token grant — usually the refresh token was issued to a different client ID than the one set here.',
    invalid_scope: 'The requested scopes are not granted on this token. Re-mint with gmail.readonly and gmail.send.',
  };

  return json({
    ok: false, stage: 'token', deployment, vars,
    token: { status: tokenStatus, minted: false, error: googleError, description: googleDescription },
    diagnosis: known[googleError]
      || `Google refused the token exchange with "${googleError || 'no error code'}" (HTTP ${tokenStatus}). ${googleDescription}`,
    checkAlso: [
      ...(whitespace.length ? [`These values have leading/trailing whitespace, which breaks the exchange and is invisible in the Vercel UI: ${whitespace.join(', ')}. Re-paste them without the trailing newline.`] : []),
      ...(badShape.length ? [`These do not look like the right kind of value: ${badShape.map((n) => `${n} (${vars.find((v) => v.name === n)?.shapeNote})`).join('; ')}`] : []),
      'Env var changes require a REDEPLOY to take effect on an existing deployment.',
    ],
  }, 200);
}
