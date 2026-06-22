/* ============================================================
   Shared GitHub + Vercel helpers — server-side only.

   Multi-site: KAI controls several websites (AquaGrace, Katie,
   Hidden Garden, …). A site is identified by a short `key`.
   Server env holds the wiring; the browser never sees tokens
   or project IDs.

   Env vars:
     GITHUB_TOKEN  — fine-grained PAT. Contents read+write,
                     scoped ONLY to the target repos.
     VERCEL_TOKEN  — Vercel API token.
     KAI_SITES     — JSON array, one entry per site:
       [
         {
           "key":             "aquagrace",
           "label":           "AquaGrace",
           "owner":           "alikaiser79-star",
           "repo":            "aquagrace-site",
           "branch":          "main",
           "vercelProjectId": "prj_xxxxxxxxxxxx",
           "deployHook":      "https://api.vercel.com/v1/integrations/deploy/prj_xxx/yyy"
         },
         ...
       ]
     deployHook is optional. Without it, a redeploy of the same
     commit can't be triggered (a fresh commit will still
     auto-deploy via Vercel's Git integration).
   ============================================================ */

const GH_BASE = 'https://api.github.com';
const VC_BASE = 'https://api.vercel.com';

export interface KaiSite {
  key: string;
  label: string;
  owner: string;
  repo: string;
  branch: string;
  vercelProjectId: string;
  deployHook?: string;
}

let cached: KaiSite[] | null = null;

export function loadSites(): KaiSite[] {
  if (cached) return cached;
  const raw = process.env.KAI_SITES;
  if (!raw) return (cached = []);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return (cached = []);
    cached = parsed
      .filter(s => s && typeof s === 'object' && s.key && s.owner && s.repo && s.vercelProjectId)
      .map((s: any) => ({
        key:             String(s.key),
        label:           String(s.label || s.key),
        owner:           String(s.owner),
        repo:            String(s.repo),
        branch:          String(s.branch || 'main'),
        vercelProjectId: String(s.vercelProjectId),
        deployHook:      s.deployHook ? String(s.deployHook) : undefined,
      }));
    return cached;
  } catch {
    return (cached = []);
  }
}

export function findSite(key: string): KaiSite | undefined {
  return loadSites().find(s => s.key.toLowerCase() === String(key || '').toLowerCase());
}

export function githubToken(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('NO_GITHUB_TOKEN');
  return t;
}
export function vercelToken(): string {
  const t = process.env.VERCEL_TOKEN;
  if (!t) throw new Error('NO_VERCEL_TOKEN');
  return t;
}

/* ── GitHub fetchers ───────────────────────────────────── */

function ghHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${githubToken()}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'KAI/1.0',
  };
}

export async function ghGet<T = any>(path: string): Promise<T> {
  const r = await fetch(GH_BASE + path, { headers: ghHeaders() });
  const text = await r.text();
  if (!r.ok) throw new Error(`github ${r.status} · ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : (null as any);
}
export async function ghPut<T = any>(path: string, body: unknown): Promise<T> {
  const r = await fetch(GH_BASE + path, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`github ${r.status} · ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/* ── Vercel fetchers ──────────────────────────────────── */

export async function vcGet<T = any>(path: string): Promise<T> {
  const r = await fetch(VC_BASE + path, {
    headers: {
      'Authorization': `Bearer ${vercelToken()}`,
      'User-Agent': 'KAI/1.0',
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`vercel ${r.status} · ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : (null as any);
}

/* ── Encoding ─────────────────────────────────────────── */

/* base64 of utf-8 — what the GitHub Contents API wants. */
export function utf8Base64(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64');
}

/* ── Error mapper ─────────────────────────────────────── */

export function explainSite(e: any): { status: number; payload: Record<string, unknown> } {
  const msg = String(e?.message || e || 'unknown');
  if (msg === 'NO_GITHUB_TOKEN') {
    return { status: 503, payload: {
      error: 'no_github_token',
      message: 'Set GITHUB_TOKEN in Vercel project env (fine-grained PAT, Contents: read & write, scoped only to target repos).',
    }};
  }
  if (msg === 'NO_VERCEL_TOKEN') {
    return { status: 503, payload: {
      error: 'no_vercel_token',
      message: 'Set VERCEL_TOKEN in Vercel project env.',
    }};
  }
  if (msg === 'no_sites') {
    return { status: 503, payload: {
      error: 'no_sites',
      message: 'Set KAI_SITES in Vercel env — JSON array of { key, label, owner, repo, branch, vercelProjectId, deployHook? }.',
    }};
  }
  if (msg === 'unknown_site') {
    return { status: 404, payload: {
      error: 'unknown_site',
      message: 'No site matches that key. Check KAI_SITES.',
    }};
  }
  return { status: 502, payload: { error: 'site_error', message: msg.slice(0, 240) } };
}
