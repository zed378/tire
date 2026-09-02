import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateTireBrandPatternInput,
  TireBrandPattern,
  TireBrandPatternListResponse,
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
import { Tabs } from "../../components/ui/tabs.tsx";

type Tab = "TB" | "LT";

/**
 * The seed loads 1,551 patterns, and this screen used to ask for the first
 * hundred and render them with no pager — so 1,451 of them simply did not
 * exist as far as an admin was concerned, with nothing on screen to say so.
 */
const PER_PAGE = 25;

export function TireBrandPatternsPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("TB");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const patterns = useQuery({
    queryKey: ["tire-brand-patterns", tab, page],
    queryFn: () =>
      api.get<TireBrandPatternListResponse>(`/api/tire-brand-patterns/${tab.toLowerCase()}`, {
        page,
        perPage: PER_PAGE,
      }),
  });

  const total = patterns.data?.total ?? 0;
  // The endpoint reports `total` and `perPage` but not a page count, so it is
  // derived here rather than trusted from a second source.
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const switchTab = (next: Tab): void => {
    setTab(next);
    // Page 3 of TB is rarely page 3 of LT, and reading a new result set at an
    // old offset shows the user a blank card.
    setPage(1);
  };

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
         <h1 className="text-lg font-semibold text-body">Manajemen Pattern Ban</h1>
         <Button onClick={() => setCreating(true)}>Tambah Pattern</Button>
       </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <Tabs
        label="Kategori pattern ban"
        value={tab}
        onChange={switchTab}
        items={[
          { value: "TB", label: "TB (Truck/Bus)" },
          { value: "LT", label: "LT (Light Truck)" },
        ]}
      />

       <Card>
        {patterns.isLoading ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Memuat pattern ban…</span>
            <SkeletonRows rows={5} />
          </div>
        ) : total === 0 ? (
          <EmptyState
            title="Belum ada pattern ban"
            description={`Tidak ada pattern untuk kategori ${tab}.`}
          />
        ) : (
          <ul className="divide-y divide-line">
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
                       <p className="font-medium text-body">
                         {pattern.pattern}{" "}
                         <span className="text-xs font-normal text-muted">
                           ({pattern.brand})
                         </span>
                       </p>
                       <p className="mt-0.5 text-xs text-muted">
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

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
          disabled={patterns.isFetching}
        />
      </Card>

      {creating ? (
        <CreatePatternDialog
          type={tab}
          onSubmit={(body) => create.mutate(body)}
          onClose={() => setCreating(false)}
          submitting={create.isPending}
        />
      ) : null}

      <ConfirmDialog
          open={deletingId !== null}
          title="Hapus pattern ban"
          description="Pattern yang dihapus tidak bisa dikembalikan."
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
    <Dialog open title={`Tambah Pattern Ban (${type})`} onClose={onClose}>
      {/* A real <form>. There was none here at all, so pressing Enter after
          typing a pattern did nothing whatsoever — the only way to submit was
          to reach for the mouse. */}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
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

