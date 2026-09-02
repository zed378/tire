import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatBytes, formatRelative } from "../../lib/format.ts";
import {
  processQueue,
  removeQueueItem,
  retryQueueItem,
  subscribeToQueue,
  summarise,
} from "../../lib/photo/upload-queue.ts";
import {
  estimateStorage,
  requestPersistentStorage,
  type QueueItem,
} from "../../lib/photo/queue-store.ts";
import { Banner } from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState } from "../../components/ui/primitives.tsx";

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

  useEffect(() => subscribeToQueue(setItems), []);
  useEffect(() => {
    void estimateStorage().then(setStorage);
  }, [items.length]);

  const summary = summarise(items);
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

   return (
     <div className="space-y-4">
       <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Antrean Unggah Foto</h1>

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
          <Button onClick={() => void processQueue()} disabled={items.length === 0}>
            Unggah sekarang
          </Button>
        }
      >
         <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
           <Stat label="Menunggu" value={String(summary.pending)} />
           <Stat label="Sedang diunggah" value={String(summary.uploading)} />
           <Stat label="Gagal" value={String(summary.failed)} tone={summary.failed > 0 ? "bad" : undefined} />
           <Stat label="Total ukuran" value={formatBytes(summary.totalBytes)} />
         </dl>

         {storage !== null && storage.quotaBytes > 0 ? (
           <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
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
           <ul className="divide-y divide-slate-200 dark:divide-slate-700">
             {items.map((item) => (
               <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                 <div className="min-w-0">
                   <p className="text-sm font-medium text-slate-900 dark:text-white">
                     <Link to={`/inspections/${item.serialNumber}`} className="hover:underline">
                       {item.serialNumber}
                     </Link>{" "}
                     · {item.positionLabel}
                   </p>
                   <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                     {formatBytes(item.byteSize)} · ditambahkan {formatRelative(item.createdAt)}
                     {item.attempts > 0 ? ` · ${item.attempts} percobaan` : ""}
                   </p>
                   {item.lastError !== null ? (
                     <p className="mt-1 text-xs text-red-700 dark:text-red-400">{item.lastError}</p>
                   ) : null}
                 </div>

                 <div className="flex items-center gap-2">
                   <span
                     className={
                       item.status === "failed"
                         ? "rounded-full border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 text-xs text-red-800 dark:text-red-200"
                         : "rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200"
                     }
                   >
                     {item.status === "failed"
                       ? "Gagal"
                       : item.status === "uploading"
                         ? "Mengunggah"
                         : "Menunggu"}
                   </span>

                   {item.status === "failed" ? (
                     <>
                       <Button variant="secondary" onClick={() => void retryQueueItem(item.id)}>
                         Coba lagi
                       </Button>
                       <Button variant="ghost" onClick={() => void removeQueueItem(item.id)}>
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
    </div>
  );
}

function Stat({
   label,
   value,
   tone,
 }: {
   label: string;
   value: string;
   tone?: "bad";
 }): ReactNode {
   return (
     <div>
       <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
       <dd
         className={
           tone === "bad"
             ? "mt-0.5 text-xl font-semibold text-red-700 dark:text-red-400"
             : "mt-0.5 text-xl font-semibold text-slate-900 dark:text-white"
         }
       >
         {value}
       </dd>
     </div>
   );
 }
