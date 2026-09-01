import { existsSync } from "node:fs";
import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { loadConfig } from "../config.ts";
import { getLogger } from "../logger.ts";

/**
 * Serves the built SPA, a job a reverse proxy used to do.
 *
 * With Cloudflare Tunnel pointing straight at this process there is no proxy in
 * front, so Fastify serves the static build. The `index.html` fallback for
 * client-side routes lives in the single not-found handler in `app.ts` — Fastify
 * allows only one, and putting the decision in two places is how a mistyped API
 * path ends up returning a blank HTML page instead of a JSON 404.
 *
 * Registered only when `WEB_DIST_DIR` points at a directory that exists. In
 * local development it is empty: Vite serves the client on :5173 and proxies
 * /api here.
 *
 * Returns whether static serving is active, so the not-found handler knows
 * whether an `index.html` fallback is even possible.
 */
export function registerStaticSpa(app: FastifyInstance): boolean {
  const config = loadConfig();
  const log = getLogger();

  if (config.WEB_DIST_DIR === "") return false;

  const root = resolve(config.WEB_DIST_DIR);
  if (!existsSync(root)) {
    // Loud, because the alternative is an application that answers 404 for its
    // own home page and gives no hint why.
    log.error({ root }, "WEB_DIST_DIR is set but does not exist — the SPA will not be served");
    return false;
  }

  void app.register(fastifyStatic, {
    root,
    // Every unmatched path is a client route, so this plugin must not own the
    // wildcard; the not-found handler does.
    wildcard: false,
    index: ["index.html"],
    // The plugin's default is `public, max-age=0`, which leaves fingerprinted
    // assets uncached — a re-download of the whole bundle on every visit, over
    // the 4G connections PLAN/06 §7 budgets for.
    //
    // Switched off here, and the policy applied in the `onSend` hook in app.ts
    // instead: that is one place, it covers the index.html fallback as well as
    // the files on disk, and it uses `cacheControlFor`, which has tests.
    cacheControl: false,
  });

  log.info({ root }, "serving the built SPA");
  return true;
}
