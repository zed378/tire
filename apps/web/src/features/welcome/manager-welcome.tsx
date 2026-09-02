import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/primitives.tsx";
import type { ManagerMetrics } from "@c26/contracts";

export function ManagerWelcome({ metrics }: { metrics: ManagerMetrics }): ReactNode {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Ringkasan Bulan Ini</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            label="Total Pengajuan"
            value={metrics.reportingMetrics.thisMonth}
            color="bg-blue-100 text-blue-900"
          />
          <SummaryCard
            label="Kategori TB"
            value={metrics.reportingMetrics.byCategory.TB}
            color="bg-purple-100 text-purple-900"
          />
          <SummaryCard
            label="Kategori LT"
            value={metrics.reportingMetrics.byCategory.LT}
            color="bg-pink-100 text-pink-900"
          />
        </div>
      </div>

      {/* Regional Breakdown */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Perincian Wilayah</h3>
        {metrics.reportingMetrics.byRegion.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-semibold text-slate-900">Wilayah</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-900">TB</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-900">LT</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-900">Total</th>
                </tr>
              </thead>
              <tbody>
                {metrics.reportingMetrics.byRegion.map((region: any) => (
                  <tr key={region.region} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-700">{region.region}</td>
                    <td className="text-center py-2 px-3 text-slate-700 font-medium">{region.TB}</td>
                    <td className="text-center py-2 px-3 text-slate-700 font-medium">{region.LT}</td>
                    <td className="text-center py-2 px-3 text-slate-900 font-bold">{region.TB + region.LT}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Tidak ada data wilayah</p>
        )}
      </div>

      {/* Trend */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Trend 6 Bulan Terakhir</h3>
        <div className="space-y-3">
          {metrics.reportingMetrics.trend.map((point: any) => (
            <div key={point.month} className="flex items-center justify-between">
              <span className="text-sm text-slate-600 w-16">{point.month}</span>
              <div className="flex-1 h-6 bg-slate-100 rounded mx-4 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded flex items-center justify-end pr-2"
                  style={{
                    width: `${(point.count / Math.max(...metrics.reportingMetrics.trend.map((t: any) => t.count), 1)) * 100}%`,
                  }}
                >
                  {point.count > 0 && (
                    <span className="text-xs font-bold text-white">{point.count}</span>
                  )}
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-900 w-8 text-right">{point.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link to="/reports">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Lihat Laporan Lengkap
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

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }): ReactNode {
  return (
    <div className={`rounded-lg p-6 text-center ${color}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-2">{label}</div>
    </div>
  );
}
