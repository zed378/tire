import pino, { type Logger, type LoggerOptions } from "pino";
import { loadConfig } from "./config.ts";

/**
 * Structured logging from day one (PLAN/01 §6).
 *
 * D-08 proved the legacy system had failures that were invisible to everyone —
 * the user, the developer, and the QA tooling alike. Observability here is not a
 * luxury item; it is the thing whose absence made that possible.
 *
 * The redaction list below is the one in PLAN/13 §8. Logging a whole request
 * object is the single most common way credentials end up in a log file, and
 * these logs are shipped to a third party.
 */

const REDACTED_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  "req.headers['x-csrf-token']",
  "res.headers['set-cookie']",
  "*.password",
  "*.newPassword",
  "*.currentPassword",
  "*.confirmPassword",
  "*.passwordHash",
  "*.temporaryPassword",
  "*.token",
  "*.tokenHash",
  "*.csrfToken",
  "*.secretEnc",
  "*.secretForManualEntry",
  "*.otpauthUri",
  "*.totpCode",
  "*.recoveryCode",
  "*.recoveryCodes",
  "body.password",
  "body.newPassword",
  "body.currentPassword",
  "body.totpCode",
  "body.recoveryCode",
];

/**
 * Pino options, exported so Fastify can build its own logger from exactly the
 * same configuration.
 *
 * Sharing the OPTIONS rather than the instance is what keeps the redaction list
 * in one place while letting Fastify own its logger — which in turn keeps the
 * application's type as the plain `FastifyInstance` every route module expects,
 * with no casting anywhere.
 */
export function loggerOptions(): LoggerOptions {
  const config = loadConfig();

  return {
    level: config.LOG_LEVEL,
    redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
    base: { app: "c26-api", env: config.APP_ENV, version: config.APP_VERSION },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport:
      config.APP_ENV === "local"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
        : undefined,
  };
}

let cached: Logger | null = null;

/** For code outside the request path: the worker, jobs, and startup. */
export function getLogger(): Logger {
  if (cached !== null) return cached;
  cached = pino(loggerOptions());
  return cached;
}

/**
 * Request identifiers are human-quotable on purpose.
 *
 * With a separate operator (PLAN/10 §3.3) this string is the backbone of the
 * support flow: a user reports "gagal, kodenya req_20260901_143022_a91f", the
 * operator pastes it into log search, and either resolves it or escalates with
 * the full context attached. A random UUID would work for machines and be
 * useless over the phone.
 */
export function generateRequestId(now: Date = new Date()): string {
  const pad = (n: number, width = 2): string => String(n).padStart(width, "0");
  const date = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const random = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0");
  return `req_${date}_${time}_${random}`;
}
