/* ============================================================
   POST /api/gmail/send

   The write side. Only ever reached from the executor in
   src/lib/kai/pending.ts AFTER the ConfirmationGate approval —
   the LLM has no tool that calls this endpoint directly.

   No body validation by the LLM itself; the gate is the
   human-in-the-loop check. We still sanity-check shape here so
   a malformed payload returns a clean 400 instead of a Gmail
   API blow-up.

   Future: when KAI is ever exposed beyond Ali, add a shared-
   secret header check here (the Face ID / PIN gate is the
   current perimeter).
   ============================================================ */

import { gmailClient, explain } from './_client.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  /* Vercel Node parses application/json by default. */
  const body: any = req.body || {};
  const to      = String(body.to      || '').trim();
  const subject = String(body.subject || '').trim();
  const text    = String(body.body    || '').trim();

  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'bad_request', message: 'to / subject / body all required' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return res.status(400).json({ error: 'bad_recipient', message: 'recipient does not look like an email address' });
  }

  try {
    const g = gmailClient();

    /* RFC 5322 envelope. base64url with no padding is what the
       Gmail API expects. */
    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      text,
    ];
    const raw = Buffer.from(lines.join('\r\n'), 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sent = await g.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return res.status(200).json({
      ok: true,
      id: sent.data.id || null,
      threadId: sent.data.threadId || null,
    });
  } catch (e: any) {
    const { status, payload } = explain(e);
    return res.status(status).json(payload);
  }
}
