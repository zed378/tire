import { loadEnvFile } from "./kernel/load-env.ts";

// Must run before anything reads process.env.
loadEnvFile();

import { buildApp } from "./app.ts";
import { loadConfig } from "./kernel/config.ts";
import { disconnectPrisma } from "./kernel/db.ts";
import { getLogger } from "./kernel/logger.ts";

/**
 * The web process. The worker runs from `worker.ts` in a separate container
 * built from the same image (PLAN/01 §5): an Excel export over tens of thousands
 * of rows must never share an event loop with a field worker's upload.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const log = getLogger();
  const app = buildApp();

  await app.listen({ host: config.API_HOST, port: config.API_PORT });
  log.info({ port: config.API_PORT, env: config.APP_ENV }, "api listening");

  const shutdown = (signal: string): void => {
    log.info({ signal }, "shutting down");
    void app
      .close()
      .then(() => disconnectPrisma())
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        log.error({ err: error }, "shutdown failed");
        process.exit(1);
      });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  // Failing to start is the right response to a missing secret: a server that
  // boots without storage credentials works fine until the first upload, hours
  // later, in the field.
  process.stderr.write(`api failed to start: ${String(error)}\n`);
  process.exit(1);
});
