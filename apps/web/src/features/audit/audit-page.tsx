import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuditEntry, Paginated } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatDateTime } from "../../lib/format.ts";
import { ErrorBanner } from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Field, Input, Spinner } from "../../components/ui/primitives.tsx";

/**
 * The audit trail (PLAN/04 §6) — closes D-15 and B-12.
 *
 * Sheets version history is not an audit trail. It cannot answer the question
 * that matters when a QC decision is disputed months later: who changed this,
 * when, from what to what, and on what grounds.
 *
 * There is no edit here and no delete anywhere in the codebase. The table is
 * append-only and the privilege is revoked at the database level (PLAN/13 §9) —
 * a trail the application could edit would not be evidence.
 */
export function AuditPage(): ReactNode {
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [requestId, setRequestId] = useState("");
  const [page, setPage] = useState(1);

  const audit = useQuery({
    queryKey: ["audit", { entity, action, requestId, page }],
    queryFn: () =>
      api.get<Paginated<AuditEntry>>("/api/audit", {
        entity: entity === "" ? undefined : entity,
        action: action === "" ? undefined : action,
        page,
      }),
  });

  const rows = (audit.data?.items ?? []).filter(
    (entry) => requestId === "" || entry.requestId === requestId,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Jejak Audit</h1>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Entitas" htmlFor="audit-entity" hint="mis. inspection, user, vehicle">
            <Input
              id="audit-entity"
              value={entity}
              onChange={(event) => {
                setEntity(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field label="Aksi" htmlFor="audit-action" hint="mis. qc.decided">
            <Input
              id="audit-action"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field
            label="Kode permintaan"
            htmlFor="audit-request"
            hint="Kode yang dilaporkan pengguna saat terjadi error."
          >
            <Input
              id="audit-request"
              value={requestId}
              placeholder="req_20260901_143022_a91f"
              onChange={(event) => setRequestId(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      {audit.error !== null ? <ErrorBanner error={audit.error} /> : null}

      <Card>
        {audit.isLoading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Spinner className="h-5 w-5" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Tidak ada catatan" description="Ubah filter di atas." />
        ) : (
          <>
            <ul className="divide-y divide-slate-200">
              {rows.map((entry) => (
                <li key={entry.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {entry.action} · {entry.entity}#{entry.entityId}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
                  </div>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {entry.actorName ?? "sistem"}
                    {entry.actorRole !== null ? ` (${entry.actorRole})` : ""}
                    {entry.requestId !== null ? ` · ${entry.requestId}` : ""}
                  </p>

                  {/* Only the columns that changed, never a whole row and never
                      a secret — not even hashed (PLAN/04 §6.2). */}
                  {entry.before !== null || entry.after !== null ? (
                    <dl className="mt-2 grid gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="font-medium text-slate-600">Sebelum</dt>
                        <dd className="mt-0.5 break-all font-mono text-slate-700">
                          {JSON.stringify(entry.before ?? {})}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-600">Sesudah</dt>
                        <dd className="mt-0.5 break-all font-mono text-slate-700">
                          {JSON.stringify(entry.after ?? {})}
                        </dd>
                      </div>
                    </dl>
                  ) : null}
                </li>
              ))}
            </ul>

            <nav className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Halaman {audit.data?.page} dari {audit.data?.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= (audit.data?.totalPages ?? 1)}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </nav>
          </>
        )}
      </Card>
    </div>
  );
}
