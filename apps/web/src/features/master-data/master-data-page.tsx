import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createBrandSchema,
  createCitySchema,
  createProvinceSchema,
  type CreateBrandInput,
  type CreateCityInput,
  type CreateProvinceInput,
  type MasterDataBundle,
  type PendingBrandReview,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { applyFieldErrors, hasFieldErrors } from "../../lib/form-errors.ts";
import { formatDate } from "../../lib/format.ts";
import { Banner, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Field, Input, Select } from "../../components/ui/primitives.tsx";
import { Pagination } from "../../components/ui/pagination.tsx";
import { Tabs, TabPanel } from "../../components/ui/tabs.tsx";

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
    // This mutation is shared by the add form and the "Jadikan Master Data"
    // button on the reviews tab. The form puts field errors under its fields,
    // so only what it cannot place becomes the banner.
    onError: (caught) => {
      if (!hasFieldErrors(caught)) setError(caught);
    },
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

      {/*
        The shared Tabs. The row of plain buttons this replaces had no
        `role="tablist"`, no `aria-selected` and no arrow keys, so a screen
        reader announced five unrelated buttons and gave no hint that choosing
        one changed the panel below it.
      */}
      <Tabs
        label="Kategori master data"
        value={tab}
        onChange={(value) => {
          setTab(value);
          setPage(1);
        }}
        items={(Object.keys(TAB_LABELS) as Tab[]).map((value) => ({
          value,
          label: TAB_LABELS[value],
        }))}
      />

      {tab === "provinces" ? (
        <TabPanel value={tab}>
          <Card title="Provinsi" description="Kode mengikuti kode BPS, dua angka.">
            <CreateForm<CreateProvinceInput>
              schema={createProvinceSchema}
              defaultValues={{ code: "", name: "" }}
              fields={[
                { name: "code", label: "Kode BPS", placeholder: "31" },
                { name: "name", label: "Nama Provinsi", placeholder: "DKI Jakarta" },
              ]}
              submitting={create.isPending}
              onSubmit={(values) => create.mutateAsync({ table: "provinces", body: values })}
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
        </TabPanel>
      ) : null}

      {tab === "cities" ? (
        <TabPanel value={tab}>
          <Card title="Kota" description="Kode mengikuti kode BPS, empat angka.">
            <CreateForm<CreateCityInput>
              schema={createCitySchema}
              defaultValues={{ provinceId: 0, code: "", name: "" }}
              fields={[
                {
                  name: "provinceId",
                  label: "Provinsi",
                  type: "select",
                  numeric: true,
                  options: (master.data?.provinces ?? []).map((province) => ({
                    value: String(province.id),
                    label: province.name,
                  })),
                },
                { name: "code", label: "Kode BPS", placeholder: "3172" },
                { name: "name", label: "Nama Kota", placeholder: "Jakarta Timur" },
              ]}
              submitting={create.isPending}
              onSubmit={(values) => create.mutateAsync({ table: "cities", body: values })}
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
        </TabPanel>
      ) : null}

      {tab === "vehicle-brands" || tab === "tire-brands" ? (
        <TabPanel value={tab}>
          <Card title={TAB_LABELS[tab]}>
            <CreateForm<CreateBrandInput>
              // Keyed by tab: the two brand tabs share this form, and without a
              // key the field keeps whatever was typed under the other tab.
              key={tab}
              schema={createBrandSchema}
              defaultValues={{ name: "" }}
              fields={[{ name: "name", label: "Nama Merk", placeholder: "Bridgestone" }]}
              submitting={create.isPending}
              onSubmit={(values) => create.mutateAsync({ table: tab, body: values })}
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
        </TabPanel>
      ) : null}

      {tab === "reviews" ? (
        <TabPanel value={tab}>
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
        </TabPanel>
      ) : null}
    </div>
  );
}

interface CreateField<T extends FieldValues> {
  name: Path<T>;
  label: string;
  placeholder?: string;
  type?: "text" | "select";
  /** Selects post strings; a schema expecting a number needs the conversion. */
  numeric?: boolean;
  options?: { value: string; label: string }[];
}

/**
 * The add-a-row form at the top of each tab.
 *
 * It takes the `@c26/contracts` schema rather than validating by hand, so the
 * two-digit province code and the four-digit city code are checked here by the
 * same rule the server checks them by. Before this the form sent whatever was
 * typed and the 422 came back as a page banner with no field to point at.
 */
function CreateForm<T extends FieldValues>({
  schema,
  fields,
  defaultValues,
  submitting,
  onSubmit,
}: {
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Non-empty: the first field is where an unplaceable server error lands. */
  fields: [CreateField<T>, ...CreateField<T>[]];
  defaultValues: DefaultValues<T>;
  submitting: boolean;
  onSubmit: (values: T) => Promise<unknown>;
}): ReactNode {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<T>({ resolver: zodResolver(schema), defaultValues });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      reset(defaultValues);
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError(fields[0].name, { message: "Gagal menyimpan. Silakan coba lagi." });
      }
    }
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-wrap items-end gap-2">
      {fields.map((field) => {
        const message = errors[field.name]?.message;
        const error = typeof message === "string" ? message : undefined;
        const registration = register(
          field.name,
          field.numeric === true ? { setValueAs: (value: string) => Number(value) } : {},
        );

        return (
          <Field
            key={field.name}
            label={field.label}
            htmlFor={`new-${field.name}`}
            error={error}
            required
          >
            {field.type === "select" ? (
              <Select id={`new-${field.name}`} invalid={error !== undefined} {...registration}>
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
                placeholder={field.placeholder}
                invalid={error !== undefined}
                {...registration}
              />
            )}
          </Field>
        );
      })}

      <Button type="submit" loading={submitting} loadingText="Menyimpan…">
        Tambah
      </Button>
    </form>
  );
}
