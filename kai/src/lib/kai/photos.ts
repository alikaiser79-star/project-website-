/* ============================================================
   GARTEN PHOTOS (§10.2) — on-device image locker. Full-resolution
   plant captures live in IndexedDB and NEVER leave the device; only
   a thumbnail rides in the Codex record, and only the compressed
   frames the operator chooses are sent to /api/claude for analysis.
   Keyed by photo id (the same id stored on PlantPhoto). Mirrors the
   Vault's IndexedDB pattern.
   ============================================================ */

const DB_NAME = 'kai-garden-photos';
const STORE = 'photos';

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

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }));
}

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  await tx('readwrite', s => s.put({ id, blob, at: Date.now() }));
}

export async function getPhotoUrl(id: string): Promise<string | null> {
  const rec = await tx<{ blob: Blob } | undefined>('readonly', s => s.get(id));
  if (!rec || !rec.blob) return null;
  return URL.createObjectURL(rec.blob);
}

export async function deletePhoto(id: string): Promise<void> {
  await tx('readwrite', s => s.delete(id));
}
