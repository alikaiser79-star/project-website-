/* ============================================================
   GET /api/ig/health

   Per-account token health for IgFeedPanel + the read_ig_health
   tool. Never returns the token itself — only validity, type
   (USER vs PAGE), days-until-expiry, scopes, and a status
   classification:

     ok          — works, doesn't expire (Page token) or > 14d left
     expiring    — works, < 14 days until expiry
     near_expiry — works, < 7 days
     broken      — Graph API rejected the token
     unknown     — basic call succeeded but debug_token unavailable

   Uses Meta's /debug_token when FB_APP_ID + FB_APP_SECRET are
   configured, otherwise falls back to a basic /me check.
   ============================================================ */

import { loadIgAccounts, tokenFor, explainIg, type IgAccount } from './_client.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

interface Health {
  key: string;
  label: string;
  handle: string;
  status: 'ok' | 'expiring' | 'near_expiry' | 'broken' | 'unknown';
  token_type: 'USER' | 'PAGE' | null;
  expires_at: string | null;          // ISO, or 'never', or null when unknown
  expires_in_days: number | null;     // null = never expires OR unknown
  scopes: string[] | null;
  message: string;
  user_id?: string | null;
  app_id?: string | null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const accounts = loadIgAccounts();
  if (accounts.length === 0) {
    const { status, payload } = explainIg(new Error('no_ig_accounts'));
    return res.status(status).json(payload);
  }

  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const canDebug = !!(appId && appSecret);

  const results: Health[] = await Promise.all(accounts.map(a => checkOne(a, canDebug, appId, appSecret)));

  return res.status(200).json({
    debug_supported: canDebug,
    debug_note: canDebug
      ? null
      : 'Set FB_APP_ID and FB_APP_SECRET in Vercel env to get full token-debug detail (expiry date, scopes, type).',
    accounts: results,
  });
}

async function checkOne(
  a: IgAccount, canDebug: boolean, appId?: string, appSecret?: string,
): Promise<Health> {
  /* Read the token without leaking it past this function. */
  let token: string;
  try {
    token = tokenFor(a);
  } catch {
    return {
      key: a.key, label: a.label, handle: a.handle,
      status: 'broken', token_type: null,
      expires_at: null, expires_in_days: null, scopes: null,
      message: 'No access token configured for this account.',
    };
  }

  /* 1) Basic liveness — hit /{ig-user-id}?fields=id. Returns
     a clean broken vs working answer without needing debug_token. */
  let basicOk = false;
  let basicErr: string | null = null;
  try {
    const url = new URL(`${GRAPH}/${a.igUserId}`);
    url.searchParams.set('fields', 'id');
    url.searchParams.set('access_token', token);
    const r = await fetch(url.toString());
    if (r.ok) basicOk = true;
    else {
      const data = await r.json().catch(() => ({}));
      basicErr = data?.error?.message || `ig ${r.status}`;
    }
  } catch (e: any) {
    basicErr = String(e?.message || 'unreachable').slice(0, 200);
  }

  if (!basicOk) {
    return {
      key: a.key, label: a.label, handle: a.handle,
      status: 'broken', token_type: null,
      expires_at: null, expires_in_days: null, scopes: null,
      message: basicErr || 'Token rejected by Graph API.',
    };
  }

  /* 2) Full debug if app creds are set. */
  if (!canDebug) {
    return {
      key: a.key, label: a.label, handle: a.handle,
      status: 'unknown', token_type: null,
      expires_at: null, expires_in_days: null, scopes: null,
      message: 'Token works. Set FB_APP_ID + FB_APP_SECRET for full debug.',
    };
  }

  try {
    const url = new URL(`${GRAPH}/debug_token`);
    url.searchParams.set('input_token', token);
    url.searchParams.set('access_token', `${appId}|${appSecret}`);
    const r = await fetch(url.toString());
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return {
        key: a.key, label: a.label, handle: a.handle,
        status: 'unknown', token_type: null,
        expires_at: null, expires_in_days: null, scopes: null,
        message: 'Token works but debug_token failed: ' + (data?.error?.message || `ig ${r.status}`),
      };
    }
    const d = data?.data || {};
    const expiresAtSec = Number(d?.expires_at || 0);
    const neverExpires = expiresAtSec === 0;
    const days = neverExpires ? null : Math.round((expiresAtSec * 1000 - Date.now()) / 86_400_000);

    let status: Health['status'] = 'ok';
    let message = neverExpires
      ? 'Non-expiring Page token. Healthy.'
      : `Expires in ${days} days.`;
    if (!neverExpires && days !== null) {
      if (days < 7)  { status = 'near_expiry'; message = `Expires in ${days} days — refresh now.`; }
      else if (days < 14) { status = 'expiring';   message = `Expires in ${days} days — refresh soon.`; }
    }

    return {
      key: a.key, label: a.label, handle: a.handle,
      status,
      token_type: d?.type === 'PAGE' ? 'PAGE' : d?.type === 'USER' ? 'USER' : null,
      expires_at: neverExpires ? 'never' : new Date(expiresAtSec * 1000).toISOString(),
      expires_in_days: days,
      scopes: Array.isArray(d?.scopes) ? d.scopes : null,
      user_id: d?.user_id || null,
      app_id:  d?.app_id  || null,
      message,
    };
  } catch (e: any) {
    return {
      key: a.key, label: a.label, handle: a.handle,
      status: 'unknown', token_type: null,
      expires_at: null, expires_in_days: null, scopes: null,
      message: 'debug_token unreachable: ' + String(e?.message || e || 'unknown').slice(0, 200),
    };
  }
}
