import type { MfaEnrollmentResult, MfaEnrollmentStart, UserRole } from "@c26/contracts";
import { recordAudit } from "../../kernel/audit.ts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { AppError } from "../../kernel/envelope/index.ts";
import { hashPassword } from "../../kernel/security/password.ts";
import {
  buildOtpauthUri,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotp,
} from "../../kernel/security/totp.ts";
import { revokeAllSessions } from "./session-service.ts";

/**
 * MFA enrolment and reset (PLAN/13 §3).
 *
 * Mandatory for `admin` and `operator`, optional for the rest. Making it
 * mandatory for everyone sounds safer and ends with field suppliers locked out
 * because they changed phones — dozens of users generating real support load for
 * accounts that hold far less value than an admin's.
 */

export interface MfaContext {
  requestId: string;
  ipAddress: string | null;
}

/**
 * Starts enrolment. The secret is stored unconfirmed: it only becomes usable
 * once the user proves they can generate a code from it.
 */
export async function startEnrollment(user: {
  id: bigint;
  username: string;
}): Promise<MfaEnrollmentStart> {
  const existing = await getPrisma().userMfa.findUnique({ where: { userId: user.id } });
  if (existing !== null && existing.confirmedAt !== null) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        {
          field: "root",
          code: "NOT_ALLOWED",
          message: "Autentikasi dua faktor sudah aktif. Minta admin lain untuk mengatur ulang.",
        },
      ],
    });
  }

  const secret = generateTotpSecret();
  const secretEnc = encryptSecret(secret);

  await getPrisma().userMfa.upsert({
    where: { userId: user.id },
    create: { userId: user.id, secretEnc },
    update: { secretEnc, confirmedAt: null },
  });

  return {
    otpauthUri: buildOtpauthUri(user.username, secret),
    secretForManualEntry: secret,
  };
}

/**
 * Confirms enrolment and issues the recovery codes.
 *
 * The codes are shown exactly once and stored as Argon2id hashes — treated
 * precisely like passwords, because that is what they are.
 */
export async function confirmEnrollment(
  user: { id: bigint; role: UserRole },
  code: string,
  context: MfaContext,
): Promise<MfaEnrollmentResult> {
  const mfa = await getPrisma().userMfa.findUnique({ where: { userId: user.id } });
  if (mfa === null) {
    throw new AppError("VALIDATION_ERROR", {
      fieldErrors: [
        { field: "root", code: "NOT_ALLOWED", message: "Mulai pendaftaran terlebih dahulu." },
      ],
    });
  }

  if (!verifyTotp(decryptSecret(Buffer.from(mfa.secretEnc)), code)) {
    throw new AppError("INVALID_CREDENTIALS", { message: "Kode autentikasi tidak cocok." });
  }

  const recoveryCodes = generateRecoveryCodes();
  const hashes = await Promise.all(recoveryCodes.map((value) => hashPassword(value)));

  await withTransaction(async (tx) => {
    await tx.userMfa.update({
      where: { userId: user.id },
      data: { confirmedAt: new Date() },
    });

    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.mfaRecoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    });

    await recordAudit(
      tx,
      { id: user.id, role: user.role, requestId: context.requestId, ipAddress: context.ipAddress },
      { action: "auth.mfa_enrolled", entity: "user", entityId: user.id },
    );
  });

  return { recoveryCodes };
}

/**
 * Resets another user's MFA.
 *
 * Only another admin may do this, it is always audited, and it always revokes
 * every session. This is the classic hole: a self-service reset over email turns
 * MFA into security theatre, because an attacker who owns the mailbox walks
 * straight through it (PLAN/13 §3.3).
 */
export async function resetMfa(
  actor: { id: bigint; role: UserRole },
  targetUserId: bigint,
  context: MfaContext,
): Promise<void> {
  if (actor.id === targetUserId) {
    throw new AppError("FORBIDDEN_ROLE", {
      message: "Autentikasi dua faktor Anda sendiri harus diatur ulang oleh admin lain.",
    });
  }

  await withTransaction(async (tx) => {
    await tx.userMfa.deleteMany({ where: { userId: targetUserId } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: targetUserId } });
    await tx.mfaUsedCode.deleteMany({ where: { userId: targetUserId } });
    await revokeAllSessions(tx, targetUserId);

    await recordAudit(
      tx,
      { id: actor.id, role: actor.role, requestId: context.requestId, ipAddress: context.ipAddress },
      {
        action: "auth.mfa_reset",
        entity: "user",
        entityId: targetUserId,
        after: { resetBy: actor.id.toString() },
      },
    );
  });
}

export async function remainingRecoveryCodes(userId: bigint): Promise<number> {
  return getPrisma().mfaRecoveryCode.count({ where: { userId, usedAt: null } });
}
