import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ManagerMetrics } from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { Card, EmptyState, StatTile } from "../../components/ui/primitives.tsx";
import { Table, type Column } from "../../components/ui/table.tsx";
import { formatNumber } from "../../lib/format.ts";

/**
 * The PM/PIC/SPV view: progress, split TB versus LT.
 *
 * That split is the axis the whole management picture is built on (K-04), so it
 * is present in the headline figures and in every regional row rather than
 * being something you drill into.
 *
 * The figures come from the same materialised view the Pelaporan screen reads,
 * which is what keeps the two screens agreeing with each other.
 */
export function ManagerWelcome({ metrics }: { metrics: ManagerMetrics }): ReactNode {
  const peak = Math.max(...metrics.trend.map((point) => point.count), 1);

  const columns: Column<ManagerMetrics["byRegion"][number]>[] = [
    { key: "region", header: "Wilayah", cell: (row) => row.region },
    { key: "tb", header: "TB", align: "right", cell: (row) => formatNumber(row.tb) },
    { key: "lt", header: "LT", align: "right", cell: (row) => formatNumber(row.lt) },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (row) => <span className="font-medium">{formatNumber(row.total)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Bulan Ini"
          value={formatNumber(metrics.thisMonth)}
          tone="accent"
          hint="Lolos QC"
        />
        <StatTile label="TB (Truck & Bus)" value={formatNumber(metrics.byCategory.TB)} />
        <StatTile label="LT (Light Truck)" value={formatNumber(metrics.byCategory.LT)} />
      </div>

      <Card title="Trend 6 Bulan Terakhir">
        {/*
          A bar per month rather than the line chart used on the reporting
          screen. Six points do not need axes, and the reporting screen is one
          click away for anyone who wants them.
        */}
        <ul className="flex items-end gap-2 sm:gap-4">
          {metrics.trend.map((point) => (
            <li key={point.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium tabular-nums text-muted">{point.count}</span>
              {/*
                Tailwind cannot express a height computed at runtime, and the
                CSP forbids an inline style attribute (PLAN/13 §7), so the bar
                is quantised to a fixed set of classes.
              */}
              <div
                className={cn("w-full rounded-t bg-accent", BAR_HEIGHTS[heightStep(point.count, peak)])}
              />
              <span className="text-xs text-subtle">{point.month}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Perincian Wilayah"
        description="Bulan berjalan, kota dengan aktivitas tertinggi di atas."
        actions={
          <Link
            to="/reports"
            className="text-sm font-medium text-accent-text underline-offset-2 hover:underline"
          >
            Buka Pelaporan
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

/**
 * Ten fixed heights.
 *
 * A computed pixel height would need a `style` attribute, and the CSP carries no
 * `unsafe-inline`. Ten steps is more than enough resolution to read a six-month
 * shape at a glance.
 */
const BAR_HEIGHTS = [
  "h-1",
  "h-4",
  "h-8",
  "h-12",
  "h-16",
  "h-20",
  "h-24",
  "h-28",
  "h-32",
  "h-36",
] as const;

function heightStep(value: number, peak: number): number {
  if (value <= 0) return 0;
  const step = Math.round((value / peak) * (BAR_HEIGHTS.length - 1));
  return Math.min(Math.max(step, 1), BAR_HEIGHTS.length - 1);
}
