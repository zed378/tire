import {
  ERROR_DEFINITIONS,
  type ErrorCode,
  type FieldErrorCode,
} from "@c26/contracts";

/**
 * The one error type route handlers throw (PLAN/05 §4).
 *
 * No handler writes its own try/catch. The wrapper catches everything, maps it
 * to a code, and shapes the envelope. That is what makes "every failure is
 * visible, logged, and testable" true by construction rather than by habit.
 */

export interface AppErrorFieldIssue {
  field: string;
  code: FieldErrorCode;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors: AppErrorFieldIssue[];
  /** Extra context for the log line only. Never sent to the browser. */
  readonly context: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      fieldErrors?: AppErrorFieldIssue[];
      context?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? ERROR_DEFINITIONS[code].message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_DEFINITIONS[code].status;
    this.fieldErrors = options.fieldErrors ?? [];
    this.context = options.context ?? {};
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// ── Constructors for the cases that recur ───────────────────────────────────

export function validationError(fieldErrors: AppErrorFieldIssue[]): AppError {
  return new AppError("VALIDATION_ERROR", { fieldErrors });
}

/**
 * Used both for a genuinely missing row and for one outside the caller's scope.
 *
 * Answering "this exists but you may not see it" would leak the existence of
 * another supplier's Serial Number, so the two cases are deliberately
 * indistinguishable (PLAN/04 §2.2).
 */
export function notFound(entity: string, id?: string | number | bigint): AppError {
  return new AppError("NOT_FOUND", { context: { entity, id: id?.toString() } });
}

export function forbidden(permission: string): AppError {
  return new AppError("FORBIDDEN_ROLE", { context: { permission } });
}

export function invalidTransition(from: string, to: string): AppError {
  return new AppError("INVALID_STATE_TRANSITION", {
    message: `Pengajuan berstatus "${from}" tidak dapat diubah menjadi "${to}".`,
    context: { from, to },
  });
}

export function duplicatePlate(details: {
  plateDisplay: string;
  serialNumber: string;
  statusLabel: string;
}): AppError {
  // The message names the blocking inspection, because "duplicate" alone leaves
  // the supplier with nothing to act on (PLAN/05 §3).
  return new AppError("DUPLICATE_PLATE", {
    message: `Kendaraan ${details.plateDisplay} sedang dalam pemeriksaan ${details.serialNumber} (${details.statusLabel}).`,
    fieldErrors: [
      {
        field: "plateDisplay",
        code: "NOT_ALLOWED",
        message: `Sedang diperiksa pada ${details.serialNumber} (${details.statusLabel}).`,
      },
    ],
    context: details,
  });
}
