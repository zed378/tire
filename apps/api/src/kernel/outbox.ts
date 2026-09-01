import type { EventType } from "@c26/contracts";
import type { Prisma } from "../generated/prisma/index.js";
import type { Tx } from "./db.ts";

/**
 * The transactional outbox (PLAN/12 §2.1).
 *
 * The naive shape this replaces:
 *
 *   await db.inspection.update({ ... status: 'passed_qc' });
 *   await sendEmail(supplier.email, "Pemeriksaan Anda lolos QC");
 *
 * which fails two ways, both of which happen in real systems. If the commit
 * succeeds and the send throws, the status changed and the supplier was never
 * told — D-08 wearing different clothes. If the send succeeds and the
 * transaction rolls back, someone was notified about something that did not
 * happen, and that one cannot be undone by any amount of retrying, logging, or
 * monitoring. The only fix is structural.
 *
 * Writing the event row inside the same transaction trades "might be lost, might
 * be false" for "certainly sent, possibly late" — the right trade.
 *
 * This is also the real reason pg-boss was chosen over Redis in PLAN/01: it runs
 * on the same PostgreSQL, so enqueueing can join the data transaction.
 */

export interface OutboxActor {
  id: bigint | null;
  requestId: string;
}

export async function publishEvent(
  tx: Tx,
  actor: OutboxActor,
  event: {
    type: EventType;
    aggregateId: bigint | number;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await tx.outbox.create({
    data: {
      eventType: event.type,
      aggregateId: BigInt(event.aggregateId),
      // BigInt ids are common in these payloads and are not JSON-serialisable.
      payload: JSON.parse(
        JSON.stringify(event.payload, (_key, value: unknown) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      ) as Prisma.InputJsonValue,
      actorId: actor.id,
      requestId: actor.requestId,
    },
  });
}
