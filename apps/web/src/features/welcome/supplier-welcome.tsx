import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/primitives.tsx";
import type { SupplierMetrics } from "@c26/contracts";

export function SupplierWelcome({ metrics }: { metrics: SupplierMetrics }): ReactNode {
  return (
    <div className="space-y-6">
      {/* Submission Status Cards */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Status Pengajuan Anda</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard
            label="Draft"
            value={metrics.submissionCounts.draft ?? 0}
            color="bg-slate-100 text-slate-900"
          />
          <MetricCard
            label="Pending QC"
            value={metrics.submissionCounts.pending_qc ?? 0}
            color="bg-yellow-100 text-yellow-900"
          />
          <MetricCard
            label="Perlu Revisi"
            value={metrics.submissionCounts.needs_revision ?? 0}
            color="bg-orange-100 text-orange-900"
          />
          <MetricCard
            label="Pass QC"
            value={metrics.submissionCounts.passed_qc ?? 0}
            color="bg-green-100 text-green-900"
          />
          <MetricCard
            label="Drop QC"
            value={metrics.submissionCounts.dropped_qc ?? 0}
            color="bg-red-100 text-red-900"
          />
        </div>
      </div>

      {/* Last Submission */}
      {metrics.lastSubmission && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900 mb-3">Pengajuan Terakhir</h3>
          <p className="text-sm text-slate-600">
            Serial Number: <span className="font-mono font-semibold">{metrics.lastSubmission.sn}</span>
          </p>
          <p className="text-sm text-slate-600 mt-1">
            Tanggal: {new Date(metrics.lastSubmission.submittedAt).toLocaleDateString("id-ID")}
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link to="/inspections/new">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Buat Pengajuan Baru
            </Button>
          </Link>
          <Link to="/inspections">
            <Button className="w-full bg-slate-200 text-slate-900 hover:bg-slate-300">
              Lihat Semua Pengajuan
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }): ReactNode {
  return (
    <div className={`rounded-lg p-4 text-center ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  );
}
