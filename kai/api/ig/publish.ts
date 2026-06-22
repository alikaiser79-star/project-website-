/* ============================================================
   POST /api/ig/publish

   Write side. Only reached by the pending executor AFTER Ali
   approves in ConfirmationGate. The LLM has no tool that hits
   this endpoint directly.

   IG Graph API publishes in two steps:
     1) POST /{ig-user-id}/media with the media specifier →
        returns a `creation_id` (the container).
     2) POST /{ig-user-id}/media_publish with that creation_id.

   For VIDEO and REELS the container processes async; we poll
   /{creation_id}?fields=status_code until FINISHED (or fail
   FAST on ERROR / IN_PROGRESS timeout).

   Body:
     {
       handle:   "ali",                       // KAI_IG_ACCOUNTS key
       media_type: "IMAGE" | "REELS",
       image_url?: "https://…",               // for IMAGE
       video_url?: "https://…",               // for REELS
       cover_url?: "https://…",               // optional REELS cover
       caption?: "…",
       share_to_feed?: true                   // REELS: also on feed
     }

   media_url / video_url MUST be a public https URL Meta can
   fetch.
   ============================================================ */

import { findIgAccount, loadIgAccounts, igGet, igPost, explainIg, type IgAccount } from './_client.js';

const MAX_POLL_MS  = 90_000;     // 90s — REELS can take a while
const POLL_EVERY   = 3_000;

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (loadIgAccounts().length === 0) {
    const { status, payload } = explainIg(new Error('no_ig_accounts'));
    return res.status(status).json(payload);
  }

  const body: any = req.body || {};
  const handleKey = String(body.handle || body.account || '').trim();
  const account = findIgAccount(handleKey);
  if (!account) {
    const { status, payload } = explainIg(new Error('unknown_ig_account'));
    return res.status(status).json({ ...payload, handle: handleKey });
  }

  const mediaType  = String(body.media_type || 'IMAGE').toUpperCase();
  const caption    = body.caption ? String(body.caption).slice(0, 2200) : undefined;
  const imageUrl   = body.image_url ? String(body.image_url) : undefined;
  const videoUrl   = body.video_url ? String(body.video_url) : undefined;
  const coverUrl   = body.cover_url ? String(body.cover_url) : undefined;
  const shareFeed  = body.share_to_feed === true;

  if (mediaType === 'IMAGE') {
    if (!isHttpsUrl(imageUrl)) return res.status(400).json({ error: 'bad_request', message: 'image_url must be a public https URL' });
  } else if (mediaType === 'REELS') {
    if (!isHttpsUrl(videoUrl)) return res.status(400).json({ error: 'bad_request', message: 'video_url must be a public https URL' });
  } else {
    return res.status(400).json({ error: 'bad_request', message: 'media_type must be IMAGE or REELS' });
  }

  try {
    /* 1) Build the container. */
    const createBody: Record<string, unknown> = { ...(caption ? { caption } : {}) };
    if (mediaType === 'IMAGE') {
      createBody.image_url = imageUrl;
    } else {
      createBody.media_type = 'REELS';
      createBody.video_url  = videoUrl;
      if (coverUrl)   createBody.cover_url = coverUrl;
      if (shareFeed)  createBody.share_to_feed = true;
    }
    const created = await igPost<any>(account, `/${account.igUserId}/media`, createBody);
    const creationId = String(created?.id || '');
    if (!creationId) {
      return res.status(502).json({ error: 'no_creation_id', message: 'IG did not return a creation_id.' });
    }

    /* 2) For REELS / VIDEO wait for status_code = FINISHED. */
    if (mediaType === 'REELS') {
      const ok = await waitFinished(account, creationId);
      if (ok !== 'FINISHED') {
        return res.status(502).json({
          error: 'container_not_ready',
          status_code: ok,
          message: 'REELS container did not finish processing in time. Try again, or check the video URL is publicly reachable.',
        });
      }
    }

    /* 3) Publish. */
    const published = await igPost<any>(account, `/${account.igUserId}/media_publish`, { creation_id: creationId });
    const mediaId = String(published?.id || '');

    return res.status(200).json({
      ok: true,
      handle: account.key,
      media_id: mediaId,
      creation_id: creationId,
      media_type: mediaType,
    });
  } catch (e: any) {
    const { status, payload } = explainIg(e);
    return res.status(status).json(payload);
  }
}

async function waitFinished(account: IgAccount, creationId: string): Promise<string> {
  const t0 = Date.now();
  while (Date.now() - t0 < MAX_POLL_MS) {
    try {
      const data = await igGet<any>(account, `/${creationId}`, { fields: 'status_code,status' });
      const sc = String(data?.status_code || '').toUpperCase();
      if (sc === 'FINISHED' || sc === 'ERROR' || sc === 'EXPIRED') return sc;
    } catch { /* transient; keep polling */ }
    await sleep(POLL_EVERY);
  }
  return 'TIMEOUT';
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function isHttpsUrl(u?: string): boolean {
  if (!u) return false;
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
}
