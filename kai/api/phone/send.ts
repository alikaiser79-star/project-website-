/* ============================================================
   POST /api/phone/send

   The write side. Only reached by the pending executor AFTER
   Ali approves in ConfirmationGate. The LLM has no tool that
   hits this endpoint directly.

   Body:
     {
       channel: "sms" | "whatsapp",
       to:      "+201…",
       body:    "<message text>"
     }

   Both channels go through the same Twilio Messages API; the
   only difference is the 'whatsapp:' prefix on From + To when
   channel === 'whatsapp'. Sanity-checks E.164 shape before
   firing.
   ============================================================ */

import { loadCreds, loadContacts, twPostForm, normPhone, explainPhone } from './_client.js';

const E164 = /^\+[1-9]\d{6,14}$/;

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  let creds;
  try { creds = loadCreds(); }
  catch (e: any) {
    const { status, payload } = explainPhone(e);
    return res.status(status).json(payload);
  }

  const body: any = req.body || {};
  const channelRaw = String(body.channel || 'sms').toLowerCase();
  const channel: 'sms' | 'whatsapp' =
    channelRaw === 'whatsapp' || channelRaw === 'wa' ? 'whatsapp' : 'sms';
  let to     = normPhone(body.to);
  const text = String(body.body || '').slice(0, 1600);   // Twilio SMS hard-cap is 1600

  /* If `to` isn't a phone, try resolving it against the trusted
     contacts list (KAI_PHONE_CONTACTS). This is where KAI's brain
     proposing "Sayed" gets turned into a real number — server-side,
     never exposed back to the LLM. Case-insensitive prefix match. */
  if (to && !to.startsWith('+')) {
    const needle = to.toLowerCase();
    const hit = loadContacts().find(c =>
      c.name.toLowerCase() === needle ||
      c.name.toLowerCase().startsWith(needle));
    if (hit) to = normPhone(hit.phone);
  }

  if (!to || !E164.test(to)) {
    return res.status(400).json({
      error: 'bad_recipient',
      message: 'to must be E.164 (e.g. +201234567890) or a known contact name in KAI_PHONE_CONTACTS',
    });
  }
  if (!text) {
    return res.status(400).json({ error: 'bad_request', message: 'body required' });
  }

  /* WhatsApp requires both From and To to be prefixed. The configured
     fromWa MUST be a WhatsApp-enabled Twilio number. */
  const from = channel === 'whatsapp' ? 'whatsapp:' + creds.fromWa : creds.fromSms;
  const sendTo = channel === 'whatsapp' ? 'whatsapp:' + to : to;

  try {
    const sent = await twPostForm<any>(creds, '/Messages.json', {
      From: from,
      To: sendTo,
      Body: text,
    });
    return res.status(200).json({
      ok: true,
      sid: String(sent?.sid || ''),
      channel,
      to_masked: to.slice(0, 4) + '…' + to.slice(-3),
      status: String(sent?.status || 'queued'),
    });
  } catch (e: any) {
    const { status, payload } = explainPhone(e);
    return res.status(status).json(payload);
  }
}
