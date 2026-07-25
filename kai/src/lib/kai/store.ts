/* ============================================================
   KAI Spine/Mirror — localStorage-safe persistence + a reactive
   version bus. SSR/test-safe: storage is accessed lazily, never
   at import time. Boot-from-empty is a hard guarantee.

   Lives alongside (NOT replacing) the app's existing
   `lib/store.ts` which holds the typed KaiPersisted blob. This
   one is a generic byte-bucket for the event spine + commitments
   index.
   ============================================================ */

function ls(): Storage | null {
  try {
    const g = globalThis as unknown as { localStorage?: Storage };
    if (g.localStorage) return g.localStorage;
  } catch { /* locked-down iframe */ }
  return null;
}

export function read<T>(key: string, fallback: T): T {
  const s = ls();
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

export function write<T>(key: string, value: T): void {
  writeSafe(key, value);
}

/* Like write(), but reports whether the value actually persisted. A silent
   localStorage failure (QuotaExceededError on a phone with a full origin, a
   locked-down iframe, private-mode caps) used to vanish here with no trace —
   which is exactly how a Spine append can be "written" yet be gone on the
   next read. Callers that must know (logEvent) use this and self-heal. */
export function writeSafe<T>(key: string, value: T): boolean {
  const s = ls();
  if (!s) return false;
  try { s.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }   // quota / security — the caller decides what to do
}

export function uid(): string {
  try {
    const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch { /* fall through */ }
  return 'k_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ── Reactive bus ──────────────────────────────────────────
   One global version counter. Panels subscribe via
   useSyncExternalStore and re-read on every emit. */

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export function emit(): void { version++; listeners.forEach((l) => l()); }
export function subscribe(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }
export function getVersion(): number { return version; }
