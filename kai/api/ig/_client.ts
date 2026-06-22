/* ============================================================
   Instagram Graph API helpers — server-side only.

   Multi-account: KAI runs @alikaiser1 and @hiddengarden.eg.
   Each Instagram Business Account has its own ig-user-id and
   (optionally) its own long-lived access token. Server env holds
   the wiring; the browser never sees tokens.

   Env vars:
     IG_ACCESS_TOKEN     — fallback long-lived access token (the
                           account-default if a per-account token
                           isn't in KAI_IG_ACCOUNTS).
     KAI_IG_ACCOUNTS     — JSON array, one per IG Business Account:
       [
         {
           "key":          "ali",
           "label":        "@alikaiser1",
           "handle":       "@alikaiser1",
           "igUserId":     "17841…",
           "accessToken":  "<override>"        // optional
         },
         {
           "key":          "garden",
           "label":        "@hiddengarden.eg",
           "handle":       "@hiddengarden.eg",
           "igUserId":     "17841…"
         }
       ]
   ============================================================ */

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface IgAccount {
  key: string;
  label: string;
  handle: string;
  igUserId: string;
  accessToken?: string;
}

let cached: IgAccount[] | null = null;

export function loadIgAccounts(): IgAccount[] {
  if (cached) return cached;
  const raw = process.env.KAI_IG_ACCOUNTS;
  if (!raw) return (cached = []);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return (cached = []);
    cached = parsed
      .filter(a => a && typeof a === 'object' && a.key && a.igUserId)
      .map((a: any) => ({
        key:         String(a.key),
        label:       String(a.label || a.handle || a.key),
        handle:      String(a.handle || a.label || a.key),
        igUserId:    String(a.igUserId),
        accessToken: a.accessToken ? String(a.accessToken) : undefined,
      }));
    return cached;
  } catch {
    return (cached = []);
  }
}

export function findIgAccount(key: string): IgAccount | undefined {
  return loadIgAccounts().find(a => a.key.toLowerCase() === String(key || '').toLowerCase());
}

export function tokenFor(account: IgAccount): string {
  const t = account.accessToken || process.env.IG_ACCESS_TOKEN;
  if (!t) throw new Error('NO_IG_TOKEN');
  return t;
}

/* ── Graph fetchers ───────────────────────────────────── */

export async function igGet<T = any>(
  account: IgAccount, path: string, params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('access_token', tokenFor(account));
  const r = await fetch(url.toString());
  const text = await r.text();
  if (!r.ok) throw new Error(`ig ${r.status} · ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : (null as any);
}

export async function igPost<T = any>(
  account: IgAccount, path: string, body: Record<string, unknown>,
): Promise<T> {
  const url = new URL(GRAPH + path);
  url.searchParams.set('access_token', tokenFor(account));
  const r = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`ig ${r.status} · ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/* ── Error mapper ─────────────────────────────────────── */

export function explainIg(e: any): { status: number; payload: Record<string, unknown> } {
  const msg = String(e?.message || e || 'unknown');
  if (msg === 'NO_IG_TOKEN') {
    return { status: 503, payload: {
      error: 'no_ig_token',
      message: 'Set IG_ACCESS_TOKEN in Vercel env, or per-account accessToken in KAI_IG_ACCOUNTS.',
    }};
  }
  if (msg === 'no_ig_accounts') {
    return { status: 503, payload: {
      error: 'no_ig_accounts',
      message: 'Set KAI_IG_ACCOUNTS in Vercel env — JSON array of { key, label, handle, igUserId, accessToken? }.',
    }};
  }
  if (msg === 'unknown_ig_account') {
    return { status: 404, payload: {
      error: 'unknown_ig_account',
      message: 'No IG account matches that key. Check KAI_IG_ACCOUNTS.',
    }};
  }
  return { status: 502, payload: { error: 'ig_error', message: msg.slice(0, 240) } };
}
