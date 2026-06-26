/* /api/site/* — single Vercel function, dispatches to
   per-action handlers. See gmail/[...path].ts for the
   rationale. */

import commit from './_commit.js';
import deploy from './_deploy.js';
import deploys from './_deploys.js';

export default async function handler(req: any, res: any) {
  const slug = req.query?.path;
  const action = Array.isArray(slug) ? String(slug[0] || '') : String(slug || '');
  switch (action) {
    case 'commit':  return commit(req, res);
    case 'deploy':  return deploy(req, res);
    case 'deploys': return deploys(req, res);
    default:
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'route_not_found', action }));
      return;
  }
}
