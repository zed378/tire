import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { APP_VERSION_HEADER, REQUEST_ID_HEADER } from "@c26/contracts";
import { loadConfig } from "../config.ts";
import { generateRequestId, getLogger } from "../logger.ts";
import type { Actor } from "../authorization.ts";

declare module "fastify" {
  interface FastifyRequest {
    /** Created at the very start of the request (PLAN/05 §4 rule 3). */
    requestId: string;
    actor: Actor | null;
    clientIp: string | null;
  }
}

/**
 * Request context: the requestId thread that ties everything together.
 *
 * PLAN/10 §3.3 turns this from a nice touch into the backbone of support. With a
 * separate operator, every problem report starts with a user quoting this code,
 * and it has to lead straight to the log line, the Sentry event, and the
 * audit_logs row. One identifier, created once, carried everywhere.
 */
export function registerRequestContext(app: FastifyInstance): void {
  const config = loadConfig();
  const log = getLogger();

  app.decorateRequest("requestId", "");
  app.decorateRequest("actor", null);
  app.decorateRequest("clientIp", null);

  app.addHook("onRequest", (request: FastifyRequest, reply: FastifyReply, done) => {
    request.requestId = generateRequestId();
    request.actor = null;

    // Behind Caddy, the real client address arrives in X-Forwarded-For.
    const forwarded = request.headers["x-forwarded-for"];
    const forwardedFirst =
      typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : forwarded?.[0]?.trim();
    request.clientIp = forwardedFirst ?? request.ip ?? null;

    reply.header(REQUEST_ID_HEADER, request.requestId);
    // Lets the client detect a stale service worker and offer a reload
    // (PLAN/06 §5.1).
    reply.header(APP_VERSION_HEADER, config.APP_VERSION);
    done();
  });

  app.addHook("onResponse", (request: FastifyRequest, reply: FastifyReply, done) => {
    log.info(
      {
        requestId: request.requestId,
        method: request.method,
        route: request.routeOptions.url ?? request.url,
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        userId: request.actor?.id.toString() ?? null,
        role: request.actor?.role ?? null,
        ip: request.clientIp,
      },
      "request",
    );
    done();
  });
}
