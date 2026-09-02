import Fastify, { LogController, type FastifyInstance } from "fastify";
import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { ERROR_DEFINITIONS } from "@c26/contracts";
import { loadConfig } from "./kernel/config.ts";
import { getLogger, loggerOptions } from "./kernel/logger.ts";
import { registerRequestContext } from "./kernel/http/context.ts";
import { verifyCsrf } from "./kernel/http/csrf.ts";
import { isRouteAllowedForHost, isStorageHost } from "./kernel/http/hosts.ts";
import { RATE_LIMITS } from "./kernel/http/rate-limits.ts";
import { cacheControlFor, securityHeadersFor } from "./kernel/http/security-headers.ts";
import { registerStaticSpa } from "./kernel/http/static-spa.ts";
import { errorEnvelope } from "./kernel/envelope/wrap-route.ts";
import { AppError } from "./kernel/envelope/index.ts";
import { registerAuthRoutes, resolveActor } from "./modules/auth/index.ts";
import { registerUserRoutes } from "./modules/users/index.ts";
import { registerMasterDataRoutes } from "./modules/master-data/index.ts";
import { registerMasterBrandRoutes } from "./modules/master-brand/index.ts";
import { registerVehicleRoutes } from "./modules/vehicles/index.ts";
import { registerInspectionRoutes } from "./modules/inspections/index.ts";
import { registerPhotoRoutes } from "./modules/photos/index.ts";
import { registerQcRoutes } from "./modules/qc/index.ts";
import { registerTireSpecRoutes } from "./modules/tire-specs/index.ts";
import { registerReportRoutes } from "./modules/reports/index.ts";
import { registerNotificationRoutes } from "./modules/notifications/index.ts";
import { registerOpsRoutes } from "./modules/ops/index.ts";
import { registerAuditRoutes } from "./modules/audit/index.ts";
import { registerUploadRoutes } from "./modules/uploads/index.ts";

/**
 * Builds the Fastify application.
 *
 * There is no reverse proxy in front of this. Cloudflare Tunnel terminates TLS
 * at the edge and connects straight to this process, so everything a proxy used
 * to do lives here: serving the SPA, the security headers, compression, and the
 * host restriction that keeps the storage hostname to a single route.
 *
 * Exported separately from `server.ts` so tests can build an app without
 * binding a port.
 */
export function buildApp(): FastifyInstance {
  const config = loadConfig();
  const log = getLogger();

  const app = Fastify({
    // Fastify builds its own logger from the shared options, which keeps the
    // instance's type as the plain `FastifyInstance` the route modules take.
    // Passing a pre-built pino instance would pin the logger generic to pino's
    // `Logger` and make every `registerXRoutes(app)` call a type error.
    logger: loggerOptions(),
    // Fastify's own per-request lines are off because `kernel/http/context.ts`
    // emits one richer line instead, carrying the requestId, the actor, the
    // route, the status, and the duration (PLAN/01 §6).
    //
    // An INSTANCE, not the class: `logController?: LogControllerClass` names the
    // instance type, because `LogController` is declared as a class. Passing the
    // class itself is what the runtime rejects with "must be an instance of
    // LogController". This replaces the top-level `disableRequestLogging`, which
    // Fastify 5 deprecates and 6 removes.
    logController: new LogController({ disableRequestLogging: true }),
    // cloudflared is the only client and it reaches this over loopback, so
    // X-Forwarded-For can be believed.
    trustProxy: true,
    // Small by default: only the upload route needs more, and it raises its own
    // limit to the 5 MB the photo contract allows.
    bodyLimit: 2 * 1024 * 1024,
    // The signed storage token is a route parameter and runs to roughly 270
    // characters: a base64url JSON payload carrying the storage key, size, MIME
    // type, checksum, and expiry, plus its HMAC. Fastify's default cap is 100,
    // and exceeding it makes the router answer 414 — which broke every photo
    // upload and every photo view, and only showed up at runtime.
    //
    // Set under `routerOptions`; the top-level form is deprecated in Fastify 5
    // and removed in 6.
    routerOptions: { maxParamLength: 1024 },
  });

  registerRequestContext(app);

  void app.register(compress, { global: true, encodings: ["br", "gzip"], threshold: 1024 });

  void app.register(cors, {
    // Nearly vestigial now that the SPA is same-origin, and kept for local
    // development where Vite runs on :5173. Still an explicit allowlist: never
    // '*', never a reflected Origin header (PLAN/13 §2).
    // Copied into a mutable array: @fastify/cors will not take a readonly one.
    origin: [...config.allowedOrigins],
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

  const servingSpa = registerStaticSpa(app);

  // ── Security headers, chosen per response class (PLAN/13 §7) ──────────────
  const headerContext = {
    storageOrigin: config.STORAGE_HOST === "" ? "" : `https://${config.STORAGE_HOST}`,
    secure: config.APP_ENV !== "local",
  };

  app.addHook("onSend", (request, reply, payload, done) => {
    const responseClass = isStorageHost(request.hostname, config.STORAGE_HOST)
      ? "storage"
      : request.url.startsWith("/api/")
        ? "api"
        : "spa";

    for (const [name, value] of Object.entries(securityHeadersFor(responseClass, headerContext))) {
      void reply.header(name, value);
    }

    // Cache policy for static responses (PLAN/06 §5.1). Set here rather than in
    // the static plugin so the index.html fallback is covered too, and so a
    // route that chose its own policy — the signed photo route does — keeps it.
    if (responseClass === "spa" && reply.getHeader("cache-control") === undefined) {
      void reply.header("cache-control", cacheControlFor(request.url.split("?")[0] ?? ""));
    }

    done(null, payload);
  });

  // ── Host restriction, authentication, and CSRF, before every handler ──────
  app.addHook("preHandler", async (request) => {
    /**
     * The storage hostname serves the signed upload route and nothing else.
     *
     * 404 rather than 403 on purpose: somebody who finds that hostname should
     * learn nothing about what else this API can do.
     */
    if (
      !isRouteAllowedForHost({
        host: request.hostname,
        path: request.url,
        storageHost: config.STORAGE_HOST,
      })
    ) {
      throw new AppError("NOT_FOUND");
    }

    request.actor = await resolveActor(request);

    // Login and health are the only state-changing routes that can be reached
    // without a session; the CSRF cookie is issued at login, so it cannot be
    // required on the login request itself.
    const path = request.routeOptions.url ?? request.url;

    // The upload routes carry their own authorisation in a signed, short-lived,
    // single-purpose token (see modules/uploads). A presigned URL is by design
    // usable without a session — that is what makes the same client code work
    // against R2 unchanged — so CSRF does not apply to them.
    const csrfExempt =
      path === "/api/auth/login" ||
      path === "/api/health" ||
      path.startsWith("/api/uploads/") ||
      // Static assets and the SPA shell. Nothing here changes state.
      !path.startsWith("/api/");

    if (!csrfExempt) verifyCsrf(request);
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerMasterDataRoutes(app);
  registerMasterBrandRoutes(app);
  registerVehicleRoutes(app);
  registerInspectionRoutes(app);
  registerPhotoRoutes(app);
  registerQcRoutes(app);
  registerTireSpecRoutes(app);
  registerReportRoutes(app);
  registerNotificationRoutes(app);
  registerOpsRoutes(app);
  registerAuditRoutes(app);
  // Only registered while STORAGE_DRIVER=local; with s3 the device uploads
  // straight to R2 and these routes do not exist.
  registerUploadRoutes(app);

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

    // Fastify types this parameter as `unknown` once a custom logger generic is
    // in play, so it is narrowed rather than assumed.
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    const status = typeof statusCode === "number" ? statusCode : 500;
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

  /**
   * One not-found handler, deciding between two very different answers.
   *
   * A path under /api is a genuine 404 and stays JSON — answering it with
   * index.html would turn a mistyped endpoint into a blank white page and a
   * mystery. Anything else is a client-side route and gets the SPA shell, so a
   * shared link to one Serial Number resolves on a cold load. That is what
   * closes B-07: the legacy application lived at a single URL inside an iframe
   * sandbox, where nothing could be bookmarked and Back did not work.
   */
  app.setNotFoundHandler((request, reply) => {
    if (servingSpa && request.method === "GET" && !request.url.startsWith("/api/")) {
      return reply.header("cache-control", "no-cache").sendFile("index.html");
    }

    return reply.status(404).send(
      errorEnvelope(
        new AppError("NOT_FOUND", { message: ERROR_DEFINITIONS.NOT_FOUND.message }),
        request.requestId,
      ),
    );
  });

  return app;
}
