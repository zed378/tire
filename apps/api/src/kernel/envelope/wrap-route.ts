import { ZodError } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ErrorEnvelope, FieldErrorCode, SuccessEnvelope } from "@c26/contracts";
import { getLogger } from "../logger.ts";
import { AppError, isAppError } from "./app-error.ts";
import { translateDatabaseError } from "./database-errors.ts";

/**
 * One wrapper for every handler (PLAN/05 §4 rule 1).
 *
 * No route writes its own try/catch. The wrapper catches everything, maps it to
 * a code, and builds one of the two envelope shapes. A raw exception never
 * reaches the browser: the stack trace goes to Pino and Sentry alongside the
 * requestId, and the user receives a sentence they can read plus that same id.
 */

/** Maps a Zod issue onto the field-level error code the client switches on. */
function fieldCodeFor(issue: { code: string; message: string }): FieldErrorCode {
  switch (issue.code) {
    case "invalid_type":
      return issue.message.toLowerCase().includes("required") ? "REQUIRED" : "INVALID_FORMAT";
    case "too_small":
      return "TOO_SHORT";
    case "too_big":
      return "TOO_LONG";
    case "invalid_string":
    case "invalid_enum_value":
      return "INVALID_FORMAT";
    default:
      return "NOT_ALLOWED";
  }
}

export function zodErrorToAppError(error: ZodError): AppError {
  // Zod collects every issue by default, and that default is kept deliberately:
  // stopping at the first error makes a user resubmit a twelve-field form over
  // and over (PLAN/05 §4.5).
  return new AppError("VALIDATION_ERROR", {
    fieldErrors: error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "root",
      code: fieldCodeFor(issue),
      message: issue.message,
    })),
  });
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof ZodError) return zodErrorToAppError(error);

  const translated = translateDatabaseError(error);
  if (translated !== null) return translated;

  return new AppError("INTERNAL_ERROR", { cause: error });
}

export function successEnvelope<T>(data: T, requestId: string): SuccessEnvelope<T> {
  return { ok: true, data, requestId };
}

export function errorEnvelope(error: AppError, requestId: string): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    ok: false,
    code: error.code,
    message: error.message,
    requestId,
  };
  if (error.fieldErrors.length > 0) envelope.errors = error.fieldErrors;
  return envelope;
}

/**
 * Wraps a handler so it can return plain data and throw plain errors.
 *
 * `statusOnSuccess` exists because 201 carries meaning the client acts on: it is
 * the signal to show the new Serial Number in a toast (PLAN/05 §3).
 */
export function wrapRoute<Req extends FastifyRequest, Result>(
  handler: (request: Req, reply: FastifyReply) => Promise<Result>,
  statusOnSuccess = 200,
) {
  return async function wrapped(request: Req, reply: FastifyReply): Promise<unknown> {
    const requestId = request.requestId;

    try {
      const data = await handler(request, reply);
      // A handler that already sent its own response (a redirect, a stream) is
      // left alone.
      if (reply.sent) return reply;
      return reply.status(statusOnSuccess).send(successEnvelope(data, requestId));
    } catch (caught) {
      const error = toAppError(caught);
      const log = getLogger();

      const logPayload = {
        requestId,
        code: error.code,
        status: error.status,
        route: `${request.method} ${request.routeOptions.url ?? request.url}`,
        userId: request.actor?.id.toString() ?? null,
        role: request.actor?.role ?? null,
        ...error.context,
      };

      if (error.status >= 500) {
        // The full cause goes to the log and to Sentry; the user gets the
        // requestId and nothing else.
        log.error({ ...logPayload, err: error.cause ?? error }, error.message);
      } else {
        log.warn(logPayload, error.message);
      }

      return reply.status(error.status).send(errorEnvelope(error, requestId));
    }
  };
}
