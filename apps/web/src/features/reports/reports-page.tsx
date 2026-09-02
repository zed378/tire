import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  EXPORT_KIND_LABELS,
  EXPORT_KINDS,
  EXPORT_POLL_INTERVAL_MS,
  type ExportJobStatus,
  type ExportKind,
  type MasterDataBundle,
  type RegionProgressResult,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { endOfDayIso, formatDate, formatDateTime, formatNumber, startOfDayIso } from "../../lib/format.ts";
import { Banner, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, Select, Spinner } from "../../components/ui/primitives.tsx";
import { LineChart } from "../../components/ui/line-chart.tsx";

/**
 * The regional dashboard and export (F-11, PLAN/08 F5).
 *
 * Two things the legacy version lacked: date and category filters, and a table
 * beside the chart. A line chart alone cannot be checked against a manual count,
 * and "the numbers match a hand count of the test data" is the acceptance
 * criterion for this phase.
 */
export function ReportsPage(): ReactNode {
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [category, setCategory] = useState<"TB" | "LT" | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const master = useQuery({
    queryKey: ["masterdata"],
    queryFn: () => api.get<MasterDataBundle>("/api/masterdata"),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const progress = useQuery({
    queryKey: ["region-progress", { provinceId, category, from, to }],
    queryFn: () =>
      api.get<RegionProgressResult>("/api/reports/region-progress", {
        provinceId: provinceId ?? undefined,
        category: category === "" ? undefined : category,
        from: from === "" ? undefined : startOfDayIso(from),
        to: to === "" ? undefined : endOfDayIso(to),
        groupBy: "day",
      }),
  });

  const chartData = (progress.data?.points ?? [])
    .reduce<{ period: string; TB: number; LT: number }[]>((accumulator, point) => {
      const existing = accumulator.find((row) => row.period === point.period);
      if (existing === undefined) {
        accumulator.push({ period: point.period, TB: point.tb, LT: point.lt });
      } else {
        existing.TB += point.tb;
        existing.LT += point.lt;
      }
      return accumulator;
    }, [])
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((row) => ({ ...row, label: formatDate(row.period) }));

  return (
     <div className="space-y-4">
       <h1 className="text-lg font-semibold text-body">Pelaporan</h1>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Provinsi" htmlFor="report-province">
            <Select
              id="report-province"
              value={provinceId ?? ""}
              onChange={(event) =>
                setProvinceId(event.target.value === "" ? null : Number(event.target.value))
              }
            >
              <option value="">Semua provinsi</option>
              {(master.data?.provinces ?? []).map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Kategori" htmlFor="report-category">
            <Select
              id="report-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as "TB" | "LT" | "")}
            >
              <option value="">TB dan LT</option>
              <option value="TB">TB (Truck &amp; Bus)</option>
              <option value="LT">LT (Light Truck)</option>
            </Select>
          </Field>

          <Field label="Dari tanggal" htmlFor="report-from">
            <Input
              id="report-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>

          <Field label="Sampai tanggal" htmlFor="report-to">
            <Input
              id="report-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      {progress.error !== null ? <ErrorBanner error={progress.error} /> : null}

       <div className="grid gap-3 sm:grid-cols-3">
         <Total label="Total TB" value={progress.data?.totals.tb} />
         <Total label="Total LT" value={progress.data?.totals.lt} />
         <Total label="Total Keseluruhan" value={progress.data?.totals.total} />
       </div>

       <Card
         title="Progres per Hari"
         description="Hanya pengajuan berstatus Pass QC yang dihitung."
       >
         {progress.isLoading ? (
           <div className="flex justify-center py-16 text-muted">
             <Spinner className="h-5 w-5" />
           </div>
         ) : chartData.length === 0 ? (
           <p className="py-10 text-center text-sm text-muted">
             Belum ada data pada filter ini.
           </p>
        ) : (
          <LineChart
            data={chartData}
            categoryKey="label"
            series={[
              // TB versus LT is the axis the whole management dashboard sits on
              // (K-04), so the two lines are the chart.
              { key: "TB", label: "TB (Truck & Bus)", tone: "primary" },
              { key: "LT", label: "LT (Light Truck)", tone: "secondary" },
            ]}
          />
        )}

         {/* Stated, not implied. The materialised view refreshes every ten
             minutes, and a dashboard that presents ten-minute-old numbers as live
             invites the wrong kind of trust. */}
         {progress.data?.refreshedAt !== null && progress.data?.refreshedAt !== undefined ? (
           <p className="mt-2 text-xs text-muted">
             Agregat terakhir disegarkan {formatDateTime(progress.data.refreshedAt)}.
           </p>
         ) : null}
      </Card>

      {/* The companion table. A chart alone cannot be checked against a manual
          count, which is exactly what the F5 acceptance list asks for. */}
       <Card title="Rincian per Kota">
         {progress.data === undefined || progress.data.points.length === 0 ? (
           <p className="py-6 text-center text-sm text-muted">Belum ada data.</p>
         ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-sm">
               <thead>
                 <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                   <th className="py-2 pr-3">Tanggal</th>
                   <th className="py-2 pr-3">Provinsi</th>
                   <th className="py-2 pr-3">Kota</th>
                   <th className="py-2 pr-3 text-right">TB</th>
                   <th className="py-2 pr-3 text-right">LT</th>
                   <th className="py-2 text-right">Total</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-line">
                {progress.data.points.map((point) => (
                  <tr key={`${point.period}-${point.cityId}`}>
                    <td className="py-2 pr-3">{formatDate(point.period)}</td>
                    <td className="py-2 pr-3">{point.provinceName}</td>
                    <td className="py-2 pr-3">{point.cityName}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(point.tb)}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(point.lt)}</td>
                    <td className="py-2 text-right font-medium">{formatNumber(point.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ExportPanel />
    </div>
  );
}

 function Total({ label, value }: { label: string; value: number | undefined }): ReactNode {
   return (
     <div className="rounded-lg border border-line bg-surface/50 p-3">
       <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
       <p className="mt-1 text-2xl font-semibold text-body">
         {value === undefined ? "—" : formatNumber(value)}
       </p>
     </div>
   );
 }

/**
 * Export with visible progress (PLAN/05 §8) — closes D-09.
 *
 * The legacy buttons produced nothing at all: no spinner, no notification, no
 * new tab. There was no way to tell success from failure. Here the click queues
 * a job, the client polls every two seconds, and the finished file arrives as a
 * download link.
 */
/** A job still queued after this long is reported, not spun at. */
const STALLED_AFTER_SECONDS = 20;

/** And polling gives up here rather than running until the tab is closed. */
const STOP_POLLING_AFTER_SECONDS = 300;

function elapsedSeconds(since: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 1000));
}

function ExportPanel(): ReactNode {
  const toast = useToast();
  const [kind, setKind] = useState<ExportKind>("qc");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const request = useMutation({
    mutationFn: () => api.post<{ jobId: string }>("/api/reports/export", { kind }),
    onSuccess: (result) => {
      setJobId(result.jobId);
      toast.push({ tone: "info", message: "Menyiapkan berkas…" });
    },
    onError: setError,
  });

  const status = useQuery({
    queryKey: ["export-status", jobId],
    queryFn: () => api.get<ExportJobStatus>(`/api/exports/${jobId ?? ""}`),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data === undefined) return EXPORT_POLL_INTERVAL_MS;
      if (data.status === "done" || data.status === "failed") return false;
      // Stop after the give-up threshold. Polling forever costs the server a
      // request every two seconds and tells the user nothing.
      return elapsedSeconds(data.requestedAt) > STOP_POLLING_AFTER_SECONDS
        ? false
        : EXPORT_POLL_INTERVAL_MS;
    },
  });

  const job = status.data;
  const waiting = job !== undefined && (job.status === "queued" || job.status === "running");
  const stalledSeconds = job === undefined ? 0 : elapsedSeconds(job.requestedAt);

  /**
   * A job that has not even started after this long almost always means nothing
   * is consuming the queue — in development, that the worker was not started.
   *
   * Saying so is the whole point. The alternative, which is what this screen did
   * before, is "Menyiapkan berkas…" forever while the client polls every two
   * seconds and the server answers 200 each time: nothing broken, nothing said.
   * That is D-08 wearing a spinner.
   */
  const stalled = waiting && job.status === "queued" && stalledSeconds > STALLED_AFTER_SECONDS;

  return (
    <Card title="Export Excel" description="Berkas disusun di latar belakang; Anda tidak perlu menunggu di halaman ini.">
      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Jenis data" htmlFor="export-kind">
          <Select
            id="export-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as ExportKind)}
          >
            {EXPORT_KINDS.map((value) => (
              <option key={value} value={value}>
                {EXPORT_KIND_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Button loading={request.isPending} loadingText="Mengantre…" onClick={() => request.mutate()}>
          Buat Export
        </Button>
      </div>

       {stalled ? (
         <Banner tone="warning" title="Berkas belum mulai disusun">
           <p>
             Permintaan sudah masuk antrean {stalledSeconds} detik lalu tetapi belum diproses.
             Biasanya ini berarti pekerjaan latar tidak sedang berjalan.
           </p>
           <p className="mt-1 text-xs">
             Saat pengembangan, jalankan <code className="rounded bg-current/10 px-1 font-mono">pnpm dev</code> (yang kini
             menjalankan worker juga). Di produksi, periksa Panel Operasional — bagian antrean
             pekerjaan menunjukkan kedalamannya.
           </p>
           <p className="mt-1 text-xs">
             Permintaan Anda tidak hilang: ia tetap di antrean dan akan diproses begitu worker
             berjalan.
           </p>
         </Banner>
       ) : null}

       {job !== undefined ? (
         <div className="mt-4">
           {job.status === "done" ? (
             <Banner tone="success" title="Berkas siap">
               <p>{formatNumber(job.rowCount ?? 0)} baris.</p>
               {job.downloadUrl !== null ? (
                 <a href={job.downloadUrl} className="mt-1 inline-block font-medium underline text-body" download>
                   Unduh berkas
                 </a>
               ) : null}
             </Banner>
           ) : job.status === "failed" ? (
             <Banner tone="error" title="Export gagal">
               {job.error ?? "Silakan coba lagi."}
             </Banner>
           ) : (
             <div>
               <p className="text-sm text-muted">
                 {job.status === "queued" ? "Menunggu giliran…" : "Menyusun berkas…"} ({job.progress}
                 %)
               </p>
               {/* A native <progress>: an inline width style would be blocked
                   by the CSP, which carries no 'unsafe-inline' (PLAN/13 §7). */}
               <progress
                 className="mt-2 h-2 w-full"
                 max={100}
                 value={job.progress}
                 aria-label="Progres penyusunan berkas"
               >
                 {job.progress}%
               </progress>
             </div>
           )}
         </div>
       ) : null}
    </Card>
  );
}
