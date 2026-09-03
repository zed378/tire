import { checkPhotoQuota, type PresignResult } from "@c26/contracts";
import { api, isApiError } from "../api-client.ts";
import {
  deleteQueueItem,
  findByChecksum,
  listQueue,
  listQueueFor,
  putQueueItem,
  type QueueItem,
} from "./queue-store.ts";
import { compressPhoto } from "./compress.ts";

/**
 * The offline upload queue processor (PLAN/06 §4).
 *
 * IT DOES NOT RELY ON BACKGROUND SYNC. That API is absent on iOS Safari, and
 * while most Indonesian field workers use Android, not all do. So the queue runs
 * from ordinary application code whenever the app is open, and Background Sync
 * is a bonus where it exists rather than the foundation.
 *
 * The consequence has to be said plainly to users, and the queue screen says it:
 * photos upload while the application is open and there is signal. Not
 * magically in the background.
 *
 * Retries use exponential backoff with jitter, cap at 8 attempts, and then mark
 * the item `failed` AND SHOW IT. Nothing is ever discarded quietly — that would
 * be D-08 reappearing in the one place where the cost is losing a field
 * worker's afternoon.
 */

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 2_000;
const POLL_INTERVAL_MS = 30_000;

export type QueueListener = (items: QueueItem[]) => void;

const listeners = new Set<QueueListener>();
let processing = false;
let pollTimer: number | null = null;

async function notifyListeners(): Promise<void> {
  const items = await listQueue();
  for (const listener of listeners) listener(items);
}

export function subscribeToQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  void notifyListeners();
  return () => listeners.delete(listener);
}

/** Backoff with jitter, so a returning signal does not stampede the server. */
function backoffFor(attempts: number): number {
  const base = BASE_BACKOFF_MS * Math.pow(2, attempts);
  const jitter = Math.random() * base * 0.3;
  return Math.min(base + jitter, 5 * 60 * 1000);
}

export interface EnqueueInput {
  serialNumber: string;
  tirePositionId: number | null;
  positionLabel: string;
  slot: QueueItem["slot"];
  file: File;
  /** Photographs the SERVER already holds for this slot and this inspection. */
  uploadedInSlot: number;
  uploadedInInspection: number;
}

/**
 * Refused before it costs anything.
 *
 * V-13 was enforced on the server at presign and nowhere on the device, so the
 * queue accepted as many photographs as were selected. Each one then failed
 * permanently with "Maksimal 10 foto per slot" and stayed in the queue — which
 * is how a slot came to read `52/10` on a screen whose own caption says the
 * maximum is ten, with the file input hidden because the count was over the cap
 * and no way to clear the fifty-two.
 *
 * The rule itself is not restated here. `checkPhotoQuota` in `@c26/contracts` is
 * the same function the server calls, so the device and the server cannot
 * disagree about what the cap is.
 */
export function quotaViolationFor(
  input: Pick<EnqueueInput, "slot" | "tirePositionId" | "uploadedInSlot" | "uploadedInInspection">,
  queued: readonly QueueItem[],
): { message: string } | null {
  // A `done` item is a photograph the server already counted; counting it here
  // as well would refuse the eleventh photograph when only ten exist.
  const inFlight = queued.filter((item) => item.status !== "done");

  const sameSlot = inFlight.filter(
    (item) => item.slot === input.slot && item.tirePositionId === input.tirePositionId,
  );

  return checkPhotoQuota({
    slotCount: input.uploadedInSlot + sameSlot.length,
    inspectionCount: input.uploadedInInspection + inFlight.length,
  });
}

export async function enqueuePhoto(input: EnqueueInput): Promise<QueueItem> {
  const violation = quotaViolationFor(input, await listQueueFor(input.serialNumber));
  if (violation !== null) throw new Error(violation.message);

  const compressed = await compressPhoto(input.file);

  // A photo already waiting with the same bytes is not queued twice.
  const existing = await findByChecksum(input.serialNumber, compressed.checksumSha256);
  if (existing !== undefined) return existing;

  const item: QueueItem = {
    id: crypto.randomUUID(),
    serialNumber: input.serialNumber,
    tirePositionId: input.tirePositionId,
    positionLabel: input.positionLabel,
    slot: input.slot,
    blob: compressed.blob,
    mimeType: compressed.mimeType,
    byteSize: compressed.blob.size,
    width: compressed.width,
    height: compressed.height,
    checksumSha256: compressed.checksumSha256,
    capturedAt: compressed.capturedAt,
    status: "pending",
    attempts: 0,
    lastError: null,
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
  };

  await putQueueItem(item);
  await notifyListeners();
  void processQueue();

  return item;
}

async function uploadOne(item: QueueItem): Promise<void> {
  // Step 1: presign. The server checks ownership, status, both photo caps, size,
  // and type here — the token it returns carries that decision (PLAN/05 §7).
  const presigned = await api.post<PresignResult>(
    `/api/inspections/${item.serialNumber}/photos/presign`,
    {
      slot: item.slot,
      tirePositionId: item.tirePositionId ?? undefined,
      byteSize: item.byteSize,
      mimeType: item.mimeType,
      checksumSha256: item.checksumSha256,
    },
  );

  // The server already has this exact photograph. A retry after a dropped
  // connection costs nothing and produces no duplicate.
  if (presigned.alreadyUploaded) {
    await deleteQueueItem(item.id);
    return;
  }

  // Step 2: PUT the bytes to the URL we were handed. Whether that is R2 or this
  // API's own upload route is not the client's concern.
  const response = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: { "content-type": item.mimeType },
    body: item.blob,
  });

  if (!response.ok) {
    throw new Error(`upload responded ${String(response.status)}`);
  }

  // Step 3: confirm. The server verifies the object landed before a row claims
  // it did — otherwise an inspection can look complete with no evidence behind
  // it.
  await api.post(`/api/inspections/${item.serialNumber}/photos/confirm`, {
    storageKey: presigned.storageKey,
    checksumSha256: item.checksumSha256,
    width: item.width,
    height: item.height,
    capturedAt: item.capturedAt,
  });

  await deleteQueueItem(item.id);
}

export async function processQueue(): Promise<void> {
  if (processing) return;
  if (!navigator.onLine) return;

  processing = true;
  try {
    const items = await listQueue();
    const now = Date.now();

    for (const item of items) {
      if (item.status === "done") continue;
      if (item.status === "failed" && item.attempts >= MAX_ATTEMPTS) continue;
      if (item.nextAttemptAt > now) continue;

      await putQueueItem({ ...item, status: "uploading" });
      await notifyListeners();

      try {
        await uploadOne(item);
      } catch (error) {
        const attempts = item.attempts + 1;
        const permanent =
          isApiError(error) &&
          // These will not succeed on a retry: the inspection has moved on, the
          // cap is reached, or the file is not acceptable. Retrying them five
          // more times only delays telling the user (PLAN/12 §6).
          ["VALIDATION_ERROR", "FORBIDDEN_ROLE", "NOT_FOUND", "INVALID_STATE_TRANSITION",
            "FILE_TOO_LARGE", "UNSUPPORTED_FILE_TYPE"].includes(error.code);

        await putQueueItem({
          ...item,
          status: permanent || attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          lastError: error instanceof Error ? error.message : "Gagal mengunggah.",
          nextAttemptAt: Date.now() + backoffFor(attempts),
        });
      }

      await notifyListeners();
    }
  } finally {
    processing = false;
  }
}

/** Manual retry from the queue screen, for an item that gave up. */
export async function retryQueueItem(id: string): Promise<void> {
  const items = await listQueue();
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) return;

  await putQueueItem({ ...item, status: "pending", attempts: 0, nextAttemptAt: Date.now() });
  await notifyListeners();
  void processQueue();
}

export async function removeQueueItem(id: string): Promise<void> {
  await deleteQueueItem(id);
  await notifyListeners();
}

/**
 * Retry, or discard, every failed photograph in one slot.
 *
 * The per-item controls live on the queue screen. These exist because the
 * supplier is on the inspection screen when the failures appear, and a slot
 * whose every photograph failed left them with no way forward at all: no retry,
 * no removal, and — once the failures pushed the count past the cap — no file
 * input either.
 */
export async function retryFailedIn(ids: string[]): Promise<void> {
  const items = await listQueue();
  for (const item of items.filter((candidate) => ids.includes(candidate.id))) {
    await putQueueItem({ ...item, status: "pending", attempts: 0, nextAttemptAt: Date.now() });
  }
  await notifyListeners();
  void processQueue();
}

export async function removeQueueItems(ids: string[]): Promise<void> {
  for (const id of ids) await deleteQueueItem(id);
  await notifyListeners();
}

/**
 * Starts the processor.
 *
 * It runs when the application opens, when the connection returns, when the tab
 * becomes visible, and every 30 seconds while anything is queued — the four
 * moments PLAN/06 §4.1 lists.
 */
export function startQueueProcessor(): () => void {
  const run = (): void => {
    void processQueue();
  };

  run();
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", run);
  pollTimer = window.setInterval(run, POLL_INTERVAL_MS);

  return () => {
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", run);
    if (pollTimer !== null) window.clearInterval(pollTimer);
  };
}

export interface QueueSummary {
  pending: number;
  uploading: number;
  failed: number;
  totalBytes: number;
  /** Anything waiting longer than 48 hours gets a prominent warning (PLAN/06 §4.3). */
  hasStaleItems: boolean;
}

export function summarise(items: QueueItem[]): QueueSummary {
  const staleThreshold = Date.now() - 48 * 60 * 60 * 1000;

  return {
    pending: items.filter((item) => item.status === "pending").length,
    uploading: items.filter((item) => item.status === "uploading").length,
    failed: items.filter((item) => item.status === "failed").length,
    totalBytes: items.reduce((sum, item) => sum + item.byteSize, 0),
    hasStaleItems: items.some(
      (item) => item.status !== "done" && item.createdAt < staleThreshold,
    ),
  };
}
