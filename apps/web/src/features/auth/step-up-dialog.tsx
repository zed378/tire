import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { totpCodeSchema, type TotpCodeInput } from "@c26/contracts";
import { api, isApiError, setStepUpHandler } from "../../lib/api-client.ts";
import { CancelButton, Dialog, DialogFooter } from "../../components/ui/feedback.tsx";
import { Button, Field, Input } from "../../components/ui/primitives.tsx";

/**
 * Re-verification for dangerous actions (PLAN/13 §4).
 *
 * A 12-hour session means an unlocked phone left in a garage grants twelve hours
 * of access. For a few actions — changing a role, deleting a user, resetting
 * someone's MFA, anything on the operations panel — that is too loose, so the
 * server demands a fresh authenticator code and answers 403 STEP_UP_REQUIRED
 * until it gets one.
 *
 * Mounted once, near the root. It installs itself as the API client's step-up
 * handler, so any request that hits STEP_UP_REQUIRED opens this dialog and is
 * then replayed automatically. Without it that 403 was a dead end: the user
 * pressed a button, saw an error they could not act on, and had no way forward.
 *
 * QC decisions are deliberately NOT on the server's step-up list — they happen
 * far too often, and the friction would outweigh the protection.
 */
export function StepUpDialog(): ReactNode {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TotpCodeInput>({
    resolver: zodResolver(totpCodeSchema),
    defaultValues: { code: "" },
  });

  // Resolves the promise the API client is awaiting while the dialog is open.
  const resolver = useRef<((elevated: boolean) => void) | null>(null);

  const finish = useCallback((elevated: boolean) => {
    setOpen(false);
    resolver.current?.(elevated);
    resolver.current = null;
  }, []);

  // Install the handler immediately on mount, before any async code runs.
  // This ensures STEP_UP_REQUIRED errors can be intercepted immediately.
  useEffect(() => {
    const handler = () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        reset({ code: "" });
        setOpen(true);
      });

    setStepUpHandler(handler);

    // Deliberately no cleanup: the handler must stay registered across a
    // remount, otherwise a STEP_UP_REQUIRED that arrives in between becomes the
    // dead end this dialog exists to remove.
  }, [reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("/api/auth/step-up", values);
      finish(true);
    } catch (caught) {
      // The code is the only field, so every error from this endpoint belongs
      // under it — there is no page banner inside a dialog this small.
      setError("code", {
        message: isApiError(caught)
          ? caught.envelope.message
          : "Verifikasi gagal. Silakan coba lagi.",
      });
    }
  });

  return (
    /*
     * The shared Dialog, not a private copy of it.
     *
     * The copy this replaces had drifted in three ways that all mattered here,
     * of all places — this is the screen asking for a second factor. It had no
     * focus trap, so Tab walked straight out of a modal and into the page
     * behind it. It rendered its overlay permanently and merely hid it, so the
     * markup sat in the document at all times. And it sat at `z-[9999]` while
     * the toast layer sits at `z-50`, which put every toast underneath it.
     */
    <Dialog
      open={open}
      title="Verifikasi ulang diperlukan"
      description="Tindakan ini menyentuh akun atau sistem, sehingga memerlukan kode autentikasi terbaru. Verifikasi berlaku 15 menit."
      onClose={() => {
        finish(false);
      }}
    >
      <form noValidate onSubmit={(event) => void onSubmit(event)} className="space-y-3">
        <Field
          label="Kode autentikasi"
          htmlFor="step-up-code"
          error={errors.code?.message}
          hint="Enam angka dari aplikasi authenticator Anda."
          required
        >
          <Input
            id="step-up-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            invalid={errors.code !== undefined}
            {...register("code")}
          />
        </Field>

        <DialogFooter>
          {/* Cancelling resolves the promise as "not elevated", so the original
              request fails with its own error rather than hanging forever. */}
          <CancelButton onClick={() => finish(false)} />
          <Button type="submit" loading={isSubmitting} loadingText="Memverifikasi…">
            Verifikasi
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
