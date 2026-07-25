/* ============================================================
   /api/gmail/* — single Vercel EDGE function that dispatches to the
   per-action handlers by URL segment.

   Runs on the Edge runtime (was Node + googleapis, which never
   bundled small enough to deploy — hence the historical 404). Counts
   as ONE function toward the Hobby 12-cap; underscore-prefixed sibling
   files (_list.ts, _send.ts, _client.ts) are NOT counted as routes.

   Client URLs (/api/gmail/list, /api/gmail/send) are unchanged.
   ============================================================ */

export const config = { runtime: 'edge' };

import { list } from './_list.js';
import { send } from './_send.js';
import { json } from './_client.js';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const action = url.pathname.replace(/^.*\/api\/gmail\/?/, '').replace(/\/+$/, '');

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (action === 'list') {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'method_not_allowed' }, 405);
    return list(url);
  }
  if (action === 'send') {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    return send(req);
  }
  return json({ error: 'route_not_found', action }, 404);
}
