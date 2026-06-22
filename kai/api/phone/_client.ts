/* ============================================================
   Twilio helpers — server-side only.

   Single Twilio account, single From number for v1. SMS and
   WhatsApp share the Messages API (WhatsApp needs the
   "whatsapp:" prefix on From + To); both flow through the same
   propose / executor / gate path.

   Env vars:
     TWILIO_ACCOUNT_SID    — AC… SID
     TWILIO_AUTH_TOKEN     — auth token
     TWILIO_FROM_NUMBER    — your Twilio phone in E.164 (+1…)
     TWILIO_WHATSAPP_FROM  — optional. Your WhatsApp-enabled number in
                             E.164 (without 'whatsapp:'). Defaults to
                             TWILIO_FROM_NUMBER if not set.
     KAI_PHONE_CONTACTS    — optional JSON map of trusted contacts:
                             [{"name":"Sayed","phone":"+201…"}]
                             KAI can resolve names → numbers when
                             proposing; you still approve the diff.
   ============================================================ */

const TW_BASE = 'https://api.twilio.com/2010-04-01';

export interface TwilioCreds {
  sid: string;
  token: string;
  fromSms: string;
  fromWa: string;
}

export interface Contact { name: string; phone: string; }

export function loadCreds(): TwilioCreds {
  const sid     = process.env.TWILIO_ACCOUNT_SID;
  const token   = process.env.TWILIO_AUTH_TOKEN;
  const fromSms = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !fromSms) throw new Error('NO_TWILIO_CREDS');
  return {
    sid, token, fromSms,
    fromWa: process.env.TWILIO_WHATSAPP_FROM || fromSms,
  };
}

export function loadContacts(): Contact[] {
  const raw = process.env.KAI_PHONE_CONTACTS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(c => c && typeof c === 'object' && c.name && c.phone)
      .map(c => ({ name: String(c.name).slice(0, 60), phone: String(c.phone).slice(0, 24) }));
  } catch { return []; }
}

function basicAuth(sid: string, token: string): string {
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

export async function twGet<T = any>(creds: TwilioCreds, path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${TW_BASE}/Accounts/${creds.sid}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const r = await fetch(url.toString(), {
    headers: {
      'Authorization': basicAuth(creds.sid, creds.token),
      'Accept': 'application/json',
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`twilio ${r.status} · ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : (null as any);
}

export async function twPostForm<T = any>(creds: TwilioCreds, path: string, fields: Record<string, string>): Promise<T> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const r = await fetch(`${TW_BASE}/Accounts/${creds.sid}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': basicAuth(creds.sid, creds.token),
      'content-type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`twilio ${r.status} · ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/* Normalise a phone — strip spaces / dashes / parens. Either it's
   already E.164 ("+…") or just a string of digits we let through
   unchanged for Twilio to reject. */
export function normPhone(p: string): string {
  return String(p || '').replace(/[\s\-()]/g, '').slice(0, 24);
}

/* Mask a number for display in logs/errors. Keep dial-prefix and
   last 3 digits. */
export function maskPhone(p: string): string {
  if (!p) return '';
  if (p.length <= 6) return p[0] + '***';
  return p.slice(0, 4) + '…' + p.slice(-3);
}

export function explainPhone(e: any): { status: number; payload: Record<string, unknown> } {
  const msg = String(e?.message || e || 'unknown');
  if (msg === 'NO_TWILIO_CREDS') {
    return { status: 503, payload: {
      error: 'no_twilio_creds',
      message: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (E.164) in Vercel env.',
    }};
  }
  return { status: 502, payload: { error: 'phone_error', message: msg.slice(0, 240) } };
}
