/* ============================================================
   THE VAULT (§6.4) — an offline-first document locker in the PWA.
   Papers that survive anything: contract scans, insurance, case
   files, IDs. Blobs live in IndexedDB (local, works with zero
   signal); the app shell is already precached by the service worker
   and the whole app sits behind the WebAuthn lock, so the Vault is
   Face-ID gated by inheritance. When life demands a paper — court,
   hospital, border — it's a couple of taps away, always.
   ============================================================ */

const DB_NAME = 'kai-vault';
const STORE = 'docs';

export interface VaultDoc { id: string; name: string; type: string; size: number; addedAt: number; }
interface VaultRecord extends VaultDoc { blob: Blob; }

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }));
}

export async function addDoc(file: File): Promise<VaultDoc> {
  const rec: VaultRecord = {
    id: 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: file.name || 'document', type: file.type || 'application/octet-stream',
    size: file.size, addedAt: Date.now(), blob: file,
  };
  await tx('readwrite', s => s.put(rec));
  const { blob, ...meta } = rec; void blob;
  return meta;
}

export async function listDocs(): Promise<VaultDoc[]> {
  const all = await tx<VaultRecord[]>('readonly', s => s.getAll());
  return (all || []).map(({ blob, ...m }) => { void blob; return m; }).sort((a, b) => b.addedAt - a.addedAt);
}

/* Returns an object URL for the stored blob — works fully offline,
   the bytes are local. Caller revokes when done. */
export async function openDocUrl(id: string): Promise<string | null> {
  const rec = await tx<VaultRecord | undefined>('readonly', s => s.get(id));
  if (!rec || !rec.blob) return null;
  return URL.createObjectURL(rec.blob);
}

export async function removeDoc(id: string): Promise<void> {
  await tx('readwrite', s => s.delete(id));
}
