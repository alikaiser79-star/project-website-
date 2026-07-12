/* ============================================================
   DER SCHATTEN client (§14) — opt into the daily pulse. Registers this
   device's Spine namespace (its §8 sync key) with the server so the
   cron includes it; the pulse then runs overnight and the Night Ledger
   shows what moved on next open. Requires sync (§8) to be on — the sync
   key IS the namespace. The morning PUSH (§14.2) also captures a push
   subscription when VAPID is wired and permission is granted.
   ============================================================ */

import { getSyncKey } from './sync';

const KEY = 'kai.shadow.enabled';

export function shadowEnabled(): boolean { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }

export async function pulseConfigured(): Promise<boolean> {
  try { const r = await fetch('/api/pulse?health'); if (!r.ok) return false; return !!(await r.json()).configured; } catch { return false; }
}

/* Ask for notification permission (once) and, if a VAPID key is present,
   subscribe to push. Returns the PushSubscription JSON or null. */
async function maybeSubscribe(): Promise<any> {
  try {
    const vapid = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapid || !('Notification' in window) || !('serviceWorker' in navigator)) return null;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(vapid) as BufferSource });
    return sub.toJSON();
  } catch { return null; }
}

function urlB64ToUint8(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enableShadow(): Promise<{ ok: boolean; reason?: string }> {
  const key = getSyncKey();
  if (!key) return { ok: false, reason: 'sync-off' };     // needs §8 sync on for a namespace
  const subscription = await maybeSubscribe();
  try {
    const r = await fetch('/api/pulse', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-kai-sync-key': key },
      body: JSON.stringify({ tz: 'Africa/Cairo', subscription }),
    });
    if (r.status === 503) return { ok: false, reason: 'server-off' };
    if (!r.ok) return { ok: false, reason: 'server' };
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    return { ok: true, reason: subscription ? 'push-on' : 'events-only' };
  } catch { return { ok: false, reason: 'offline' }; }
}

export function disableShadow(): void { try { localStorage.setItem(KEY, '0'); } catch { /* ignore */ } }
