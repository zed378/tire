import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TireSize, CreateTireSizeInput } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, Spinner } from "../../components/ui/primitives.tsx";

type Tab = "TB" | "LT";

export function TireSizesPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("TB");
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSize, setEditSize] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sizes = useQuery({
    queryKey: ["tire-sizes", tab],
    queryFn: () =>
      api.get<{ items: TireSize[] }>(`/api/tire-sizes/${tab}`, { perPage: 100 }),
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
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Manajemen Ukuran Ban</h1>
        <Button onClick={() => setCreating(true)}>Tambah Ukuran</Button>
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <nav className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setTab("TB")}
          className={
            tab === "TB"
              ? "border-b-2 border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 dark:text-brand-400"
              : "px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }
        >
          TB (Truck/Bus)
        </button>
        <button
          type="button"
          onClick={() => setTab("LT")}
          className={
            tab === "LT"
              ? "border-b-2 border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 dark:text-brand-400"
              : "px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }
        >
          LT (Light Truck)
        </button>
      </nav>

      {sizes.isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : null}

      {sizes.data !== undefined ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Ukuran</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sizes.data.items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-500 dark:text-slate-400">
                      Belum ada ukuran ban untuk kategori {tab}.
                    </td>
                  </tr>
                ) : (
                  sizes.data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
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
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
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

      {deletingId !== null ? (
        <ConfirmDeleteDialog
          title="Hapus ukuran ban"
          description="Ukuran ban yang dihapus tidak bisa dikembalikan."
          onConfirm={() => remove.mutate(deletingId)}
          onClose={() => setDeletingId(null)}
          submitting={remove.isPending}
        />
      ) : null}
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

  const submit = (): void => {
    if (size.trim() === "") return;
    onSubmit({ size: size.trim(), type });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-slate-900 shadow-xl">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Tambah Ukuran Ban ({type})
          </h2>
        </div>
        <div className="space-y-3 p-4">
          <Field label="Ukuran Ban" htmlFor="new-size-name" hint="Contoh: 10.00R20 atau 7.50-16" required>
            <Input
              id="new-size-name"
              value={size}
              onChange={(event) => setSize(event.target.value)}
              placeholder="Contoh: 10.00R20"
              autoFocus
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={submit} loading={submitting} loadingText="Menyimpan…">
            Tambah
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteDialog({
  title,
  description,
  onConfirm,
  onClose,
  submitting,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
}): ReactNode {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-slate-900 shadow-xl">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting} loadingText="Menghapus…">
            Hapus
          </Button>
        </div>
      </div>
    </div>
  );
}
