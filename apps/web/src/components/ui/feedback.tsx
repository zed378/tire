import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { INSPECTION_STATUS_LABELS, type InspectionStatus } from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { isApiError } from "../../lib/api-client.ts";
import { Button } from "./primitives.tsx";

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
  error: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-blue-300 bg-blue-50 text-blue-900",
  success: "border-green-300 bg-green-50 text-green-900",
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
              <code className="select-all rounded bg-white/60 px-1 py-0.5 font-mono">
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
            className="shrink-0 rounded px-2 py-1 text-lg leading-none hover:bg-black/5"
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
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 safe-bottom"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm shadow-lg",
              toast.tone === "success" && "border-green-300 bg-green-50 text-green-900",
              toast.tone === "error" && "border-red-300 bg-red-50 text-red-900",
              toast.tone === "info" && "border-slate-300 bg-white text-slate-900",
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
                className="rounded px-1 text-lg leading-none hover:bg-black/5"
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
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}): ReactNode {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
      >
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description !== undefined ? (
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
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

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_TONES: Record<InspectionStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  pending_qc: "bg-amber-50 text-amber-800 border-amber-300",
  needs_revision: "bg-orange-50 text-orange-800 border-orange-300",
  passed_qc: "bg-green-50 text-green-800 border-green-300",
  dropped_qc: "bg-red-50 text-red-800 border-red-300",
};

export function StatusBadge({ status }: { status: InspectionStatus }): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_TONES[status],
      )}
    >
      {INSPECTION_STATUS_LABELS[status]}
    </span>
  );
}
