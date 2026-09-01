/**
 * Rate limits (PLAN/13 §6).
 *
 * PLAN/04 limits login; the rest of these endpoints matter just as much.
 *
 * The one easiest to overlook is `vehicles/search`. That endpoint (PLAN/11 §6)
 * turns the system into a tool that answers "is plate X registered?" — and
 * without a limit, a customer's entire fleet can be mapped from outside.
 */

export interface RateLimitRule {
  max: number;
  timeWindow: string;
}

export const RATE_LIMITS = {
  /** Per account. The IP-level limit is applied separately in the auth module. */
  login: { max: 5, timeWindow: "15 minutes" },
  loginPerIp: { max: 20, timeWindow: "15 minutes" },
  mfaVerify: { max: 5, timeWindow: "15 minutes" },
  passwordReset: { max: 3, timeWindow: "1 hour" },
  vehicleSearch: { max: 60, timeWindow: "1 minute" },
  presign: { max: 100, timeWindow: "1 minute" },
  /** Global safety net across every endpoint. */
  global: { max: 300, timeWindow: "1 minute" },
} as const satisfies Record<string, RateLimitRule>;
