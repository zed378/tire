import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AuditEntry, Paginated } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatDateTime } from "../../lib/format.ts";
import { useSession } from "../../lib/session.tsx";
import { Card, EmptyState, SkeletonRows } from "../../components/ui/primitives.tsx";

/**
 * "Riwayat Perubahan" for one inspection (PLAN/04 §6.3).
 *
 * The audit trail existed and was reachable — but only as a top-level screen
 * listing every row in the system, which is the wrong shape for the question
 * people actually ask: what happened to *this* submission? PLAN/04 §6.3 asks
 * for it here, opened from the inspection, and notes that it also finishes off
 * D-02 sideways: the legacy card titled "Riwayat" finally has a history behind
 * it rather than three summary numbers.
 *
 * Rendered only for a role that may read the audit trail. Hiding it is not the
 * enforcement — the server refuses the request regardless (PLAN/04 §2.2) — but
 * an empty card nobody is allowed to fill is worse than no card.
 */
export function ChangeHistory({ inspectionId }: { inspectionId: number }): ReactNode {
  const { can } = useSession();
  const allowed = can("audit.read");

  const history = useQuery({
    queryKey: ["audit", "inspection", inspectionId],
    queryFn: () =>
      api.get<Paginated<AuditEntry>>("/api/audit", {
        entity: "inspection",
        entityId: inspectionId,
        perPage: 20,
      }),
    enabled: allowed,
  });

  if (!allowed) return null;

  const entries = history.data?.items ?? [];

  return (
    <Card
      title="Riwayat Perubahan"
      description="Setiap perubahan status tercatat di sini dan tidak bisa dihapus."
      actions={
        <Link
          to="/audit"
          className="text-sm font-medium text-accent-text underline-offset-2 hover:underline"
        >
          Jejak audit lengkap
        </Link>
      }
    >
      {history.isPending ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Memuat riwayat perubahan…</span>
          <SkeletonRows rows={3} />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="Belum ada perubahan tercatat"
          description="Riwayat muncul setelah pengajuan ini dikirim atau statusnya berubah."
        />
      ) : (
        <ol className="divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-body">{entry.action}</p>
                <p className="text-xs text-subtle">{formatDateTime(entry.createdAt)}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {entry.actorName ?? "Tidak diketahui"}
                {entry.actorRole === null ? "" : ` · ${entry.actorRole}`}
              </p>

              {/*
                Before and after, when the entry carries them. Rendered as plain
                key/value rather than raw JSON: an operator reading this at
                07:00 should not have to parse braces.
              */}
              {entry.before !== null || entry.after !== null ? (
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                  {changedFields(entry).map(([field, from, to]) => (
                    <div key={field} className="contents">
                      <dt className="text-subtle">{field}</dt>
                      <dd className="text-body">
                        <span className="text-muted line-through">{from}</span>
                        {" → "}
                        <span className="font-medium">{to}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/**
 * The fields that actually differ between before and after.
 *
 * An audit row often carries the whole record on both sides; listing every
 * field would bury the one that changed among twenty that did not.
 */
function changedFields(entry: AuditEntry): [string, string, string][] {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return keys
    .map((key): [string, string, string] => [key, present(before[key]), present(after[key])])
    .filter(([, from, to]) => from !== to);
}

function present(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
