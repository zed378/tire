import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createVehicleBrandSchema,
  updateVehicleBrandSchema,
  type CreateVehicleBrandInput,
  type UpdateVehicleBrandInput,
  type VehicleBrand,
  type VehicleBrandListResponse,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { applyFieldErrors } from "../../lib/form-errors.ts";
import {
  CancelButton,
  ConfirmDialog,
  Dialog,
  DialogFooter,
  ErrorBanner,
  useToast,
} from "../../components/ui/feedback.tsx";
import { Button, Card, EmptyState, Field, Input, SkeletonRows } from "../../components/ui/primitives.tsx";
import { Pagination } from "../../components/ui/pagination.tsx";

/**
 * Master data grows without anyone deciding to grow it — the CSV seed alone
 * loads hundreds of rows. A list with no pager silently stops at whatever
 * `perPage` happens to be, and nothing on screen admits it.
 */
const PER_PAGE = 25;

export function VehicleBrandsPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VehicleBrand | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const brands = useQuery({
    queryKey: ["vehicle-brands", page],
    queryFn: () =>
      api.get<VehicleBrandListResponse>("/api/vehicle-brands", { page, perPage: PER_PAGE }),
  });

  const total = brands.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const create = useMutation({
    mutationFn: (body: CreateVehicleBrandInput) => api.post("/api/vehicle-brands", body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Merk kendaraan ditambahkan." });
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["vehicle-brands"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateVehicleBrandInput }) =>
      api.patch(`/api/vehicle-brands/${String(id)}`, body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Merk kendaraan diperbarui." });
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["vehicle-brands"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/vehicle-brands/${String(id)}`),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Merk kendaraan dihapus." });
      setDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: ["vehicle-brands"] });
    },
    onError: setError,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-body">Manajemen Merk Kendaraan</h1>
        <Button onClick={() => setCreating(true)}>Tambah Merk</Button>
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {/* PLAN/05 §5.2 rule 6: a failure becomes a banner, never a silent one.
          Without this the list rendered as "no rows" when it actually meant "we
          could not ask" — and those look identical to the reader. */}
      {brands.error !== null ? <ErrorBanner error={brands.error} /> : null}

      <Card>
        {brands.isLoading ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Memuat merk kendaraan…</span>
            <SkeletonRows rows={5} />
          </div>
        ) : total === 0 ? (
          <EmptyState
            title="Belum ada merk kendaraan"
            description="Tambahkan merk pertama lewat tombol di atas."
          />
        ) : (
          <ul className="divide-y divide-line">
            {(brands.data?.items ?? []).map((brand) => (
              <li key={brand.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                {editing?.id === brand.id ? (
                  <EditBrandForm
                    brand={brand}
                    submitting={update.isPending}
                    onSubmit={(body) => update.mutateAsync({ id: brand.id, body })}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <div className="min-w-0">
                      <p className="font-medium text-body">{brand.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {brand.isActive ? "Aktif" : "Nonaktif"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(brand)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeletingId(brand.id)}>
                        Hapus
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
          disabled={brands.isFetching}
        />
      </Card>

      {creating ? (
        <CreateBrandDialog
          onSubmit={(body) => create.mutateAsync(body)}
          onClose={() => setCreating(false)}
          submitting={create.isPending}
        />
      ) : null}

      <ConfirmDialog
        open={deletingId !== null}
        title="Hapus merk kendaraan"
        description="Merk yang dihapus tidak bisa dikembalikan."
        confirmLabel="Hapus"
        loading={remove.isPending}
        onConfirm={() => {
          if (deletingId !== null) remove.mutate(deletingId);
        }}
        onClose={() => {
          setDeletingId(null);
        }}
      />
    </div>
  );
}

/**
 * The inline rename on a row.
 *
 * A real form with the shared schema behind it, not a bare input. The server
 * rejects a one-character name; before this the client let the user send it and
 * then had nowhere to put the answer.
 */
function EditBrandForm({
  brand,
  submitting,
  onSubmit,
  onCancel,
}: {
  brand: VehicleBrand;
  submitting: boolean;
  onSubmit: (body: UpdateVehicleBrandInput) => Promise<unknown>;
  onCancel: () => void;
}): ReactNode {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UpdateVehicleBrandInput>({
    resolver: zodResolver(updateVehicleBrandSchema),
    defaultValues: { name: brand.name },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({ name: values.name });
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("name", { message: "Gagal menyimpan. Silakan coba lagi." });
      }
    }
  });

  const fieldId = `edit-brand-${String(brand.id)}`;

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-1 flex-wrap items-start gap-2"
    >
      <Field label="Nama Merk" htmlFor={fieldId} error={errors.name?.message}>
        <Input id={fieldId} autoFocus invalid={errors.name !== undefined} {...register("name")} />
      </Field>
      <Button type="submit" loading={submitting} loadingText="Menyimpan…">
        Simpan
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel}>
        Batal
      </Button>
    </form>
  );
}

function CreateBrandDialog({
  onSubmit,
  onClose,
  submitting,
}: {
  onSubmit: (body: CreateVehicleBrandInput) => Promise<unknown>;
  onClose: () => void;
  submitting: boolean;
}): ReactNode {
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CreateVehicleBrandInput>({
    resolver: zodResolver(createVehicleBrandSchema),
    defaultValues: { name: "" },
  });

  // The dialog takes focus itself when it opens, so `autoFocus` on a child that
  // mounts in the same commit loses the race. Focus the field once it is up.
  useEffect(() => {
    setFocus("name");
  }, [setFocus]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("name", { message: "Gagal menyimpan. Silakan coba lagi." });
      }
    }
  });

  return (
    <Dialog open title="Tambah Merk Kendaraan" onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-3">
        <Field label="Nama Merk" htmlFor="new-brand-name" error={errors.name?.message} required>
          <Input
            id="new-brand-name"
            placeholder="Contoh: Toyota"
            invalid={errors.name !== undefined}
            {...register("name")}
          />
        </Field>

        <DialogFooter>
          <CancelButton onClick={onClose} />
          <Button type="submit" loading={submitting} loadingText="Menyimpan…">
            Tambah
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
