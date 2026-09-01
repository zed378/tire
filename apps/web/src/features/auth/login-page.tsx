import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@c26/contracts";
import { isApiError } from "../../lib/api-client.ts";
import { useSession } from "../../lib/session.tsx";
import { Banner } from "../../components/ui/feedback.tsx";
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    // The browser's own validation is switched off, so the messages are the
    // Indonesian ones from the shared schema rather than "Please fill out this
    // field." in English (D-07).
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
        navigate("/profile/mfa", { replace: true });
        return;
      }

      if (result.status === "must_change_password") {
        navigate("/profile/password", { replace: true });
        return;
      }

      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? "/inspections", { replace: true });
    } catch (caught) {
      setError(caught);
      // A second factor was supplied and rejected: keep the field, do not send
      // the user back to the start of the form.
      if (isApiError(caught) && caught.code === "INVALID_CREDENTIALS" && needsTotp) {
        setTimeout(() => setFocus("totpCode"), 0);
      }
    }
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Commercial 2026</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sistem Pengolahan Data Ban Bus &amp; Truk
          </p>
        </div>

        <form
          onSubmit={(event) => void onSubmit(event)}
          // Validation comes from the shared Zod schema, never from the browser.
          noValidate
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          {error !== null ? <ErrorSummary error={error} onDismiss={() => setError(null)} /> : null}

          <Field label="User ID" htmlFor="username" error={errors.username?.message} required>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              invalid={errors.username !== undefined}
              {...register("username")}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password?.message} required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={errors.password !== undefined}
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
                <Input
                  id="recoveryCode"
                  autoComplete="one-time-code"
                  invalid={errors.recoveryCode !== undefined}
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
                  {...register("totpCode")}
                />
              </Field>
            )
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting} loadingText="Memproses…">
            {needsTotp ? "Verifikasi" : "Masuk"}
          </Button>

          {needsTotp ? (
            <button
              type="button"
              className="w-full text-center text-sm text-brand-700 underline"
              onClick={() => setUseRecoveryCode((current) => !current)}
            >
              {useRecoveryCode
                ? "Gunakan kode dari aplikasi authenticator"
                : "Kehilangan akses ke authenticator? Pakai kode pemulihan"}
            </button>
          ) : null}
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Lupa password? Hubungi admin untuk mengatur ulang.
        </p>
      </div>
    </div>
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
