import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  INSPECTION_STATUS_LABELS,
  INSPECTION_STATUSES,
  type InspectionListItem,
  type InspectionStatus,
  type Paginated,
  type QcStats,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { endOfDayIso, formatDate, formatNumber, startOfDayIso } from "../../lib/format.ts";
import { ErrorBanner, StatusBadge } from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Field, Input, Select, Spinner } from "../../components/ui/primitives.tsx";

/**
 * The QC work queue (PLAN/08 F4).
 *
 * Two defects closed at once. D-02: the legacy card was titled "Riwayat" and
 * contained no table at all — only a filter and three numbers, so an admin had
 * no list of work. D-01: those filters were never wired to the data, so a date
 * range of 2020 still returned a 2026 record and the counters never moved.
 *
 * Here the filter is the query, and the counters answer the same filter as the
 * table beneath them.
 */
export function QcQueuePage(): ReactNode {
  const [status, setStatus] = useState<InspectionStatus | "">("pending_qc");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filters = {
    status: status === "" ? undefined : status,
    submittedFrom: from === "" ? undefined : startOfDayIso(from),
    submittedTo: to === "" ? undefined : endOfDayIso(to),
    q: search === "" ? undefined : search,
  };

  const queue = useQuery({
    queryKey: ["qc-queue", { ...filters, page }],
    queryFn: () => api.get<Paginated<InspectionListItem>>("/api/qc/queue", { ...filters, page }),
  });

  const stats = useQuery({
    queryKey: ["qc-stats", filters],
    queryFn: () => api.get<QcStats>("/api/qc/stats", filters),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-body">Quality Control</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Menunggu QC" value={stats.data?.pending} tone="pending" />
        <StatCard label="Pass QC" value={stats.data?.passed} tone="pass" />
        <StatCard label="Perlu Revisi" value={stats.data?.needsRevision} tone="revision" />
        <StatCard label="Drop QC" value={stats.data?.dropped} tone="drop" />
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status" htmlFor="qc-status">
            <Select
              id="qc-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as InspectionStatus | "");
                setPage(1);
              }}
            >
              <option value="">Semua status</option>
              {INSPECTION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {INSPECTION_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Dikirim dari" htmlFor="qc-from">
            <Input
              id="qc-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field label="Sampai" htmlFor="qc-to">
            <Input
              id="qc-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field label="Cari plat nomor" htmlFor="qc-q">
            <Input
              id="qc-q"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
      </Card>

      {queue.error !== null ? <ErrorBanner error={queue.error} /> : null}

      <Card title="Antrean kerja">
        {queue.isLoading ? (
          <div className="flex justify-center py-10 text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : queue.data === undefined || queue.data.items.length === 0 ? (
          <EmptyState
            title="Tidak ada pengajuan pada filter ini"
            description="Ubah filter di atas untuk melihat pengajuan lain."
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {queue.data.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-body">
                      {item.serialNumber} · {item.plateDisplay}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {item.cityName}, {item.provinceName} · {item.category} · {item.totalTires} ban
                      · {item.photoCount} foto
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {item.submittedByName} ·{" "}
                      {item.submittedAt === null ? "belum dikirim" : formatDate(item.submittedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <Link to={`/qc/${item.serialNumber}`}>
                      <Button variant="secondary">Tinjau</Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <nav className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted">
                Halaman {queue.data.page} dari {queue.data.totalPages} · {queue.data.total} data
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={queue.data.page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="secondary"
                  disabled={queue.data.page >= queue.data.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </nav>
          </>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: "pending" | "pass" | "revision" | "drop";
}): ReactNode {
  const tones = {
    pending: "border-warning-line bg-warning-soft text-warning-text",
    pass: "border-success-line bg-success-soft text-success-text",
    revision: "border-warning-line bg-warning-soft text-warning-text",
    drop: "border-danger-line bg-danger-soft text-danger-text",
  } as const;

  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {value === undefined ? "—" : formatNumber(value)}
      </p>
    </div>
  );
}
