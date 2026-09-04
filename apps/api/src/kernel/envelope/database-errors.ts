import { Prisma } from "../../generated/prisma/index.js";
import { AppError, type AppErrorFieldIssue } from "./app-error.ts";

/**
 * Translates database constraint violations into the error contract
 * (PLAN/05 §4.6).
 *
 * The last row of that table is the important one: a constraint with no mapping
 * becomes a `500`, not a leaked PostgreSQL message. Adding a constraint to a
 * migration without adding it here is therefore visible as an internal error
 * rather than as a raw string in the user's face — and `.claude/rules/
 * migrations.md` requires the pair to be added together.
 */

interface ConstraintMapping {
  toError: (detail: string) => AppError;
}

const FIELD = (field: string, message: string): AppErrorFieldIssue[] => [
  { field, code: "NOT_ALLOWED", message },
];

const CONSTRAINT_MAP: Record<string, ConstraintMapping> = {
  uq_locking_inspection: {
    // The caller normally intercepts this first and produces a message naming the
    // blocking Serial Number. This is the fallback when a race slips past.
    toError: () =>
      new AppError("DUPLICATE_PLATE", {
        message: "Kendaraan ini sedang dalam pemeriksaan yang belum selesai.",
        fieldErrors: FIELD("plateDisplay", "Kendaraan ini sedang diperiksa."),
      }),
  },
  uq_vehicle_plate: {
    toError: () =>
      new AppError("DUPLICATE_PLATE", {
        message: "Plat nomor ini sudah terdaftar pada kendaraan lain.",
        fieldErrors: FIELD("plateDisplay", "Plat nomor sudah terdaftar."),
      }),
  },
  uq_vehicle_chassis: {
    toError: () =>
      new AppError("DUPLICATE_CHASSIS", {
        fieldErrors: FIELD("chassisNumber", "Nomor rangka sudah terdaftar."),
      }),
  },
  uq_users_username_active: {
    toError: () =>
      new AppError("DUPLICATE_USERNAME", {
        fieldErrors: FIELD("username", "User ID ini sudah dipakai."),
      }),
  },
  ck_plate_format: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          {
            field: "plateDisplay",
            code: "INVALID_FORMAT",
            message: "Format plat nomor tidak valid. Contoh yang benar: B 1234 ABC.",
          },
        ],
      }),
  },
  ck_plate_key_len: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          { field: "plateDisplay", code: "INVALID_FORMAT", message: "Panjang plat nomor tidak wajar." },
        ],
      }),
  },
  ck_chassis_format: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          {
            field: "chassisNumber",
            code: "INVALID_FORMAT",
            message: "Nomor rangka hanya boleh berisi huruf dan angka, 5–25 karakter.",
          },
        ],
      }),
  },
  ck_lt_not_bus: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          { field: "segment", code: "NOT_ALLOWED", message: "Kategori LT tidak dapat bersegmen Bus." },
        ],
      }),
  },
  ck_axle_count: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          { field: "axleCount", code: "NOT_ALLOWED", message: "Jumlah Poros harus 2, 3, 4, atau 6." },
        ],
      }),
  },
  ck_total_tires: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          {
            field: "axleConfigs",
            code: "OUT_OF_RANGE",
            message: "Total ban terhitung di luar rentang wajar 4–22.",
          },
        ],
      }),
  },
  ck_steer_single: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          {
            field: "axleConfigs",
            code: "NOT_ALLOWED",
            message: "Poros Steer (Kemudi) selalu Single, tidak dapat Double.",
          },
        ],
      }),
  },
  ck_notes_required: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          {
            field: "notes",
            code: "TOO_SHORT",
            message: "Alasan wajib diisi, minimal 10 karakter.",
          },
        ],
      }),
  },
  ck_size_format: {
    toError: () =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          {
            field: "size",
            code: "INVALID_FORMAT",
            message: "Format ukuran ban tidak valid. Contoh: 1000-20 atau 295/80R22.5.",
          },
        ],
      }),
  },
  uq_notif: {
    // Idempotency working as designed: the same event, recipient, and channel
    // already produced a row. Not an error the user should ever see.
    toError: () => new AppError("CONCURRENT_MODIFICATION"),
  },
};

/** Errors raised by PL/pgSQL triggers, matched on their message prefix. */
const TRIGGER_MAP: { prefix: string; toError: (message: string) => AppError }[] = [
  {
    prefix: "AXLE_SUM_MISMATCH",
    toError: (message) => {
      // The trigger message carries both numbers; keep them, because the whole
      // point of closing D-04 is that the user learns which figure to change.
      const numbers = message.match(/\((\d+)\).*\((\d+)\)/);
      const detail =
        numbers !== null
          ? `Rincian poros berjumlah ${numbers[1]}, sedangkan Jumlah Poros yang dipilih adalah ${numbers[2]}.`
          : "Rincian poros tidak sama dengan Jumlah Poros yang dipilih.";
      return new AppError("VALIDATION_ERROR", {
        fieldErrors: [{ field: "axleConfigs", code: "AXLE_SUM_MISMATCH", message: detail }],
      });
    },
  },
  {
    prefix: "PHOTO_LIMIT_EXCEEDED",
    toError: (message) =>
      new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          {
            field: "photos",
            code: "PHOTO_LIMIT_EXCEEDED",
            message: message.includes("per pengajuan")
              ? "Maksimal 30 foto per pengajuan."
              : "Maksimal 10 foto per slot.",
          },
        ],
      }),
  },
];

/**
 * Prisma codes that mean "the database is not available right now", not "your
 * request was wrong".
 *
 * `PLAN/05` §4.6 maps this whole family to a 503 with a banner and a suggestion
 * to try again. Only two of them were being caught: the initialization error and
 * the Rust panic — both of which describe a client that never connected. The
 * codes below describe a client that *had* connected and then lost the server,
 * which is the ordinary shape of a redeployment: Postgres restarts, the pooled
 * connections die, and every request in flight lands here.
 *
 * Falling through to a 500 was not a cosmetic mistake. The 500 copy tells the
 * user to report a code to the admin, so a thirty-second restart window turns
 * into a defect report about a system that was working correctly — and the code
 * they were told to quote points at no bug at all.
 */
const UNAVAILABLE_CODES = new Set([
  "P1001", // Cannot reach the database server.
  "P1002", // Reached it; it timed out.
  "P1008", // The operation timed out.
  "P1017", // The server closed the connection.
  "P2024", // Timed out taking a connection from the pool — the redeploy case.
]);

function constraintNameFrom(error: Prisma.PrismaClientKnownRequestError): string | null {
  const meta = error.meta ?? {};
  const target = (meta as { target?: unknown }).target;

  if (typeof target === "string") return target;
  if (Array.isArray(target) && typeof target[0] === "string") return target[0];

  // Same two shapes as `target` above. Which key Prisma populates, and whether
  // it holds a string or an array, varies by connector and error code — so both
  // keys accept both shapes rather than only the one first encountered.
  const constraint = (meta as { constraint?: unknown }).constraint;
  if (typeof constraint === "string") return constraint;
  if (Array.isArray(constraint) && typeof constraint[0] === "string") return constraint[0];

  return null;
}

/**
 * Returns a mapped AppError, or null when the error is not a recognised database
 * violation and should be handled as an internal error.
 */
export function translateDatabaseError(error: unknown): AppError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const name = constraintNameFrom(error);
    if (name !== null) {
      for (const [constraint, mapping] of Object.entries(CONSTRAINT_MAP)) {
        if (name.includes(constraint)) return mapping.toError(name);
      }
    }

    // A foreign key that does not resolve is a client mistake, not a server bug:
    // it means a province, city, or brand id that does not exist was sent.
    if (error.code === "P2003") {
      return new AppError("VALIDATION_ERROR", {
        fieldErrors: [
          { field: "root", code: "NOT_ALLOWED", message: "Referensi data yang dipilih tidak ditemukan." },
        ],
        context: { prismaCode: error.code },
      });
    }
    if (error.code === "P2025") return new AppError("NOT_FOUND");

    // Checked after the constraint and reference cases above, because those are
    // specific and these are a catch-all for the connection itself.
    if (UNAVAILABLE_CODES.has(error.code)) {
      return new AppError("SERVICE_UNAVAILABLE", { cause: error });
    }
  }

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  for (const trigger of TRIGGER_MAP) {
    if (message.includes(trigger.prefix)) return trigger.toError(message);
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return new AppError("SERVICE_UNAVAILABLE", { cause: error });
  }

  return null;
}
