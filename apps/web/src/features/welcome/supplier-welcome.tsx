import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { INSPECTION_STATUS_LABELS, type SupplierMetrics } from "@c26/contracts";
import { Card, EmptyState, StatTile } from "../../components/ui/primitives.tsx";
import { formatDateTime } from "../../lib/format.ts";

export function SupplierWelcome({ metrics }: { metrics: SupplierMetrics }): ReactNode {
  const counts = metrics.submissionCounts;
  const needsAction = counts.needs_revision ?? 0;

  return (
    <div className="space-y-6">
      {/* Action Required Banner for Needs Revision */}
      {needsAction > 0 ? (
        <div className="rounded-2xl border border-warning-line bg-warning-soft/80 p-4 sm:p-5 text-warning-text shadow-sm backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning-text font-bold">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold">
                  {needsAction} Pengajuan Memerlukan Revisi Anda
                </h2>
                <p className="text-xs opacity-90 mt-0.5">
                  Tim QC mengembalikan pengajuan dengan catatan perbaikan. Silakan periksa detailnya.
                </p>
              </div>
            </div>
            <Link
              to="/inspections?status=needs_revision"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-warning text-white px-4 text-xs sm:text-sm font-semibold hover:opacity-95 shadow-sm transition-all"
            >
              Lihat Pengajuan Perlu Revisi →
            </Link>
          </div>
        </div>
      ) : null}

      {/* 5-Column Status Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatTile
          label={INSPECTION_STATUS_LABELS.draft}
          value={counts.draft ?? 0}
          hint="Disimpan lokal"
        />
        <StatTile
          label={INSPECTION_STATUS_LABELS.pending_qc}
          value={counts.pending_qc ?? 0}
          tone="info"
          hint="Sedang ditinjau QC"
        />
        <StatTile
          label={INSPECTION_STATUS_LABELS.needs_revision}
          value={counts.needs_revision ?? 0}
          tone={needsAction > 0 ? "warning" : "neutral"}
          hint="Perlu tindakan perbaikan"
        />
        <StatTile
          label={INSPECTION_STATUS_LABELS.passed_qc}
          value={counts.passed_qc ?? 0}
          tone="success"
          hint="Lolos verifikasi QC"
        />
        <StatTile
          label={INSPECTION_STATUS_LABELS.dropped_qc}
          value={counts.dropped_qc ?? 0}
          tone={(counts.dropped_qc ?? 0) > 0 ? "danger" : "neutral"}
          hint="Pengajuan dibatalkan"
        />
      </div>

      {/* Last Submission & Quick Create Action */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Pengajuan Terakhir"
          description="Status pengajuan yang paling baru Anda kirim"
          className="lg:col-span-2"
        >
          {metrics.lastSubmission === null ? (
            <EmptyState
              title="Belum ada pengajuan"
              description="Mulai proses pendataan ban dari pemeriksaan pertama Anda."
              action={
                <Link
                  to="/inspections/new"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-xs sm:text-sm font-semibold text-on-accent hover:bg-accent-hover shadow-sm"
                >
                  Buat Pemeriksaan Baru
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <Link
                    to={`/inspections/${metrics.lastSubmission.serialNumber}`}
                    className="font-mono text-base font-bold text-accent-text hover:underline"
                  >
                    {metrics.lastSubmission.serialNumber}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">
                    Dikirim pada {formatDateTime(metrics.lastSubmission.submittedAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/inspections/${metrics.lastSubmission.serialNumber}`}
                  className="inline-flex min-h-10 items-center rounded-lg border border-line-strong bg-surface px-4 text-xs sm:text-sm font-semibold text-body hover:bg-surface-sunken"
                >
                  Detail
                </Link>
                <Link
                  to="/inspections/new"
                  className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-xs sm:text-sm font-semibold text-on-accent hover:bg-accent-hover"
                >
                  + Baru
                </Link>
              </div>
            </div>
          )}
        </Card>

        <Card title="Aksi Cepat">
          <div className="space-y-3">
            <Link
              to="/inspections/new"
              className="flex items-center justify-between p-3 rounded-xl border border-line bg-surface-sunken/60 hover:border-accent/40 transition-all text-xs font-semibold text-body"
            >
              <span>+ Buat Pengajuan Baru</span>
              <span className="text-accent-text">→</span>
            </Link>
            <Link
              to="/inspections"
              className="flex items-center justify-between p-3 rounded-xl border border-line bg-surface-sunken/60 hover:border-accent/40 transition-all text-xs font-semibold text-body"
            >
              <span>Daftar Semua Pengajuan</span>
              <span className="text-accent-text">→</span>
            </Link>
            <Link
              to="/upload-queue"
              className="flex items-center justify-between p-3 rounded-xl border border-line bg-surface-sunken/60 hover:border-accent/40 transition-all text-xs font-semibold text-body"
            >
              <span>Status Antrean Unggahan Foto</span>
              <span className="text-accent-text">→</span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
