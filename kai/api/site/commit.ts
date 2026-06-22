/* ============================================================
   POST /api/site/commit

   Write side. Only reached by the pending executor AFTER Ali
   approves in ConfirmationGate. The LLM has no tool that hits
   this endpoint directly.

   Body:
     {
       repo:    "<site key from KAI_SITES, e.g. aquagrace>",
       path:    "content/posts/foo.md",
       content: "<full new file utf-8>",
       message: "<commit msg>",
       branch?: "main"     // override
     }

   GitHub Contents API gotcha — to UPDATE an existing file you
   must include its current "sha"; without it the PUT 409s.
   So we GET first, then PUT.
   ============================================================ */

import { findSite, loadSites, ghGet, ghPut, utf8Base64, explainSite } from './_client.js';

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

  const path    = String(body.path    || '').trim().replace(/^\/+/, '');
  const content = String(body.content ?? '');
  const message = String(body.message || `KAI: update ${path}`).slice(0, 240);
  const branch  = String(body.branch  || site.branch);

  if (!path)             return res.status(400).json({ error: 'bad_request', message: 'path required' });
  if (path.length > 240) return res.status(400).json({ error: 'bad_request', message: 'path too long' });
  if (/(^|\/)\.\.(\/|$)/.test(path)) {
    return res.status(400).json({ error: 'bad_path', message: 'path may not contain ".."' });
  }
  if (typeof body.content !== 'string') {
    return res.status(400).json({ error: 'bad_request', message: 'content must be a string' });
  }
  if (content.length > 256 * 1024) {
    return res.status(413).json({ error: 'too_large', message: 'content > 256 KiB' });
  }

  try {
    /* 1) Look up current sha (existing file). 404 → new file. */
    let sha: string | undefined;
    try {
      const cur = await ghGet<any>(
        `/repos/${site.owner}/${site.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`,
      );
      if (cur && cur.sha) sha = String(cur.sha);
    } catch (e: any) {
      if (!/github 404/.test(String(e?.message || ''))) throw e;
    }

    /* 2) PUT — without sha for create, with sha for update. */
    const result = await ghPut<any>(
      `/repos/${site.owner}/${site.repo}/contents/${encodeURI(path)}`,
      {
        message,
        branch,
        content: utf8Base64(content),
        ...(sha ? { sha } : {}),
      },
    );

    return res.status(200).json({
      ok: true,
      repo: site.key,
      owner: site.owner,
      repository: site.repo,
      branch,
      path,
      commit_sha: String(result?.commit?.sha || '').slice(0, 7),
      url: result?.commit?.html_url || result?.content?.html_url || null,
      new_file: !sha,
      auto_deploy_note: 'Vercel will auto-deploy this commit via the Git integration.',
    });
  } catch (e: any) {
    const { status, payload } = explainSite(e);
    return res.status(status).json(payload);
  }
}
