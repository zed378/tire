import { PrismaClient } from "../generated/prisma/index.js";
import { loadConfig } from "./config.ts";
import { getLogger } from "./logger.ts";

/**
 * One Prisma client for the process.
 *
 * Transactions matter more here than usual. PLAN/04 §6.2 rule 1 requires the
 * audit entry to be written in the same transaction as the change it records —
 * not after the commit, not as an async job. A change that succeeds without a
 * trail is a bug. PLAN/12 §2.1 adds the outbox row to that same transaction, so
 * a notification about an event that rolled back becomes impossible.
 */

let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (client !== null) return client;

  const config = loadConfig();
  client = new PrismaClient({
    datasourceUrl: config.DATABASE_URL,
    log:
      config.LOG_LEVEL === "debug" || config.LOG_LEVEL === "trace"
        ? [{ emit: "event", level: "query" }]
        : [],
  });

  if (config.LOG_LEVEL === "debug" || config.LOG_LEVEL === "trace") {
    const log = getLogger();
    // @ts-expect-error Prisma's event typing depends on the log config above.
    client.$on("query", (event: { query: string; duration: number }) => {
      log.debug({ query: event.query, durationMs: event.duration }, "prisma query");
    });
  }

  return client;
}

/**
 * The transaction handle passed through the service layer.
 *
 * Services take this rather than reaching for the global client, so a caller can
 * compose several operations into one atomic unit — which is exactly what a
 * status change (update + qc_review + audit_log + outbox) has to be.
 */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(async (tx) => fn(tx), {
    // Long enough for a status change plus its audit and outbox rows; short
    // enough that a stuck transaction does not hold a row lock all afternoon.
    timeout: 15_000,
    maxWait: 5_000,
  });
}

export async function disconnectPrisma(): Promise<void> {
  if (client !== null) {
    await client.$disconnect();
    client = null;
  }
}
