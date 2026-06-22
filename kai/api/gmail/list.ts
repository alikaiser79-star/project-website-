/* ============================================================
   GET /api/gmail/list?q=...

   Read-only inbox digest. Returns up to 15 message headers +
   snippets matching the Gmail query. Default: `in:inbox
   newer_than:7d`.

   READ side ships first per the brief: it's safe and useful
   without granting KAI the ability to send anything. The write
   side (/api/gmail/send) is only reachable via the
   ConfirmationGate after Ali approves.
   ============================================================ */

import { gmailClient, explain } from './_client.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const g = gmailClient();
    const q = String(
      (req.query && req.query.q) ||
      new URL(req.url || '', 'http://x').searchParams.get('q') ||
      'in:inbox newer_than:7d',
    ).slice(0, 240);

    const list = await g.users.messages.list({
      userId: 'me', q, maxResults: 15,
    });
    const ids = (list.data.messages || []).map((m: any) => m.id).filter(Boolean);

    /* Hydrate in parallel — metadata only, no bodies. Snippets
       are short by Gmail's design and safe to surface. */
    const messages = await Promise.all(ids.map(async (id: string) => {
      const full = await g.users.messages.get({
        userId: 'me', id, format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      const headers: Record<string, string> = {};
      for (const h of (full.data.payload?.headers || [])) {
        if (h.name && h.value) headers[h.name] = h.value;
      }
      return {
        id,
        from:    headers.From    || '',
        subject: headers.Subject || '',
        date:    headers.Date    || '',
        snippet: (full.data.snippet || '').slice(0, 220),
      };
    }));

    return res.status(200).json({ query: q, messages });
  } catch (e: any) {
    const { status, payload } = explain(e);
    return res.status(status).json(payload);
  }
}
