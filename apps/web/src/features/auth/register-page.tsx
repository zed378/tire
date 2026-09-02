import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@c26/contracts";
import { api, isApiError } from "../../lib/api-client.ts";
import { Banner } from "../../components/ui/feedback.tsx";
import { Button, Field, Input } from "../../components/ui/primitives.tsx";
import { WHEEL_IMAGE } from "../landing/image-credits.ts";
import { AUTH_FIELD, AuthLayout } from "./auth-layout.tsx";
import { PasswordChecklist, PasswordField, TreadGauge, scorePassword } from "./auth-fields.tsx";
import { formatDate } from "../../lib/format.ts";

export function RegisterPage(): ReactNode {
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [succeeded, setSucceeded] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    // Blur, not keystroke. `reValidateMode` then keeps a field that has already
    // failed updating live, which is when live feedback helps (brief §30).
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const password = watch("password") ?? "";
  const strength = scorePassword(password);

  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error !== null) errorRef.current?.focus();
  }, [error]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    try {
      await api.post("/api/auth/register", values);

      /*
       * A calm beat before the redirect, naming what happens next.
       *
       * Registration signs the account in immediately, so without this the
       * screen simply vanishes and is replaced by a dashboard — which reads as
       * a glitch rather than as success, and gives no chance to notice that
       * the account was created at all.
       */
      setSucceeded(true);
      window.setTimeout(() => {
        void navigate("/welcome", { replace: true });
      }, 800);
    } catch (caught: unknown) {
      setError(caught);
    }
  });

  return (
    <AuthLayout
      title="Mulai menggunakan"
      subtitle="Akun langsung aktif dengan peran Supplier. Admin dapat mengubah peran Anda nanti."
      image={WHEEL_IMAGE}
      note={`${formatDate(new Date())} WIB`}
      footer={
        <>
          <p className="text-xs text-muted">
            Sudah memiliki akun?{" "}
            <Link to="/login" className="font-medium text-accent-text underline-offset-2 hover:underline">
              Masuk
            </Link>
          </p>
          <p className="mt-2 text-xs text-subtle">
            Peran Supplier dapat membuat dan mengirim pemeriksaan. Untuk akses lain, hubungi
            admin.
          </p>
        </>
      }
    >
      {succeeded ? (
        /*
         * The success beat. It is a status, not an alert: `polite` lets a
         * screen reader finish whatever it was saying before announcing it,
         * and nothing here is urgent.
         */
        <div role="status" className="py-4 text-center">
          <p className="font-display text-lg font-semibold text-body">Akun dibuat.</p>
          <p className="mt-2 text-sm text-muted">
            Anda sudah masuk. Membuka beranda…
          </p>
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="auth-stagger space-y-4">
          {error !== null ? (
            <div ref={errorRef} tabIndex={-1} className="outline-none">
              <Banner tone="error" onDismiss={() => setError(null)}>
                {isApiError(error)
                  ? error.envelope.message
                  : "Server tidak merespons. Periksa koneksi Anda, lalu coba lagi."}
              </Banner>
            </div>
          ) : null}

          <Field
            label="User ID"
            htmlFor="username"
            error={errors.username?.message}
            hint="3–64 karakter (huruf, angka, titik, garis bawah, strip)"
            required
          >
            <div className="auth-field">
              <Input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                placeholder="joko_inspector"
                invalid={errors.username !== undefined}
                className={AUTH_FIELD}
                {...register("username")}
              />
            </div>
          </Field>

          <Field
            label="Nama Lengkap"
            htmlFor="displayName"
            error={errors.displayName?.message}
            required
          >
            <div className="auth-field">
              <Input
                id="displayName"
                autoComplete="name"
                placeholder="Joko Susanto"
                invalid={errors.displayName !== undefined}
                className={AUTH_FIELD}
                {...register("displayName")}
              />
            </div>
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password?.message} required>
            <PasswordField
              id="password"
              autoComplete="new-password"
              invalid={errors.password !== undefined}
              className={AUTH_FIELD}
              {...register("password")}
            />
            {/* The gauge appears once there is something to measure. The
                checklist is there from the start, because requirements one
                cannot see are requirements one fails. */}
            {password.length > 0 ? <TreadGauge strength={strength} /> : null}
            <PasswordChecklist password={password} />
          </Field>

          <Field
            label="Konfirmasi Password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
            required
          >
            <PasswordField
              id="confirmPassword"
              autoComplete="new-password"
              invalid={errors.confirmPassword !== undefined}
              className={AUTH_FIELD}
              {...register("confirmPassword")}
            />
          </Field>

          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            loadingText="Memeriksa…"
          >
            Mulai Menggunakan
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
