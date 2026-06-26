/* ============================================================
   POST /api/ingest — STUBBED OUT.

   Part E (phone bridge) repeatedly broke the Vercel build. Per
   operator directive: the Living Command Core ships first; the
   phone bridge can be reinstated once it's solid on its own
   branch. This stub keeps the share_target POST in the PWA
   manifest from 404-ing — it just returns a clean 503 instead.

   No imports, no regex, no Edge runtime — nothing that can
   bundle differently between a local clean install and Vercel's
   build environment.

   Reinstate the full implementation from git history
   (kai/api/ingest.ts pre-d631d70) when Part E is being worked
   on again, on its own branch, isolated.
   ============================================================ */

export default function handler(_req: any, res: any) {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: 'phone_bridge_offline',
    message: 'Phone bridge is currently disabled. Share intake will be back soon.',
  }));
}
