import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  INSPECTION_STATUS_LABELS,
  USER_ROLE_LABELS,
  USER_ROLES,
  type AdminMetrics,
} from "@c26/contracts";
import { Card, EmptyState, StatTile } from "../../components/ui/primitives.tsx";
import { formatNumber, formatRelative } from "../../lib/format.ts";

/**
 * The admin opens the application to do QC, so the queue comes first and
 * everything else is context.
 */
export function AdminWelcome({ metrics }: { metrics: AdminMetrics }): ReactNode {
  const { users, inspections, recentAuditEvents } = metrics;
  const waiting = inspections.byStatus.pending_qc;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={INSPECTION_STATUS_LABELS.pending_qc}
          value={formatNumber(waiting)}
          tone={waiting > 0 ? "warning" : "neutral"}
          hint="Menunggu ditinjau"
        />
        <StatTile
          label="Pengajuan Bulan Ini"
          value={formatNumber(inspections.thisMonth)}
          hint={`TB ${formatNumber(inspections.thisMonthByCategory.TB)} · LT ${formatNumber(
            inspections.thisMonthByCategory.LT,
          )}`}
        />
        <StatTile label="Total Pengajuan" value={formatNumber(inspections.total)} />
        <StatTile
          label="Pengguna Aktif"
          value={formatNumber(users.active)}
          hint={`dari ${formatNumber(users.total)} akun`}
        />
      </div>

      {waiting > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium text-body">
              {formatNumber(waiting)} pengajuan menunggu Quality Control
            </p>
            <Link
              to="/qc"
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover"
            >
              Buka Antrean QC
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Statistik Pengajuan">
          <dl className="space-y-2">
            {Object.entries(inspections.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <dt className="text-muted">
                  {INSPECTION_STATUS_LABELS[status as keyof typeof INSPECTION_STATUS_LABELS]}
                </dt>
                <dd className="font-medium tabular-nums text-body">{formatNumber(count)}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Pengguna Berdasarkan Peran">
          <dl className="space-y-2">
            {USER_ROLES.map((role) => (
              <div key={role} className="flex items-center justify-between text-sm">
                <dt className="text-muted">{USER_ROLE_LABELS[role]}</dt>
                <dd className="font-medium tabular-nums text-body">
                  {formatNumber(users.byRole[role])}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card
        title="Event Audit Terbaru"
        actions={
          <Link
            to="/audit"
            className="text-sm font-medium text-accent-text underline-offset-2 hover:underline"
          >
            Lihat semua
          </Link>
        }
      >
        {recentAuditEvents.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas"
            description="Perubahan pada data akan tercatat di sini."
          />
        ) : (
          <ul className="divide-y divide-line">
            {recentAuditEvents.map((event) => (
              <li
                key={`${event.occurredAt}-${event.action}-${event.entity}`}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
              >
                <span className="text-body">
                  <span className="font-medium">{event.action}</span>{" "}
                  <span className="text-muted">{event.entity}</span>
                </span>
                <span className="text-xs text-subtle">
                  {event.actor} · {formatRelative(event.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
