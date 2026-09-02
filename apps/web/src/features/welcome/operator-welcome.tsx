import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { OperatorMetrics } from "@c26/contracts";
import { Card, StatTile } from "../../components/ui/primitives.tsx";
import { formatNumber } from "../../lib/format.ts";

/**
 * The operator's job is to notice when something has stopped working, so this
 * screen is built around the three things that go wrong quietly: jobs that
 * failed, events that never got dispatched, and uploaded bytes nothing claimed.
 *
 * Every figure is read live. An earlier version of the endpoint returned
 * hardcoded zeros, which is the worst possible reading for an operations
 * screen — it looks exactly like a healthy system.
 */
export function OperatorWelcome({ metrics }: { metrics: OperatorMetrics }): ReactNode {
  const { jobs, outboxPending, orphanedUploads } = metrics;
  const healthy = jobs.failed === 0 && outboxPending === 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-body">
              {healthy ? "Tidak ada yang perlu ditangani" : "Ada yang perlu diperiksa"}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {healthy
                ? "Antrean pekerjaan dan outbox bersih."
                : "Lihat detail dan tindakan di Panel Operasional."}
            </p>
          </div>
          <Link
            to="/ops"
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            Buka Panel Operasional
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Pekerjaan Gagal"
          value={formatNumber(jobs.failed)}
          tone={jobs.failed > 0 ? "danger" : "success"}
          hint={jobs.failed > 0 ? "Perlu dicoba ulang" : "Tidak ada"}
        />
        <StatTile label="Menunggu Dijalankan" value={formatNumber(jobs.pending)} />
        <StatTile label="Sedang Berjalan" value={formatNumber(jobs.active)} />
        <StatTile
          label="Outbox Tertahan"
          value={formatNumber(outboxPending)}
          tone={outboxPending > 0 ? "warning" : "neutral"}
          hint="Event belum terkirim"
        />
      </div>

      <Card title="Unggahan Terlantar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-body">
              {formatNumber(orphanedUploads)}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Unggahan yang sudah lewat masa berlaku dan tidak pernah dikonfirmasi. Bytes ini
              tidak akan pernah diklaim oleh baris mana pun.
            </p>
          </div>
          {orphanedUploads > 0 ? (
            <Link
              to="/ops"
              className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-body hover:bg-surface-sunken"
            >
              Bersihkan
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
