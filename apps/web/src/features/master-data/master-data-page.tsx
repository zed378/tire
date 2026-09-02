import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MasterDataBundle, PendingBrandReview } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatDate } from "../../lib/format.ts";
import { Banner, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Field, Input, Select } from "../../components/ui/primitives.tsx";
import { Pagination } from "../../components/ui/pagination.tsx";

/**
 * Master data (PLAN/02 §5) — closes Q-07.
 *
 * Provinces, cities, and brands were constants in the legacy code, covering Java
 * only. The moment the business reaches Sumatra, a constant becomes a
 * deployment; here it is an admin task.
 *
 * Nothing is ever deleted. A city that stops being served still has inspections
 * pointing at it, so deactivation removes it from the dropdowns and leaves the
 * history intact.
 */

type Tab = "provinces" | "cities" | "vehicle-brands" | "tire-brands" | "reviews";

const TAB_LABELS: Record<Tab, string> = {
  provinces: "Provinsi",
  cities: "Kota",
  "vehicle-brands": "Merk Kendaraan",
  "tire-brands": "Merk Ban",
  reviews: "Merk Menunggu Tinjauan",
};

/**
 * Rows per tab.
 *
 * The seed alone loads 290 cities, and the Kota tab rendered every one of them
 * in a single list. These arrive together in one master-data bundle — the same
 * bundle the vehicle form's dropdowns need whole — so the list is paged here
 * rather than by asking the server for it again a slice at a time.
 */
const PER_PAGE = 25;

function pageOf<T>(rows: readonly T[], page: number): T[] {
  return rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
}

function pageCount(rows: readonly unknown[]): number {
  return Math.max(1, Math.ceil(rows.length / PER_PAGE));
}

export function MasterDataPage(): ReactNode {
  const [tab, setTab] = useState<Tab>("provinces");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);

  const master = useQuery({
    queryKey: ["masterdata"],
    queryFn: () => api.get<MasterDataBundle>("/api/masterdata"),
  });

  const reviews = useQuery({
    queryKey: ["brand-reviews"],
    queryFn: () => api.get<PendingBrandReview[]>("/api/masterdata/brand-reviews"),
    enabled: tab === "reviews",
  });

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["masterdata"] });
    await queryClient.invalidateQueries({ queryKey: ["brand-reviews"] });
  };

  const create = useMutation({
    mutationFn: ({ table, body }: { table: string; body: unknown }) =>
      api.post(`/api/masterdata/${table}`, body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Data master ditambahkan." });
      await invalidate();
    },
    onError: setError,
  });

  const toggleActive = useMutation({
    mutationFn: ({ table, id, isActive }: { table: string; id: number; isActive: boolean }) =>
      api.patch(`/api/masterdata/${table}/${String(id)}`, { isActive }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Status data master diperbarui." });
      await invalidate();
    },
    onError: setError,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-body">Master Data</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            to="/master-data/vehicle-brands"
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1.5 font-medium text-body hover:bg-surface-sunken"
          >
            Merk Kendaraan →
          </Link>
          <Link
            to="/master-data/tire-brand-patterns"
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1.5 font-medium text-body hover:bg-surface-sunken"
          >
            Pattern Ban →
          </Link>
          <Link
            to="/master-data/tire-sizes"
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1.5 font-medium text-body hover:bg-surface-sunken"
          >
            Ukuran Ban →
          </Link>
        </div>
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <nav className="flex flex-wrap gap-1 border-b border-line">
        {(Object.keys(TAB_LABELS) as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setPage(1);
            }}
            className={
              tab === value
                ? "border-b-2 border-accent px-3 py-2 text-sm font-medium text-accent-text"
                : "px-3 py-2 text-sm text-muted hover:text-body"
            }
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </nav>

      {tab === "provinces" ? (
        <Card title="Provinsi" description="Kode mengikuti kode BPS, dua angka.">
          <CreateForm
            fields={[
              { name: "code", label: "Kode BPS", placeholder: "31" },
              { name: "name", label: "Nama Provinsi", placeholder: "DKI Jakarta" },
            ]}
            submitting={create.isPending}
            onSubmit={(values) => create.mutate({ table: "provinces", body: values })}
          />

          <ul className="mt-4 divide-y divide-line">
            {pageOf(master.data?.provinces ?? [], page).map((province) => (
              <li key={province.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-body">
                  {province.code} · {province.name}{" "}
                  <span className="text-muted">({province.cityCount} kota)</span>
                </span>
                <Button
                  variant="secondary"
                  onClick={() =>
                    toggleActive.mutate({
                      table: "provinces",
                      id: province.id,
                      isActive: !province.isActive,
                    })
                  }
                >
                  {province.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            totalPages={pageCount(master.data?.provinces ?? [])}
            totalItems={(master.data?.provinces ?? []).length}
            onPageChange={setPage}
          />
        </Card>
      ) : null}

      {tab === "cities" ? (
        <Card title="Kota" description="Kode mengikuti kode BPS, empat angka.">
          <CreateForm
            fields={[
              {
                name: "provinceId",
                label: "Provinsi",
                type: "select",
                options: (master.data?.provinces ?? []).map((province) => ({
                  value: String(province.id),
                  label: province.name,
                })),
              },
              { name: "code", label: "Kode BPS", placeholder: "3172" },
              { name: "name", label: "Nama Kota", placeholder: "Jakarta Timur" },
            ]}
            submitting={create.isPending}
            onSubmit={(values) =>
              create.mutate({
                table: "cities",
                body: { ...values, provinceId: Number(values.provinceId) },
              })
            }
          />

          <ul className="mt-4 divide-y divide-line">
            {pageOf(master.data?.cities ?? [], page).map((city) => (
              <li key={city.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-body">
                  {city.code} · {city.name}{" "}
                  <span className="text-muted">({city.provinceName})</span>
                </span>
                <Button
                  variant="secondary"
                  onClick={() =>
                    toggleActive.mutate({ table: "cities", id: city.id, isActive: !city.isActive })
                  }
                >
                  {city.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            totalPages={pageCount(master.data?.cities ?? [])}
            totalItems={(master.data?.cities ?? []).length}
            onPageChange={setPage}
          />
        </Card>
      ) : null}

      {tab === "vehicle-brands" || tab === "tire-brands" ? (
        <Card title={TAB_LABELS[tab]}>
          <CreateForm
            fields={[{ name: "name", label: "Nama Merk", placeholder: "Bridgestone" }]}
            submitting={create.isPending}
            onSubmit={(values) => create.mutate({ table: tab, body: values })}
          />

          <ul className="mt-4 divide-y divide-line">
            {pageOf(
              tab === "vehicle-brands"
                ? (master.data?.vehicleBrands ?? [])
                : (master.data?.tireBrands ?? []),
              page,
            ).map((brand) => (
              <li key={brand.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-body">{brand.name}</span>
                <Button
                  variant="secondary"
                  onClick={() =>
                    toggleActive.mutate({ table: tab, id: brand.id, isActive: !brand.isActive })
                  }
                >
                  {brand.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            totalPages={pageCount(tab === "vehicle-brands"
                ? (master.data?.vehicleBrands ?? [])
                : (master.data?.tireBrands ?? []))}
            totalItems={(tab === "vehicle-brands"
                ? (master.data?.vehicleBrands ?? [])
                : (master.data?.tireBrands ?? [])).length}
            onPageChange={setPage}
          />
        </Card>
      ) : null}

      {tab === "reviews" ? (
        <Card
          title="Merk yang Diisi Bebas"
          description="Nilai yang diketik pengguna karena tidak ada di daftar."
        >
          {/* PLAN/02 §5 keeps the free-text escape hatch on purpose: a managed
              list with no way in pushes people to pick the nearest wrong option,
              which is worse than the spelling variants it was meant to fix. */}
          <Banner tone="info">
            Promosikan nilai yang benar menjadi master data, agar laporan tidak lagi memecah satu
            merk menjadi beberapa ejaan.
          </Banner>

          {reviews.data === undefined || reviews.data.length === 0 ? (
            <EmptyState
              title="Tidak ada merk yang menunggu"
              description="Semua merk yang dipakai sudah ada di daftar master."
            />
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {reviews.data.map((review) => (
                <li
                  key={`${review.source}-${review.value}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-body">{review.value}</p>
                    <p className="text-xs text-muted">
                      {review.occurrences}× dipakai · pertama {formatDate(review.firstSeenAt)} ·{" "}
                      {review.source === "tire" ? "merk ban" : "merk kendaraan"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      create.mutate({
                        table: review.source === "tire" ? "tire-brands" : "vehicle-brands",
                        body: { name: review.value },
                      })
                    }
                  >
                    Jadikan Master Data
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}

interface CreateField {
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
}

function CreateForm({
  fields,
  submitting,
  onSubmit,
}: {
  fields: CreateField[];
  submitting: boolean;
  onSubmit: (values: Record<string, string>) => void;
}): ReactNode {
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
        setValues({});
      }}
      className="flex flex-wrap items-end gap-2"
    >
      {fields.map((field) => (
        <Field key={field.name} label={field.label} htmlFor={`new-${field.name}`}>
          {field.type === "select" ? (
            <Select
              id={`new-${field.name}`}
              value={values[field.name] ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.name]: event.target.value }))
              }
            >
              <option value="">— Pilih —</option>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={`new-${field.name}`}
              value={values[field.name] ?? ""}
              placeholder={field.placeholder}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.name]: event.target.value }))
              }
            />
          )}
        </Field>
      ))}

      <Button type="submit" loading={submitting} loadingText="Menyimpan…">
        Tambah
      </Button>
    </form>
  );
}
