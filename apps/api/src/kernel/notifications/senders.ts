import { loadConfig } from "../config.ts";
import { getLogger } from "../logger.ts";
import type { NotificationSender, OutgoingNotification, SendResult } from "./sender.ts";

/**
 * Channel implementations (PLAN/12 §4.1).
 *
 * In-app first, and not merely as a saving. The in-app channel keeps the whole
 * notification history inside this system, can be tested automatically, and
 * never fails for a reason outside our control. Email and WhatsApp extend the
 * reach on top of that base; they do not replace it. A notification delivered
 * only by email that fails to send is a notification that never existed.
 */

/**
 * In-app delivery is a no-op: the row in `notifications` IS the delivery. The
 * user's inbox reads that table.
 */
export const inAppSender: NotificationSender = {
  channel: "in_app",
  send(): Promise<SendResult> {
    return Promise.resolve({ ok: true });
  },
};

function classifyEmailFailure(status: number): { retryable: boolean } {
  // 4xx other than 408/429 will not succeed on a retry: a malformed address
  // stays malformed. Retrying it five times only wastes the operator's attention
  // later (PLAN/12 §6).
  if (status === 408 || status === 429) return { retryable: true };
  if (status >= 400 && status < 500) return { retryable: false };
  return { retryable: true };
}

export const consoleEmailSender: NotificationSender = {
  channel: "email",
  send(notification: OutgoingNotification): Promise<SendResult> {
    // Local and staging default. Writes what would be sent so a developer can
    // read it, without depending on a third party to exercise the flow.
    getLogger().info(
      {
        to: notification.recipientEmail,
        subject: notification.title,
        eventType: notification.eventType,
      },
      "email (console transport)",
    );
    return Promise.resolve({ ok: true, externalId: `console-${notification.id.toString()}` });
  },
};

export const resendEmailSender: NotificationSender = {
  channel: "email",
  async send(notification: OutgoingNotification): Promise<SendResult> {
    const config = loadConfig();

    if (notification.recipientEmail === null || notification.recipientEmail === "") {
      // Not retryable, and not an error either: the user simply has no address.
      // The worker marks it `suppressed`.
      return { ok: false, retryable: false, error: "recipient has no email address" };
    }
    if (config.RESEND_API_KEY === undefined || config.RESEND_API_KEY === "") {
      return { ok: false, retryable: false, error: "RESEND_API_KEY is not configured" };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.EMAIL_FROM,
          to: [notification.recipientEmail],
          subject: notification.title,
          text: notification.link === null ? notification.body : `${notification.body}\n\n${notification.link}`,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const detail = await response.text();
        return {
          ok: false,
          ...classifyEmailFailure(response.status),
          error: `resend responded ${response.status}: ${detail.slice(0, 200)}`,
        };
      }

      const body = (await response.json()) as { id?: string };
      return { ok: true, externalId: body.id };
    } catch (error) {
      // A timeout or a DNS failure is worth retrying.
      return {
        ok: false,
        retryable: true,
        error: error instanceof Error ? error.message : "unknown email transport failure",
      };
    }
  },
};

/**
 * WhatsApp is deliberately not implemented (PLAN/12 §4.2, decision N-04).
 *
 * It sits behind this interface so that adding it later touches no domain code,
 * but building it now would mean the Business API through an official provider,
 * Meta template approval, per-conversation billing, and phone numbers as
 * personal data — none of which is ready. Failing loudly and not-retryably is
 * better than a queue that silently accumulates work nobody can deliver.
 */
export const unavailableWhatsappSender: NotificationSender = {
  channel: "whatsapp",
  send(): Promise<SendResult> {
    return Promise.resolve({
      ok: false,
      retryable: false,
      error: "WhatsApp channel is not enabled (PLAN/12 §4.2, scheduled for F7+)",
    });
  },
};

export function buildSenders(): Map<string, NotificationSender> {
  const config = loadConfig();
  const email = config.EMAIL_PROVIDER === "resend" ? resendEmailSender : consoleEmailSender;

  return new Map<string, NotificationSender>([
    ["in_app", inAppSender],
    ["email", email],
    ["whatsapp", unavailableWhatsappSender],
  ]);
}
