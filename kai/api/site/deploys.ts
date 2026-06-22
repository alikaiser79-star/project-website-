/* ============================================================
   GET /api/site/deploys

   Read-only: for every site in KAI_SITES, fetch its 3 most-recent
   Vercel deployments. Returns owner/repo/branch + per-deploy
   state (READY / BUILDING / ERROR / QUEUED / CANCELED), URL,
   createdAt.

   Safe to poll freely. No tokens leak — owner/repo are pulled
   from KAI_SITES (public-ish), deployment state is from Vercel
   API with the server-side VERCEL_TOKEN.
   ============================================================ */

import { loadSites, vcGet, explainSite } from './_client.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const sites = loadSites();
  if (sites.length === 0) {
    const { status, payload } = explainSite(new Error('no_sites'));
    return res.status(status).json(payload);
  }

  try {
    /* Fetch all sites in parallel; tolerate per-site failure so
       one broken project doesn't black out the whole panel. */
    const results = await Promise.all(sites.map(async (s) => {
      try {
        const data = await vcGet<any>(`/v6/deployments?projectId=${encodeURIComponent(s.vercelProjectId)}&limit=3`);
        const deploys = Array.isArray(data?.deployments) ? data.deployments : [];
        return {
          key: s.key, label: s.label,
          owner: s.owner, repo: s.repo, branch: s.branch,
          deployHook: !!s.deployHook,
          deploys: deploys.map((d: any) => ({
            uid:        String(d?.uid || d?.id || ''),
            state:      String(d?.state || d?.readyState || 'UNKNOWN'),
            url:        d?.url ? `https://${d.url}` : null,
            createdAt:  Number(d?.created || d?.createdAt || 0),
            target:     String(d?.target || 'production'),
            commit:     d?.meta?.githubCommitSha ? String(d.meta.githubCommitSha).slice(0, 7) : null,
            message:    d?.meta?.githubCommitMessage
                          ? String(d.meta.githubCommitMessage).split('\n')[0].slice(0, 140)
                          : null,
          })),
        };
      } catch (e: any) {
        return {
          key: s.key, label: s.label, owner: s.owner, repo: s.repo, branch: s.branch,
          deployHook: !!s.deployHook, deploys: [],
          error: String(e?.message || e || 'unknown').slice(0, 200),
        };
      }
    }));

    return res.status(200).json({ sites: results });
  } catch (e: any) {
    const { status, payload } = explainSite(e);
    return res.status(status).json(payload);
  }
}
