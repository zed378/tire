import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  deleteUserSchema,
  USER_ROLE_LABELS,
  USER_ROLES,
  type CreateUserInput,
  type DeleteUserInput,
  type MasterDataBundle,
  type Paginated,
  type UserRecord,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { applyFieldErrors } from "../../lib/form-errors.ts";
import { formatRelative } from "../../lib/format.ts";
import { useSession } from "../../lib/session.tsx";
import {
  Banner,
  CancelButton,
  ConfirmDialog,
  Dialog,
  DialogFooter,
  ErrorBanner,
  useToast,
} from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, Select, Spinner } from "../../components/ui/primitives.tsx";
import { Pagination } from "../../components/ui/pagination.tsx";

/**
 * User management (PLAN/04 §5) — closes D-12.
 *
 * The legacy system had add and delete and nothing else: no edit, no password
 * reset, no deactivate. The four guards the server enforces are visible in this
 * UI too — you cannot delete yourself, you cannot remove the last active admin,
 * a role change ends every session, and deletion asks you to retype the username
 * rather than nodding at a browser `confirm()` (which is forbidden anyway).
 */
const PER_PAGE = 25;

export function UsersPage(): ReactNode {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user: currentUser } = useSession();

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<UserRecord | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [resettingMfa, setResettingMfa] = useState<UserRecord | null>(null);
  const [error, setError] = useState<unknown>(null);

  const users = useQuery({
    queryKey: ["users", page],
    queryFn: () => api.get<Paginated<UserRecord>>("/api/users", { page, perPage: PER_PAGE }),
  });

  const master = useQuery({
    queryKey: ["masterdata"],
    queryFn: () => api.get<MasterDataBundle>("/api/masterdata"),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const create = useMutation({
    mutationFn: (input: CreateUserInput) =>
      api.post<{ user: UserRecord; temporaryPassword: string }>("/api/users", input),
    onSuccess: async (result) => {
      // Shown exactly once, for the admin to pass on out of band. It is never
      // stored in readable form anywhere.
      setTemporaryPassword(result.temporaryPassword);
      setCreating(false);
      await invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Record<string, unknown> }) =>
      api.patch(`/api/users/${String(id)}`, patch),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Perubahan tersimpan." });
      await invalidate();
    },
    onError: setError,
  });

  const resetPassword = useMutation({
    mutationFn: (id: number) =>
      api.post<{ temporaryPassword: string; revokedSessions: number }>(
        `/api/users/${String(id)}/reset-password`,
      ),
    onSuccess: async (result) => {
      setTemporaryPassword(result.temporaryPassword);
      toast.push({
        tone: "success",
        message: `Password direset. ${result.revokedSessions} sesi dicabut.`,
      });
      await invalidate();
    },
    onError: setError,
  });

  /**
   * Resetting somebody else's two-factor authentication.
   *
   * `PLAN/13` §3 states it plainly: "Reset MFA — hanya oleh admin lain, tercatat
   * di audit, dan mencabut seluruh sesi." The endpoint has always done exactly
   * that, and nothing on this screen called it.
   *
   * The consequence of that gap was not cosmetic. An admin's role requires MFA,
   * so an admin who loses their phone and their ten recovery codes is locked out
   * — and the only remaining route in was direct database access, which
   * `PLAN/10` §5 forbids outright. There was no way back into the system.
   *
   * `resetMfa` refuses to act on the caller themselves, which is the point of
   * the rule: a self-service reset turns MFA into security theatre.
   */
  const resetMfaFor = useMutation({
    mutationFn: (id: number) => api.post(`/api/users/${String(id)}/reset-mfa`),
    onSuccess: async () => {
      setResettingMfa(null);
      toast.push({
        tone: "success",
        message: "2FA direset. Pengguna mendaftar ulang saat login berikutnya, dan semua sesinya dicabut.",
      });
      await invalidate();
    },
    onError: (caught) => {
      setResettingMfa(null);
      setError(caught);
    },
  });

  const remove = useMutation({
    mutationFn: ({ id, body }: { id: number; body: DeleteUserInput }) =>
      api.delete(`/api/users/${String(id)}`, body),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Pengguna dihapus." });
      setDeleting(null);
      await invalidate();
    },
  });

  // Any one of this screen's queries failing is still a failure to report.
  const loadError = users.error ?? master.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-body">Manajemen Pengguna</h1>
        <Button onClick={() => setCreating(true)}>Tambah Pengguna</Button>
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {/* PLAN/05 §5.2 rule 6: a failure becomes a banner, never a silent one.
          Without this the list rendered as "no rows" when it actually meant "we
          could not ask" — and those look identical to the reader. */}
      {loadError !== null ? <ErrorBanner error={loadError} /> : null}

      {temporaryPassword !== null ? (
        <Banner
          tone="warning"
          title="Password sementara — hanya ditampilkan sekali"
          onDismiss={() => setTemporaryPassword(null)}
        >
          <p>
            Sampaikan kepada pengguna melalui kanal yang sudah ada. Pengguna akan diminta
            menggantinya saat login pertama.
          </p>
          <code className="mt-2 inline-block select-all rounded bg-surface px-2 py-1 font-mono text-sm text-body">
            {temporaryPassword}
          </code>
        </Banner>
      ) : null}

      <Card>
        {users.isLoading ? (
          <div className="flex justify-center py-10 text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {(users.data?.items ?? []).map((row) => {
              const isSelf = currentUser?.id === row.id;

              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-body">
                      {row.displayName}{" "}
                      <span className="font-normal text-muted">({row.username})</span>
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {USER_ROLE_LABELS[row.role]}
                      {row.regions.length > 0
                        ? ` · ${row.regions.map((region) => region.name).join(", ")}`
                        : " · seluruh wilayah"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {row.isActive ? "Aktif" : "Nonaktif"}
                      {row.mfaEnrolled ? " · 2FA aktif" : ""}
                      {row.mustChangePassword ? " · wajib ganti password" : ""}
                      {" · terakhir masuk "}
                      {row.lastLoginAt === null ? "belum pernah" : formatRelative(row.lastLoginAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label={`Peran ${row.username}`}
                      value={row.role}
                      disabled={isSelf}
                      onChange={(event) =>
                        update.mutate({
                          id: row.id,
                          patch: { role: event.target.value },
                        })
                      }
                      className="w-40 min-h-9"
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {USER_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </Select>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => resetPassword.mutate(row.id)}
                      loading={resetPassword.isPending}
                    >
                      Reset Password
                    </Button>

                    {/* Offered only where there is something to reset. A button
                        that answers "this user has no 2FA" is a button that
                        should not have been there. */}
                    {row.mfaEnrolled ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => setResettingMfa(row)}
                      >
                        Reset 2FA
                      </Button>
                    ) : null}

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isSelf}
                      onClick={() => update.mutate({ id: row.id, patch: { isActive: !row.isActive } })}
                    >
                      {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isSelf}
                      onClick={() => setDeleting(row)}
                    >
                      Hapus
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          page={page}
          totalPages={users.data?.totalPages ?? 1}
          totalItems={users.data?.total}
          onPageChange={setPage}
          disabled={users.isFetching}
        />
      </Card>

      {creating ? (
        <CreateUserDialog
          provinces={master.data?.provinces ?? []}
          submitting={create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(input) => create.mutateAsync(input)}
        />
      ) : null}

      <ConfirmDialog
        open={resettingMfa !== null}
        title="Reset autentikasi dua faktor"
        description={
          resettingMfa === null
            ? ""
            : `Perangkat authenticator ${resettingMfa.displayName} dan seluruh kode pemulihannya dihapus, dan semua sesinya dicabut. Ia mendaftarkan 2FA lagi saat login berikutnya. Tindakan ini tercatat di jejak audit.`
        }
        confirmLabel="Reset 2FA"
        loading={resetMfaFor.isPending}
        onConfirm={() => {
          if (resettingMfa !== null) resetMfaFor.mutate(resettingMfa.id);
        }}
        onClose={() => {
          setResettingMfa(null);
        }}
      />

      {deleting !== null ? (
        <DeleteUserDialog
          user={deleting}
          submitting={remove.isPending}
          onClose={() => setDeleting(null)}
          onSubmit={(body) => remove.mutateAsync({ id: deleting.id, body })}
        />
      ) : null}
    </div>
  );
}

/**
 * Guard 4 (PLAN/04 §5): deletion requires retyping the username, in an
 * application dialog. A browser `confirm()` could not ask for it and is
 * forbidden regardless.
 *
 * The mismatch is a field error rather than a disabled button. A button that is
 * dead with nothing to explain why is the same dead end the step-up 403 used to
 * be — the user can see the field they filled in and not the reason it is not
 * enough.
 */
function DeleteUserDialog({
  user,
  submitting,
  onClose,
  onSubmit,
}: {
  user: UserRecord;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (body: DeleteUserInput) => Promise<unknown>;
}): ReactNode {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DeleteUserInput>({
    resolver: zodResolver(deleteUserSchema),
    defaultValues: { confirmUsername: "" },
  });

  const submit = handleSubmit(async (values) => {
    if (values.confirmUsername !== user.username) {
      setError("confirmUsername", { message: "User ID yang diketik tidak sama." });
      return;
    }

    try {
      await onSubmit(values);
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("confirmUsername", {
          message: "Gagal menghapus pengguna. Silakan coba lagi.",
        });
      }
    }
  });

  return (
    <Dialog
      open
      title="Hapus pengguna"
      description="Pengajuan yang pernah dibuat pengguna ini tetap tersimpan dan tetap merujuk kepadanya."
      onClose={onClose}
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-3">
        <Field
          label={`Ketik ulang User ID "${user.username}" untuk mengonfirmasi`}
          htmlFor="confirm-username"
          error={errors.confirmUsername?.message}
          required
        >
          <Input
            id="confirm-username"
            autoComplete="off"
            autoCapitalize="none"
            invalid={errors.confirmUsername !== undefined}
            {...register("confirmUsername")}
          />
        </Field>

        <DialogFooter>
          <CancelButton onClick={onClose} />
          <Button type="submit" variant="danger" loading={submitting} loadingText="Menghapus…">
            Hapus Pengguna
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function CreateUserDialog({
  provinces,
  submitting,
  onClose,
  onSubmit,
}: {
  provinces: { id: number; name: string }[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateUserInput) => Promise<unknown>;
}): ReactNode {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      displayName: "",
      role: "supplier",
      email: null,
      regions: [],
    },
  });

  // The dialog takes focus itself when it opens, so `autoFocus` on a child that
  // mounts in the same commit loses the race.
  useEffect(() => {
    setFocus("username");
  }, [setFocus]);

  const role = watch("role");

  const submit = handleSubmit(async (values) => {
    try {
      // Region rows only mean something for a supplier; a role change that left
      // stale selections behind would otherwise send them anyway.
      await onSubmit(values.role === "supplier" ? values : { ...values, regions: [] });
    } catch (caught) {
      if (!applyFieldErrors(caught, setError)) {
        setError("username", { message: "Gagal menyimpan pengguna. Silakan coba lagi." });
      }
    }
  });

  return (
    <Dialog
      open
      title="Tambah Pengguna"
      description="Password awal dibuat sistem dan hanya ditampilkan sekali."
      onClose={onClose}
    >
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-3">
        <Field label="User ID" htmlFor="new-username" error={errors.username?.message} required>
          <Input
            id="new-username"
            autoCapitalize="none"
            invalid={errors.username !== undefined}
            {...register("username")}
          />
        </Field>

        <Field label="Nama" htmlFor="new-displayName" error={errors.displayName?.message} required>
          <Input
            id="new-displayName"
            invalid={errors.displayName !== undefined}
            {...register("displayName")}
          />
        </Field>

        <Field label="Peran" htmlFor="new-role" error={errors.role?.message} required>
          <Select id="new-role" invalid={errors.role !== undefined} {...register("role")}>
            {USER_ROLES.map((value) => (
              <option key={value} value={value}>
                {USER_ROLE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Email"
          htmlFor="new-email"
          error={errors.email?.message}
          hint="Opsional. Diperlukan untuk notifikasi lewat surel."
        >
          {/* An empty field means "no email", not an invalid one. Without
              `setValueAs` the optional field fails its own format check on "". */}
          <Input
            id="new-email"
            type="email"
            invalid={errors.email !== undefined}
            {...register("email", { setValueAs: (value: string) => (value === "" ? null : value) })}
          />
        </Field>

        {role === "supplier" ? (
          <Field
            label="Wilayah penugasan"
            htmlFor="new-regions"
            error={errors.regions?.message}
            hint="Kosongkan bila supplier ini tidak dibatasi wilayah."
          >
            <Controller
              control={control}
              name="regions"
              render={({ field }) => (
                <select
                  id="new-regions"
                  multiple
                  size={4}
                  className="w-full rounded-md border border-line-strong bg-surface px-3 py-2"
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={(field.value ?? []).map((region) => String(region.provinceId))}
                  onChange={(event) =>
                    field.onChange(
                      Array.from(event.target.selectedOptions).map((option) => ({
                        provinceId: Number(option.value),
                      })),
                    )
                  }
                >
                  {provinces.map((province) => (
                    <option key={province.id} value={province.id}>
                      {province.name}
                    </option>
                  ))}
                </select>
              )}
            />
          </Field>
        ) : null}

        <DialogFooter>
          <CancelButton onClick={onClose} />
          <Button type="submit" loading={submitting} loadingText="Menyimpan…">
            Tambah Pengguna
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
