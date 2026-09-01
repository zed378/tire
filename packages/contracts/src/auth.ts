import { z } from "zod";
import { MIN_PASSWORD_LENGTH, type UserRole } from "./constants.ts";

/**
 * Authentication (PLAN/04 §4, hardened by PLAN/13).
 *
 * The session mechanism is an opaque server session, not a JWT. PLAN/13 §1.1
 * settles the contradiction between PLAN/01 and PLAN/04 in favour of the one
 * property that actually defines "hardened": a session can be revoked the
 * instant a role is downgraded. PLAN/04 §5 already required that, and a JWT
 * cannot deliver it.
 */

export const loginSchema = z.object({
  username: z
    .string({ required_error: "User ID wajib diisi." })
    .trim()
    .min(1, "User ID wajib diisi.")
    .max(64),
  password: z.string({ required_error: "Password wajib diisi." }).min(1, "Password wajib diisi."),
  /** Present on the second step when the account has MFA enrolled. */
  totpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Kode autentikasi terdiri dari 6 angka.")
    .optional(),
  recoveryCode: z.string().trim().min(8).max(64).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * PLAN/04 §4.1: length beats composition. No symbol requirements, no forced
 * rotation — mandatory rotation is what produces `Password1`, `Password2`.
 * The common-password list and the Have I Been Pwned check run on the server,
 * where the wordlist lives.
 */
export const passwordSchema = z
  .string({ required_error: "Password wajib diisi." })
  .min(MIN_PASSWORD_LENGTH, `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`)
  .max(200, "Password maksimal 200 karakter.");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Konfirmasi password tidak sama.",
      });
    }
    if (value.newPassword === value.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "Password baru tidak boleh sama dengan password saat ini.",
      });
    }
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── MFA (PLAN/13 §3) ────────────────────────────────────────────────────────

export const totpCodeSchema = z.object({
  code: z
    .string({ required_error: "Kode autentikasi wajib diisi." })
    .trim()
    .regex(/^\d{6}$/, "Kode autentikasi terdiri dari 6 angka."),
});

export type TotpCodeInput = z.infer<typeof totpCodeSchema>;

export interface MfaEnrollmentStart {
  /** otpauth:// URI for the QR code. Never logged, never persisted client-side. */
  otpauthUri: string;
  secretForManualEntry: string;
}

export interface MfaEnrollmentResult {
  /** Shown exactly once, at enrolment. PLAN/13 §3.3. */
  recoveryCodes: string[];
}

// ── Session state ───────────────────────────────────────────────────────────

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
  mfaEnrolled: boolean;
  /** True when the role requires MFA and none is enrolled yet: enrol before anything else. */
  mfaEnrollmentRequired: boolean;
  /** Permission keys, so the client hides what it must and the server enforces it anyway. */
  permissions: string[];
  regions: { provinceId: number | null; cityId: number | null; name: string }[];
  unreadNotifications: number;
}

export interface LoginResult {
  /** `mfa_required` means the credentials were right and a TOTP code is next. */
  status: "authenticated" | "mfa_required" | "mfa_enrollment_required" | "must_change_password";
  user: CurrentUser | null;
}

export interface SessionSummary {
  id: string;
  deviceLabel: string;
  ipAddress: string | null;
  approximateLocation: string | null;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}
