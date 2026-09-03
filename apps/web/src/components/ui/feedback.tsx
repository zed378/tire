import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { INSPECTION_STATUS_LABELS, type InspectionStatus } from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { isApiError } from "../../lib/api-client.ts";
import { Badge, Button } from "./primitives.tsx";

/**
 * The three error channels (PLAN/05 §5.1).
 *
 *   inline  — under the field: 422, duplicate 409, 413, 415 (in `Field`)
 *   banner  — above the content: every page-level error
 *   toast   — green, auto-dismissing: every success
 *
 * The banner is a direct port of the one thing the legacy system got right
 * (K-08): the dismissible red box on the login page. It is promoted to the
 * standard here rather than replaced.
 */

// ── Banner ──────────────────────────────────────────────────────────────────

export interface BannerProps {
  tone?: "error" | "warning" | "info" | "success";
  title?: string;
  children: ReactNode;
  /** Shown as small copyable text on a 500 (PLAN/05 §5.2 rule 7). */
  requestId?: string;
  onDismiss?: () => void;
}

const BANNER_TONES = {
  error: "border-danger-line bg-danger-soft text-danger-text",
  warning: "border-warning-line bg-warning-soft text-warning-text",
  info: "border-info-line bg-info-soft text-info-text",
  success: "border-success-line bg-success-soft text-success-text",
} as const;

export function Banner({
  tone = "error",
  title,
  children,
  requestId,
  onDismiss,
}: BannerProps): ReactNode {
  return (
    <div role="alert" className={cn("rounded-md border p-3 text-sm", BANNER_TONES[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title !== undefined ? <p className="font-semibold">{title}</p> : null}
          <div className={cn(title !== undefined && "mt-0.5")}>{children}</div>

          {requestId !== undefined ? (
            <p className="mt-2 text-xs opacity-80">
              Sebutkan kode ini saat melapor:{" "}
              <code className="select-all rounded bg-surface/60 px-1 py-0.5 font-mono">
                {requestId}
              </code>
            </p>
          ) : null}
        </div>

        {onDismiss !== undefined ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup pesan"
            // `currentColor` at low opacity rather than a fixed black wash,
            // which was invisible against the dark-theme banner fills.
            className="shrink-0 rounded px-2 py-1 text-lg leading-none hover:bg-current/10"
          >
            &times;
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Turns any thrown error into the banner it deserves. */
export function ErrorBanner({
  error,
  onDismiss,
}: {
  error: unknown;
  onDismiss?: () => void;
}): ReactNode {
  if (error === null || error === undefined) return null;

  if (isApiError(error)) {
    return (
      <Banner
        tone={error.code === "SERVICE_UNAVAILABLE" ? "warning" : "error"}
        // Only a 500 carries the id: on a validation error the user needs the
        // field message, not a support code.
        requestId={error.envelope.code === "INTERNAL_ERROR" ? error.requestId : undefined}
        onDismiss={onDismiss}
      >
        {error.envelope.message}
      </Banner>
    );
  }

  return (
    <Banner onDismiss={onDismiss}>
      Terjadi kesalahan yang tidak terduga. Silakan muat ulang halaman.
    </Banner>
  );
}

// ── Toast ───────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
  action?: { label: string; href: string };
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_TONES: Record<Toast["tone"], string> = {
  success: "border-success-line bg-success-soft text-success-text",
  error: "border-danger-line bg-danger-soft text-danger-text",
  info: "border-line bg-surface text-body",
};

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...toast, id }]);
      // Four seconds, per PLAN/05 §5.1. A toast carrying an action link stays
      // longer, because it is asking the user to do something.
      const timer = window.setTimeout(() => dismiss(id), toast.action === undefined ? 4000 : 10_000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) window.clearTimeout(timer);
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 safe-bottom"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm shadow-lg",
              TOAST_TONES[toast.tone],
            )}
          >
            <span className="min-w-0">{toast.message}</span>
            <div className="flex shrink-0 items-center gap-2">
              {toast.action !== undefined ? (
                <a
                  href={toast.action.href}
                  className="font-medium underline underline-offset-2"
                  download
                >
                  {toast.action.label}
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Tutup notifikasi"
                className="rounded px-1 text-lg leading-none hover:bg-current/10"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

// ── Dialog ──────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps the keyboard inside the dialog while it is open, and gives focus back
 * to whatever opened it on the way out.
 *
 * Without this, opening a dialog left focus on the page behind it: a keyboard
 * or screen-reader user pressing Tab walked straight out of the dialog and into
 * the content it was covering, with no way to know they had left.
 */
function useFocusTrap(open: boolean, container: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = container.current;

    const focusables = node?.querySelectorAll<HTMLElement>(FOCUSABLE);
    // Prefer the first control; fall back to the dialog itself so focus is at
    // least inside, and the title is announced.
    (focusables?.[0] ?? node)?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab" || node === null) return;

      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, container]);
}

/**
 * The replacement for `confirm()`.
 *
 * PLAN/04 §5 guard 4 asks for a deletion dialog that makes the user retype the
 * username — something a browser `confirm()` cannot do, quite apart from being
 * forbidden outright as defect D-08.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}): ReactNode {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useFocusTrap(open, panel);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center",
        className,
      )}
      // Dismissing by clicking away is what people expect of an overlay, and
      // the same click on the panel must not close it.
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="w-full max-w-lg rounded-lg bg-surface shadow-xl"
      >
        <header className="border-b border-line px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-body">
            {title}
          </h2>
          {description !== undefined ? (
            <p id={descriptionId} className="mt-0.5 text-sm text-muted">
              {description}
            </p>
          ) : null}
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }): ReactNode {
  return <div className="mt-4 flex flex-wrap justify-end gap-2">{children}</div>;
}

export function CancelButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <Button variant="secondary" type="button" onClick={onClick}>
      Batal
    </Button>
  );
}

/**
 * A dialog that asks "are you sure" and nothing more.
 *
 * Four pages had rebuilt this by hand, and two of them had rebuilt the whole
 * `Dialog` with it — losing Escape, the focus trap, and the dialog role in the
 * process. PLAN/10 §3.2 rule 4 requires a two-step confirmation on every
 * operational action, so it is worth having once and correct.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Lanjutkan",
  tone = "danger",
  loading = false,
  onConfirm,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose} className={className}>
      {children}
      <DialogFooter>
        <CancelButton onClick={onClose} />
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          loading={loading}
          loadingText="Memproses…"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ── Status badge ────────────────────────────────────────────────────────────

/**
 * Status colours, chosen by who has to act next rather than by how the status
 * sounds.
 *
 * `pending_qc` is blue because nothing is required of the person reading it —
 * the submission is with QC. `needs_revision` is amber because it is the one
 * status that is asking the supplier to do something. The two used to be amber
 * and orange, a distinction of hue with no meaning attached, and hard to tell
 * apart at badge size anyway.
 */
const STATUS_TONES = {
  draft: "neutral",
  pending_qc: "info",
  needs_revision: "warning",
  passed_qc: "success",
  dropped_qc: "danger",
} as const satisfies Record<InspectionStatus, "neutral" | "info" | "warning" | "success" | "danger">;

export function StatusBadge({ status }: { status: InspectionStatus }): ReactNode {
  return <Badge tone={STATUS_TONES[status]}>{INSPECTION_STATUS_LABELS[status]}</Badge>;
}
