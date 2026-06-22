/* ============================================================
   POST /api/site/deploy

   Write side. Triggers a Vercel redeploy of a site WITHOUT a
   commit (cache bust, env-var change, manual redeploy). Used
   sparingly — a commit through /api/site/commit auto-deploys
   via Vercel's Git integration, so this is for redeploys only.

   Strategy:
     1. If the site config has a `deployHook` URL, POST it.
     2. Otherwise — surface that no hook is configured. Vercel
        does NOT expose a "redeploy this project" REST endpoint
        without specifying a deployment to redeploy; a fresh
        commit is the supported path.

   Body:
     { repo: "<site key>", reason?: "<short>" }
   ============================================================ */

import { findSite, loadSites, explainSite } from './_client.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (loadSites().length === 0) {
    const { status, payload } = explainSite(new Error('no_sites'));
    return res.status(status).json(payload);
  }

  const body: any = req.body || {};
  const siteKey = String(body.repo || body.siteKey || '').trim();
  const site = findSite(siteKey);
  if (!site) {
    const { status, payload } = explainSite(new Error('unknown_site'));
    return res.status(status).json({ ...payload, site_key: siteKey });
  }

  const reason = String(body.reason || '').slice(0, 240);

  if (!site.deployHook) {
    return res.status(503).json({
      error: 'no_deploy_hook',
      message: `Site "${site.key}" has no deployHook in KAI_SITES. Add one from Vercel → Project → Settings → Git → Deploy Hooks, or commit a change to auto-deploy.`,
    });
  }

  if (!/^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\//.test(site.deployHook)) {
    return res.status(502).json({
      error: 'bad_hook',
      message: `Site "${site.key}" deployHook does not look like a Vercel deploy-hook URL.`,
    });
  }

  try {
    const r = await fetch(site.deployHook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const text = await r.text();
    if (!r.ok) {
      return res.status(502).json({
        error: 'deploy_failed',
        message: `vercel ${r.status} · ${text.slice(0, 200)}`,
      });
    }
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 240) }; }
    return res.status(200).json({
      ok: true,
      repo: site.key,
      job: data?.job?.id || data?.id || null,
      reason: reason || null,
    });
  } catch (e: any) {
    return res.status(502).json({
      error: 'deploy_unreachable',
      message: String(e?.message || e || 'unknown').slice(0, 240),
    });
  }
}
