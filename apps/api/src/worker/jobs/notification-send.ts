import { getPrisma } from "../../kernel/db.ts";
import { getLogger } from "../../kernel/logger.ts";
import { buildSenders } from "../../kernel/notifications/senders.ts";
import {
  secondsUntilSendingWindow,
  shouldDeferUntilMorning,
} from "../../kernel/notifications/sender.ts";

/**
 * Delivers one notification through its channel (PLAN/12 §6, §7).
 *
 * The `retryable` flag on the sender's result decides everything here. Without
 * it, an invalid email address is retried five times, parked in the dead letter
 * queue, and eventually handed to an operator to investigate — work that was
 * never going to succeed.
 */
export async function sendNotification(notificationId: bigint): Promise<{ status: string }> {
  const prisma = getPrisma();
  const log = getLogger();

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      recipient: {
        select: { displayName: true, email: true, phone: true, isActive: true, deletedAt: true },
      },
    },
  });

  if (notification === null) return { status: "missing" };
  if (notification.status === "sent") return { status: "sent" };

  // A deactivated recipient is suppressed, not retried. Nothing about this
  // situation improves by trying again.
  if (!notification.recipient.isActive || notification.recipient.deletedAt !== null) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "suppressed", lastError: "recipient is inactive" },
    });
    return { status: "suppressed" };
  }

  // Quiet hours (PLAN/12 §5.1). Without them, a storage outage sends an operator
  // hundreds of emails in minutes — and they switch notifications off, right
  // before the one that matters arrives. Password resets and security alerts are
  // exempt and go out immediately.
  if (shouldDeferUntilMorning(notification.eventType)) {
    const delaySeconds = secondsUntilSendingWindow();
    log.info(
      { notificationId: notificationId.toString(), delaySeconds },
      "deferring notification until sending hours",
    );
    throw Object.assign(new Error("outside sending hours"), { retryAfterSeconds: delaySeconds });
  }

  const sender = buildSenders().get(notification.channel);
  if (sender === undefined) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "failed", lastError: `no sender for channel ${notification.channel}` },
    });
    return { status: "failed" };
  }

  const result = await sender.send({
    id: notification.id,
    recipientId: notification.recipientId,
    recipientName: notification.recipient.displayName,
    recipientEmail: notification.recipient.email,
    recipientPhone: notification.recipient.phone,
    channel: notification.channel,
    eventType: notification.eventType,
    title: notification.title,
    body: notification.body,
    link: notification.link,
  });

  if (result.ok) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 } },
    });
    return { status: "sent" };
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: result.retryable ? "pending" : "failed",
      lastError: result.error,
      attempts: { increment: 1 },
    },
  });

  // Only a retryable failure is thrown, so only that one is retried by pg-boss.
  if (result.retryable) throw new Error(result.error);

  log.warn(
    { notificationId: notificationId.toString(), error: result.error },
    "notification failed permanently",
  );
  return { status: "failed" };
}
