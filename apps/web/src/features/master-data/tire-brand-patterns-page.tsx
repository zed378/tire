import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createTireBrandPatternSchema,
  updateTireBrandPatternSchema,
  type CreateTireBrandPatternInput,
  type TireBrandPattern,
  type TireBrandPatternListResponse,
  type UpdateTireBrandPatternInput,
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
import { Tabs, TabPanel } from "../../components/ui/tabs.tsx";

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
  const [editing, setEditing] = useState<TireBrandPattern | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const patterns = useQuery({
    queryKey: ["tire-brand-patterns", tab, page],
    queryFn: () =>
      api.get<TireBrandPatternListResponse>(`/api/tire-brand-patterns/${tab}`, {
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
      api.post("/api/tire-brand-patterns", body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Pattern ban ditambahkan." });
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["tire-brand-patterns"] });
      await queryClient.invalidateQueries({ queryKey: ["tire-brands"] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateTireBrandPatternInput }) =>
      api.patch(`/api/tire-brand-patterns/${String(id)}`, body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Pattern ban diperbarui." });
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["tire-brand-patterns"] });
    },
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

   return (
     <div className="space-y-4">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <h1 className="text-lg font-semibold text-body">Manajemen Pattern Ban</h1>
         <Button onClick={() => setCreating(true)}>Tambah Pattern</Button>
       </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {/* PLAN/05 §5.2 rule 6: a failure becomes a banner, never a silent one.
          Without this the list rendered as "no rows" when it actually meant "we
          could not ask" — and those look identical to the reader. */}
      {patterns.error !== null ? <ErrorBanner error={patterns.error} /> : null}

      <Tabs
        label="Kategori pattern ban"
        value={tab}
        onChange={switchTab}
        items={[
          { value: "TB", label: "TB (Truck/Bus)" },
          { value: "LT", label: "LT (Light Truck)" },
        ]}
      />

      {/* The tab bar tells assistive technology it controls a region. Without
          this wrapper that region did not exist — `aria-controls` pointed at an
          id nothing rendered, which axe reports as critical. */}
      <TabPanel value={tab}>
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
              <li key={pattern.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                {editing?.id === pattern.id ? (
                  <EditPatternForm
                    pattern={pattern}
                    submitting={update.isPending}
                    onSubmit={(body) => update.mutateAsync({ id: pattern.id, body })}
                    onCancel={() => setEditing(null)}
                  />
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
                      <Button variant="secondary" size="sm" onClick={() => setEditing(pattern)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeletingId(pattern.id)}>
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
      </TabPanel>

      {creating ? (
        <CreatePatternDialog
          type={tab}
          onSubmit={(body) => create.mutateAsync(body)}
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

/**
 * The inline rename on a row, as a real form with the shared schema behind it.
 *
 * The server rejects an empty pattern and a one-character brand. Before this the
 * client let the user send either and then had nowhere to put the answer.
 */
function EditPatternForm({
  pattern,
  submitting,
  onSubmit,
  onCancel,
}: {
  pattern: TireBrandPattern;
  submitting: boolean;
  onSubmit: (body: UpdateTireBrandPatternInput) => Promise<unknown>;
  onCancel: () => void;
}): ReactNode {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<UpdateTireBrandPatternInput>({
    resolver: zodResolver(updateTireBrandPatternSchema),
    defaultValues: { pattern: pattern.pattern, brand: pattern.brand },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({ pattern: values.pattern, brand: values.brand });
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("pattern", { message: "Gagal menyimpan. Silakan coba lagi." });
      }
    }
  });

  const patternFieldId = `edit-pattern-${String(pattern.id)}`;
  const brandFieldId = `edit-brand-${String(pattern.id)}`;

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-1 flex-wrap items-start gap-2"
    >
      <Field label="Pattern" htmlFor={patternFieldId} error={errors.pattern?.message}>
        <Input
          id={patternFieldId}
          autoFocus
          invalid={errors.pattern !== undefined}
          {...register("pattern")}
        />
      </Field>
      <Field label="Brand" htmlFor={brandFieldId} error={errors.brand?.message}>
        <Input id={brandFieldId} invalid={errors.brand !== undefined} {...register("brand")} />
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

function CreatePatternDialog({
  type,
  onSubmit,
  onClose,
  submitting,
}: {
  type: Tab;
  onSubmit: (body: CreateTireBrandPatternInput) => Promise<unknown>;
  onClose: () => void;
  submitting: boolean;
}): ReactNode {
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CreateTireBrandPatternInput>({
    resolver: zodResolver(createTireBrandPatternSchema),
    // The tab decides the category; it is a value the form carries, not one the
    // user is asked for a second time.
    defaultValues: { pattern: "", brand: "", type },
  });

  // The dialog takes focus itself when it opens, so `autoFocus` on a child that
  // mounts in the same commit loses the race.
  useEffect(() => {
    setFocus("pattern");
  }, [setFocus]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("pattern", { message: "Gagal menyimpan. Silakan coba lagi." });
      }
    }
  });

  return (
    <Dialog open title={`Tambah Pattern Ban (${type})`} onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-3">
        <Field label="Pattern" htmlFor="new-pattern-name" error={errors.pattern?.message} required>
          <Input
            id="new-pattern-name"
            placeholder="Contoh: Ecopia"
            invalid={errors.pattern !== undefined}
            {...register("pattern")}
          />
        </Field>
        <Field label="Brand" htmlFor="new-pattern-brand" error={errors.brand?.message} required>
          <Input
            id="new-pattern-brand"
            placeholder="Contoh: Bridgestone"
            invalid={errors.brand !== undefined}
            {...register("brand")}
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

