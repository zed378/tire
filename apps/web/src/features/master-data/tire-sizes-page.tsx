import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTireSizeInput, TireSize, TireSizeListResponse } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSize, setEditSize] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sizes = useQuery({
    queryKey: ["tire-sizes", tab, page],
    queryFn: () =>
      api.get<TireSizeListResponse>(`/api/tire-sizes/${tab}`, { page, perPage: PER_PAGE }),
  });

  const create = useMutation({
    mutationFn: (body: CreateTireSizeInput) =>
      api.post("/api/tire-sizes", body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Ukuran ban ditambahkan." });
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["tire-sizes"] });
    },
    onError: setError,
  });

  const update = useMutation({
    mutationFn: ({ id, size }: { id: number; size: string }) =>
      api.patch(`/api/tire-sizes/${String(id)}`, { size }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Ukuran ban diperbarui." });
      setEditingId(null);
      setEditSize("");
      await queryClient.invalidateQueries({ queryKey: ["tire-sizes"] });
    },
    onError: setError,
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

  const startEdit = (item: TireSize): void => {
    setEditingId(item.id);
    setEditSize(item.size);
  };

  const submitEdit = (): void => {
    if (editingId === null || editSize.trim() === "") return;
    update.mutate({ id: editingId, size: editSize.trim() });
  };

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
                  sizes.data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-sunken">
                      <td className="py-2.5 px-3 font-medium text-body">
                        {editingId === item.id ? (
                          <Input
                            value={editSize}
                            onChange={(e) => setEditSize(e.target.value)}
                            className="max-w-xs"
                          />
                        ) : (
                          item.size
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted">
                        {item.type}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {editingId === item.id ? (
                          <div className="flex justify-end gap-1.5">
                            <Button onClick={submitEdit} loading={update.isPending} className="min-h-9 px-3 text-xs">
                              Simpan
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setEditingId(null);
                                setEditSize("");
                              }}
                              className="min-h-9 px-3 text-xs"
                            >
                              Batal
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            <Button variant="secondary" onClick={() => startEdit(item)} className="min-h-9 px-3 text-xs">
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
                        )}
                      </td>
                    </tr>
                  ))
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
          onSubmit={(body) => create.mutate(body)}
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

function CreateSizeDialog({
  type,
  onSubmit,
  onClose,
  submitting,
}: {
  type: Tab;
  onSubmit: (body: CreateTireSizeInput) => void;
  onClose: () => void;
  submitting: boolean;
}): ReactNode {
  const [size, setSize] = useState("");

  const handleClose = (): void => {
    setSize("");
    onClose();
  };

  const submit = (): void => {
    if (size.trim() === "") return;
    const val = size.trim();
    setSize("");
    onSubmit({ size: val, type });
  };

  return (
    <Dialog open title={`Tambah Ukuran Ban (${type})`} onClose={handleClose}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Field
          label="Ukuran Ban"
          htmlFor="new-size-name"
          hint="Contoh: 10.00R20 atau 7.50-16"
          required
        >
          <Input
            id="new-size-name"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            placeholder="Contoh: 10.00R20"
            autoFocus
          />
        </Field>

        <DialogFooter>
          <CancelButton onClick={handleClose} />
          <Button type="submit" loading={submitting} loadingText="Menyimpan…">
            Tambah
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

