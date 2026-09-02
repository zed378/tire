import {
  forwardRef,
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
 */

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50 dark:bg-cyan-600 dark:hover:bg-cyan-700 dark:disabled:bg-cyan-600/50",
  secondary:
    "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-600 dark:disabled:text-slate-500",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50 dark:bg-red-700 dark:hover:bg-red-600 dark:disabled:bg-red-700/50",
  ghost: "text-slate-700 hover:bg-slate-100 disabled:text-slate-400 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:disabled:text-slate-500",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  /** Shown beside the spinner so the user knows what is happening. */
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, loadingText, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      // Disabled while in flight: this is the double-submit guard, not a
      // decoration (PLAN/05 §5.2 rule 3).
      disabled={disabled === true || loading}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium",
        "transition-colors disabled:cursor-not-allowed",
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

   return (
     <div className="space-y-1.5">
       <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
         {label}
         {required ? <span className="ml-1 text-red-500 dark:text-red-400">*</span> : null}
       </label>
       {children}
       {hint !== undefined && error === undefined ? (
         <p id={hintId} className="text-xs text-slate-600 dark:text-slate-400">
           {hint}
         </p>
       ) : null}
       {error !== undefined ? (
         <p id={errorId} role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
           {error}
         </p>
       ) : null}
     </div>
   );
}

// ── Inputs ──────────────────────────────────────────────────────────────────

const CONTROL_CLASSES =
  "w-full min-h-11 rounded-md border px-3 text-slate-900 placeholder:text-slate-400 " +
  "disabled:bg-slate-100 disabled:text-slate-500 " +
  "dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 " +
  "dark:disabled:bg-slate-700/50 dark:disabled:text-slate-400";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        CONTROL_CLASSES,
        invalid ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/40" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700",
        className,
      )}
      {...props}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        CONTROL_CLASSES,
        invalid ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/40" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700",
        className,
      )}
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
  { invalid = false, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-slate-900 dark:text-slate-100 dark:bg-slate-700",
        invalid ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/40" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700",
        className,
      )}
      {...props}
    />
  );
});

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
    <section className={cn("rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors duration-200", className)}>
      {title !== undefined ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {description !== undefined ? (
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }): ReactNode {
  return (
    <div className="py-10 text-center">
      <p className="font-medium text-slate-700 dark:text-slate-300">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}
