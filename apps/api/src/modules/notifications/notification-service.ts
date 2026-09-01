import {
  EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  UNMUTABLE_EVENT_TYPES,
  type EventType,
  type NotificationListQuery,
  type NotificationPreference,
  type NotificationRecord,
  type Paginated,
  type UpdatePreferencesInput,
} from "@c26/contracts";
import type { Actor } from "../../kernel/authorization.ts";
import { getPrisma } from "../../kernel/db.ts";

/**
 * Notification inbox and preferences (PLAN/12 §8).
 *
 * In-app is an archive, not an interruption, so it can never be switched off.
 * Three event types cannot be muted on any channel; `inspection.needs_revision`
 * is on that list because it is the only notification that DEMANDS an action
 * from the supplier. If it could be silenced, D-11 returns in a new form:
 * an inspection hanging forever because nobody knew it needed fixing.
 */

export async function listNotifications(
  actor: Actor,
  query: NotificationListQuery,
): Promise<Paginated<NotificationRecord>> {
  const prisma = getPrisma();

  const where = {
    recipientId: actor.id,
    channel: "in_app" as const,
    ...(query.unreadOnly ? { readAt: null } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    items: items.map((notification) => ({
      id: Number(notification.id),
      eventType: notification.eventType as EventType,
      channel: notification.channel,
      status: notification.status,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    })),
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

export async function markRead(actor: Actor, ids: number[]): Promise<{ marked: number }> {
  const result = await getPrisma().notification.updateMany({
    // Scoped to the recipient: an id belonging to someone else matches nothing.
    where: { id: { in: ids.map((id) => BigInt(id)) }, recipientId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { marked: result.count };
}

export async function markAllRead(actor: Actor): Promise<{ marked: number }> {
  const result = await getPrisma().notification.updateMany({
    where: { recipientId: actor.id, channel: "in_app", readAt: null },
    data: { readAt: new Date() },
  });
  return { marked: result.count };
}

/** Which events a role is offered at all. Noise gets the important ones ignored. */
const EVENTS_BY_ROLE: Record<Actor["role"], readonly EventType[]> = {
  supplier: [
    "inspection.passed_qc",
    "inspection.dropped_qc",
    "inspection.needs_revision",
    "export.ready",
    "export.failed",
    "user.password_reset",
    "user.login_from_new_device",
  ],
  admin: [
    "inspection.submitted",
    "inspection.resubmitted",
    "export.ready",
    "export.failed",
    "user.password_reset",
    "user.login_from_new_device",
    "vehicle.duplicate_suspected",
  ],
  manager: ["export.ready", "export.failed", "user.password_reset", "user.login_from_new_device"],
  operator: [
    "job.repeatedly_failed",
    "storage.threshold_exceeded",
    "export.ready",
    "export.failed",
    "user.password_reset",
    "user.login_from_new_device",
  ],
};

export async function getPreferences(actor: Actor): Promise<NotificationPreference[]> {
  const stored = await getPrisma().notificationPreference.findMany({
    where: { userId: actor.id },
  });

  const storedMap = new Map(
    stored.map((preference) => [`${preference.eventType}|${preference.channel}`, preference.enabled]),
  );

  const relevant = EVENTS_BY_ROLE[actor.role];
  const preferences: NotificationPreference[] = [];

  for (const eventType of EVENT_TYPES) {
    if (!relevant.includes(eventType)) continue;

    for (const channel of NOTIFICATION_CHANNELS) {
      // Not built yet, and deliberately so (PLAN/12 §4.2). Offering a toggle for
      // a channel that cannot deliver would be worse than not offering it.
      if (channel === "whatsapp") continue;

      const unmutable = channel === "in_app" || UNMUTABLE_EVENT_TYPES.includes(eventType);

      preferences.push({
        eventType,
        channel,
        enabled: unmutable ? true : (storedMap.get(`${eventType}|${channel}`) ?? true),
        locked: unmutable,
        lockedReason:
          channel === "in_app"
            ? "Notifikasi dalam aplikasi adalah arsip, bukan gangguan, sehingga tidak dapat dimatikan."
            : UNMUTABLE_EVENT_TYPES.includes(eventType)
              ? "Notifikasi ini menuntut tindakan Anda dan tidak dapat dimatikan."
              : null,
      });
    }
  }

  return preferences;
}

export async function updatePreferences(
  actor: Actor,
  input: UpdatePreferencesInput,
): Promise<{ updated: number }> {
  const prisma = getPrisma();
  let updated = 0;

  for (const preference of input.preferences) {
    // Silently ignoring a locked toggle would be worse than refusing it; the
    // client never renders one, and a request that carries one is skipped.
    if (preference.channel === "in_app") continue;
    if (UNMUTABLE_EVENT_TYPES.includes(preference.eventType)) continue;

    await prisma.notificationPreference.upsert({
      where: {
        userId_eventType_channel: {
          userId: actor.id,
          eventType: preference.eventType,
          channel: preference.channel,
        },
      },
      create: {
        userId: actor.id,
        eventType: preference.eventType,
        channel: preference.channel,
        enabled: preference.enabled,
      },
      update: { enabled: preference.enabled },
    });
    updated++;
  }

  return { updated };
}
