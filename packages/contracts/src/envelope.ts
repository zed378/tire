import { z } from "zod";
import { ERROR_CODES, FIELD_ERROR_CODES, type ErrorCode, type FieldErrorCode } from "./errors.ts";

/**
 * The two response shapes (PLAN/05 §2). There is no third.
 *
 * Note what is absent: the `status` field from the original audit design. HTTP
 * status now lives where it belongs — in the header — and duplicating it in the
 * body only creates two sources of truth that can disagree. That duplication was
 * forced on the legacy system because Apps Script always answered 200 (`B-02`);
 * a real HTTP API has no such excuse.
 */

export const fieldErrorSchema = z.object({
  field: z.string(),
  code: z.enum(FIELD_ERROR_CODES),
  message: z.string(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;

export function successEnvelopeSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    ok: z.literal(true),
    data,
    requestId: z.string(),
  });
}

export const errorEnvelopeSchema = z.object({
  ok: z.literal(false),
  code: z.enum(ERROR_CODES),
  message: z.string(),
  errors: z.array(fieldErrorSchema).optional(),
  requestId: z.string(),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
  requestId: string;
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export function isErrorEnvelope<T>(envelope: Envelope<T>): envelope is ErrorEnvelope {
  return envelope.ok === false;
}

/** Pulls the message for one field out of a VALIDATION_ERROR envelope. */
export function fieldErrorFor(envelope: ErrorEnvelope, field: string): FieldError | undefined {
  return envelope.errors?.find((e) => e.field === field);
}

export interface FieldErrorInput {
  field: string;
  code: FieldErrorCode;
  message: string;
}

/** Cursor-free pagination: page numbers are what the tables in this app need. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    perPage: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });
}

/** Every response carries this so the UI, Pino, Sentry, and audit_logs agree. */
export const REQUEST_ID_HEADER = "x-request-id";

/** Compared by the client to decide whether to offer a reload (PLAN/06 §5.1). */
export const APP_VERSION_HEADER = "x-app-version";

/** Double-submit CSRF token header (PLAN/13 §2.2). */
export const CSRF_HEADER = "x-csrf-token";
export const CSRF_COOKIE = "csrf";
export const SESSION_COOKIE = "sid";

export type { ErrorCode, FieldErrorCode };
