import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { INSPECTION_STATUS_LABELS, type SupplierMetrics } from "@c26/contracts";
import { Card, EmptyState, StatTile } from "../../components/ui/primitives.tsx";
import { formatDateTime } from "../../lib/format.ts";

/**
 * What a supplier needs on opening the application: whether anything is waiting
 * on them, and the way to start the next inspection.
 *
 * `needs_revision` is first and coloured, because it is the only status that is
 * asking them to do something. The rest are there for reassurance.
 */
export function SupplierWelcome({ metrics }: { metrics: SupplierMetrics }): ReactNode {
  const counts = metrics.submissionCounts;
  const needsAction = counts.needs_revision;

  return (
    <div className="space-y-4">
      {needsAction > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-body">
                {needsAction} pengajuan perlu Anda perbaiki
              </p>
              <p className="mt-0.5 text-sm text-muted">
                QC mengembalikannya dengan catatan. Buka untuk melihat alasannya.
              </p>
            </div>
            <Link
              to="/inspections?status=needs_revision"
              className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover"
            >
              Lihat Pengajuan
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label={INSPECTION_STATUS_LABELS.draft} value={counts.draft} />
        <StatTile
          label={INSPECTION_STATUS_LABELS.pending_qc}
          value={counts.pending_qc}
          tone="info"
        />
        <StatTile
          label={INSPECTION_STATUS_LABELS.needs_revision}
          value={counts.needs_revision}
          tone={needsAction > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label={INSPECTION_STATUS_LABELS.passed_qc}
          value={counts.passed_qc}
          tone="success"
        />
        <StatTile
          label={INSPECTION_STATUS_LABELS.dropped_qc}
          value={counts.dropped_qc}
          tone={counts.dropped_qc > 0 ? "danger" : "neutral"}
        />
      </div>

      <Card title="Pengajuan Terakhir">
        {metrics.lastSubmission === null ? (
          <EmptyState
            title="Belum ada pengajuan"
            description="Mulai dari pemeriksaan pertama Anda."
            action={
              <Link
                to="/inspections/new"
                className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover"
              >
                Pemeriksaan Baru
              </Link>
            }
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                to={`/inspections/${metrics.lastSubmission.serialNumber}`}
                className="font-medium text-accent-text underline-offset-2 hover:underline"
              >
                {metrics.lastSubmission.serialNumber}
              </Link>
              <p className="mt-0.5 text-sm text-muted">
                Dikirim {formatDateTime(metrics.lastSubmission.submittedAt)}
              </p>
            </div>
            <Link
              to="/inspections/new"
              className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-body hover:bg-surface-sunken"
            >
              Pemeriksaan Baru
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
