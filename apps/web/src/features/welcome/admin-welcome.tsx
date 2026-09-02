import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/primitives.tsx";
import type { AdminMetrics } from "@c26/contracts";

export function AdminWelcome({ metrics }: { metrics: AdminMetrics }): ReactNode {
  return (
    <div className="space-y-6">
      {/* System Health */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Kesehatan Sistem</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HealthCard
            label="Total Pengguna"
            value={metrics.systemHealth.totalUsers}
            sublabel={`${metrics.systemHealth.activeUsers} aktif`}
          />
          <HealthCard label="Total Pengajuan" value={metrics.submissionStats.totalSubmissions} />
          <HealthCard label="Pengajuan Bulan Ini" value={metrics.submissionStats.thisMonth} />
        </div>
      </div>

      {/* Users by Role */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Pengguna Berdasarkan Peran</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(metrics.systemHealth.usersByRole).map(([role, count]: [string, number]) => (
            <div key={role} className="text-center p-3 rounded-lg bg-slate-50">
              <div className="text-lg font-bold text-slate-900">{count}</div>
              <div className="text-xs text-slate-600 mt-1 capitalize">{getRoleLabel(role)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Submission Stats */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Statistik Pengajuan</h3>
        <div className="space-y-3">
          {Object.entries(metrics.submissionStats.byStatus).map(([status, count]: [string, number]) => (
            <div key={status} className="flex items-center justify-between">
              <span className="text-sm text-slate-600 capitalize">{getStatusLabel(status)}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${(count / Math.max(...Object.values(metrics.submissionStats.byStatus) as number[])) * 100}%`,
                    }}
                  />
                </div>
                <span className="font-semibold text-slate-900 w-12 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown This Month */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Pengajuan Bulan Ini (Kategori)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 text-center">
            <div className="text-2xl font-bold text-slate-900">{metrics.submissionStats.thisMonthByCategory.TB}</div>
            <div className="text-sm text-slate-600 mt-1">TB (Truck & Bus)</div>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 text-center">
            <div className="text-2xl font-bold text-slate-900">{metrics.submissionStats.thisMonthByCategory.LT}</div>
            <div className="text-sm text-slate-600 mt-1">LT (Light Truck)</div>
          </div>
        </div>
      </div>

      {/* Recent Audit Events */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Event Audit Terbaru</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {metrics.recentAuditEvents.length > 0 ? (
            metrics.recentAuditEvents.map((event: any, idx: number) => (
              <div key={idx} className="text-sm border-b border-slate-200 pb-3 last:border-b-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{event.action}</p>
                    <p className="text-xs text-slate-500 mt-1">oleh {event.actor}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(event.timestamp).toLocaleTimeString("id-ID")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Tidak ada event</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Link to="/users">
            <Button className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300">
              Kelola Pengguna
            </Button>
          </Link>
          <Link to="/qc">
            <Button className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300">
              Queue QC
            </Button>
          </Link>
          <Link to="/audit">
            <Button className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300">
              Audit Log
            </Button>
          </Link>
          <Link to="/master-data">
            <Button className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300">
              Master Data
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function HealthCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: number;
  sublabel?: string;
}): ReactNode {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-600 mt-2">{label}</div>
      {sublabel && <div className="text-xs text-slate-500 mt-1">{sublabel}</div>}
    </div>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    supplier: "Data Supplier",
    admin: "Admin",
    manager: "PM/PIC/SPV",
    operator: "Operator",
  };
  return labels[role] || role;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draf",
    pending_qc: "Pending QC",
    needs_revision: "Perlu Revisi",
    passed_qc: "Pass QC",
    dropped_qc: "Drop QC",
  };
  return labels[status] || status;
}
