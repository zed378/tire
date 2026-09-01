import {
  NOTIFICATION_TEMPLATES,
  renderTemplate,
  UNMUTABLE_EVENT_TYPES,
  type EventType,
  type NotificationChannel,
} from "@c26/contracts";
import { getPrisma, withTransaction, type Tx } from "../../kernel/db.ts";
import { getLogger } from "../../kernel/logger.ts";
import { JOB_NAMES, sendInTransaction } from "../../kernel/queue.ts";

/**
 * Reads the outbox and composes notifications (PLAN/12 §7).
 *
 * This is the second half of the transactional outbox. The first half — writing
 * the event inside the data transaction — is in `kernel/outbox.ts`. Together
 * they turn "might be lost, might be false" into "certainly sent, possibly
 * late", which is the right trade.
 *
 * Every row it produces is protected by `uq_notif`: one event, one recipient,
 * one channel, exactly once. A worker retried after a timeout re-inserts the
 * same row and the constraint refuses it, so nobody gets a duplicate.
 * Idempotency is enforced by the database, not by discipline in code.
 */

interface Recipient {
  userId: bigint;
  channels: NotificationChannel[];
}

/**
 * Who needs to know, per PLAN/12 §5.
 *
 * The events NOT on this list matter as much as the ones on it. Every photo
 * upload, every tire specification saved, every dashboard refresh — none of them
 * change anybody's next action, and notifying about them would train people to
 * ignore the ones that do.
 */
async function resolveRecipients(
  tx: Tx,
  eventType: EventType,
  payload: Record<string, unknown>,
): Promise<Recipient[]> {
  switch (eventType) {
    case "inspection.submitted":
    case "inspection.resubmitted": {
      const admins = await tx.user.findMany({
        where: { role: "admin", isActive: true, deletedAt: null },
        select: { id: true },
      });
      return admins.map((admin) => ({ userId: admin.id, channels: ["in_app"] }));
    }

    case "inspection.passed_qc":
    case "inspection.dropped_qc":
    case "inspection.needs_revision": {
      const inspection = await tx.inspection.findUnique({
        where: { id: BigInt(String(payload.inspectionId ?? "0")) },
        select: { submittedById: true },
      });
      if (inspection === null) return [];
      return [{ userId: inspection.submittedById, channels: ["in_app", "email"] }];
    }

    case "export.ready":
    case "export.failed":
    case "user.password_reset":
    case "user.login_from_new_device": {
      const userId = payload.userId ?? payload.requestedBy;
      if (userId === undefined || userId === null) return [];
      const channels: NotificationChannel[] =
        eventType.startsWith("export.") ? ["in_app"] : ["in_app", "email"];
      return [{ userId: BigInt(String(userId)), channels }];
    }

    case "job.repeatedly_failed":
    case "storage.threshold_exceeded": {
      const operators = await tx.user.findMany({
        where: { role: "operator", isActive: true, deletedAt: null },
        select: { id: true },
      });
      return operators.map((operator) => ({
        userId: operator.id,
        channels: ["in_app", "email"],
      }));
    }

    case "vehicle.duplicate_suspected": {
      const admins = await tx.user.findMany({
        where: { role: "admin", isActive: true, deletedAt: null },
        select: { id: true },
      });
      return admins.map((admin) => ({ userId: admin.id, channels: ["in_app"] }));
    }
  }
}

function linkFor(eventType: EventType, payload: Record<string, unknown>): string | null {
  if (eventType.startsWith("inspection.")) {
    const serialNumber = payload.serialNumber;
    return typeof serialNumber === "string" ? `/inspections/${serialNumber}` : null;
  }
  if (eventType.startsWith("export.")) return "/reports/exports";
  if (eventType === "vehicle.duplicate_suspected") return "/master-data/vehicle-reviews";
  if (eventType.startsWith("job.") || eventType.startsWith("storage.")) return "/ops";
  return null;
}

/**
 * Whether a recipient has switched this channel off.
 *
 * In-app can never be off. Three event types can never be off on any channel;
 * `inspection.needs_revision` is among them because it is the only notification
 * that demands an action — silencing it would bring D-11 back in a new form,
 * with inspections hanging forever because nobody knew they needed fixing.
 */
async function isEnabled(
  tx: Tx,
  userId: bigint,
  eventType: EventType,
  channel: NotificationChannel,
): Promise<boolean> {
  if (channel === "in_app") return true;
  if (UNMUTABLE_EVENT_TYPES.includes(eventType)) return true;

  const preference = await tx.notificationPreference.findUnique({
    where: { userId_eventType_channel: { userId, eventType, channel } },
  });
  return preference?.enabled ?? true;
}

export async function dispatchOutbox(batchSize = 100): Promise<{ processed: number; created: number }> {
  const log = getLogger();

  const pending = await getPrisma().outbox.findMany({
    where: { processedAt: null },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let created = 0;

  for (const event of pending) {
    const eventType = event.eventType as EventType;
    const template = NOTIFICATION_TEMPLATES[eventType];

    if (template === undefined) {
      // An unknown event type is a bug, but stalling the outbox behind it would
      // silence every later notification too. Mark it, log it, move on.
      log.error({ eventType, outboxId: event.id.toString() }, "unknown outbox event type");
      await getPrisma().outbox.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
      continue;
    }

    await withTransaction(async (tx) => {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const recipients = await resolveRecipients(tx, eventType, payload);
      const values = payload as Record<string, string | number>;

      for (const recipient of recipients) {
        for (const channel of recipient.channels) {
          if (!(await isEnabled(tx, recipient.userId, eventType, channel))) continue;

          const notification = await tx.notification
            .create({
              data: {
                outboxId: event.id,
                recipientId: recipient.userId,
                channel,
                eventType,
                title: renderTemplate(template.title, values),
                body: renderTemplate(template.body, values),
                link: linkFor(eventType, payload),
                payload: payload as never,
              },
              select: { id: true },
            })
            // uq_notif refusing the insert IS the idempotency working. It means
            // this event/recipient/channel was already produced by an earlier
            // attempt, so there is nothing to do.
            .catch(() => null);

          if (notification === null) continue;
          created++;

          if (channel !== "in_app") {
            await sendInTransaction(tx, JOB_NAMES.notificationSend, {
              notificationId: notification.id.toString(),
              requestId: event.requestId,
            });
          }
        }
      }

      await tx.outbox.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    });
  }

  return { processed: pending.length, created };
}
