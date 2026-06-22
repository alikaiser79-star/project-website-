/* ============================================================
   GET /api/phone/contacts

   Read-only: the trusted-contacts list from KAI_PHONE_CONTACTS
   so the brain can resolve "Sayed" → +201… before proposing a
   send. Numbers are masked in the response — only the name and
   masked phone are surfaced. The brain proposes by NAME; the
   pending executor resolves to the full number on the server
   when Ali approves.

   Empty list when KAI_PHONE_CONTACTS isn't set.
   ============================================================ */

import { loadContacts, maskPhone } from './_client.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const contacts = loadContacts();
  return res.status(200).json({
    contacts: contacts.map(c => ({ name: c.name, phone_masked: maskPhone(c.phone) })),
  });
}
