import type { PositionInput } from "./types";

const DB_NAME = "sol-tracking-express-v1";
const STORE = "pending-positions";
const MAX_ROWS = 400;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: ["sessionId", "sequence"] });
        store.createIndex("by_session", "sessionId", { unique: false });
      }
    };
  });
}

export async function enqueuePosition(token: string, position: PositionInput) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ token, ...position, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countPending(sessionId: string) {
  const db = await openDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const idx = tx.objectStore(STORE).index("by_session");
    const req = idx.count(IDBKeyRange.only(sessionId));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listPending(sessionId: string) {
  const db = await openDb();
  return new Promise<Array<PositionInput & { token: string }>>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const idx = tx.objectStore(STORE).index("by_session");
    const req = idx.getAll(IDBKeyRange.only(sessionId));
    req.onsuccess = () => {
      const rows = (req.result as Array<PositionInput & { token: string }>).sort(
        (a, b) => a.sequence - b.sequence,
      );
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removePositions(sessionId: string, sequences: number[]) {
  if (!sequences.length) return;
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const seq of sequences) {
      store.delete([sessionId, seq]);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function trimOldPositions(sessionId: string) {
  const rows = await listPending(sessionId);
  if (rows.length <= MAX_ROWS) return;
  const drop = rows.slice(0, rows.length - MAX_ROWS);
  await removePositions(
    sessionId,
    drop.map((r) => r.sequence),
  );
}
