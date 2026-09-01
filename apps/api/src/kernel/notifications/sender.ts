import type { NotificationChannel } from "@c26/contracts";

/**
 * One sender interface, several implementations (PLAN/12 §6).
 *
 * Domain code never learns which channel was used. That is what allows WhatsApp
 * to arrive in F7 without touching a single line of business logic — and
 * WhatsApp is the channel most likely to be wanted and most easily mis-planned:
 * it needs the Business API through an official provider, pre-approved templates
 * for anything outside the 24-hour window, per-conversation billing, and a phone
 * number that becomes personal data to protect.
 */

export interface OutgoingNotification {
  id: bigint;
  recipientId: bigint;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  channel: NotificationChannel;
  eventType: string;
  title: string;
  body: string;
  link: string | null;
}

/**
 * `retryable` is the field that decides everything downstream.
 *
 * Without it a worker retries an invalid email address five times, parks it in
 * the dead letter queue, and hands the operator something to investigate that
 * was never going to succeed.
 */
export type SendResult =
  | { ok: true; externalId?: string }
  | { ok: false; retryable: boolean; error: string };

export interface NotificationSender {
  readonly channel: NotificationChannel;
  send(notification: OutgoingNotification): Promise<SendResult>;
}

/**
 * Quiet hours (PLAN/12 §5.1).
 *
 * Without damping, a storage outage sends the operator hundreds of emails in
 * minutes — and they switch notifications off, right before the one that
 * matters. In-app is never damped: it is cheap and it does not interrupt.
 */
export const QUIET_HOURS = { startHourWib: 7, endHourWib: 20 } as const;

const WIB_OFFSET_HOURS = 7;

export function isWithinSendingHours(now: Date = new Date()): boolean {
  const wibHour = (now.getUTCHours() + WIB_OFFSET_HOURS) % 24;
  return wibHour >= QUIET_HOURS.startHourWib && wibHour < QUIET_HOURS.endHourWib;
}

/** Events that ignore quiet hours entirely (PLAN/12 §5.1). */
const ALWAYS_IMMEDIATE = new Set(["user.password_reset", "user.login_from_new_device"]);

export function shouldDeferUntilMorning(eventType: string, now: Date = new Date()): boolean {
  if (ALWAYS_IMMEDIATE.has(eventType)) return false;
  return !isWithinSendingHours(now);
}

/** Seconds until 07:00 WIB, used to schedule a deferred send. */
export function secondsUntilSendingWindow(now: Date = new Date()): number {
  const target = new Date(now);
  target.setUTCHours(QUIET_HOURS.startHourWib - WIB_OFFSET_HOURS, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return Math.ceil((target.getTime() - now.getTime()) / 1000);
}
