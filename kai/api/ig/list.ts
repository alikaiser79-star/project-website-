/* ============================================================
   GET /api/ig/list

   Read-only: across every IG account in KAI_IG_ACCOUNTS, returns
   profile stats (followers, follows, media count) and the 6
   most-recent media items per account.

   Per-account failure is tolerated so one bad token doesn't
   black out the whole panel. Comments are intentionally NOT
   fetched here — that read needs explicit permission scope and
   surfaces user-generated text we want to handle as untrusted
   data via a separate endpoint.
   ============================================================ */

import { loadIgAccounts, igGet, explainIg, type IgAccount } from './_client.js';

const MEDIA_FIELDS = [
  'id', 'media_type', 'media_product_type', 'caption',
  'permalink', 'media_url', 'thumbnail_url', 'timestamp',
  'like_count', 'comments_count',
].join(',');

const PROFILE_FIELDS = ['id', 'username', 'name', 'followers_count', 'follows_count', 'media_count'].join(',');

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const accounts = loadIgAccounts();
  if (accounts.length === 0) {
    const { status, payload } = explainIg(new Error('no_ig_accounts'));
    return res.status(status).json(payload);
  }

  try {
    const results = await Promise.all(accounts.map(async (a) => loadOne(a)));
    return res.status(200).json({ accounts: results });
  } catch (e: any) {
    const { status, payload } = explainIg(e);
    return res.status(status).json(payload);
  }
}

async function loadOne(a: IgAccount) {
  try {
    const [profile, media] = await Promise.all([
      igGet<any>(a, `/${a.igUserId}`, { fields: PROFILE_FIELDS }),
      igGet<any>(a, `/${a.igUserId}/media`, { fields: MEDIA_FIELDS, limit: 6 }),
    ]);
    return {
      key:        a.key,
      label:      a.label,
      handle:     a.handle,
      profile: {
        username:        profile?.username || a.handle.replace(/^@/, ''),
        name:            profile?.name || null,
        followers_count: typeof profile?.followers_count === 'number' ? profile.followers_count : null,
        follows_count:   typeof profile?.follows_count   === 'number' ? profile.follows_count   : null,
        media_count:     typeof profile?.media_count     === 'number' ? profile.media_count     : null,
      },
      media: Array.isArray(media?.data) ? media.data.map((m: any) => ({
        id:               String(m?.id || ''),
        media_type:       String(m?.media_type || ''),
        media_product_type: m?.media_product_type ? String(m.media_product_type) : null,
        caption:          m?.caption ? String(m.caption).slice(0, 240) : null,
        permalink:        m?.permalink || null,
        thumbnail_url:    m?.thumbnail_url || m?.media_url || null,
        timestamp:        m?.timestamp || null,
        like_count:       typeof m?.like_count === 'number' ? m.like_count : null,
        comments_count:   typeof m?.comments_count === 'number' ? m.comments_count : null,
      })) : [],
    };
  } catch (e: any) {
    return {
      key: a.key, label: a.label, handle: a.handle,
      profile: null, media: [],
      error: String(e?.message || e || 'unknown').slice(0, 200),
    };
  }
}
