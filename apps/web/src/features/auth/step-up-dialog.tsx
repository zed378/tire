import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Resolves the promise the API client is awaiting while the dialog is open.
  const resolver = useRef<((elevated: boolean) => void) | null>(null);

  // Install the handler immediately on mount, before any async code runs.
  // This ensures STEP_UP_REQUIRED errors can be intercepted immediately.
  useEffect(() => {
    const handler = () =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setCode("");
        setError(undefined);
        setOpen(true);
      });
    
    setStepUpHandler(handler);
    
    // Return cleanup to ensure handler is always set when needed
    return () => {
      // Don't clear the handler on unmount - keep it registered
      // in case the component remounts or errors occur
    };
  }, []);

  const finish = useCallback((elevated: boolean) => {
    setOpen(false);
    setSubmitting(false);
    resolver.current?.(elevated);
    resolver.current = null;
  }, []);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(undefined);

    try {
      await api.post("/api/auth/step-up", { code });
      finish(true);
    } catch (caught) {
      setSubmitting(false);
      setError(
        isApiError(caught)
          ? caught.envelope.message
          : "Verifikasi gagal. Silakan coba lagi.",
      );
    }
  }, [code, finish]);

  return (
    <Dialog
      open={open}
      title="Verifikasi ulang diperlukan"
      description="Tindakan ini menyentuh akun atau sistem, sehingga memerlukan kode autentikasi terbaru. Verifikasi berlaku 15 menit."
      onClose={() => finish(false)}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Kode autentikasi"
          htmlFor="step-up-code"
          error={error}
          hint="Enam angka dari aplikasi authenticator Anda."
          required
        >
          <Input
            id="step-up-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            invalid={error !== undefined}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, ""));
              setError(undefined);
            }}
          />
        </Field>

        <DialogFooter>
          {/* Cancelling resolves the promise as "not elevated", so the original
              request fails with its own error rather than hanging forever. */}
          <CancelButton onClick={() => finish(false)} />
          <Button type="submit" loading={submitting} loadingText="Memverifikasi…" disabled={code.length !== 6}>
            Verifikasi
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
