import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TireBrandPattern, CreateTireBrandPatternInput } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, Spinner } from "../../components/ui/primitives.tsx";

type Tab = "TB" | "LT";

export function TireBrandPatternsPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("TB");
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const patterns = useQuery({
    queryKey: ["tire-brand-patterns", tab],
    queryFn: () =>
      api.get<{ items: TireBrandPattern[] }>(`/api/tire-brand-patterns/${tab.toLowerCase()}`, { perPage: 100 }),
  });

  const create = useMutation({
    mutationFn: (body: CreateTireBrandPatternInput) =>
      api.post("/api/tire-brand-patterns", { ...body, type: tab.toLowerCase() }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Pattern ban ditambahkan." });
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["tire-brand-patterns"] });
      await queryClient.invalidateQueries({ queryKey: ["tire-brands"] });
    },
    onError: setError,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      pattern,
      brand,
    }: {
      id: number;
      pattern: string;
      brand: string;
    }) => api.patch(`/api/tire-brand-patterns/${String(id)}`, { pattern, brand }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Pattern ban diperbarui." });
      setEditingId(null);
      setEditPattern("");
      setEditBrand("");
      await queryClient.invalidateQueries({ queryKey: ["tire-brand-patterns"] });
    },
    onError: setError,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/api/tire-brand-patterns/${String(id)}`),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Pattern ban dihapus." });
      setDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: ["tire-brand-patterns"] });
    },
    onError: setError,
  });

  const startEdit = (pattern: TireBrandPattern): void => {
    setEditingId(pattern.id);
    setEditPattern(pattern.pattern);
    setEditBrand(pattern.brand);
  };

  const submitEdit = (): void => {
    if (editingId === null || editPattern.trim() === "" || editBrand === "") return;
    update.mutate({ id: editingId, pattern: editPattern.trim(), brand: editBrand.trim() });
  };

   return (
     <div className="space-y-4">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Manajemen Pattern Ban</h1>
         <Button onClick={() => setCreating(true)}>Tambah Pattern</Button>
       </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

       <nav className="flex border-b border-slate-200 dark:border-slate-700">
         <button
           type="button"
           onClick={() => setTab("TB")}
           className={
             tab === "TB"
               ? "border-b-2 border-brand-600 px-4 py-2 text-sm font-medium text-brand-700"
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
               ? "border-b-2 border-brand-600 px-4 py-2 text-sm font-medium text-brand-700"
               : "px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
           }
         >
           LT (Light Truck)
         </button>
       </nav>

       <Card>
         {patterns.isLoading ? (
           <div className="flex justify-center py-10 text-slate-500 dark:text-slate-400">
             <Spinner className="h-5 w-5" />
           </div>
         ) : (
           <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {(patterns.data?.items ?? []).map((pattern) => (
              <li key={pattern.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                {editingId === pattern.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Field label="Pattern" htmlFor={`edit-pattern-${pattern.id}`}>
                      <Input
                        id={`edit-pattern-${pattern.id}`}
                        value={editPattern}
                        onChange={(event) => setEditPattern(event.target.value)}
                        autoFocus
                      />
                    </Field>
                    <Field label="Brand" htmlFor={`edit-brand-${pattern.id}`}>
                      <Input
                        id={`edit-brand-${pattern.id}`}
                        value={editBrand}
                        onChange={(event) => setEditBrand(event.target.value)}
                      />
                    </Field>
                    <Button onClick={submitEdit} loading={update.isPending}>
                      Simpan
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingId(null);
                        setEditPattern("");
                        setEditBrand("");
                      }}
                    >
                      Batal
                    </Button>
                  </div>
                 ) : (
                   <>
                     <div className="min-w-0">
                       <p className="font-medium text-slate-900 dark:text-white">
                         {pattern.pattern}{" "}
                         <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                           ({pattern.brand})
                         </span>
                       </p>
                       <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                         {pattern.isActive ? "Aktif" : "Nonaktif"}
                       </p>
                     </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" onClick={() => startEdit(pattern)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => setDeletingId(pattern.id)}>
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
        <CreatePatternDialog
          type={tab}
          onSubmit={(body) => create.mutate(body)}
          onClose={() => setCreating(false)}
          submitting={create.isPending}
        />
      ) : null}

      {deletingId !== null ? (
        <ConfirmDeleteDialog
          title="Hapus pattern ban"
          description="Pattern yang dihapus tidak bisa dikembalikan."
          onConfirm={() => remove.mutate(deletingId)}
          onClose={() => setDeletingId(null)}
          submitting={remove.isPending}
        />
      ) : null}
    </div>
  );
}

function CreatePatternDialog({
  type,
  onSubmit,
  onClose,
  submitting,
}: {
  type: Tab;
  onSubmit: (body: CreateTireBrandPatternInput) => void;
  onClose: () => void;
  submitting: boolean;
}): ReactNode {
  const [pattern, setPattern] = useState("");
  const [brand, setBrand] = useState("");

  const submit = (): void => {
    if (pattern.trim() === "" || brand.trim() === "") return;
    onSubmit({ pattern: pattern.trim(), brand: brand.trim(), type: type.toLowerCase() as "TB" | "LT" });
  };

   return (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
       <div className="w-full max-w-lg rounded-lg bg-white dark:bg-slate-900 shadow-xl">
         <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
           <h2 className="text-base font-semibold text-slate-900 dark:text-white">
             Tambah Pattern Ban ({type})
           </h2>
         </div>
        <div className="space-y-3 p-4">
          <Field label="Pattern" htmlFor="new-pattern-name" required>
            <Input
              id="new-pattern-name"
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder="Contoh: Ecopia"
              autoFocus
            />
          </Field>
          <Field label="Brand" htmlFor="new-pattern-brand" required>
            <Input
              id="new-pattern-brand"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Contoh: Bridgestone"
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
