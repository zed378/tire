import {
  ACCOUNT_LOCK_MINUTES,
  LOGIN_ATTEMPT_LIMIT,
  LOGIN_ATTEMPT_WINDOW_MINUTES,
  ROLES_REQUIRING_MFA,
  permissionsFor,
  type ChangePasswordInput,
  type CurrentUser,
  type LoginInput,
  type LoginResult,
  type RegisterInput,
  type SessionSummary,
} from "@c26/contracts";
import { recordAudit } from "../../kernel/audit.ts";
import { getPrisma, withTransaction, type Tx } from "../../kernel/db.ts";
import { AppError } from "../../kernel/envelope/index.ts";
import { publishEvent } from "../../kernel/outbox.ts";
import {
  assertPasswordPolicy,
  hashPassword,
  isPasswordBreached,
  safeEqual,
  verifyPassword,
} from "../../kernel/security/password.ts";
import {
  decryptSecret,
  normalizeRecoveryCode,
  verifyTotp,
} from "../../kernel/security/totp.ts";
import { verify as verifyArgon } from "@node-rs/argon2";
import { createSession, revokeAllSessions, type CreatedSession } from "./session-service.ts";

/**
 * Authentication (PLAN/04 §4, PLAN/13 §3).
 *
 * The demo login panel is gone and cannot come back: D-16 put three buttons on
 * the login page that authenticated as Supplier, Admin, or PM/SPV with no
 * credentials at all. Gate G-10 greps for it, so its absence is checked rather
 * than remembered.
 */

export interface LoginContext {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | undefined;
}

/**
 * One failure message for every cause.
 *
 * Unknown username, wrong password, deactivated account — all answer identically
 * (PLAN/04 §4.3). Distinguishing them tells an attacker which usernames exist.
 */
function invalidCredentials(): AppError {
  return new AppError("INVALID_CREDENTIALS");
}

// ── Registration ───────────────────────────────────────────────────────────────

/**
 * Public self-registration: new users start with 'authenticated' role.
 * Admin later changes the role to 'supplier', 'admin', 'manager', or 'operator'.
 */
export interface RegisterOutcome {
  result: { status: "registered"; user: CurrentUser };
  session: CreatedSession;
}

export async function register(input: RegisterInput, context: LoginContext): Promise<RegisterOutcome> {
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();

  // Check for duplicate username (case-insensitive)
  const existing = await getPrisma().user.findFirst({
    where: { username, deletedAt: null },
  });

  if (existing !== null) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        { field: "username", code: "NOT_ALLOWED", message: "User ID ini sudah terdaftar." },
      ],
    });
  }

  // Validate password policy
  assertPasswordPolicy(input.password);

  // Check against breached password list
  if (await isPasswordBreached(input.password)) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          field: "password",
          code: "PASSWORD_TOO_COMMON",
          message: "Password ini pernah bocor dalam kebocoran data publik. Pilih yang lain.",
        },
      ],
    });
  }

  const passwordHash = await hashPassword(input.password);

  const outcome = await withTransaction(async (tx) => {
    // Create user with 'supplier' role initially. Admin can change role later.
    const user = await tx.user.create({
      data: {
        username,
        displayName,
        passwordHash,
        role: "supplier",
        isActive: true,
        mustChangePassword: false,
      },
      include: { mfa: true, regions: true },
    });

    // Create session immediately (login on register)
    const session = await createSession(tx, {
      userId: user.id,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      mfaSatisfied: false,
    });

    // Audit log
    await recordAudit(
      tx,
      { id: user.id, role: user.role, requestId: context.requestId, ipAddress: context.ipAddress },
      {
        action: "user.created",
        entity: "user",
        entityId: user.id,
        after: { role: "supplier", source: "self_registration" },
      },
    );

    return { user, session };
  });

  const mfaEnrolled = outcome.user.mfa !== null && outcome.user.mfa.confirmedAt !== null;
  const mfaRequired = ROLES_REQUIRING_MFA.includes(outcome.user.role);

  return {
    result: {
      status: "registered",
      user: toCurrentUser(outcome.user, mfaEnrolled, mfaRequired),
    },
    session: outcome.session,
  };
}

// ── Login ──────────────────────────────────────────────────────────────────────

async function isAccountLocked(username: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_ATTEMPT_WINDOW_MINUTES * 60 * 1000);
  const failures = await getPrisma().loginAttempt.count({
    where: { username, succeeded: false, createdAt: { gte: since } },
  });
  return failures >= LOGIN_ATTEMPT_LIMIT;
}

async function recordAttempt(
  username: string,
  ipAddress: string | null,
  succeeded: boolean,
  failureReason: string | null,
): Promise<void> {
  await getPrisma().loginAttempt.create({
    data: { username, ipAddress, succeeded, failureReason },
  });
}

export interface LoginOutcome {
  result: LoginResult;
  session: CreatedSession | null;
}

export async function login(input: LoginInput, context: LoginContext): Promise<LoginOutcome> {
  const username = input.username.trim();

  if (await isAccountLocked(username)) {
    await recordAttempt(username, context.ipAddress, false, "locked");
    throw new AppError("ACCOUNT_LOCKED", {
      message: `Akun terkunci sementara karena terlalu banyak percobaan masuk yang gagal. Coba lagi dalam ${ACCOUNT_LOCK_MINUTES} menit.`,
    });
  }

  const user = await getPrisma().user.findFirst({
    where: { username, deletedAt: null },
    include: { mfa: true, regions: true },
  });

  // The password is verified even when the user does not exist would be ideal
  // for timing symmetry, but Argon2id at these parameters costs ~50ms and a
  // rate limit of 5 per 15 minutes already bounds the oracle. Failing fast here
  // is the honest trade.
  if (user === null || !user.isActive) {
    await recordAttempt(username, context.ipAddress, false, user === null ? "unknown" : "inactive");
    throw invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    await recordAttempt(username, context.ipAddress, false, "bad_password");
    throw invalidCredentials();
  }

  const mfaEnrolled = user.mfa !== null && user.mfa.confirmedAt !== null;
  const mfaRequired = ROLES_REQUIRING_MFA.includes(user.role);

  // A role that requires MFA cannot finish a login without enrolling first
  // (PLAN/13 §3.1).
  if (mfaRequired && !mfaEnrolled) {
    await recordAttempt(username, context.ipAddress, true, null);
    const session = await withTransaction(async (tx) =>
      createSession(tx, {
        userId: user.id,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        mfaSatisfied: false,
      }),
    );
    return { result: { status: "mfa_enrollment_required", user: null }, session };
  }

  if (mfaEnrolled) {
    const verified = await verifySecondFactor(user.id, input);
    if (!verified.ok) {
      await recordAttempt(username, context.ipAddress, false, "bad_mfa");
      if (verified.missing) return { result: { status: "mfa_required", user: null }, session: null };
      throw new AppError("INVALID_CREDENTIALS", {
        message: "Kode autentikasi tidak valid atau sudah dipakai.",
      });
    }
  }

  const outcome = await withTransaction(async (tx) => {
    const session = await createSession(tx, {
      userId: user.id,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      mfaSatisfied: mfaEnrolled,
    });

    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await recordAudit(
      tx,
      { id: user.id, role: user.role, requestId: context.requestId, ipAddress: context.ipAddress },
      {
        action: "auth.login_succeeded",
        entity: "user",
        entityId: user.id,
        after: { deviceLabel: session.deviceLabel, mfaSatisfied: mfaEnrolled },
      },
    );

    // PLAN/13 §5: the cheapest defence against leaked credentials is the user
    // themselves noticing. This email cannot be switched off.
    if (session.isNewDevice) {
      await publishEvent(
        tx,
        { id: user.id, requestId: context.requestId },
        {
          type: "user.login_from_new_device",
          aggregateId: user.id,
          payload: {
            userId: user.id.toString(),
            deviceLabel: session.deviceLabel,
            location: context.ipAddress ?? "tidak diketahui",
          },
        },
      );
    }

    return session;
  });

  await recordAttempt(username, context.ipAddress, true, null);

  return {
    result: {
      status: user.mustChangePassword ? "must_change_password" : "authenticated",
      user: toCurrentUser(user, mfaEnrolled, mfaRequired),
    },
    session: outcome,
  };
}

interface SecondFactorResult {
  ok: boolean;
  /** True when no code was supplied at all: prompt, do not penalise. */
  missing: boolean;
}

async function verifySecondFactor(
  userId: bigint,
  input: LoginInput,
): Promise<SecondFactorResult> {
  if (input.recoveryCode !== undefined && input.recoveryCode !== "") {
    return { ok: await consumeRecoveryCode(userId, input.recoveryCode), missing: false };
  }
  if (input.totpCode === undefined || input.totpCode === "") {
    return { ok: false, missing: true };
  }
  return { ok: await verifyTotpForUser(userId, input.totpCode), missing: false };
}

export async function verifyTotpForUser(userId: bigint, code: string): Promise<boolean> {
  const prisma = getPrisma();
  const mfa = await prisma.userMfa.findUnique({ where: { userId } });
  if (mfa === null) return false;

  // Anti-replay: a code already used inside its tolerance window is refused
  // (PLAN/13 §3.3).
  const alreadyUsed = await prisma.mfaUsedCode.findUnique({
    where: { userId_code: { userId, code } },
  });
  if (alreadyUsed !== null) return false;

  if (!verifyTotp(decryptSecret(Buffer.from(mfa.secretEnc)), code)) return false;

  await prisma.mfaUsedCode.create({ data: { userId, code } });
  return true;
}

async function consumeRecoveryCode(userId: bigint, supplied: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(supplied);
  const candidates = await getPrisma().mfaRecoveryCode.findMany({
    where: { userId, usedAt: null },
  });

  for (const candidate of candidates) {
    try {
      if (await verifyArgon(candidate.codeHash, normalized)) {
        await getPrisma().mfaRecoveryCode.update({
          where: { id: candidate.id },
          data: { usedAt: new Date() },
        });
        return true;
      }
    } catch {
      // A malformed stored hash is not a reason to fail the whole check.
      continue;
    }
  }
  return false;
}

export function toCurrentUser(
  user: {
    id: bigint;
    username: string;
    displayName: string;
    role: CurrentUser["role"];
    mustChangePassword: boolean;
    regions: { provinceId: bigint | null; cityId: bigint | null }[];
  },
  mfaEnrolled: boolean,
  mfaRequired: boolean,
  unreadNotifications = 0,
): CurrentUser {
  return {
    id: Number(user.id),
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    mfaEnrolled,
    mfaEnrollmentRequired: mfaRequired && !mfaEnrolled,
    permissions: [...permissionsFor(user.role)],
    regions: user.regions.map((region) => ({
      provinceId: region.provinceId === null ? null : Number(region.provinceId),
      cityId: region.cityId === null ? null : Number(region.cityId),
      name: "",
    })),
    unreadNotifications,
  };
}

export async function changePassword(
  actorId: bigint,
  sessionId: string,
  input: ChangePasswordInput,
  context: { requestId: string; ipAddress: string | null },
): Promise<void> {
  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actorId } });

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        { field: "currentPassword", code: "NOT_ALLOWED", message: "Password saat ini salah." },
      ],
    });
  }

  assertPasswordPolicy(input.newPassword);

  if (await isPasswordBreached(input.newPassword)) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          field: "newPassword",
          code: "PASSWORD_TOO_COMMON",
          message: "Password ini pernah bocor dalam kebocoran data publik. Pilih yang lain.",
        },
      ],
    });
  }

  const newHash = await hashPassword(input.newPassword);

  await withTransaction(async (tx) => {
    await tx.user.update({
      where: { id: actorId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    // Every other device is signed out. If the password change was prompted by a
    // suspected compromise, leaving the other sessions alive defeats the point.
    await revokeAllSessions(tx, actorId, { exceptSessionId: sessionId });

    await recordAudit(
      tx,
      { id: actorId, role: user.role, requestId: context.requestId, ipAddress: context.ipAddress },
      { action: "user.password_changed", entity: "user", entityId: actorId },
    );
  });
}

export async function listSessions(userId: bigint, currentSessionId: string): Promise<SessionSummary[]> {
  const sessions = await getPrisma().session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });

  return sessions.map((session) => ({
    id: session.id,
    deviceLabel: session.deviceLabel ?? "Perangkat tidak dikenal",
    ipAddress: session.ipAddress,
    approximateLocation: null,
    lastSeenAt: session.lastSeenAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    current: session.id === currentSessionId,
  }));
}

/** Used by the step-up flow and by MFA enrolment confirmation. */
export async function assertTotpOrThrow(userId: bigint, code: string): Promise<void> {
  if (!(await verifyTotpForUser(userId, code))) {
    throw new AppError("INVALID_CREDENTIALS", {
      message: "Kode autentikasi tidak valid atau sudah dipakai.",
    });
  }
}

export async function auditStepUp(
  tx: Tx,
  actor: { id: bigint; role: CurrentUser["role"] },
  context: { requestId: string; ipAddress: string | null },
  succeeded: boolean,
): Promise<void> {
  await recordAudit(
    tx,
    { id: actor.id, role: actor.role, requestId: context.requestId, ipAddress: context.ipAddress },
    {
      action: succeeded ? "auth.step_up_succeeded" : "auth.step_up_failed",
      entity: "user",
      entityId: actor.id,
    },
  );
}

/** Exported for the recovery-code comparison in tests. */
export { safeEqual };
