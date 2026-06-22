/* ============================================================
   Shared Gmail client — server-side only.

   Tokens live ONLY in Vercel env vars:
     GOOGLE_CLIENT_ID
     GOOGLE_CLIENT_SECRET
     GOOGLE_REFRESH_TOKEN

   googleapis hits the OAuth token endpoint on demand to mint a
   short-lived access token from the refresh token, so we never
   ship anything sensitive to the browser. Same posture as
   ANTHROPIC_API_KEY on /api/claude.

   Single-user app: one refresh token = Ali's account. If we ever
   onboard a second operator, swap to Vercel KV per-user.
   ============================================================ */

import { google } from 'googleapis';

export function gmailClient() {
  const id     = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    throw new Error('NO_GMAIL_CREDS');
  }
  const oauth = new google.auth.OAuth2(id, secret);
  oauth.setCredentials({ refresh_token: refresh });
  return google.gmail({ version: 'v1', auth: oauth });
}

/* Map node-level errors to a single JSON shape the client can
   safely render. NO env-var values ever leak through. */
export function explain(e: any): { status: number; payload: Record<string, unknown> } {
  const msg = String(e?.message || e || 'unknown');
  if (msg === 'NO_GMAIL_CREDS') {
    return {
      status: 503,
      payload: {
        error: 'no_gmail_creds',
        message: 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Vercel.',
      },
    };
  }
  return { status: 502, payload: { error: 'gmail_error', message: msg.slice(0, 240) } };
}
