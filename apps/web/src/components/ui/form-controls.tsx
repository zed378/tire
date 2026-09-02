import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/**
 * Controls the existing primitives did not cover (DESIGN_PLAN, PROMPT 1).
 *
 * `Field`, `Input`, `Select` and `Textarea` already live in `primitives.tsx` and
 * are used by twenty screens; they are extended there rather than reimplemented
 * here. What was missing entirely is a checkbox, a radio, and a container — so
 * only those are new.
 *
 * The touch target on both controls is 44px, which is larger than the box that
 * is drawn. That is deliberate: these are used on phones, in a workshop, often
 * by someone wearing gloves.
 */

// ── Container ───────────────────────────────────────────────────────────────

/**
 * One width for the whole site.
 *
 * Every page was setting its own `max-w-*`, so the columns did not line up from
 * one screen to the next. `max-w-site` is the single value; `prose` narrows to
 * a readable measure for running text.
 */
export function Container({
  children,
  className,
  width = "site",
}: {
  children: ReactNode;
  className?: string;
  width?: "site" | "prose";
}): ReactNode {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        width === "site" ? "max-w-site" : "max-w-prose",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Checkbox ────────────────────────────────────────────────────────────────

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  hint?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className={className}>
      {/*
        The label wraps the input, so the whole 44px row is the hit area rather
        than just the 18px box. `-my-*` pulls the extra height back out of the
        layout so a stack of checkboxes does not gain 26px of air per row.
      */}
      <label
        htmlFor={inputId}
        className="-my-3 flex cursor-pointer items-start gap-3 py-3 text-sm"
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={cn(
            "mt-0.5 h-[18px] w-[18px] flex-none cursor-pointer rounded-tight border",
            "accent-brand",
            error !== undefined ? "border-signal-danger" : "border-steel",
          )}
          {...props}
        />
        <span className="text-body">{label}</span>
      </label>

      {hint !== undefined && error === undefined ? (
        <p id={hintId} className="mt-1.5 pl-[30px] text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} role="alert" className="mt-1.5 pl-[30px] text-xs font-medium text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
});

// ── Radio ───────────────────────────────────────────────────────────────────

export interface RadioOption<Value extends string> {
  value: Value;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * A radio group, not a lone radio.
 *
 * A single radio button is never correct on its own, and rendering them one at
 * a time is how a group ends up without a `<fieldset>` or a shared name — which
 * is what makes arrow keys work.
 */
export function RadioGroup<Value extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  error,
  className,
}: {
  legend: string;
  name: string;
  value: Value | null;
  options: RadioOption<Value>[];
  onChange: (value: Value) => void;
  error?: string;
  className?: string;
}): ReactNode {
  const groupId = useId();
  const errorId = `${groupId}-error`;

  return (
    <fieldset className={className} aria-describedby={error !== undefined ? errorId : undefined}>
      <legend className="text-sm font-medium text-body">{legend}</legend>

      <div className="mt-2 space-y-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "-my-3 flex items-start gap-3 py-3 text-sm",
              option.disabled === true ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              aria-invalid={error !== undefined}
              onChange={() => {
                onChange(option.value);
              }}
              className={cn(
                "mt-0.5 h-[18px] w-[18px] flex-none rounded-full border accent-brand",
                option.disabled === true ? "cursor-not-allowed" : "cursor-pointer",
                error !== undefined ? "border-signal-danger" : "border-steel",
              )}
            />
            <span>
              <span className="block text-body">{option.label}</span>
              {option.hint !== undefined ? (
                <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      {error !== undefined ? (
        <p id={errorId} role="alert" className="mt-2 text-xs font-medium text-danger-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
