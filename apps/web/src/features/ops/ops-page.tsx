import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HealthReport, JobRecord, LogEntry, OrphanUpload } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatBytes, formatDateTime, formatNumber } from "../../lib/format.ts";
import {
  Banner,
  CancelButton,
  Dialog,
  DialogFooter,
  ErrorBanner,
  useToast,
} from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Field, Input, Spinner } from "../../components/ui/primitives.tsx";

/**
 * The operations panel (PLAN/10 §3).
 *
 * It exists because operations are run by a third person who does not read the
 * code, has no `psql`, and must resolve most problems without calling the system
 * owner. PLAN/10 §1 states the consequence: every operational task without an
 * interface becomes a phone call, and enough of those mean the role split has
 * failed.
 *
 * The scope is deliberately narrow. A panel that can do everything is a panel
 * that can break everything: no free-form SQL, no action that deletes business
 * data, every action audited, and every mutation behind a two-step confirmation
 * (PLAN/10 §3.2).
 */
export function OpsPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [requestId, setRequestId] = useState("");
  const [searchedRequestId, setSearchedRequestId] = useState("");
  const [confirming, setConfirming] = useState<null | { action: "retry" | "cleanup"; ids: string[] }>(
    null,
  );
  const [error, setError] = useState<unknown>(null);

  const health = useQuery({
    queryKey: ["ops-health"],
    queryFn: () => api.get<HealthReport>("/api/ops/health"),
    refetchInterval: 30_000,
  });

  const jobs = useQuery({
    queryKey: ["ops-jobs"],
    queryFn: () => api.get<JobRecord[]>("/api/ops/jobs", { state: "failed" }),
  });

  const orphans = useQuery({
    queryKey: ["ops-orphans"],
    queryFn: () => api.get<OrphanUpload[]>("/api/ops/orphans"),
  });

  const logs = useQuery({
    queryKey: ["ops-logs", searchedRequestId],
    queryFn: () => api.get<LogEntry[]>("/api/ops/logs", { requestId: searchedRequestId }),
    enabled: searchedRequestId !== "",
  });

  const retryJobs = useMutation({
    mutationFn: (jobIds: string[]) => api.post("/api/ops/jobs/retry", { jobIds, confirm: true }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Pekerjaan dijadwalkan ulang." });
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ["ops-jobs"] });
    },
    onError: (caught) => {
      setConfirming(null);
      setError(caught);
    },
  });

  const cleanupOrphans = useMutation({
    mutationFn: (storageKeys: string[]) =>
      api.post("/api/ops/orphans/cleanup", { storageKeys, confirm: true }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Unggahan terlantar dibersihkan." });
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ["ops-orphans"] });
    },
    onError: (caught) => {
      setConfirming(null);
      setError(caught);
    },
  });

  const report = health.data;

  return (
     <div className="space-y-4">
       <h1 className="text-lg font-semibold text-body">Panel Operasional</h1>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {/* PLAN/12 §7.1: the signal most easily missed. An outbox that stops being
          processed raises no error at all — the system looks healthy while
          nobody is being told anything. Queue depth does not catch that; only
          the AGE of the oldest entry does. */}
      {report !== undefined &&
      report.queue.oldestUnprocessedOutboxSeconds !== null &&
      report.queue.oldestUnprocessedOutboxSeconds > 300 ? (
        <Banner tone="error" title="Outbox notifikasi macet">
          Entri tertua sudah menunggu {report.queue.oldestUnprocessedOutboxSeconds} detik. Selama ini
          terjadi, tidak ada notifikasi yang terkirim kepada siapa pun — tanpa error apa pun. Segera
          eskalasi ke pemilik sistem.
        </Banner>
      ) : null}

       <Card title="Kesehatan Sistem">
         {report === undefined ? (
           <div className="flex justify-center py-6 text-muted">
             <Spinner className="h-5 w-5" />
           </div>
         ) : (
           <>
             <div className="mb-3 flex items-center gap-2">
               <span
                 className={
                   report.status === "ok"
                     ? "rounded-full border border-success-line bg-success-soft px-3 py-1 text-sm text-success-text"
                     : report.status === "degraded"
                       ? "rounded-full border border-warning-line bg-warning-soft px-3 py-1 text-sm text-warning-text"
                       : "rounded-full border border-danger-line bg-danger-soft px-3 py-1 text-sm text-danger-text"
                 }
               >
                 {report.status === "ok"
                   ? "Normal"
                   : report.status === "degraded"
                     ? "Terganggu"
                     : "Tidak berjalan"}
               </span>
               <span className="text-sm text-muted">versi {report.version}</span>
             </div>

             <ul className="divide-y divide-line">
               {report.checks.map((check) => (
                 <li key={check.name} className="flex items-center justify-between py-2 text-sm">
                   <span className="text-body">{check.name}</span>
                   <span className="text-muted">
                    {check.detail}
                    {check.latencyMs !== null ? ` · ${check.latencyMs} ms` : ""}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Antrean" value={formatNumber(report.queue.depth)} />
              <Metric label="Gagal 24 jam" value={formatNumber(report.queue.failedLast24h)} />
              <Metric label="Penyimpanan" value={formatBytes(report.storage.usedBytes)} />
              <Metric label="Jumlah foto" value={formatNumber(report.storage.objectCount)} />
            </dl>
          </>
        )}
      </Card>

      {/* PLAN/10 §3.3: with a separate operator this field is the backbone of
          support. A report starts with the user quoting a code, and it has to
          lead straight to what happened. */}
      <Card
        title="Pencarian Log"
        description="Tempel kode permintaan yang dilaporkan pengguna, misalnya req_20260901_143022_a91f."
      >
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setSearchedRequestId(requestId.trim());
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <Field label="Kode permintaan" htmlFor="ops-request">
            <Input
              id="ops-request"
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={requestId.trim().length < 6}>
            Cari
          </Button>
        </form>

         {searchedRequestId !== "" ? (
           logs.data === undefined ? (
             <div className="mt-3 flex justify-center py-4 text-muted">
               <Spinner className="h-5 w-5" />
             </div>
           ) : logs.data.length === 0 ? (
             <p className="mt-3 text-sm text-muted">
               Tidak ada catatan untuk kode ini. Eskalasi ke pemilik sistem dengan menyertakan kodenya.
             </p>
           ) : (
             <ul className="mt-3 divide-y divide-line">
               {logs.data.map((entry, index) => (
                 <li key={`${entry.timestamp}-${String(index)}`} className="py-2 text-sm">
                   <p className="text-body">{entry.message}</p>
                   <p className="text-xs text-muted">
                    {formatDateTime(entry.timestamp)}
                    {entry.role !== null ? ` · ${entry.role}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>

      <Card
        title="Pekerjaan Latar yang Gagal"
        description="7 hari terakhir."
        actions={
          jobs.data !== undefined && jobs.data.length > 0 ? (
            <Button
              onClick={() =>
                setConfirming({ action: "retry", ids: (jobs.data ?? []).map((job) => job.id) })
              }
            >
              Coba Lagi Semua
            </Button>
          ) : undefined
        }
      >
         {jobs.data === undefined ? (
           <div className="flex justify-center py-6 text-muted">
             <Spinner className="h-5 w-5" />
           </div>
         ) : jobs.data.length === 0 ? (
           <EmptyState
             title="Tidak ada pekerjaan yang gagal"
             description="Semua pekerjaan latar berjalan normal."
           />
         ) : (
           <ul className="divide-y divide-line">
             {jobs.data.map((job) => (
               <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                 <div className="min-w-0">
                   <p className="text-sm font-medium text-body">{job.name}</p>
                   <p className="text-xs text-muted">
                    {formatDateTime(job.createdAt)} · {job.retryCount} percobaan
                    {job.requestId !== null ? ` · ${job.requestId}` : ""}
                  </p>
                  {job.errorMessage !== null ? (
                    <p className="mt-1 text-xs text-danger-text">{job.errorMessage}</p>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setConfirming({ action: "retry", ids: [job.id] })}
                >
                  Coba Lagi
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Unggahan Terlantar"
        description="Foto yang mendapat izin unggah tetapi tidak pernah selesai, lebih dari 24 jam."
        actions={
          orphans.data !== undefined && orphans.data.length > 0 ? (
            <Button
              variant="secondary"
              onClick={() =>
                setConfirming({
                  action: "cleanup",
                  ids: (orphans.data ?? []).map((orphan) => orphan.storageKey),
                })
              }
            >
              Bersihkan Semua
            </Button>
          ) : undefined
        }
      >
        {orphans.data === undefined || orphans.data.length === 0 ? (
          <EmptyState
            title="Tidak ada unggahan terlantar"
            description="Semua unggahan yang dimulai sudah selesai."
          />
        ) : (
          <>
            {/* PLAN/10 §3.2 rule 2: this only ever touches objects that never
                had a completed photo row. It cannot reach a photograph somebody
                actually took. */}
            <Banner tone="info">
              Pembersihan ini hanya menyentuh objek yang tidak pernah punya baris foto yang selesai.
              Foto yang sudah tercatat tidak akan terpengaruh.
            </Banner>
             <ul className="mt-3 divide-y divide-line">
               {orphans.data.slice(0, 20).map((orphan) => (
                 <li key={orphan.storageKey} className="py-2 text-sm">
                   <p className="break-all font-mono text-xs text-body">{orphan.storageKey}</p>
                   <p className="text-xs text-muted">
                    {formatBytes(orphan.byteSize)} · {orphan.ageHours} jam
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* Two-step confirmation in an application dialog, never confirm()
          (PLAN/10 §3.2 rule 4). */}
      <Dialog
        open={confirming !== null}
        title={confirming?.action === "retry" ? "Jalankan ulang pekerjaan?" : "Bersihkan unggahan terlantar?"}
        description={
          confirming?.action === "retry"
            ? `${String(confirming.ids.length)} pekerjaan akan dijadwalkan ulang. Tindakan ini tercatat di jejak audit.`
            : `${String(confirming?.ids.length ?? 0)} objek akan dihapus permanen. Tindakan ini tercatat di jejak audit.`
        }
        onClose={() => setConfirming(null)}
      >
        <DialogFooter>
          <CancelButton onClick={() => setConfirming(null)} />
          <Button
            variant={confirming?.action === "cleanup" ? "danger" : "primary"}
            loading={retryJobs.isPending || cleanupOrphans.isPending}
            onClick={() => {
              if (confirming === null) return;
              if (confirming.action === "retry") retryJobs.mutate(confirming.ids);
              else cleanupOrphans.mutate(confirming.ids);
            }}
          >
            Ya, lanjutkan
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-body">{value}</dd>
    </div>
  );
}
