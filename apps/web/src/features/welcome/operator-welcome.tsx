import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { OperatorMetrics } from "@c26/contracts";
import { Card, StatTile } from "../../components/ui/primitives.tsx";
import { formatNumber } from "../../lib/format.ts";

export function OperatorWelcome({ metrics }: { metrics: OperatorMetrics }): ReactNode {
  const { jobs, outboxPending, orphanedUploads } = metrics;
  const healthy = jobs.failed === 0 && outboxPending === 0;

  return (
    <div className="space-y-6">
      {/* System Health Status Banner */}
      <div
        className={`rounded-2xl border p-5 shadow-sm transition-colors ${
          healthy
            ? "border-success-line bg-success-soft/80 text-success-text"
            : "border-danger-line bg-danger-soft/80 text-danger-text"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl font-bold shadow-sm ${
                healthy ? "bg-success text-white" : "bg-danger text-white"
              }`}
            >
              {healthy ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {healthy ? "Seluruh Sistem Operasional Normal" : "Ada Antrean Pekerjaan yang Perlu Diperiksa"}
              </h2>
              <p className="text-xs sm:text-sm opacity-90 mt-0.5">
                {healthy
                  ? "Tidak ada kegagalan background jobs maupun event outbox yang tertahan."
                  : "Ditemukan pekerjaan gagal atau outbox event tertahan. Buka Panel Operasional untuk tindakan perbaikan."}
              </p>
            </div>
          </div>

          <Link
            to="/ops"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-accent text-on-accent px-4 text-xs sm:text-sm font-semibold hover:bg-accent-hover shadow-sm transition-all"
          >
            Buka Panel Operasional →
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Pekerjaan Gagal"
          value={formatNumber(jobs.failed)}
          tone={jobs.failed > 0 ? "danger" : "success"}
          hint={jobs.failed > 0 ? "Perlu dicoba ulang" : "Semua pekerjaan selesai"}
        />
        <StatTile
          label="Menunggu Dijalankan"
          value={formatNumber(jobs.pending)}
          tone="info"
          hint="Antrean pemrosesan foto &amp; data"
        />
        <StatTile
          label="Sedang Berjalan"
          value={formatNumber(jobs.active)}
          hint="Pekerjaan aktif di background"
        />
        <StatTile
          label="Outbox Tertahan"
          value={formatNumber(outboxPending)}
          tone={outboxPending > 0 ? "warning" : "neutral"}
          hint="Event belum terkirim ke subscriber"
        />
      </div>

      {/* Orphaned Uploads Card */}
      <Card
        title="Status Unggahan Terlantar (Orphaned Uploads)"
        description="Penyimpanan sementara file upload yang tidak pernah diklaim"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums text-body">
                {formatNumber(orphanedUploads)}
              </span>
              <span className="text-xs text-muted">file berkas</span>
            </div>
            <p className="mt-1 text-xs text-muted max-w-prose">
              Unggahan yang melewati batas waktu kedaluwarsa tanpa dikonfirmasi pengajuan. Pembersihan berkala menjaga kapasitas penyimpanan tetap efisien.
            </p>
          </div>

          {orphanedUploads > 0 ? (
            <Link
              to="/ops"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-xs sm:text-sm font-semibold text-body hover:bg-surface-sunken transition-colors"
            >
              Bersihkan Sekarang
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-text">
              ✓ Penyimpanan Bersih
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
