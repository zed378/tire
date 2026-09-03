import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatBytes, formatRelative } from "../../lib/format.ts";
import {
  processQueue,
  removeQueueItem,
  removeQueueItems,
  retryFailedIn,
  retryQueueItem,
  subscribeToQueue,
  summarise,
} from "../../lib/photo/upload-queue.ts";
import {
  estimateStorage,
  requestPersistentStorage,
  type QueueItem,
} from "../../lib/photo/queue-store.ts";
import { Badge, Button, Card, EmptyState, PageHeader, StatTile } from "../../components/ui/primitives.tsx";
import { Banner, ConfirmDialog } from "../../components/ui/feedback.tsx";

/**
 * The upload queue (PLAN/06 §4).
 *
 * This screen tells the truth about what the platform can and cannot promise.
 * Background Sync is unavailable on iOS Safari, so the queue runs from ordinary
 * application code — photos upload while the app is open and there is signal,
 * not magically in the background. PLAN/06 §4.2 says to state that plainly
 * rather than imply otherwise, so the sentence is on the screen.
 *
 * Nothing is ever discarded quietly. An item that exhausts its retries is marked
 * failed AND SHOWN, because losing a field worker's afternoon silently would be
 * D-08 in the worst possible place.
 */
export function UploadQueuePage(): ReactNode {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [storage, setStorage] = useState<{ usageBytes: number; quotaBytes: number } | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const failedIds = items.filter((item) => item.status === "failed").map((item) => item.id);

  useEffect(() => subscribeToQueue(setItems), []);
  useEffect(() => {
    void estimateStorage().then(setStorage);
  }, [items.length]);

  const summary = summarise(items);
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

   return (
     <div className="space-y-4">
      <PageHeader
        title="Antrean Unggah Foto"
        description="Foto yang belum sampai ke server. Semuanya tersimpan di perangkat ini."
      />

      <Banner tone="info" title="Cara antrean ini bekerja">
        Foto terunggah saat aplikasi dibuka dan ada sinyal — bukan secara otomatis di latar
        belakang. Biarkan aplikasi terbuka beberapa saat setelah Anda kembali ke area bersinyal.
      </Banner>

      {/* PLAN/06 §4.3: iOS clears site storage after roughly seven days without
          a visit, and its quota is tighter. Neither limit is fixable here; the
          honest response is to make them visible. */}
      {isIos ? (
        <Banner tone="warning" title="Catatan untuk pengguna iPhone / iPad">
          iOS dapat menghapus penyimpanan situs setelah sekitar 7 hari tidak dibuka. Jangan biarkan
          foto menunggu berhari-hari — unggah segera setelah ada sinyal.
        </Banner>
      ) : null}

      {summary.hasStaleItems ? (
        <Banner tone="error" title="Ada foto yang menunggu lebih dari 48 jam">
          Foto yang menunggu terlalu lama berisiko hilang bila penyimpanan perangkat dibersihkan.
          Tekan &quot;Unggah sekarang&quot; selagi Anda ada sinyal.
        </Banner>
      ) : null}

      <Card
        title="Ringkasan"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void processQueue()} disabled={items.length === 0}>
              Unggah sekarang
            </Button>
            {/*
              One action for the whole backlog. A queue can reach three figures
              — a slot that keeps being refused fails once per photograph — and
              clearing that one "Buang" at a time is not a recovery path.

              Retry first, discard second, and the discard asks. These are
              photographs taken in the field that exist nowhere else.
            */}
            {failedIds.length > 0 ? (
              <>
                <Button variant="secondary" onClick={() => void retryFailedIn(failedIds)}>
                  Coba lagi semua ({failedIds.length})
                </Button>
                <Button variant="danger" onClick={() => setDiscarding(true)}>
                  Buang semua yang gagal
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Menunggu" value={summary.pending} />
          <StatTile label="Sedang diunggah" value={summary.uploading} />
          <StatTile
            label="Gagal"
            value={summary.failed}
            tone={summary.failed > 0 ? "danger" : "neutral"}
          />
          <StatTile label="Total ukuran" value={formatBytes(summary.totalBytes)} />
        </div>

         {storage !== null && storage.quotaBytes > 0 ? (
          <p className="mt-3 text-xs text-muted">
             Penyimpanan perangkat terpakai {formatBytes(storage.usageBytes)} dari{" "}
             {formatBytes(storage.quotaBytes)}.
             {persistent === true ? " Penyimpanan permanen aktif." : null}
           </p>
         ) : null}

        {persistent !== true ? (
          <Button
            variant="secondary"
            className="mt-2"
            onClick={() => void requestPersistentStorage().then(setPersistent)}
          >
            Minta penyimpanan permanen
          </Button>
        ) : null}
      </Card>

       <Card title="Daftar antrean">
         {items.length === 0 ? (
           <EmptyState
             title="Tidak ada foto yang menunggu"
             description="Semua foto sudah terunggah."
           />
         ) : (
           <ul className="divide-y divide-line">
             {items.map((item) => (
               <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                 <div className="min-w-0">
                  <p className="text-sm font-medium text-body">
                     <Link to={`/inspections/${item.serialNumber}`} className="hover:underline">
                       {item.serialNumber}
                     </Link>{" "}
                     · {item.positionLabel}
                   </p>
                  <p className="mt-0.5 text-xs text-subtle">
                     {formatBytes(item.byteSize)} · ditambahkan {formatRelative(item.createdAt)}
                     {item.attempts > 0 ? ` · ${item.attempts} percobaan` : ""}
                   </p>
                   {item.lastError !== null ? (
                    <p className="mt-1 text-xs text-danger-text">{item.lastError}</p>
                   ) : null}
                 </div>

                 <div className="flex items-center gap-2">
                  <Badge tone={item.status === "failed" ? "danger" : "warning"}>
                    {item.status === "failed"
                      ? "Gagal"
                      : item.status === "uploading"
                        ? "Mengunggah"
                        : "Menunggu"}
                  </Badge>

                   {item.status === "failed" ? (
                     <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void retryQueueItem(item.id)}
                      >
                         Coba lagi
                       </Button>
                      <Button variant="ghost" size="sm" onClick={() => void removeQueueItem(item.id)}>
                         Buang
                       </Button>
                     </>
                   ) : null}
                 </div>
               </li>
             ))}
           </ul>
         )}
       </Card>

      <ConfirmDialog
        open={discarding}
        title="Buang semua foto yang gagal?"
        description={`${String(failedIds.length)} foto akan dihapus dari perangkat ini dan tidak dapat dikembalikan. Foto yang sudah terunggah tidak terpengaruh.`}
        confirmLabel="Buang"
        onConfirm={() => {
          void removeQueueItems(failedIds);
          setDiscarding(false);
        }}
        onClose={() => {
          setDiscarding(false);
        }}
      />
    </div>
  );
}

