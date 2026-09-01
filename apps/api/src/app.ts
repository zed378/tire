import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ERROR_DEFINITIONS } from "@c26/contracts";
import { loadConfig } from "./kernel/config.ts";
import { getLogger } from "./kernel/logger.ts";
import { registerRequestContext } from "./kernel/http/context.ts";
import { verifyCsrf } from "./kernel/http/csrf.ts";
import { RATE_LIMITS } from "./kernel/http/rate-limits.ts";
import { errorEnvelope } from "./kernel/envelope/wrap-route.ts";
import { AppError } from "./kernel/envelope/index.ts";
import { registerAuthRoutes, resolveActor } from "./modules/auth/index.ts";
import { registerUserRoutes } from "./modules/users/index.ts";
import { registerMasterDataRoutes } from "./modules/master-data/index.ts";
import { registerVehicleRoutes } from "./modules/vehicles/index.ts";
import { registerInspectionRoutes } from "./modules/inspections/index.ts";
import { registerPhotoRoutes } from "./modules/photos/index.ts";
import { registerQcRoutes } from "./modules/qc/index.ts";
import { registerTireSpecRoutes } from "./modules/tire-specs/index.ts";
import { registerReportRoutes } from "./modules/reports/index.ts";
import { registerNotificationRoutes } from "./modules/notifications/index.ts";
import { registerOpsRoutes } from "./modules/ops/index.ts";
import { registerAuditRoutes } from "./modules/audit/index.ts";

/**
 * Builds the Fastify application.
 *
 * Exported separately from `server.ts` so tests can build an app without
 * binding a port.
 */
export function buildApp(): FastifyInstance {
  const config = loadConfig();
  const log = getLogger();

  const app = Fastify({
    loggerInstance: log,
    disableRequestLogging: true, // the context hook logs a single richer line
    trustProxy: true, // Caddy sits in front
    bodyLimit: 2 * 1024 * 1024, // photos go straight to storage, never through here
  });

  registerRequestContext(app);

  void app.register(helmet, {
    // The SPA's CSP is served by Caddy; the API answers JSON only and locks
    // itself down completely (PLAN/13 §7).
    contentSecurityPolicy: {
      directives: { "default-src": ["'none'"], "frame-ancestors": ["'none'"] },
    },
    // `frame-ancestors 'none'` is worth noting: the legacy system lived INSIDE an
    // Apps Script sandbox iframe (B-07). This one refuses to be framed at all.
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  });

  void app.register(cors, {
    // An explicit allowlist. Never '*', and never a reflected Origin header
    // (PLAN/13 §2).
    origin: config.allowedOrigins,
    credentials: true,
    allowedHeaders: ["content-type", "x-csrf-token"],
    exposedHeaders: ["x-request-id", "x-app-version"],
  });

  void app.register(cookie);

  void app.register(rateLimit, {
    global: true,
    max: RATE_LIMITS.global.max,
    timeWindow: RATE_LIMITS.global.timeWindow,
    // Per user where known, per IP otherwise: one office behind one NAT must not
    // rate-limit itself out of the system.
    keyGenerator: (request) => request.actor?.id.toString() ?? request.clientIp ?? request.ip,
    errorResponseBuilder: (request) =>
      errorEnvelope(new AppError("RATE_LIMITED"), request.requestId),
  });

  // ── Authentication and CSRF, before every handler ──────────────────────────
  app.addHook("preHandler", async (request) => {
    request.actor = await resolveActor(request);

    // Login and health are the only state-changing routes that can be reached
    // without a session; the CSRF cookie is issued at login, so it cannot be
    // required on the login request itself.
    const path = request.routeOptions.url ?? request.url;
    const csrfExempt = path === "/api/auth/login" || path === "/api/health";
    if (!csrfExempt) verifyCsrf(request);
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerMasterDataRoutes(app);
  registerVehicleRoutes(app);
  registerInspectionRoutes(app);
  registerPhotoRoutes(app);
  registerQcRoutes(app);
  registerTireSpecRoutes(app);
  registerReportRoutes(app);
  registerNotificationRoutes(app);
  registerOpsRoutes(app);
  registerAuditRoutes(app);

  /**
   * The last line of defence.
   *
   * `wrapRoute` catches everything a handler throws; this catches what happens
   * before a handler runs — a malformed body, a failed CSRF check in the hook,
   * a rate limit. Even here the browser gets the envelope and never a stack
   * trace (PLAN/05 §4 rule 2).
   */
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.status >= 500) log.error({ requestId: request.requestId, err: error }, error.message);
      return reply.status(error.status).send(errorEnvelope(error, request.requestId));
    }

    const status = typeof error.statusCode === "number" ? error.statusCode : 500;
    const mapped =
      status === 400
        ? new AppError("BAD_REQUEST")
        : status === 429
          ? new AppError("RATE_LIMITED")
          : status === 413
            ? new AppError("FILE_TOO_LARGE")
            : new AppError("INTERNAL_ERROR", { cause: error });

    if (mapped.status >= 500) {
      log.error({ requestId: request.requestId, err: error }, "unhandled error");
    }
    return reply.status(mapped.status).send(errorEnvelope(mapped, request.requestId));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(
      errorEnvelope(
        new AppError("NOT_FOUND", { message: ERROR_DEFINITIONS.NOT_FOUND.message }),
        request.requestId,
      ),
    ),
  );

  return app;
}
