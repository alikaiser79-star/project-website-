/* ============================================================
   /api/gmail/* — single Vercel EDGE function that dispatches to the
   per-action handlers by URL segment.

   Runs on the Edge runtime (was Node + googleapis, which never
   bundled small enough to deploy — hence the historical 404). Counts
   as ONE function toward the Hobby 12-cap; underscore-prefixed sibling
   files (_list.ts, _send.ts, _client.ts) are NOT counted as routes.

   Client URLs (/api/gmail/list, /api/gmail/send) are unchanged.
   ============================================================ */

import { guardEdge, corsFor } from '../_guard';

export const config = { runtime: 'edge' };

import { list } from './_list.js';
import { send } from './_send.js';
import { health } from './_health.js';
import { json } from './_client.js';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const action = url.pathname.replace(/^.*\/api\/gmail\/?/, '').replace(/\/+$/, '');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsFor(req as any) });
  }

  /* Health is the ONLY unguarded action: it returns booleans and lengths
     and never a value (see _health.ts), and it is the one diagnostic
     that has to work when the secret itself is what is misconfigured. */
  if (action === 'health') return health();

  /* Everything else reaches Google as Ali — READING his mail as well as
     sending as him. The guard sits above the whole dispatch on purpose:
     an earlier draft put it after the `list` branch, which left his
     inbox open while looking like it had been fixed. */
  const denied = guardEdge(req);
  if (denied) return denied;

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
