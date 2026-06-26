/* ============================================================
   /api/gmail/* — single Vercel serverless function that
   dispatches to the per-action handlers based on URL segment.

   Counts as ONE function toward the Hobby 12-cap (instead of
   N functions, one per action). Underscore-prefixed sibling
   files (_list.ts, _send.ts, _client.ts) are NOT counted as
   routes per Vercel's convention.

   Client URLs (/api/gmail/list, /api/gmail/send) are unchanged.
   ============================================================ */

import list from './_list.js';
import send from './_send.js';

export default async function handler(req: any, res: any) {
  const slug = req.query?.path;
  const action = Array.isArray(slug) ? String(slug[0] || '') : String(slug || '');
  switch (action) {
    case 'list': return list(req, res);
    case 'send': return send(req, res);
    default:
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'route_not_found', action }));
      return;
  }
}
