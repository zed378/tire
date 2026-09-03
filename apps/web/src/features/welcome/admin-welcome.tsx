import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  INSPECTION_STATUS_LABELS,
  USER_ROLE_LABELS,
  USER_ROLES,
  type AdminMetrics,
  type InspectionStatus,
} from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { Card, EmptyState, StatTile } from "../../components/ui/primitives.tsx";
import { formatNumber, formatRelative } from "../../lib/format.ts";


const STATUS_BAR_TONES: Partial<Record<InspectionStatus, string>> = {
  passed_qc: "bg-success",
  pending_qc: "bg-warning",
  needs_revision: "bg-warning",
  dropped_qc: "bg-danger",
};

/**
 * Bar widths as classes, in 5% steps.
 *
 * Tailwind cannot express a percentage computed at runtime, and the CSP forbids
 * the `style` attribute that would otherwise carry it.
 */
const BAR_WIDTHS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-1/5", "w-1/4",
  "w-[30%]", "w-[35%]", "w-2/5", "w-[45%]", "w-1/2", "w-[55%]",
  "w-3/5", "w-[65%]", "w-[70%]", "w-3/4", "w-4/5", "w-[85%]",
  "w-[90%]", "w-[95%]", "w-full",
] as const;

function widthStep(value: number, total: number): number {
  if (value <= 0 || total <= 0) return 0;
  const step = Math.round((value / total) * (BAR_WIDTHS.length - 1));
  // Anything non-zero gets a visible sliver rather than disappearing.
  return Math.min(Math.max(step, 1), BAR_WIDTHS.length - 1);
}

export function AdminWelcome({ metrics }: { metrics: AdminMetrics }): ReactNode {
  const { users, inspections, recentAuditEvents } = metrics;
  const waiting = inspections.byStatus.pending_qc ?? 0;
  const totalSubmissions = inspections.total > 0 ? inspections.total : 1;

  return (
    <div className="space-y-6">
      {/* Quick Action Alert for QC Queue */}
      {waiting > 0 ? (
        <div className="rounded-xl border border-warning-line bg-warning-soft/80 p-4 sm:p-5 text-warning-text shadow-sm backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning-text font-bold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-sm sm:text-base">
                  {formatNumber(waiting)} Pengajuan Menunggu Quality Control
                </p>
                <p className="text-xs opacity-90">
                  Tinjau foto bukti dan tetapkan keputusan QC agar alur kerja tidak terhambat.
                </p>
              </div>
            </div>
            <Link
              to="/qc"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-warning text-on-warning px-4 text-xs sm:text-sm font-semibold hover:opacity-95 shadow-sm transition-all"
            >
              Buka Antrean QC →
            </Link>
          </div>
        </div>
      ) : null}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Pending QC"
          value={formatNumber(waiting)}
          tone={waiting > 0 ? "warning" : "neutral"}
          hint="Menunggu peninjauan tim QC"
        />
        <StatTile
          label="Pengajuan Bulan Ini"
          value={formatNumber(inspections.thisMonth)}
          tone="info"
          hint={`TB ${formatNumber(inspections.thisMonthByCategory.TB ?? 0)} · LT ${formatNumber(
            inspections.thisMonthByCategory.LT ?? 0,
          )}`}
        />
        <StatTile
          label="Total Pengajuan"
          value={formatNumber(inspections.total)}
          hint="Akumulasi seluruh riwayat"
        />
        <StatTile
          label="Pengguna Aktif"
          value={formatNumber(users.active)}
          tone="success"
          hint={`dari ${formatNumber(users.total)} total akun`}
        />
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Submission Breakdown */}
        <Card title="Statistik Status Pengajuan" description="Distribusi seluruh status pengajuan di sistem">
          <div className="space-y-3.5">
            {Object.entries(inspections.byStatus).map(([status, count]) => {
              const num = count ?? 0;
              const pct = Math.round((num / totalSubmissions) * 100);
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-medium text-body">
                      {INSPECTION_STATUS_LABELS[status as keyof typeof INSPECTION_STATUS_LABELS] || status}
                    </span>
                    <span className="tabular-nums font-semibold text-body">
                      {formatNumber(num)} <span className="text-xs text-muted font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                    {/*
                      Width comes from a fixed class, never a style attribute:
                      the CSP is `style-src 'self'` with no `unsafe-inline`
                      (PLAN/13 §7), so an inline width is dropped by the browser
                      and the bar renders at nothing — in production only, where
                      the header is set. Twenty-one steps is finer than the eye
                      reads a 2px bar.
                    */}
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        BAR_WIDTHS[widthStep(num, totalSubmissions)],
                        STATUS_BAR_TONES[status as InspectionStatus] ?? "bg-accent",
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Users by Role Breakdown */}
        <Card title="Distribusi Pengguna" description="Jumlah akun terdaftar berdasarkan hak akses">
          <div className="grid grid-cols-2 gap-3">
            {USER_ROLES.map((role) => (
              <div
                key={role}
                className="rounded-xl border border-line bg-surface-sunken/60 p-3.5 flex flex-col justify-between"
              >
                <div className="text-xs font-semibold text-muted uppercase tracking-wider">
                  {USER_ROLE_LABELS[role]}
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums text-body">
                  {formatNumber(users.byRole[role] ?? 0)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-line flex justify-end">
            <Link
              to="/users"
              className="text-xs font-semibold text-accent-text hover:underline"
            >
              Kelola Pengguna &amp; Peran →
            </Link>
          </div>
        </Card>
      </div>

      {/* Recent Audit Events */}
      <Card
        title="Event Audit Terbaru"
        description="Aktivitas dan rekaman perubahan data terkini"
        actions={
          <Link
            to="/audit"
            className="text-xs sm:text-sm font-semibold text-accent-text hover:underline"
          >
            Buka Audit Log Lengkap →
          </Link>
        }
      >
        {recentAuditEvents.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas audit"
            description="Perubahan data dan login akun akan tercatat di sini secara otomatis."
          />
        ) : (
          <div className="divide-y divide-line">
            {recentAuditEvents.map((event, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 py-3 first:pt-0 last:pb-0 text-xs sm:text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-semibold text-body">{event.action}</span>
                    <span className="text-muted ml-1.5">{event.entity}</span>
                  </div>
                </div>
                <div className="text-[11px] text-muted sm:text-right pl-9 sm:pl-0">
                  <span className="font-medium text-body">{event.actor}</span> • {formatRelative(event.occurredAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
