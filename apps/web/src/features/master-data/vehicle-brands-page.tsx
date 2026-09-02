import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VehicleBrand, CreateVehicleBrandInput } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, Spinner } from "../../components/ui/primitives.tsx";

export function VehicleBrandsPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const brands = useQuery({
    queryKey: ["vehicle-brands"],
    queryFn: () => api.get<{ items: VehicleBrand[] }>("/api/vehicle-brands", { perPage: 100 }),
  });

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
           <div className="flex justify-center py-10 text-muted">
             <Spinner className="h-5 w-5" />
           </div>
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
      </Card>

      {creating ? (
        <CreateBrandDialog
          onSubmit={(name) => create.mutate({ name })}
          onClose={() => setCreating(false)}
          submitting={create.isPending}
        />
      ) : null}

      {deletingId !== null ? (
        <ConfirmDeleteDialog
          title="Hapus merk kendaraan"
          description="Merk yang dihapus tidak bisa dikembalikan."
          onConfirm={() => remove.mutate(deletingId)}
          onClose={() => setDeletingId(null)}
          submitting={remove.isPending}
        />
      ) : null}
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
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
       <div className="w-full max-w-lg rounded-lg bg-surface shadow-xl">
         <div className="border-b border-line px-4 py-3">
           <h2 className="text-base font-semibold text-body">Tambah Merk Kendaraan</h2>
         </div>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="space-y-3 p-4"
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
        </form>
         <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
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
       <div className="w-full max-w-lg rounded-lg bg-surface shadow-xl">
         <div className="border-b border-line px-4 py-3">
           <h2 className="text-base font-semibold text-body">{title}</h2>
           <p className="mt-0.5 text-sm text-muted">{description}</p>
         </div>
         <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
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
