import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@c26/contracts";
import { isApiError } from "../../lib/api-client.ts";
import { useSession } from "../../lib/session.tsx";
import { Banner } from "../../components/ui/feedback.tsx";
import { HERO_IMAGE } from "../landing/image-credits.ts";
import { AUTH_FIELD, AuthLayout } from "./auth-layout.tsx";
import { Button, Field, Input } from "../../components/ui/primitives.tsx";

/**
 * Login (PLAN/04 §4).
 *
 * WHAT IS NOT HERE: the demo panel. D-16 found three buttons on the legacy login
 * page that authenticated as Supplier, Admin, or PM/SPV with no credentials at
 * all — the most severe finding in the audit if that application had ever
 * touched real data. There is no path here that skips password verification, and
 * gate G-10 greps the source to make sure one does not reappear.
 *
 * The red dismissible banner is a deliberate port: it was the one piece of error
 * handling the legacy system got right (K-08), so it became the standard rather
 * than being replaced.
 */
export function LoginPage(): ReactNode {
  const { user, login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
  });

  if (user !== null) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? "/inspections"} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    try {
      const result = await login(values);

      if (result.status === "mfa_required") {
        setNeedsTotp(true);
        setTimeout(() => setFocus("totpCode"), 0);
        return;
      }

      if (result.status === "mfa_enrollment_required") {
        void navigate("/profile/mfa", { replace: true });
        return;
      }

      if (result.status === "must_change_password") {
        void navigate("/profile/password", { replace: true });
        return;
      }

      const from = (location.state as { from?: string } | null)?.from;
      // Falls back to the role-aware home screen, not to /inspections —
      // which the manager and operator roles have no permission to read, so
      // two of the four roles landed on a page that bounced them straight
      // back out. A deep link the user was heading for still wins.
      void navigate(from ?? "/welcome", { replace: true });
    } catch (caught) {
      setError(caught);
      if (isApiError(caught) && caught.code === "INVALID_CREDENTIALS" && needsTotp) {
        setTimeout(() => setFocus("totpCode"), 0);
      }
    }
  });

  return (
    <AuthLayout
      title={needsTotp ? "Verifikasi dua faktor" : "Masuk ke akun Anda"}
      subtitle={
        needsTotp
          ? "Satu langkah lagi. Masukkan kode dari aplikasi authenticator Anda."
          : "Gunakan User ID dan kata sandi yang diberikan admin."
      }
      image={HERO_IMAGE}
      imageCaption={[
        { label: "SN2026-00001 · Pass QC", detail: "B 1234 ABC · Probolinggo, Jawa Timur" },
        { label: "Steer 1 Kanan", detail: "6 dari 6 foto terunggah" },
      ]}
      footer={
        <>
          <p className="text-xs text-muted">
            Belum memiliki akun?{" "}
            <Link
              to="/register"
              className="font-medium text-accent-text underline-offset-2 hover:underline"
            >
              Daftar akun baru
            </Link>
          </p>
          <p className="mt-2 text-xs text-subtle">
            Lupa password? Hubungi admin untuk mengatur ulang.
          </p>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
        {error !== null ? <ErrorSummary error={error} onDismiss={() => setError(null)} /> : null}

        <Field label="User ID" htmlFor="username" error={errors.username?.message} required>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            invalid={errors.username !== undefined}
            className={AUTH_FIELD}
            {...register("username")}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              invalid={errors.password !== undefined}
              className={`${AUTH_FIELD} pr-11`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => {
                setShowPassword((prev) => !prev);
              }}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-subtle transition-colors hover:text-body"
            >
              {showPassword ? (
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </Field>

        {needsTotp ? (
          useRecoveryCode ? (
            <Field
              label="Kode pemulihan"
              htmlFor="recoveryCode"
              error={errors.recoveryCode?.message}
              hint="Gunakan salah satu kode sekali pakai yang Anda simpan saat mendaftarkan autentikasi dua faktor."
            >
              <Input
                id="recoveryCode"
                autoComplete="one-time-code"
                invalid={errors.recoveryCode !== undefined}
                className={`${AUTH_FIELD} text-center font-mono tracking-widest`}
                {...register("recoveryCode")}
              />
            </Field>
          ) : (
            <Field
              label="Kode autentikasi"
              htmlFor="totpCode"
              error={errors.totpCode?.message}
              hint="Enam angka dari aplikasi authenticator Anda. Kode ini bekerja tanpa sinyal."
            >
              <Input
                id="totpCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                invalid={errors.totpCode !== undefined}
                className={`${AUTH_FIELD} text-center font-mono text-lg tracking-widest`}
                {...register("totpCode")}
              />
            </Field>
          )
        ) : null}

        <Button
          type="submit"
          className="w-full rounded-xl"
          loading={isSubmitting}
          loadingText="Memproses…"
        >
          {needsTotp ? "Verifikasi" : "Masuk"}
        </Button>

        {needsTotp ? (
          <button
            type="button"
            onClick={() => {
              setUseRecoveryCode((current) => !current);
            }}
            className="block w-full text-center text-xs text-accent-text underline underline-offset-2 hover:text-body"
          >
            {useRecoveryCode
              ? "Gunakan kode dari aplikasi authenticator"
              : "Kehilangan akses ke authenticator? Pakai kode pemulihan"}
          </button>
        ) : null}
      </form>
    </AuthLayout>
  );
}

function ErrorSummary({ error, onDismiss }: { error: unknown; onDismiss: () => void }): ReactNode {
  if (!isApiError(error)) {
    return <Banner onDismiss={onDismiss}>Terjadi kesalahan. Silakan coba lagi.</Banner>;
  }

  return (
    <Banner
      tone={error.code === "ACCOUNT_LOCKED" ? "warning" : "error"}
      onDismiss={onDismiss}
      requestId={error.code === "INTERNAL_ERROR" ? error.requestId : undefined}
    >
      {error.envelope.message}
    </Banner>
  );
}
