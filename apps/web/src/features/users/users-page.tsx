import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUserSchema,
  USER_ROLE_LABELS,
  USER_ROLES,
  type CreateUserInput,
  type MasterDataBundle,
  type Paginated,
  type UserRecord,
  type UserRole,
} from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatRelative } from "../../lib/format.ts";
import { useSession } from "../../lib/session.tsx";
import {
  Banner,
  CancelButton,
  Dialog,
  DialogFooter,
  ErrorBanner,
  useToast,
} from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input, Select, Spinner } from "../../components/ui/primitives.tsx";

/**
 * User management (PLAN/04 §5) — closes D-12.
 *
 * The legacy system had add and delete and nothing else: no edit, no password
 * reset, no deactivate. The four guards the server enforces are visible in this
 * UI too — you cannot delete yourself, you cannot remove the last active admin,
 * a role change ends every session, and deletion asks you to retype the username
 * rather than nodding at a browser `confirm()` (which is forbidden anyway).
 */
export function UsersPage(): ReactNode {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user: currentUser } = useSession();

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<UserRecord | null>(null);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<Paginated<UserRecord>>("/api/users", { perPage: 100 }),
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
    onError: setError,
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

  const remove = useMutation({
    mutationFn: ({ id, username }: { id: number; username: string }) =>
      api.delete(`/api/users/${String(id)}`, { confirmUsername: username }),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Pengguna dihapus." });
      setDeleting(null);
      setConfirmUsername("");
      await invalidate();
    },
    onError: setError,
  });

  return (
    <div className="space-y-4">
       <div className="flex flex-wrap items-center justify-between gap-2">
         <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Manajemen Pengguna</h1>
        <Button onClick={() => setCreating(true)}>Tambah Pengguna</Button>
      </div>

      {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

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
           <code className="mt-2 inline-block select-all rounded bg-white dark:bg-slate-900 px-2 py-1 font-mono text-sm text-slate-900 dark:text-slate-100">
             {temporaryPassword}
           </code>
         </Banner>
       ) : null}

       <Card>
         {users.isLoading ? (
           <div className="flex justify-center py-10 text-slate-500 dark:text-slate-400">
             <Spinner className="h-5 w-5" />
           </div>
         ) : (
           <ul className="divide-y divide-slate-200 dark:divide-slate-700">
             {(users.data?.items ?? []).map((row) => {
               const isSelf = currentUser?.id === row.id;

               return (
                 <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                   <div className="min-w-0">
                     <p className="font-medium text-slate-900 dark:text-slate-100">
                       {row.displayName}{" "}
                       <span className="font-normal text-slate-500 dark:text-slate-400">({row.username})</span>
                     </p>
                     <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                       {USER_ROLE_LABELS[row.role]}
                       {row.regions.length > 0
                         ? ` · ${row.regions.map((region) => region.name).join(", ")}`
                         : " · seluruh wilayah"}
                     </p>
                     <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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
                      className="w-40"
                    >
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {USER_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </Select>

                    <Button
                      variant="secondary"
                      onClick={() => resetPassword.mutate(row.id)}
                      loading={resetPassword.isPending}
                    >
                      Reset Password
                    </Button>

                    <Button
                      variant="secondary"
                      disabled={isSelf}
                      onClick={() => update.mutate({ id: row.id, patch: { isActive: !row.isActive } })}
                    >
                      {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>

                    <Button variant="danger" disabled={isSelf} onClick={() => setDeleting(row)}>
                      Hapus
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <CreateUserDialog
        open={creating}
        provinces={master.data?.provinces ?? []}
        submitting={create.isPending}
        onClose={() => setCreating(false)}
        onSubmit={(input) => create.mutate(input)}
      />

      {/* Guard 4 (PLAN/04 §5): retyping the username, in an application dialog.
          A browser confirm() could not do this and is forbidden regardless. */}
      <Dialog
        open={deleting !== null}
        title="Hapus pengguna"
        description="Pengajuan yang pernah dibuat pengguna ini tetap tersimpan dan tetap merujuk kepadanya."
        onClose={() => {
          setDeleting(null);
          setConfirmUsername("");
        }}
      >
        <Field
          label={`Ketik ulang User ID "${deleting?.username ?? ""}" untuk mengonfirmasi`}
          htmlFor="confirm-username"
          required
        >
          <Input
            id="confirm-username"
            value={confirmUsername}
            autoComplete="off"
            onChange={(event) => setConfirmUsername(event.target.value)}
          />
        </Field>

        <DialogFooter>
          <CancelButton
            onClick={() => {
              setDeleting(null);
              setConfirmUsername("");
            }}
          />
          <Button
            variant="danger"
            loading={remove.isPending}
            disabled={confirmUsername !== deleting?.username}
            onClick={() => {
              if (deleting !== null) {
                remove.mutate({ id: deleting.id, username: confirmUsername });
              }
            }}
          >
            Hapus Pengguna
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function CreateUserDialog({
  open,
  provinces,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  provinces: { id: number; name: string }[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateUserInput) => void;
}): ReactNode {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("supplier");
  const [email, setEmail] = useState("");
  const [regionProvinceIds, setRegionProvinceIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (): void => {
    const candidate = {
      username,
      displayName,
      role,
      email: email === "" ? null : email,
      regions: regionProvinceIds.map((provinceId) => ({ provinceId })),
    };

    const parsed = createUserSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      return;
    }

    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <Dialog
      open={open}
      title="Tambah Pengguna"
      description="Password awal dibuat sistem dan hanya ditampilkan sekali."
      onClose={onClose}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Field label="User ID" htmlFor="new-username" error={errors.username} required>
          <Input
            id="new-username"
            value={username}
            autoCapitalize="none"
            invalid={errors.username !== undefined}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>

        <Field label="Nama" htmlFor="new-displayName" error={errors.displayName} required>
          <Input
            id="new-displayName"
            value={displayName}
            invalid={errors.displayName !== undefined}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>

        <Field label="Peran" htmlFor="new-role" error={errors.role} required>
          <Select
            id="new-role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
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
          error={errors.email}
          hint="Opsional. Diperlukan untuk notifikasi lewat surel."
        >
          <Input
            id="new-email"
            type="email"
            value={email}
            invalid={errors.email !== undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        {role === "supplier" ? (
          <Field
            label="Wilayah penugasan"
            htmlFor="new-regions"
            hint="Kosongkan bila supplier ini tidak dibatasi wilayah."
          >
            <select
              id="new-regions"
              multiple
              size={4}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={regionProvinceIds.map(String)}
              onChange={(event) =>
                setRegionProvinceIds(
                  Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                )
              }
            >
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
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
