/* ============================================================
   GET /api/ig/derive-token

   One-time setup helper. Pass a long-lived USER access token,
   the route calls /me/accounts to enumerate the Facebook Pages
   tied to that user, pulls each Page's NON-EXPIRING Page access
   token + the linked Instagram Business Account id and username,
   and returns a KAI_IG_ACCOUNTS-ready JSON array.

   PAGE TOKEN LIFECYCLE
   Per Meta docs (Graph API v21.0): a Page access token derived
   from a long-lived USER token does not have an expiration date
   — it only stops working if the user revokes the grant, changes
   their password, or 90 days pass without using it for an API
   call. So if KAI is hitting IG every day for reads, the token
   keeps working indefinitely.

   SECURITY
   This endpoint emits the actual page tokens in its response.
   It is GATED by a one-shot shared secret in the
   `KAI_SETUP_SECRET` env var. Workflow:
     1. Set KAI_SETUP_SECRET to a random string in Vercel env.
     2. Set FB_LONG_LIVED_USER_TOKEN to your long-lived user token.
     3. curl -H "x-kai-setup-secret: <secret>" https://kai/api/ig/derive-token
     4. Copy `ready_to_paste` into KAI_IG_ACCOUNTS.
     5. UNSET KAI_SETUP_SECRET and FB_LONG_LIVED_USER_TOKEN.
     6. Redeploy.
   ============================================================ */

const GRAPH = 'https://graph.facebook.com/v21.0';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const setupSecret = process.env.KAI_SETUP_SECRET;
  if (!setupSecret) {
    return res.status(503).json({
      error: 'no_setup_secret',
      message: 'Set KAI_SETUP_SECRET in Vercel env to enable this one-time helper. Remove it after setup.',
    });
  }
  const provided =
    req.headers?.['x-kai-setup-secret'] ||
    req.headers?.['X-Kai-Setup-Secret'] ||
    '';
  if (String(provided) !== setupSecret) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing or wrong x-kai-setup-secret header.' });
  }

  const url = new URL(req.url || '', 'http://x');
  const userToken =
    url.searchParams.get('token') ||
    process.env.FB_LONG_LIVED_USER_TOKEN ||
    '';
  if (!userToken) {
    return res.status(400).json({
      error: 'no_user_token',
      message: 'Pass ?token=<long-lived user access token>, or set FB_LONG_LIVED_USER_TOKEN.',
    });
  }

  try {
    /* 1) Inspect the user token shape — informational. Best effort;
       skip silently if FB_APP_* aren't set. */
    let userTokenInfo: any = null;
    if (process.env.FB_APP_ID && process.env.FB_APP_SECRET) {
      try {
        const debugUrl = new URL(GRAPH + '/debug_token');
        debugUrl.searchParams.set('input_token', userToken);
        debugUrl.searchParams.set('access_token', `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`);
        const debug = await fetch(debugUrl.toString()).then(r => r.json());
        const d = debug?.data;
        userTokenInfo = d ? {
          type:      d.type || null,
          app_id:    d.app_id || null,
          user_id:   d.user_id || null,
          expires_at: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : 'never',
          expires_in_days: d.expires_at ? Math.round((d.expires_at * 1000 - Date.now()) / 86_400_000) : null,
          scopes:    d.scopes || [],
          is_valid:  d.is_valid !== false,
        } : null;
      } catch { /* tolerate */ }
    }

    /* 2) Enumerate pages + page tokens + linked IG business accounts. */
    const pagesUrl = new URL(GRAPH + '/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username,name}');
    pagesUrl.searchParams.set('access_token', userToken);

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok) {
      return res.status(502).json({
        error: 'pages_fetch_failed',
        message: pagesData?.error?.message || `graph ${pagesRes.status}`,
      });
    }

    const allPages = Array.isArray(pagesData?.data) ? pagesData.data : [];
    const igPages = allPages.filter((p: any) => p?.instagram_business_account);

    const readyEntries = igPages.map((p: any) => {
      const ig = p.instagram_business_account;
      const username = ig?.username || '';
      const handle = username ? '@' + username : (p?.name || '');
      const key = (username || p?.name || '')
        .toString().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || ('acct_' + (p?.id || ''));
      return {
        key,
        label: handle || key,
        handle,
        igUserId: String(ig.id),
        accessToken: String(p.access_token),
      };
    });

    return res.status(200).json({
      user_token: userTokenInfo,
      pages: igPages.map((p: any) => ({
        page_id: String(p.id),
        page_name: String(p.name || ''),
        instagram_business_account_id: String(p.instagram_business_account.id),
        instagram_username: p.instagram_business_account.username || null,
        /* Page tokens are emitted for setup ONLY. Treat the response
           like a one-time secret dump. */
        page_access_token_preview: maskToken(p.access_token),
      })),
      total_pages: allPages.length,
      ig_pages: igPages.length,
      ready_to_paste: JSON.stringify(readyEntries),
      next_steps: [
        '1. Set KAI_IG_ACCOUNTS = the ready_to_paste JSON in Vercel env.',
        '2. Unset KAI_SETUP_SECRET and FB_LONG_LIVED_USER_TOKEN.',
        '3. Redeploy. The IG panel should turn green.',
        '4. (Optional) Set FB_APP_ID + FB_APP_SECRET so /api/ig/health can show token-debug detail.',
      ],
      note: 'Page tokens derived this way do not expire as long as the user does not revoke or change password. Re-run this helper if a token ever stops working.',
    });
  } catch (e: any) {
    return res.status(502).json({
      error: 'derive_failed',
      message: String(e?.message || e || 'unknown').slice(0, 240),
    });
  }
}

function maskToken(t: string): string {
  if (!t) return '';
  if (t.length <= 12) return '***';
  return t.slice(0, 6) + '…' + t.slice(-4);
}
