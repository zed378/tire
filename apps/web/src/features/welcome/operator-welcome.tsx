import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/primitives.tsx";
import type { OperatorMetrics } from "@c26/contracts";

export function OperatorWelcome({ metrics }: { metrics: OperatorMetrics }): ReactNode {
  return (
    <div className="space-y-6">
      {/* Job Queue Status */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Status Antrian Pekerjaan</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatusCard
            label="Pending"
            value={metrics.jobQueueStatus.pending}
            color="bg-yellow-100 text-yellow-900"
          />
          <StatusCard
            label="Processing"
            value={metrics.jobQueueStatus.processing}
            color="bg-blue-100 text-blue-900"
          />
          <StatusCard
            label="Failed"
            value={metrics.jobQueueStatus.failed}
            color="bg-red-100 text-red-900"
          />
          <StatusCard label="Total" value={metrics.jobQueueStatus.pending + metrics.jobQueueStatus.processing + metrics.jobQueueStatus.failed} color="bg-slate-100 text-slate-900" />
        </div>
      </div>

      {/* Last Error (if any) */}
      {metrics.jobQueueStatus.lastError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h3 className="font-semibold text-red-900 mb-2">Error Terbaru</h3>
          <p className="text-sm text-red-800 font-mono">{metrics.jobQueueStatus.lastError}</p>
        </div>
      )}

      {/* Recent Logs */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Log Sistem Terbaru</h3>
        {metrics.recentLogs.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-xs">
            {metrics.recentLogs.map((log: any, idx: number) => (
              <div
                key={idx}
                className={`p-2 rounded ${
                  log.level === "error"
                    ? "bg-red-50 text-red-800"
                    : log.level === "warn"
                      ? "bg-yellow-50 text-yellow-800"
                      : "bg-slate-50 text-slate-700"
                }`}
              >
                <span className="font-semibold">[{log.level.toUpperCase()}]</span>{" "}
                <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString("id-ID")}</span>{" "}
                {log.message}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Tidak ada log</p>
        )}
      </div>

      {/* System Status */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Status Sistem</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Kesehatan Sistem</span>
              <span className="text-sm font-semibold text-green-600">Baik</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: "95%" }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Uptime</span>
              <span className="text-sm font-semibold">99.8%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: "99.8%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link to="/ops">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Monitor Sistem
            </Button>
          </Link>
          <Link to="/users">
            <Button className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300">
              Kelola Pengguna
            </Button>
          </Link>
          <Link to="/audit">
            <Button className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300">
              Audit Log
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: number; color: string }): ReactNode {
  return (
    <div className={`rounded-lg p-4 text-center ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  );
}
