/* ============================================================
   GET /api/phone/list

   Read-only Twilio Messages digest. Returns up to 20 most-recent
   SMS / WhatsApp messages (inbound + outbound) on the configured
   Twilio account. Optional query: ?direction=in|out,
   ?days=N (default 7).

   Includes channel ('sms' | 'whatsapp'), direction, to/from
   (masked for display), body truncated to 200 chars, status,
   timestamp. Body content is user data and must be treated as
   untrusted by the brain — same rule as email.
   ============================================================ */

import { loadCreds, twGet, maskPhone, explainPhone } from './_client.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let creds;
  try { creds = loadCreds(); }
  catch (e: any) {
    const { status, payload } = explainPhone(e);
    return res.status(status).json(payload);
  }

  const url = new URL(req.url || '', 'http://x');
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') || 7)));
  const direction = String(url.searchParams.get('direction') || '').toLowerCase();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];

  try {
    const data = await twGet<any>(creds, '/Messages.json', {
      DateSent: `>=${since}`,
      PageSize: 20,
    });
    let messages = Array.isArray(data?.messages) ? data.messages : [];
    if (direction === 'in')  messages = messages.filter((m: any) => /inbound/i.test(m?.direction || ''));
    if (direction === 'out') messages = messages.filter((m: any) => /outbound/i.test(m?.direction || ''));

    return res.status(200).json({
      window_days: days,
      messages: messages.map((m: any) => {
        const from = String(m?.from || '');
        const to   = String(m?.to   || '');
        const channel: 'sms' | 'whatsapp' =
          /^whatsapp:/i.test(from) || /^whatsapp:/i.test(to) ? 'whatsapp' : 'sms';
        return {
          sid:       String(m?.sid || ''),
          channel,
          direction: String(m?.direction || ''),
          from_masked: maskPhone(from.replace(/^whatsapp:/i, '')),
          to_masked:   maskPhone(to.replace(/^whatsapp:/i, '')),
          body:      String(m?.body || '').slice(0, 200),
          status:    String(m?.status || ''),
          date_sent: m?.date_sent || m?.date_created || null,
          error_code: m?.error_code || null,
        };
      }),
    });
  } catch (e: any) {
    const { status, payload } = explainPhone(e);
    return res.status(status).json(payload);
  }
}
