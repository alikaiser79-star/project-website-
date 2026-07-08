/* ============================================================
   VAULT EXPORT / IMPORT (§8.2) — offline backup of the whole KAI
   brain in one file. Export downloads the full Spine + commitments +
   settings (and the rest of the id-keyed stores) as
   kai-spine-YYYY-MM-DD.json. Import restores by MERGE, never a blind
   overwrite: id-keyed collections union by id (an existing local
   record is never clobbered by an older backup copy), and the typed
   state blob is restored wholesale only into a wiped device — an
   already-populated device keeps its own settings.

   Acceptance: export → wipe → import restores identically.
   ============================================================ */

import { read, write, emit } from './store';
import { loadState } from '../store';

declare const __BUILD_ID__: string;

const STATE_KEY = 'kai.state.v1';
const EVENTS_KEY = 'kai.events';

/* Everything worth carrying between devices / restores. */
const BACKUP_KEYS = [
  STATE_KEY, EVENTS_KEY,
  'kai.commitments', 'kai.deadlines', 'kai.promises', 'kai.people',
  'kai.leads', 'kai.missions', 'kai.pending', 'kai.content.v1',
];

export interface Backup {
  app: 'KAI';
  kind: 'spine-backup';
  version: 1;
  exportedAt: string;
  build: string;
  store: Record<string, unknown>;
}

export function exportBackup(): Backup {
  const store: Record<string, unknown> = {};
  for (const k of BACKUP_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (raw != null) store[k] = JSON.parse(raw);
    } catch { /* skip an unreadable key */ }
  }
  return {
    app: 'KAI', kind: 'spine-backup', version: 1,
    exportedAt: new Date().toISOString(),
    build: (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'),
    store,
  };
}

/* One-tap download. */
export function downloadBackup(): string {
  const data = exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = `kai-spine-${new Date().toISOString().slice(0, 10)}.json`;
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

function isIdCollection(v: unknown): v is Array<{ id: string }> {
  return Array.isArray(v) && v.length > 0 && !!v[0] && typeof v[0] === 'object' && 'id' in (v[0] as any);
}

export interface ImportResult { ok: true; events: number; collections: number; }

export function importBackup(backup: any): ImportResult {
  if (!backup || backup.kind !== 'spine-backup' || !backup.store || typeof backup.store !== 'object') {
    throw new Error('Not a KAI Spine backup file.');
  }
  const wiped = read<any[]>(EVENTS_KEY, []).length === 0;
  let collections = 0;

  for (const [k, v] of Object.entries(backup.store as Record<string, unknown>)) {
    if (isIdCollection(v)) {
      /* union by id — existing local record wins (never overwrite a
         possibly-newer local copy with an older backup one). */
      const cur = read<Array<{ id: string; ts?: number }>>(k, []);
      const seen = new Set(cur.map((x) => x.id));
      const add = (v as Array<{ id: string }>).filter((x) => x && x.id && !seen.has(x.id));
      let next: any[] = [...cur, ...add];
      if (k === EVENTS_KEY) {
        next.sort((a, b) => (a.ts || 0) - (b.ts || 0));
        if (next.length > 2000) next = next.slice(next.length - 2000);
      }
      write(k, next);
      collections++;
    } else if (k === STATE_KEY) {
      if (wiped) {
        /* fresh/wiped device — restore the typed blob wholesale. */
        try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ }
      } else {
        /* populated device — keep local settings/state; only fill keys
           the local blob is missing (local always wins on conflict). */
        const cur = loadState();
        const merged = { ...(v as object), ...cur };
        try { localStorage.setItem(k, JSON.stringify(merged)); } catch { /* quota */ }
      }
    } else {
      /* scalar/config store — only restore when absent locally. */
      try { if (localStorage.getItem(k) == null) localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
    }
  }

  emit();
  return { ok: true, events: read<any[]>(EVENTS_KEY, []).length, collections };
}

/* Parse a File (from an <input type=file>) into a Backup and import it. */
export async function importBackupFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  return importBackup(parsed);
}

/* Dev/console hooks — parallels __kaiSeed. Lets the operator (or a
   verification run) round-trip a backup without the file dialog:
   window.__kaiExport() → Backup object; window.__kaiImport(obj). */
export function installBackupDevHooks(): void {
  try {
    (window as any).__kaiExport = () => exportBackup();
    (window as any).__kaiImport = (obj: any) => { const r = importBackup(obj); console.info('[KAI backup]', r); return r; };
  } catch { /* ignore */ }
}
