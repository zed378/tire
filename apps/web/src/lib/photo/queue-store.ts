/**
 * IndexedDB store for the offline upload queue (PLAN/06 §4.1).
 *
 * IndexedDB rather than the Cache API, because what is held here is unfinished
 * WORK — not a copy of a resource. A cache entry can be discarded and refetched;
 * a queued photograph cannot be recovered from anywhere if it is dropped.
 *
 * A small hand-written wrapper rather than a library: it is one object store,
 * and PLAN/09 §4.3 asks for boring code over clever code.
 *
 * Session tokens never go in here. The httpOnly cookie holds them, and
 * JavaScript cannot read it — which is the point (PLAN/06 §5 rule 1).
 */

const DATABASE_NAME = "c26-uploads";
const DATABASE_VERSION = 1;
const STORE = "queue";

export type QueueItemStatus = "pending" | "uploading" | "done" | "failed";

export interface QueueItem {
  id: string;
  serialNumber: string;
  /** null for the two general slots. */
  tirePositionId: number | null;
  positionLabel: string;
  slot: "front_rear" | "side" | "tire_position";
  blob: Blob;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  checksumSha256: string;
  capturedAt: string | null;
  status: QueueItemStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number;
  createdAt: number;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise !== null) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("bySerialNumber", "serialNumber");
        store.createIndex("byStatus", "status");
        store.createIndex("byChecksum", "checksumSha256");
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("failed to open the upload queue"));
    };
  });

  return databasePromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));

    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("upload queue operation failed"));
    };
  });
}

export async function putQueueItem(item: QueueItem): Promise<void> {
  await withStore("readwrite", (store) => store.put(item));
}

export async function getQueueItem(id: string): Promise<QueueItem | undefined> {
  return withStore("readonly", (store) => store.get(id) as IDBRequest<QueueItem | undefined>);
}

export async function deleteQueueItem(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function listQueue(): Promise<QueueItem[]> {
  const items = await withStore("readonly", (store) => store.getAll() as IDBRequest<QueueItem[]>);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listQueueFor(serialNumber: string): Promise<QueueItem[]> {
  const all = await listQueue();
  return all.filter((item) => item.serialNumber === serialNumber);
}

/**
 * Deduplication before an item is even queued.
 *
 * The same checksum guarantees the same bytes, so re-adding a photograph that is
 * already waiting is a no-op rather than a second upload (PLAN/02 §8.3).
 */
export async function findByChecksum(
  serialNumber: string,
  checksum: string,
): Promise<QueueItem | undefined> {
  const items = await listQueueFor(serialNumber);
  return items.find((item) => item.checksumSha256 === checksum);
}

export async function clearQueue(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}

/**
 * How much storage the browser is willing to give this origin.
 *
 * Surfaced in the UI because of PLAN/06 §4.3: iOS clears site storage after
 * roughly seven days without a visit, and its quota is tighter. Those limits are
 * not fixable here — the honest response is to make them visible rather than to
 * imply a durability the platform does not provide.
 */
export async function estimateStorage(): Promise<{ usageBytes: number; quotaBytes: number } | null> {
  if (navigator.storage?.estimate === undefined) return null;
  const estimate = await navigator.storage.estimate();
  return { usageBytes: estimate.usage ?? 0, quotaBytes: estimate.quota ?? 0 };
}

/**
 * Asks the browser to keep this origin's storage.
 *
 * Reduces, but does not remove, the risk of a queued photograph being evicted.
 * Chrome usually grants it to an installed PWA; Safari does not offer it at all.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist === undefined) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
