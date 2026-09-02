import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ManagerMetrics } from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { Card, EmptyState, StatTile } from "../../components/ui/primitives.tsx";
import { Table, type Column } from "../../components/ui/table.tsx";
import { formatNumber } from "../../lib/format.ts";

export function ManagerWelcome({ metrics }: { metrics: ManagerMetrics }): ReactNode {
  const peak = Math.max(...metrics.trend.map((point) => point.count), 1);

  const columns: Column<ManagerMetrics["byRegion"][number]>[] = [
    {
      key: "region",
      header: "Wilayah / Kota",
      cell: (row) => <span className="font-semibold text-body">{row.region}</span>,
    },
    {
      key: "tb",
      header: "TB (Truck & Bus)",
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatNumber(row.tb)}</span>,
    },
    {
      key: "lt",
      header: "LT (Light Truck)",
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatNumber(row.lt)}</span>,
    },
    {
      key: "total",
      header: "Total Lolos QC",
      align: "right",
      cell: (row) => (
        <span className="font-bold tabular-nums text-accent-text">{formatNumber(row.total)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Total Lolos QC Bulan Ini"
          value={formatNumber(metrics.thisMonth)}
          tone="accent"
          hint="Hasil verifikasi QC terstandarisasi"
        />
        <StatTile
          label="Kategori TB (Truck &amp; Bus)"
          value={formatNumber(metrics.byCategory.TB ?? 0)}
          tone="info"
          hint="Angkutan berat komersial"
        />
        <StatTile
          label="Kategori LT (Light Truck)"
          value={formatNumber(metrics.byCategory.LT ?? 0)}
          tone="success"
          hint="Armada truk ringan"
        />
      </div>

      {/* 6-Month Trend Chart Card */}
      <Card
        title="Trend 6 Bulan Terakhir"
        description="Grafik volume pengajuan lolos QC per bulan berjalan"
        actions={
          <Link
            to="/reports"
            className="text-xs sm:text-sm font-semibold text-accent-text hover:underline"
          >
            Laporan Analitik Lengkap →
          </Link>
        }
      >
        <div className="pt-2">
          <ul className="flex items-end justify-between gap-2 sm:gap-6 h-48 pb-2">
            {metrics.trend.map((point) => (
              <li key={point.month} className="flex flex-1 flex-col items-center gap-2 h-full justify-end group">
                <span className="text-xs font-bold tabular-nums text-body group-hover:text-accent-text transition-colors">
                  {formatNumber(point.count)}
                </span>
                <div
                  className={cn(
                    "w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-accent to-accent-hover transition-all duration-300 group-hover:opacity-90 shadow-sm",
                    BAR_HEIGHTS[heightStep(point.count, peak)],
                  )}
                />
                <span className="text-[11px] font-medium text-muted truncate max-w-full text-center">
                  {point.month}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Regional Breakdown Table Card */}
      <Card
        title="Perincian Wilayah Operasional"
        description="Distribusi pengajuan lolos QC bulan ini per wilayah kota"
        actions={
          <Link
            to="/reports"
            className="text-xs sm:text-sm font-semibold text-accent-text hover:underline"
          >
            Ekspor Data →
          </Link>
        }
      >
        <Table
          caption="Jumlah pemeriksaan lolos QC per kota, dipisah TB dan LT"
          columns={columns}
          rows={metrics.byRegion}
          rowKey={(row) => row.region}
          empty={
            <EmptyState
              title="Belum ada data wilayah"
              description="Angka muncul setelah ada pemeriksaan yang lolos QC bulan ini."
            />
          }
        />
      </Card>
    </div>
  );
}

const BAR_HEIGHTS = [
  "h-2",
  "h-6",
  "h-10",
  "h-16",
  "h-20",
  "h-24",
  "h-28",
  "h-32",
  "h-36",
  "h-40",
] as const;

function heightStep(value: number, peak: number): number {
  if (value <= 0) return 0;
  const step = Math.round((value / peak) * (BAR_HEIGHTS.length - 1));
  return Math.min(Math.max(step, 1), BAR_HEIGHTS.length - 1);
}
