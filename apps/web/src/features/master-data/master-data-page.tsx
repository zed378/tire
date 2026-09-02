import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MasterDataBundle, PendingBrandReview } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatDate } from "../../lib/format.ts";
import { Banner, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Field, Input, Select } from "../../components/ui/primitives.tsx";

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

export function MasterDataPage(): ReactNode {
  const [tab, setTab] = useState<Tab>("provinces");
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
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Master Data</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            to="/master-data/vehicle-brands"
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Merk Kendaraan →
          </Link>
          <Link
            to="/master-data/tire-brand-patterns"
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Pattern Ban →
          </Link>
          <Link
            to="/master-data/tire-sizes"
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Ukuran Ban →
          </Link>
        </div>
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {(Object.keys(TAB_LABELS) as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={
              tab === value
                ? "border-b-2 border-brand-600 px-3 py-2 text-sm font-medium text-brand-700"
                : "px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
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

          <ul className="mt-4 divide-y divide-slate-200">
            {(master.data?.provinces ?? []).map((province) => (
              <li key={province.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-800">
                  {province.code} · {province.name}{" "}
                  <span className="text-slate-500">({province.cityCount} kota)</span>
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

          <ul className="mt-4 divide-y divide-slate-200">
            {(master.data?.cities ?? []).map((city) => (
              <li key={city.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-800">
                  {city.code} · {city.name}{" "}
                  <span className="text-slate-500">({city.provinceName})</span>
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
        </Card>
      ) : null}

      {tab === "vehicle-brands" || tab === "tire-brands" ? (
        <Card title={TAB_LABELS[tab]}>
          <CreateForm
            fields={[{ name: "name", label: "Nama Merk", placeholder: "Bridgestone" }]}
            submitting={create.isPending}
            onSubmit={(values) => create.mutate({ table: tab, body: values })}
          />

          <ul className="mt-4 divide-y divide-slate-200">
            {(tab === "vehicle-brands"
              ? (master.data?.vehicleBrands ?? [])
              : (master.data?.tireBrands ?? [])
            ).map((brand) => (
              <li key={brand.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-800">{brand.name}</span>
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
            <ul className="mt-3 divide-y divide-slate-200">
              {reviews.data.map((review) => (
                <li
                  key={`${review.source}-${review.value}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{review.value}</p>
                    <p className="text-xs text-slate-500">
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
