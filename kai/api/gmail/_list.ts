/* ============================================================
   GET /api/gmail/list?q=...

   Read-only inbox digest. Up to 15 message headers + snippets
   matching the Gmail query (default `in:inbox newer_than:7d`).
   Response contract is unchanged from the googleapis version:
     { query, messages: [{ id, threadId, from, subject, date, snippet }] }
   so InboxPanel / mailwatch / bookingwatch need no client change.
   ============================================================ */

import { getAccessToken, gmailApi, json, gmailErr, explain } from './_client.js';

interface MailMsg {
  id: string; threadId: string; from: string; subject: string; date: string; snippet: string;
}

export async function list(url: URL): Promise<Response> {
  try {
    const token = await getAccessToken();
    const q = (url.searchParams.get('q') || 'in:inbox newer_than:7d').slice(0, 240);

    const listRes = await gmailApi(
      '/users/me/messages?maxResults=15&q=' + encodeURIComponent(q),
      token,
    );
    if (!listRes.ok) return gmailErr(listRes, 'gmail list');
    const listData: any = await listRes.json();
    const ids: string[] = (listData.messages || []).map((m: any) => m?.id).filter(Boolean);

    /* Hydrate in parallel — metadata only, no bodies. A single failed
       hydrate drops that one message rather than sinking the whole digest. */
    const hydrated = await Promise.all(ids.map(async (id): Promise<MailMsg | null> => {
      const mRes = await gmailApi(
        '/users/me/messages/' + id +
          '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date',
        token,
      );
      if (!mRes.ok) return null;
      const full: any = await mRes.json();
      const headers: Record<string, string> = {};
      for (const h of (full?.payload?.headers || [])) {
        if (h?.name && h?.value) headers[h.name] = h.value;
      }
      return {
        id,
        threadId: full?.threadId || id,       // conversation key — dedups the watcher per thread
        from: headers.From || '',
        subject: headers.Subject || '',
        date: headers.Date || '',
        snippet: String(full?.snippet || '').slice(0, 220),
      };
    }));

    const messages = hydrated.filter((m): m is MailMsg => m !== null);
    return json({ query: q, messages });
  } catch (e) {
    return explain(e);
  }
}
