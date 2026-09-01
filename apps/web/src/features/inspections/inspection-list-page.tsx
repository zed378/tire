import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  INSPECTION_STATUS_LABELS,
  INSPECTION_STATUSES,
  type InspectionListItem,
  type InspectionStatus,
  type Paginated,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { endOfDayIso, formatDate, startOfDayIso } from "../../lib/format.ts";
import { useSession } from "../../lib/session.tsx";
import { ErrorBanner, StatusBadge } from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Field, Input, Select, Spinner } from "../../components/ui/primitives.tsx";

/**
 * The inspection list.
 *
 * For a supplier this is D-10 closed. Until now they submitted data and went
 * blind: no list, no status, no notification, so every Pass or Drop had to be
 * chased through WhatsApp or a phone call. The reason for a rejection travels on
 * the row itself, not hidden behind a detail page they might never open.
 *
 * The filters are real filters. D-01 found the legacy ones rendered but never
 * wired to the query — a 2020 date range still returned a 2026 record.
 */
export function InspectionListPage(): ReactNode {
  const { can } = useSession();
  const [status, setStatus] = useState<InspectionStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["inspections", { status, from, to, search, page }],
    queryFn: () =>
      api.get<Paginated<InspectionListItem>>("/api/inspections", {
        status: status === "" ? undefined : status,
        submittedFrom: from === "" ? undefined : startOfDayIso(from),
        submittedTo: to === "" ? undefined : endOfDayIso(to),
        q: search === "" ? undefined : search,
        page,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Pengajuan</h1>
        {can("submission.create") ? (
          <Link to="/inspections/new">
            <Button>Pemeriksaan Baru</Button>
          </Link>
        ) : null}
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status" htmlFor="filter-status">
            <Select
              id="filter-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as InspectionStatus | "");
                setPage(1);
              }}
            >
              <option value="">Semua status</option>
              {INSPECTION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {INSPECTION_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Dikirim dari" htmlFor="filter-from">
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field label="Sampai" htmlFor="filter-to">
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field label="Cari plat nomor" htmlFor="filter-q">
            <Input
              id="filter-q"
              value={search}
              placeholder="B 1234 ABC"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
      </Card>

      {query.error !== null ? <ErrorBanner error={query.error} /> : null}

      <Card>
        {query.isLoading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Spinner className="h-5 w-5" />
          </div>
        ) : query.data === undefined || query.data.items.length === 0 ? (
          <EmptyState
            title="Belum ada pengajuan"
            description="Pengajuan yang Anda buat akan muncul di sini beserta statusnya."
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-200">
              {query.data.items.map((item) => (
                <li key={item.id} className="py-3">
                  <Link to={`/inspections/${item.serialNumber}`} className="block hover:opacity-80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          {item.serialNumber} · {item.plateDisplay}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {item.cityName}, {item.provinceName} · {item.category} ·{" "}
                          {item.totalTires} ban · {item.photoCount} foto
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.submittedAt === null
                            ? "Belum dikirim"
                            : `Dikirim ${formatDate(item.submittedAt)}`}
                          {" · "}
                          {item.submittedByName}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    {/* The reason travels with the row. A supplier should not
                        have to open a detail page to learn what to fix. */}
                    {item.latestQcNotes !== null ? (
                      <p className="mt-2 rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                        {item.latestQcNotes}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>

            <nav className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Halaman {query.data.page} dari {query.data.totalPages} · {query.data.total} data
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={query.data.page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="secondary"
                  disabled={query.data.page >= query.data.totalPages}
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
