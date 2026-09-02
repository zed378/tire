import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@c26/contracts";
import { api, isApiError } from "../../lib/api-client.ts";
import { Banner } from "../../components/ui/feedback.tsx";
import { Button, Field, Input } from "../../components/ui/primitives.tsx";
import { WHEEL_IMAGE } from "../landing/image-credits.ts";
import { AUTH_FIELD, AuthLayout } from "./auth-layout.tsx";

export function RegisterPage(): ReactNode {
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onSubmit",
  });

  const password = watch("password") || "";

  // Password strength helper
  const getPasswordStrength = (pwd: string): { label: string; score: number; color: string } => {
    if (!pwd) return { label: "Belum diisi", score: 0, color: "bg-slate-300 dark:bg-slate-700" };
    let score = 0;
    if (pwd.length >= 10) score++;
    if (pwd.length >= 14) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: "Sangat Lemah", score: 1, color: "bg-red-500" };
    if (score === 2) return { label: "Cukup", score: 2, color: "bg-amber-500" };
    if (score === 3) return { label: "Baik", score: 3, color: "bg-blue-500" };
    return { label: "Kuat", score: 4, color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength(password);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    try {
      await api.post("/api/auth/register", values);

      // Redirect to welcome dashboard upon registration
      void navigate("/welcome", { replace: true });
    } catch (caught: unknown) {
      setError(caught);
    }
  });

  return (
    <AuthLayout
      title="Buat akun baru"
      subtitle="Akun baru menunggu persetujuan admin sebelum bisa dipakai."
      image={WHEEL_IMAGE}
      imageCaption={[
        { label: "34 konfigurasi poros", detail: "Slot foto dihitung, bukan diketik" },
        { label: "Drive 1 Kiri Dalam", detail: "Setiap posisi ban punya namanya sendiri" },
      ]}
      footer={
        <>
          <p className="text-xs text-muted">
            Sudah memiliki akun?{" "}
            <Link to="/login" className="font-medium text-accent-text underline-offset-2 hover:underline">
              Masuk
            </Link>
          </p>
          <p className="mt-2 text-xs text-subtle">
            Admin akan menetapkan peran Anda setelah akun ditinjau.
          </p>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
        {error !== null ? (
          <Banner tone="error" onDismiss={() => setError(null)}>
            {isApiError(error)
              ? error.envelope.message
              : "Pendaftaran gagal. Silakan coba lagi."}
          </Banner>
        ) : null}

        <Field
          label="User ID"
          htmlFor="username"
          error={errors.username?.message}
          hint="3–64 karakter (huruf, angka, titik, strip)"
          required
        >
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            placeholder="contoh: joko_inspector"
            invalid={errors.username !== undefined}
            className={AUTH_FIELD}
            {...register("username")}
          />
        </Field>

        <Field label="Nama Lengkap" htmlFor="displayName" error={errors.displayName?.message} required>
          <Input
            id="displayName"
            autoComplete="name"
            placeholder="contoh: Joko Susanto"
            invalid={errors.displayName !== undefined}
            className={AUTH_FIELD}
            {...register("displayName")}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="Minimal 10 karakter"
          required
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              invalid={errors.password !== undefined}
              className={`${AUTH_FIELD} pr-11`}
              {...register("password")}
            />
            <PasswordToggle
              shown={showPassword}
              onToggle={() => {
                setShowPassword((prev) => !prev);
              }}
            />
          </div>

          {password ? (
            <div className="mt-2">
              <div
                className="flex h-1.5 gap-1 overflow-hidden rounded-full bg-surface-sunken"
                role="img"
                aria-label={`Kekuatan password: ${strength.label}`}
              >
                <div className={`h-full flex-1 ${strength.score >= 1 ? strength.color : ""}`} />
                <div className={`h-full flex-1 ${strength.score >= 2 ? strength.color : ""}`} />
                <div className={`h-full flex-1 ${strength.score >= 3 ? strength.color : ""}`} />
                <div className={`h-full flex-1 ${strength.score >= 4 ? strength.color : ""}`} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted">
                <span>Kekuatan password:</span>
                <span className="font-semibold text-body">{strength.label}</span>
              </div>
            </div>
          ) : null}
        </Field>

        <Field
          label="Konfirmasi Password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
          required
        >
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              invalid={errors.confirmPassword !== undefined}
              className={`${AUTH_FIELD} pr-11`}
              {...register("confirmPassword")}
            />
            <PasswordToggle
              shown={showConfirmPassword}
              onToggle={() => {
                setShowConfirmPassword((prev) => !prev);
              }}
            />
          </div>
        </Field>

        <Button
          type="submit"
          className="w-full rounded-xl"
          loading={isSubmitting}
          loadingText="Mendaftarkan…"
        >
          Daftar akun
        </Button>
      </form>
    </AuthLayout>
  );
}

/**
 * Show/hide for a password field.
 *
 * A real button rather than the `<span onClick>` this replaces — twice on this
 * page, and neither was reachable by keyboard or announced to a screen reader.
 */
function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? "Sembunyikan password" : "Tampilkan password"}
      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-subtle transition-colors hover:text-body"
    >
      {shown ? (
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
  );
}
