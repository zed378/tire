import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateVehicleBrandInput,
  VehicleBrand,
  VehicleBrandListResponse,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
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
    onError: setError,
  });

  const update = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch(`/api/vehicle-brands/${String(id)}`, { name }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Merk kendaraan diperbarui." });
      setEditingId(null);
      setEditName("");
      await queryClient.invalidateQueries({ queryKey: ["vehicle-brands"] });
    },
    onError: setError,
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

  const startEdit = (brand: VehicleBrand): void => {
    setEditingId(brand.id);
    setEditName(brand.name);
  };

  const submitEdit = (): void => {
    if (editingId === null || editName.trim() === "") return;
    update.mutate({ id: editingId, name: editName.trim() });
  };

   return (
     <div className="space-y-4">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <h1 className="text-lg font-semibold text-body">Manajemen Merk Kendaraan</h1>
         <Button onClick={() => setCreating(true)}>Tambah Merk</Button>
       </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

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
              <li key={brand.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                {editingId === brand.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Field label="Nama Merk" htmlFor={`edit-${brand.id}`}>
                      <Input
                        id={`edit-${brand.id}`}
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        autoFocus
                      />
                    </Field>
                    <Button onClick={submitEdit} loading={update.isPending}>
                      Simpan
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingId(null);
                        setEditName("");
                      }}
                    >
                      Batal
                    </Button>
                  </div>
                 ) : (
                   <>
                     <div className="min-w-0">
                       <p className="font-medium text-body">{brand.name}</p>
                       <p className="mt-0.5 text-xs text-muted">
                         {brand.isActive ? "Aktif" : "Nonaktif"}
                       </p>
                     </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" onClick={() => startEdit(brand)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => setDeletingId(brand.id)}>
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
          onSubmit={(name) => create.mutate({ name })}
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

function CreateBrandDialog({
  onSubmit,
  onClose,
  submitting,
}: {
  onSubmit: (name: string) => void;
  onClose: () => void;
  submitting: boolean;
}): ReactNode {
  const [name, setName] = useState("");

  const submit = (): void => {
    if (name.trim() === "") return;
    onSubmit(name.trim());
  };

  return (
    <Dialog open title="Tambah Merk Kendaraan" onClose={onClose}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Field label="Nama Merk" htmlFor="new-brand-name" required>
          <Input
            id="new-brand-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Contoh: Toyota"
            autoFocus
          />
        </Field>

        {/* Inside the form, so Enter and the button take the same path. They
            used to be separate: the buttons sat outside the <form>, which meant
            the keyboard and the mouse ran different code. */}
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

