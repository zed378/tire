import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { USER_ROLE_LABELS, type SessionSummary } from "@c26/contracts";
import { api } from "../../lib/api-client.ts";
import { formatDateTime, formatRelative } from "../../lib/format.ts";
import { useSession } from "../../lib/session.tsx";
import { Badge, Button, Card, EmptyState, PageHeader, SkeletonRows } from "../../components/ui/primitives.tsx";
import { ConfirmDialog, ErrorBanner, useToast } from "../../components/ui/feedback.tsx";

/**
 * The account screen (PLAN/13 §5, PLAN/04 §4.2).
 *
 * The two endpoints behind this have existed since authentication was built —
 * `GET /api/auth/sessions` and `POST /api/auth/logout-all` — but nothing in the
 * interface reached them. Somebody who left a phone in a garage could not see
 * that it was still signed in, let alone end it. That is the gap this closes.
 *
 * The columns are the ones PLAN/13 §5 names: device, approximate location, last
 * active, and a way to end each one.
 */
export function ProfilePage(): ReactNode {
  const { user, logout } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [error, setError] = useState<unknown>(null);
  const [revoking, setRevoking] = useState<SessionSummary | null>(null);
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false);

  const sessions = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: () => api.get<SessionSummary[]>("/api/auth/sessions"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/auth/sessions/${id}`),
    onSuccess: async () => {
      toast.push({ tone: "success", message: "Sesi diakhiri." });
      setRevoking(null);
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (caught: unknown) => {
      setRevoking(null);
      setError(caught);
    },
  });

  const logoutEverywhere = useMutation({
    mutationFn: () => api.post("/api/auth/logout-all"),
    // The server revokes this session too and clears the cookies, so there is
    // nothing left to return to. Going through `logout()` also wipes the local
    // caches and the upload queue, which D-17 requires.
    onSuccess: () => logout(),
    onError: (caught: unknown) => {
      setConfirmingLogoutAll(false);
      setError(caught);
    },
  });

  if (user === null) return null;

  const list = sessions.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Akun Saya"
        description={`${user.displayName} · ${USER_ROLE_LABELS[user.role]}`}
      />

      {error !== null ? (
        <ErrorBanner
          error={error}
          onDismiss={() => {
            setError(null);
          }}
        />
      ) : null}

      <Card title="Keamanan Akun">
        {/*
          A list, not a `<dl>`.
 
          It was a description list whose `<dt>` and `<dd>` sat two divs deep,
          which is invalid: a `<dl>` may wrap a term-and-description group in one
          `<div>`, not two. axe reported both halves of that — the list holding
          something other than groups, and the terms holding no list.

          Flattening it would not have made it right either. Each row carries an
          action, and a row that can be operated is not a term and its
          definition. A list of settings is what this is.
        */}
        <ul className="grid gap-4 sm:grid-cols-2">
          <li className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-body">Kata sandi</p>
              <p className="mt-0.5 text-xs text-muted">
                {user.mustChangePassword
                  ? "Wajib diganti sebelum melanjutkan."
                  : "Ganti berkala, dan segera bila Anda curiga bocor."}
              </p>
            </div>
            <Link to="/profile/password">
              <Button variant="secondary" size="sm">
                Ganti
              </Button>
            </Link>
          </li>

          <li className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-body">Autentikasi dua faktor</p>
              <p className="mt-0.5 text-xs text-muted">
                {user.mfaEnrolled
                  ? "Aktif. Kode diminta saat login dari perangkat baru."
                  : "Belum aktif."}
              </p>
            </div>
            {user.mfaEnrolled ? (
              <Badge tone="success">Aktif</Badge>
            ) : (
              <Link to="/profile/mfa">
                <Button variant="secondary" size="sm">
                  Aktifkan
                </Button>
              </Link>
            )}
          </li>
        </ul>
      </Card>

      <Card
        title="Perangkat &amp; Sesi Aktif"
        description="Setiap perangkat yang sedang masuk ke akun Anda."
        actions={
          list.length > 1 ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmingLogoutAll(true);
              }}
            >
              Keluar dari semua perangkat
            </Button>
          ) : undefined
        }
      >
        {sessions.isPending ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Memuat daftar sesi…</span>
            <SkeletonRows rows={3} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="Tidak ada sesi lain"
            description="Hanya perangkat ini yang sedang masuk."
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-body">
                    {session.deviceLabel}
                    {session.current ? <Badge tone="accent">Perangkat ini</Badge> : null}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {session.approximateLocation ??
                      session.ipAddress ??
                      "Alamat IP tidak tercatat"}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    Terakhir aktif {formatRelative(session.lastSeenAt)} · Masuk{" "}
                    {formatDateTime(session.createdAt)}
                  </p>
                </div>

                {/*
                  The current session has no "end" button: doing that from here
                  is just signing out, and there is a button for that in the
                  header already.
                */}
                {session.current ? null : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setRevoking(session);
                    }}
                  >
                    Akhiri sesi ini
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={revoking !== null}
        title="Akhiri sesi ini?"
        description={
          revoking === null
            ? ""
            : `${revoking.deviceLabel} akan langsung keluar dan harus masuk lagi.`
        }
        confirmLabel="Akhiri sesi"
        loading={revoke.isPending}
        onConfirm={() => {
          if (revoking !== null) revoke.mutate(revoking.id);
        }}
        onClose={() => {
          setRevoking(null);
        }}
      />

      <ConfirmDialog
        open={confirmingLogoutAll}
        title="Keluar dari semua perangkat?"
        description="Semua sesi diakhiri, termasuk yang sedang Anda pakai sekarang. Anda akan diminta masuk kembali."
        confirmLabel="Keluar dari semua"
        loading={logoutEverywhere.isPending}
        onConfirm={() => {
          logoutEverywhere.mutate();
        }}
        onClose={() => {
          setConfirmingLogoutAll(false);
        }}
      />
    </div>
  );
}
