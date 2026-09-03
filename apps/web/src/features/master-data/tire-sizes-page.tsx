import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createTireSizeSchema,
  updateTireSizeSchema,
  type CreateTireSizeInput,
  type TireSize,
  type TireSizeListResponse,
  type UpdateTireSizeInput,
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
import { Button, Card, Field, Input, SkeletonRows } from "../../components/ui/primitives.tsx";
import { Pagination } from "../../components/ui/pagination.tsx";
import { Tabs } from "../../components/ui/tabs.tsx";

type Tab = "TB" | "LT";

/**
 * Sizes arrive from req-Size.csv and grow whenever the business adds one, so
 * the list is paged rather than trusting it to stay short.
 */
const PER_PAGE = 25;

export function TireSizesPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("TB");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TireSize | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sizes = useQuery({
    queryKey: ["tire-sizes", tab, page],
    queryFn: () =>
      api.get<TireSizeListResponse>(`/api/tire-sizes/${tab}`, { page, perPage: PER_PAGE }),
  });

  const create = useMutation({
    mutationFn: (body: CreateTireSizeInput) => api.post("/api/tire-sizes", body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Ukuran ban ditambahkan." });
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["tire-sizes"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateTireSizeInput }) =>
      api.patch(`/api/tire-sizes/${String(id)}`, body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Ukuran ban diperbarui." });
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["tire-sizes"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/tire-sizes/${String(id)}`),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Ukuran ban dihapus." });
      setDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: ["tire-sizes"] });
    },
    onError: setError,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-body">Manajemen Ukuran Ban</h1>
        <Button onClick={() => setCreating(true)}>Tambah Ukuran</Button>
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <Tabs
        label="Kategori ukuran ban"
        value={tab}
        onChange={(next) => {
          setTab(next);
          setPage(1);
        }}
        items={[
          { value: "TB", label: "TB (Truck/Bus)" },
          { value: "LT", label: "LT (Light Truck)" },
        ]}
      />

      {sizes.isLoading ? (
        <Card>
          <div role="status" aria-live="polite">
            <span className="sr-only">Memuat ukuran ban…</span>
            <SkeletonRows rows={5} />
          </div>
        </Card>
      ) : null}

      {sizes.data !== undefined ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="py-2.5 px-3">Ukuran</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sizes.data.items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted">
                      Belum ada ukuran ban untuk kategori {tab}.
                    </td>
                  </tr>
                ) : (
                  sizes.data.items.map((item) =>
                    editing?.id === item.id ? (
                      <EditSizeRow
                        key={item.id}
                        size={item}
                        submitting={update.isPending}
                        onSubmit={(body) => update.mutateAsync({ id: item.id, body })}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <tr key={item.id} className="hover:bg-surface-sunken">
                        <td className="py-2.5 px-3 font-medium text-body">{item.size}</td>
                        <td className="py-2.5 px-3 text-muted">{item.type}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              onClick={() => setEditing(item)}
                              className="min-h-9 px-3 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => setDeletingId(item.id)}
                              className="min-h-9 px-3 text-xs"
                            >
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(sizes.data.total / PER_PAGE))}
            totalItems={sizes.data.total}
            onPageChange={setPage}
            disabled={sizes.isFetching}
          />
        </Card>
      ) : null}

      {creating ? (
        <CreateSizeDialog
          type={tab}
          onSubmit={(body) => create.mutateAsync(body)}
          onClose={() => setCreating(false)}
          submitting={create.isPending}
        />
      ) : null}

      <ConfirmDialog
          open={deletingId !== null}
          title="Hapus ukuran ban"
          description="Ukuran ban yang dihapus tidak bisa dikembalikan."
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
 * The inline rename, as one row of the table.
 *
 * The form element lives in the first cell and the Save button in the third, so
 * they are joined by `form=` rather than by nesting — a `<form>` cannot wrap two
 * `<td>`s. Enter still submits, and the shared schema still decides what is
 * valid.
 */
function EditSizeRow({
  size,
  submitting,
  onSubmit,
  onCancel,
}: {
  size: TireSize;
  submitting: boolean;
  onSubmit: (body: UpdateTireSizeInput) => Promise<unknown>;
  onCancel: () => void;
}): ReactNode {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UpdateTireSizeInput>({
    resolver: zodResolver(updateTireSizeSchema),
    defaultValues: { size: size.size },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({ size: values.size });
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("size", { message: "Gagal menyimpan. Silakan coba lagi." });
      }
    }
  });

  const formId = `edit-size-form-${String(size.id)}`;
  const fieldId = `edit-size-${String(size.id)}`;

  return (
    <tr className="hover:bg-surface-sunken">
      <td className="py-2.5 px-3 font-medium text-body">
        <form id={formId} noValidate onSubmit={(event) => void submit(event)} />
        <Field label="Ukuran Ban" htmlFor={fieldId} error={errors.size?.message}>
          <Input
            id={fieldId}
            form={formId}
            autoFocus
            className="max-w-xs"
            invalid={errors.size !== undefined}
            {...register("size")}
          />
        </Field>
      </td>
      <td className="py-2.5 px-3 text-muted">{size.type}</td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex justify-end gap-1.5">
          <Button
            type="submit"
            form={formId}
            loading={submitting}
            loadingText="Menyimpan…"
            className="min-h-9 px-3 text-xs"
          >
            Simpan
          </Button>
          <Button variant="secondary" onClick={onCancel} className="min-h-9 px-3 text-xs">
            Batal
          </Button>
        </div>
      </td>
    </tr>
  );
}

function CreateSizeDialog({
  type,
  onSubmit,
  onClose,
  submitting,
}: {
  type: Tab;
  onSubmit: (body: CreateTireSizeInput) => Promise<unknown>;
  onClose: () => void;
  submitting: boolean;
}): ReactNode {
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CreateTireSizeInput>({
    resolver: zodResolver(createTireSizeSchema),
    // The tab decides the category; it is a value the form carries, not one the
    // user is asked for a second time.
    defaultValues: { size: "", type },
  });

  // The dialog takes focus itself when it opens, so `autoFocus` on a child that
  // mounts in the same commit loses the race.
  useEffect(() => {
    setFocus("size");
  }, [setFocus]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("size", { message: "Gagal menyimpan. Silakan coba lagi." });
      }
    }
  });

  return (
    <Dialog open title={`Tambah Ukuran Ban (${type})`} onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-3">
        <Field
          label="Ukuran Ban"
          htmlFor="new-size-name"
          error={errors.size?.message}
          hint="Contoh: 10.00R20 atau 7.50-16"
          required
        >
          <Input
            id="new-size-name"
            placeholder="Contoh: 10.00R20"
            invalid={errors.size !== undefined}
            {...register("size")}
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

