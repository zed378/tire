import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@c26/contracts";
import { isApiError } from "../../lib/api-client.ts";
import { useSession } from "../../lib/session.tsx";
import { Banner } from "../../components/ui/feedback.tsx";
import { AUTH_FIELD, AuthLayout } from "./auth-layout.tsx";
import { PasswordField } from "./auth-fields.tsx";
import { Button, Field, Input } from "../../components/ui/primitives.tsx";
import { formatDate } from "../../lib/format.ts";

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    // On blur, not on the first keystroke: telling someone their User ID is
    // too short while they are still typing the third character is noise.
    // `reValidateMode` keeps a corrected field updating live once it has
    // already failed once, which is the moment live feedback is actually
    // wanted (brief §30).
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  /*
   * A server error moves focus to itself. Without this the message is
   * announced but the reader stays wherever they were, which on a failed
   * sign-in is usually the password field — so a screen reader user hears that
   * something went wrong and has no way to find out what.
   */
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error !== null) errorRef.current?.focus();
  }, [error]);

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
      photo="depot"
      note={`${formatDate(new Date())} WIB`}
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
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="auth-stagger space-y-4">
        {error !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <ErrorSummary error={error} onDismiss={() => setError(null)} />
          </div>
        ) : null}

        <Field label="User ID" htmlFor="username" error={errors.username?.message} required>
          <div className="auth-field">
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              invalid={errors.username !== undefined}
              className={AUTH_FIELD}
              {...register("username")}
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <PasswordField
            id="password"
            autoComplete="current-password"
            invalid={errors.password !== undefined}
            className={AUTH_FIELD}
            {...register("password")}
          />
        </Field>

        {needsTotp ? (
          useRecoveryCode ? (
            <Field
              label="Kode pemulihan"
              htmlFor="recoveryCode"
              error={errors.recoveryCode?.message}
              hint="Gunakan salah satu kode sekali pakai yang Anda simpan saat mendaftarkan autentikasi dua faktor."
            >
              <div className="auth-field">
                <Input
                  id="recoveryCode"
                  autoComplete="one-time-code"
                  invalid={errors.recoveryCode !== undefined}
                  className={`${AUTH_FIELD} text-center font-data tracking-widest`}
                  {...register("recoveryCode")}
                />
              </div>
            </Field>
          ) : (
            <Field
              label="Kode autentikasi"
              htmlFor="totpCode"
              error={errors.totpCode?.message}
              hint="Enam angka dari aplikasi authenticator Anda. Kode ini bekerja tanpa sinyal."
            >
              <div className="auth-field">
                <Input
                  id="totpCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  invalid={errors.totpCode !== undefined}
                  className={`${AUTH_FIELD} text-center font-data text-lg tracking-widest`}
                  {...register("totpCode")}
                />
              </div>
            </Field>
          )
        ) : null}

        <Button
          type="submit"
          className="w-full"
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
