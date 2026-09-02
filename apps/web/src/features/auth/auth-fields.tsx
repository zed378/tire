import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { MIN_PASSWORD_LENGTH } from "@c26/contracts";
import { cn } from "../../lib/cn.ts";
import { Input } from "../../components/ui/primitives.tsx";

/**
 * The parts both auth screens need, written once.
 *
 * The show/hide toggle used to exist twice on the register page and a third
 * time, inline, on login — three copies of the same control, and the two on
 * register had drifted from the one on login. Brief §27 asks for no duplicated
 * styles between these screens; this is that, applied to behaviour as well.
 */

// ── Password field ──────────────────────────────────────────────────────────

export interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
}

/**
 * A password input with a visibility toggle and Caps Lock detection.
 *
 * Caps Lock is worth the code: it is the single most common reason a correct
 * password is rejected, and the server cannot tell the difference — it just
 * says the credentials do not match, which sends the user looking for the wrong
 * problem.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ className, invalid, id, ...props }, ref) {
    const [shown, setShown] = useState(false);
    const [capsLock, setCapsLock] = useState(false);

    return (
      <>
        <div className="auth-field">
          <Input
            ref={ref}
            id={id}
            type={shown ? "text" : "password"}
            invalid={invalid}
            className={cn("pr-11", className)}
            onKeyUp={(event) => {
              // `getModifierState` is missing on a few older mobile browsers.
              // There, the notice simply never appears.
              if (typeof event.getModifierState === "function") {
                setCapsLock(event.getModifierState("CapsLock"));
              }
            }}
            onBlur={(event) => {
              setCapsLock(false);
              props.onBlur?.(event);
            }}
            {...props}
          />
          <button
            type="button"
            onClick={() => {
              setShown((current) => !current);
            }}
            aria-pressed={shown}
            aria-label={shown ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-base text-subtle transition-colors duration-180 ease-precision hover:text-body"
          >
            <EyeIcon crossed={shown} />
          </button>
        </div>

        {/*
          A notice, not an alert: `polite` so it waits for a pause rather than
          interrupting whatever the reader is in the middle of.
        */}
        <p aria-live="polite" className="sr-only">
          {capsLock ? "Caps Lock aktif." : ""}
        </p>
        {capsLock ? (
          <p
            aria-hidden="true"
            className="mt-1.5 flex items-center gap-1.5 text-xs text-warning-text"
          >
            <WarningIcon />
            Caps Lock sedang aktif.
          </p>
        ) : null}
      </>
    );
  },
);

// ── Tread depth gauge ───────────────────────────────────────────────────────

const GROOVES = 5;

export type PasswordStrength = { filled: number; label: string; tone: string };

/**
 * Password strength, scored on the rule this system actually enforces.
 *
 * PLAN/04 §4.1 is explicit: length beats composition. No symbol requirement, no
 * forced rotation — mandatory rotation is what produces `Password1`,
 * `Password2`. The previous meter scored uppercase, digits and symbols, which
 * taught users a rule the server does not have and never rewarded the one thing
 * that genuinely helps.
 *
 * The remaining check — whether the password is a common one — runs on the
 * server, where the wordlist lives. It cannot be scored here, so it is not
 * claimed here.
 */
export function scorePassword(password: string): PasswordStrength {
  if (password.length === 0) {
    return { filled: 0, label: "Belum diisi", tone: "bg-line-strong" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { filled: 1, label: "Terlalu pendek", tone: "bg-signal-danger" };
  }
  if (password.length < 14) {
    return { filled: 2, label: "Lemah", tone: "bg-signal-danger" };
  }
  if (password.length < 18) {
    return { filled: 3, label: "Cukup", tone: "bg-warning" };
  }
  if (password.length < 24) {
    return { filled: 4, label: "Kuat", tone: "bg-signal-ok" };
  }
  return { filled: GROOVES, label: "Sangat kuat", tone: "bg-signal-ok" };
}

/**
 * Five grooves that fill as the password gets longer — a wear gauge, which is
 * the instrument these users already read every working day.
 *
 * Colour is never the only indicator: the label beside it says the strength in
 * words, and the number of filled grooves carries it independently of hue.
 */
export function TreadGauge({ strength }: { strength: PasswordStrength }): ReactNode {
  return (
    <div className="mt-2.5 flex items-end gap-3">
      <div
        className="flex h-6 items-end gap-1"
        role="img"
        aria-label={`Kekuatan password: ${strength.label}`}
      >
        {Array.from({ length: GROOVES }, (_, index) => {
          const filled = index < strength.filled;
          // Grooves deepen left to right, so the gauge reads as a profile even
          // before any of it is filled.
          const height = ["h-2.5", "h-3.5", "h-4", "h-5", "h-6"][index] ?? "h-4";
          return (
            <span
              key={index}
              className={cn(
                "tread-groove w-1.5 rounded-tight",
                height,
                filled ? strength.tone : "bg-line-strong",
              )}
            />
          );
        })}
      </div>
      <span className="pb-0.5 text-xs font-medium text-body">{strength.label}</span>
    </div>
  );
}

// ── Live requirement checklist ──────────────────────────────────────────────

/**
 * The requirements, ticking as they are met rather than appearing as errors
 * after a failed submit.
 *
 * It lists only what is actually enforced. A checklist that invents rules —
 * "one uppercase", "one symbol" — is worse than none: the user satisfies it,
 * the server does not care, and the next person copies the invented rule into
 * the next form.
 */
export function PasswordChecklist({ password }: { password: string }): ReactNode {
  const rules = [
    {
      label: `Minimal ${String(MIN_PASSWORD_LENGTH)} karakter`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    { label: "Semakin panjang, semakin kuat — bukan semakin rumit", met: password.length >= 14 },
  ];

  return (
    <ul className="mt-3 space-y-1.5">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={cn(
            "flex items-start gap-2 text-xs",
            rule.met ? "text-success-text" : "text-muted",
          )}
        >
          <span aria-hidden="true" className="mt-px flex-none">
            {rule.met ? <CheckIcon /> : <DotIcon />}
          </span>
          <span>
            <span className="sr-only">{rule.met ? "Terpenuhi: " : "Belum terpenuhi: "}</span>
            {rule.label}
          </span>
        </li>
      ))}
      <li className="flex items-start gap-2 text-xs text-muted">
        <span aria-hidden="true" className="mt-px flex-none">
          <DotIcon />
        </span>
        Tidak boleh password yang umum dipakai — ini diperiksa server saat dikirim.
      </li>
    </ul>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function EyeIcon({ crossed }: { crossed: boolean }): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
      {crossed ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
    </svg>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function DotIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function WarningIcon(): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 flex-none"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}
