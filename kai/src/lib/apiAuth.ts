/* ============================================================
   THE CLIENT HALF OF THE SERVER GATE.

   Every guarded /api/* route now requires an x-kai-key header. There
   are 25 raw fetch('/api/...') call sites in this codebase and no
   wrapper, so rather than edit 25 places — and silently miss the 26th
   somebody adds next month — this patches fetch ONCE, at boot, and
   attaches the header to same-origin /api/ requests only.

   ── WHY THE SECRET IS NOT IN THE BUNDLE ───────────────────────
   The obvious move is a VITE_KAI_API_SECRET in .env. That would be
   worthless: Vite inlines VITE_* into the shipped JavaScript, so the
   "secret" would be a public constant with a frightening name, readable
   by anyone who opens devtools on the site.

   So it is entered once per device, by hand, into Settings, and lives
   in that device's localStorage. The bundle never carries it. Reading
   the JavaScript gets an attacker nothing; they would need the string
   from Ali or the unlocked device.

   ── WHAT THIS DOES NOT DO ─────────────────────────────────────
   It is one shared secret, not a login. It cannot tell one holder from
   another, it cannot be revoked for one device without rotating it for
   all of them, and anyone Ali gives it to has it until he changes it.
   It closes the open door; it does not install a doorman.
   ============================================================ */

import { read, write, emit } from './kai/store';

const KEY = 'kai.api.secret';
export const KEY_HEADER = 'x-kai-key';

export function apiSecret(): string { return read<string>(KEY, ''); }
export function hasApiSecret(): boolean { return apiSecret().trim().length >= 16; }

export interface SetResult { ok: boolean; reason: string }

export function setApiSecret(s: string): SetResult {
  const v = String(s || '').trim();
  if (!v) { write(KEY, ''); emit(); return { ok: true, reason: 'Cleared. Guarded routes will refuse this device until you set it again.' }; }
  if (v.length < 16) {
    return { ok: false, reason: `Too short — ${v.length} characters. The server requires at least 16, so a shorter one would be rejected there and this would look like a bug instead of a typo.` };
  }
  write(KEY, v); emit();
  return { ok: true, reason: 'Stored on this device only. It is not in the app bundle and never leaves here except as a header to your own API.' };
}

/* ── the patch ───────────────────────────────────────────────── */

let installed = false;

function isOurApi(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input as Request).url;
    if (!raw) return false;
    /* Relative /api/... or absolute on THIS origin. Never a third
       party — sending the secret to someone else's server would be the
       exact leak this file exists to prevent. */
    if (raw.startsWith('/api/')) return true;
    const u = new URL(raw, location.origin);
    return u.origin === location.origin && u.pathname.startsWith('/api/');
  } catch { return false; }
}

export function installApiAuth(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isOurApi(input)) return original(input, init);
    const s = apiSecret();
    if (!s) return original(input, init);

    /* Header merging has to cover all three shapes a caller might use —
       Headers, a plain object, or an array of pairs — or the secret
       silently does not get attached for some call sites and the whole
       app looks intermittently broken. */
    const h = new Headers(
      (init?.headers as HeadersInit | undefined) ??
      (input instanceof Request ? input.headers : undefined),
    );
    h.set(KEY_HEADER, s);
    return original(input, { ...init, headers: h });
  };
}

/* Turns the server's own refusals into something readable rather than a
   bare 401 in the console. */
export function explainApiStatus(status: number, body?: any): string | null {
  if (status === 401) {
    return hasApiSecret()
      ? 'The server rejected this device\'s key (401). The string in Settings does not match KAI_API_SECRET in Vercel — check for a trailing space or a stale value after a rotation.'
      : 'This device has no API key set (401). Paste your KAI_API_SECRET into Settings.';
  }
  if (status === 503 && body?.error === 'not_configured') {
    return 'The server has no KAI_API_SECRET set, so it is refusing every caller including you. Set it in the Vercel project environment (Production) and redeploy.';
  }
  if (status === 429) return String(body?.message || 'Rate limited.');
  return null;
}
