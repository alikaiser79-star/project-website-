/* /api/phone/* — single Vercel function, dispatches to
   per-action handlers. See gmail/[...path].ts for the
   rationale. */

import list from './_list.js';
import send from './_send.js';
import contacts from './_contacts.js';

export default async function handler(req: any, res: any) {
  const slug = req.query?.path;
  const action = Array.isArray(slug) ? String(slug[0] || '') : String(slug || '');
  switch (action) {
    case 'list':     return list(req, res);
    case 'send':     return send(req, res);
    case 'contacts': return contacts(req, res);
    default:
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'route_not_found', action }));
      return;
  }
}
