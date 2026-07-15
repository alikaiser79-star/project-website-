/* ============================================================
   SPINE SYNC (§8.1) — client half of SPINE EVERYWHERE.

   Append-only, conflict-free. Each device PUSHES events the server
   doesn't have yet (deduped by event id) and PULLS events it lacks,
   so any number of devices converge on the same Spine through the
   server without a merge conflict — the event log is the CRDT.
   Non-Spine settings (preferences only) sync last-write-wins by ts.

   Auth: an unguessable 256-bit sync key, generated once and stored
   locally (reachable only while the app is unlocked). It rides in the
   x-kai-sync-key header; the server hashes it to a private namespace.
   No key on the server (Upstash unconfigured) → sync stays cleanly
   OFF and the app is local-only.

   Triggers: app foreground (visibility/online) + a 5s debounce after
   any Spine write. SystemPulse renders the live state as a dot.
   ============================================================ */

import { read, write, emit, subscribe } from './store';
import { loadState, saveState } from '../store';
import type { KaiEvent } from './events';

const CFG_KEY = 'kai.sync.v1';
const EVENTS_KEY = 'kai.events';
const DEBOUNCE_MS = 5000;

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'pending' | 'failing';

interface SyncConfig {
  enabled: boolean;
  key: string;              // 256-bit base64url — the namespace secret
  settingsTs: number;       // ts of the settings blob we last adopted/pushed
  settingsHash: string;     // hash of the settings we last synced (change detect)
  lastSyncAt: number;
}

const DEFAULT_CFG: SyncConfig = { enabled: false, key: '', settingsTs: 0, settingsHash: '', lastSyncAt: 0 };

function loadCfg(): SyncConfig { return { ...DEFAULT_CFG, ...read<Partial<SyncConfig>>(CFG_KEY, {}) }; }
function saveCfg(c: SyncConfig) { write(CFG_KEY, c); }

/* ── live status for SystemPulse ─────────────────────────── */
let status: SyncStatus = loadCfg().enabled ? 'pending' : 'off';
let lastError = '';
const statusListeners = new Set<() => void>();
function setStatus(s: SyncStatus, err = '') { status = s; lastError = err; statusListeners.forEach((l) => l()); }
export function getSyncStatus(): SyncStatus { return status; }
export function getSyncError(): string { return lastError; }
export function onSyncStatus(l: () => void): () => void { statusListeners.add(l); return () => statusListeners.delete(l); }

/* ── key management ──────────────────────────────────────── */
export function isSyncEnabled(): boolean { return loadCfg().enabled; }
export function getSyncKey(): string { return loadCfg().key; }

function genKey(): string {
  const bytes = new Uint8Array(32);
  (globalThis.crypto || (window as any).crypto).getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Enable sync. With no key given, mint a fresh one (this device is the
   origin); paste an existing key to JOIN another device's namespace. */
export function enableSync(existingKey?: string): SyncConfig {
  const c = loadCfg();
  c.enabled = true;
  c.key = (existingKey && existingKey.trim().length >= 16) ? existingKey.trim() : (c.key || genKey());
  saveCfg(c);
  setStatus('pending');
  void syncNow();
  return c;
}

export function disableSync() {
  const c = loadCfg();
  c.enabled = false;
  saveCfg(c);
  setStatus('off');
}

/* ── server calls ────────────────────────────────────────── */
async function api(path: string, init?: RequestInit): Promise<Response> {
  const key = loadCfg().key;
  return fetch(`/api/spine/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-kai-sync-key': key, ...(init?.headers || {}) },
  });
}

export async function syncConfigured(): Promise<boolean> {
  try {
    const r = await fetch('/api/spine/health');
    if (!r.ok) return false;
    const d = await r.json();
    return !!d.configured;
  } catch { return false; }
}

/* ── the sync itself ─────────────────────────────────────── */
let inFlight = false;

export async function syncNow(): Promise<void> {
  const cfg = loadCfg();
  if (!cfg.enabled || !cfg.key) { setStatus('off'); return; }
  if (inFlight) return;
  inFlight = true;
  setStatus('syncing');
  try {
    /* 1. EVENTS — pull remote, union by id into the CURRENT local store. */
    const pullRes = await api('pull');
    if (pullRes.status === 503) { setStatus('off'); inFlight = false; return; }   // server not configured
    if (pullRes.status === 401) throw new Error('bad key');
    if (!pullRes.ok) throw new Error('pull ' + pullRes.status);
    const remote: KaiEvent[] = (await pullRes.json()).events || [];
    const remoteIds = new Set(remote.map((e) => e.id));

    /* Re-READ local AFTER the pull. Anything logEvent()'d during the await
       (e.g. a boot-time migration) is in storage but NOT in the `local`
       snapshot above; unioning against the CURRENT store instead of the
       stale snapshot means a concurrent append is never clobbered by the
       merge write. */
    const localNow = read<KaiEvent[]>(EVENTS_KEY, []);
    const curIds = new Set(localNow.map((e) => e.id));
    const fresh = remote.filter((e) => e && e.id && !curIds.has(e.id));
    let merged = localNow;
    if (fresh.length) {
      merged = [...localNow, ...fresh].sort((a, b) => a.ts - b.ts);
      if (merged.length > 2000) merged = merged.slice(merged.length - 2000);
      write(EVENTS_KEY, merged);
      emit();                                   // wake every Spine-reading panel
    }

    /* 2. PUSH — send events the server is missing (incl. concurrent appends). */
    const missing = merged.filter((e) => !remoteIds.has(e.id));
    if (missing.length) {
      const pushRes = await api('push', { method: 'POST', body: JSON.stringify({ events: missing }) });
      if (!pushRes.ok) throw new Error('push ' + pushRes.status);
    }

    /* 3. SETTINGS — last-write-wins (preferences only, never Spine). */
    const setRes = await api('settings');
    if (setRes.ok) {
      const rs = await setRes.json();
      if (rs && rs.data && Number(rs.ts) > cfg.settingsTs) {
        const s = loadState();
        s.settings = { ...s.settings, ...rs.data };
        saveState(s);
        cfg.settingsTs = Number(rs.ts);
        cfg.settingsHash = JSON.stringify(s.settings);
        emit();
      }
    }
    const localSettings = loadState().settings;
    const localHash = JSON.stringify(localSettings);
    if (localHash !== cfg.settingsHash) {
      const ts = Date.now();
      const psh = await api('settings', { method: 'POST', body: JSON.stringify({ data: localSettings, ts }) });
      if (psh.ok) { cfg.settingsTs = ts; cfg.settingsHash = localHash; }
    }

    cfg.lastSyncAt = Date.now();
    saveCfg(cfg);
    setStatus('synced');
  } catch (e: any) {
    setStatus('failing', String(e?.message || e));
  } finally {
    inFlight = false;
  }
}

/* ── auto-triggers (foreground + debounced writes) ───────── */
let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function startSync() {
  if (started) return;
  started = true;

  const kick = () => { if (isSyncEnabled()) void syncNow(); };

  /* foreground / reconnect */
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  window.addEventListener('focus', kick);
  window.addEventListener('online', kick);

  /* debounce 5s after any Spine write */
  subscribe(() => {
    if (!isSyncEnabled()) return;
    if (status === 'synced') setStatus('pending');
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { void syncNow(); }, DEBOUNCE_MS);
  });

  kick();   // first sync on boot
}
