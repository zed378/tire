import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn.ts";

/**
 * Owned components, in the shadcn spirit: copied into the repository rather than
 * pulled from a dependency that can change or disappear (PLAN/01 §4.1).
 *
 * Two rules run through all of them. Every submit button has a loading state,
 * because a double submit and an unresponsive screen are both real (PLAN/05 §5.2
 * rule 3). And nothing here uses `alert`, `confirm`, or `prompt` — those are
 * defect D-08, the thing this rewrite exists to remove, and both a lint rule and
 * a CI gate check that they stay gone.
 *
 * Colours come from the semantic tokens in index.css: a component asks for
 * `bg-surface` and the theme decides what that means. Each token already
 * carries its dark value, so a `dark:` variant in this file is a sign that
 * something is being said twice.
 */

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover disabled:bg-accent/50",
  secondary:
    "bg-surface text-body border border-line-strong hover:bg-surface-sunken disabled:text-subtle",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50",
  ghost: "text-muted hover:bg-surface-sunken hover:text-body disabled:text-subtle",
};

/**
 * `md` is 44px, the touch target this application needs — it is used on phones
 * in garages (PLAN/00 §4). `sm` is deliberately smaller and is for dense
 * desktop rows, such as the per-row actions in the master data tables, where a
 * stack of 44px buttons makes the table unreadable.
 */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Shown beside the spinner so the user knows what is happening. */
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingText,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      // Disabled while in flight: this is the double-submit guard, not a
      // decoration (PLAN/05 §5.2 rule 3).
      disabled={disabled === true || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors disabled:cursor-not-allowed",
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {loading && loadingText !== undefined ? loadingText : children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }): ReactNode {
  return (
    <svg
      className={cn("h-4 w-4 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="opacity-75"
      />
    </svg>
  );
}

// ── Field wrapper ───────────────────────────────────────────────────────────

interface FieldContextValue {
  describedBy: string | undefined;
  invalid: boolean;
}

/**
 * Carries the hint and error element ids down to whichever control sits inside
 * the field.
 *
 * A context rather than `cloneElement` because the control is not always the
 * direct child — several forms wrap theirs in a layout div — and because it
 * leaves every existing call site untouched.
 */
const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * One field, one label, one inline error.
 *
 * The error text is the first channel of the three in PLAN/05 §5.1 and it is
 * always Indonesian — closing D-07, where HTML5 `required` produced an English
 * browser tooltip in an Indonesian interface and could be bypassed anyway.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
}: FieldProps): ReactNode {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;

  const showHint = hint !== undefined && error === undefined;
  const describedBy =
    [error !== undefined ? errorId : null, showHint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <FieldContext.Provider value={{ describedBy, invalid: error !== undefined }}>
      <div className="space-y-1.5">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-body">
          {label}
          {required ? (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {children}
        {showHint ? (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        ) : null}
        {error !== undefined ? (
          <p id={errorId} role="alert" className="text-sm font-medium text-danger-text">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export const CONTROL_CLASSES =
  "w-full min-h-11 rounded-md border px-3 text-body placeholder:text-subtle " +
  "disabled:bg-surface-sunken disabled:text-subtle";

export function controlTone(invalid: boolean): string {
  return invalid ? "border-danger bg-danger-soft" : "border-line-strong bg-surface";
}

/**
 * Merges what the surrounding `Field` knows with what the caller passed.
 *
 * The `invalid` prop still wins when set explicitly, so a control used outside
 * a `Field` behaves exactly as before.
 */
export function useFieldWiring(invalid: boolean | undefined): {
  invalid: boolean;
  describedBy: string | undefined;
} {
  const field = useContext(FieldContext);
  return {
    invalid: invalid ?? field?.invalid ?? false,
    describedBy: field?.describedBy,
  };
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const wiring = useFieldWiring(invalid);
  return (
    <input
      ref={ref}
      aria-invalid={wiring.invalid}
      aria-describedby={ariaDescribedBy ?? wiring.describedBy}
      className={cn(CONTROL_CLASSES, controlTone(wiring.invalid), className)}
      {...props}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const wiring = useFieldWiring(invalid);
  return (
    <select
      ref={ref}
      aria-invalid={wiring.invalid}
      aria-describedby={ariaDescribedBy ?? wiring.describedBy}
      className={cn(CONTROL_CLASSES, controlTone(wiring.invalid), className)}
      {...props}
    >
      {children}
    </select>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, "aria-describedby": ariaDescribedBy, ...props },
  ref,
) {
  const wiring = useFieldWiring(invalid);
  return (
    <textarea
      ref={ref}
      aria-invalid={wiring.invalid}
      aria-describedby={ariaDescribedBy ?? wiring.describedBy}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-body placeholder:text-subtle",
        controlTone(wiring.invalid),
        className,
      )}
      {...props}
    />
  );
});

// ── Page header ─────────────────────────────────────────────────────────────

export interface Breadcrumb {
  label: string;
  to?: string;
}

/**
 * The heading block every page opens with.
 *
 * It exists because there were seventeen hand-written `<h1>` elements, no two
 * styled alike, and the deep screens had no way back at all — `/qc/:sn` and
 * `/inspections/:sn/tire-specs` left the browser's Back button as the only
 * exit. `renderCrumbLink` is injected so this file stays free of a router
 * import and can be rendered in a test without one.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  renderCrumbLink,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  renderCrumbLink?: (crumb: Breadcrumb) => ReactNode;
}): ReactNode {
  return (
    <div className="space-y-2">
      {breadcrumbs !== undefined && breadcrumbs.length > 0 ? (
        <nav aria-label="Remah roti">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {crumb.to !== undefined && renderCrumbLink !== undefined ? (
                  renderCrumbLink(crumb)
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-body">{title}</h1>
          {description !== undefined ? (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {actions !== undefined ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

// ── Card and layout helpers ─────────────────────────────────────────────────

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <section className={cn("rounded-xl border border-line bg-surface shadow-sm", className)}>
      {title !== undefined ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-base font-semibold text-body">{title}</h2>
            {description !== undefined ? (
              <p className="mt-0.5 text-xs text-muted sm:text-sm">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

/**
 * What a list shows when it has nothing to show.
 *
 * The action slot matters more than it looks: an empty list that offers the
 * thing you came to do is a shortcut, and one that just says "kosong" is a dead
 * end the user has to navigate out of.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="py-10 text-center">
      {icon !== undefined ? (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-subtle">
          {icon}
        </div>
      ) : null}
      <p className="font-medium text-body">{title}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-muted">{description}</p>
      {action !== undefined ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

/**
 * Placeholder for content that is still loading.
 *
 * Preferred over a centred spinner wherever the shape of the result is already
 * known: it keeps the layout from jumping when the data lands, and it tells the
 * user what is coming rather than only that something is.
 *
 * `aria-hidden` because the loading state is announced once, by the region that
 * owns it — a screen reader does not need to hear about nine grey rectangles.
 */
export function Skeleton({ className }: { className?: string }): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-surface-sunken", className)}
    />
  );
}

export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }): ReactNode {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-muted border-line-strong",
  accent: "bg-accent-soft text-accent-text border-accent/30",
  success: "bg-success-soft text-success-text border-success-line",
  warning: "bg-warning-soft text-warning-text border-warning-line",
  danger: "bg-danger-soft text-danger-text border-danger-line",
  info: "bg-info-soft text-info-text border-info-line",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────

/**
 * A single headline number.
 *
 * Replaces the two private copies that had grown apart — `Total()` on the
 * reports page and `Metric()` on the operations panel.
 *
 * `loading` renders a placeholder rather than a zero, because a zero that turns
 * out to be a loading state is a number someone might act on.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: BadgeTone;
  loading?: boolean;
}): ReactNode {
  const accentByTone: Record<BadgeTone, string> = {
    neutral: "text-body",
    accent: "text-accent-text",
    success: "text-success-text",
    warning: "text-warning-text",
    danger: "text-danger-text",
    info: "text-info-text",
  };

  const labelId = useId();

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p id={labelId} className="text-xs font-medium uppercase tracking-wide text-subtle">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p aria-labelledby={labelId} className={cn("mt-1 text-2xl font-semibold", accentByTone[tone])}>
          {value}
        </p>
      )}
      {hint !== undefined ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export {
  SearchableSelect,
  type SearchableOption,
  type SearchableSelectProps,
} from "./searchable-select.tsx";
