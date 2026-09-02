import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { changePasswordSchema, MIN_PASSWORD_LENGTH, type ChangePasswordInput } from "@c26/contracts";
import { api, isApiError } from "../../lib/api-client.ts";
import { useSession } from "../../lib/session.tsx";
import { ErrorBanner, useToast } from "../../components/ui/feedback.tsx";
import { Button, Card, Field, Input } from "../../components/ui/primitives.tsx";

/**
 * Changing your own password (PLAN/04 §4.1).
 *
 * No composition rules and no forced expiry, on purpose: length decides far more
 * than a symbol requirement, and mandatory rotation is what produces
 * `Password1`, `Password2` on every account in the building. The server also
 * checks the password against a common-password list and Have I Been Pwned via
 * k-anonymity, so those messages arrive as field errors.
 */
export function ChangePasswordPage(): ReactNode {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const toast = useToast();
  const [error, setError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post("/api/auth/change-password", values);
      await refresh();
      toast.push({ tone: "success", message: "Password berhasil diganti." });
      void navigate("/inspections", { replace: true });
    } catch (caught) {
      // Field-level errors go under the field they belong to; anything else
      // becomes the page banner (PLAN/05 §5.1).
      if (isApiError(caught) && caught.fieldErrors.length > 0) {
        for (const fieldError of caught.fieldErrors) {
          setFieldError(fieldError.field as keyof ChangePasswordInput, {
            message: fieldError.message,
          });
        }
        return;
      }
      setError(caught);
    }
  });

  return (
    <div className="mx-auto max-w-md">
      <Card title="Ganti Password">
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
          {error !== null ? <ErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

          <Field
            label="Password saat ini"
            htmlFor="currentPassword"
            error={errors.currentPassword?.message}
            required
          >
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              invalid={errors.currentPassword !== undefined}
              {...register("currentPassword")}
            />
          </Field>

          <Field
            label="Password baru"
            htmlFor="newPassword"
            error={errors.newPassword?.message}
            hint={`Minimal ${MIN_PASSWORD_LENGTH} karakter. Panjang lebih menentukan daripada campuran simbol — kalimat pendek yang mudah Anda ingat lebih baik daripada satu kata dengan angka di belakangnya.`}
            required
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              invalid={errors.newPassword !== undefined}
              {...register("newPassword")}
            />
          </Field>

          <Field
            label="Ulangi password baru"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
            required
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              invalid={errors.confirmPassword !== undefined}
              {...register("confirmPassword")}
            />
          </Field>

          <p className="text-xs text-muted">
            Mengganti password akan mengakhiri sesi Anda di semua perangkat lain.
          </p>

          <Button type="submit" loading={isSubmitting} loadingText="Menyimpan…" className="w-full">
            Simpan Password Baru
          </Button>
        </form>
      </Card>
    </div>
  );
}
