/* /api/ig/* — single Vercel function, dispatches to per-action
   handlers. See gmail/[...path].ts for the full rationale. */

import list from './_list.js';
import publish from './_publish.js';
import health from './_health.js';
import deriveToken from './_derive-token.js';

export default async function handler(req: any, res: any) {
  const slug = req.query?.path;
  const action = Array.isArray(slug) ? String(slug[0] || '') : String(slug || '');
  switch (action) {
    case 'list':         return list(req, res);
    case 'publish':      return publish(req, res);
    case 'health':       return health(req, res);
    case 'derive-token': return deriveToken(req, res);
    default:
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'route_not_found', action }));
      return;
  }
}
