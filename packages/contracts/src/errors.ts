/**
 * Error codes and the Indonesian messages that go with them.
 *
 * PLAN/05 §3 maps each code to an HTTP status and a display channel; PLAN/13 §10
 * adds the four auth-hardening codes. Both sides import this file, so the string
 * a user reads and the string a test asserts on are the same string.
 *
 * The whole point of D-08 being closed is that no failure is silent any more.
 * A code that is not in this table becomes INTERNAL_ERROR with a requestId —
 * visible and traceable — rather than a raw database message leaking through.
 */

export const ERROR_CODES = [
  "BAD_REQUEST",
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "MFA_REQUIRED",
  "STEP_UP_REQUIRED",
  "CSRF_MISMATCH",
  "FORBIDDEN_ROLE",
  "NOT_FOUND",
  "DUPLICATE_PLATE",
  "DUPLICATE_CHASSIS",
  "DUPLICATE_USERNAME",
  "INVALID_STATE_TRANSITION",
  "CONCURRENT_MODIFICATION",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_FILE_TYPE",
  "VALIDATION_ERROR",
  "ACCOUNT_LOCKED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Where the client renders an error of this code (PLAN/05 §5.1). */
export type ErrorChannel = "inline" | "banner" | "banner-login";

export interface ErrorDefinition {
  readonly status: number;
  readonly message: string;
  readonly channel: ErrorChannel;
}

export const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  BAD_REQUEST: {
    status: 400,
    message: "Permintaan tidak dapat diproses karena datanya rusak.",
    channel: "banner",
  },
  INVALID_CREDENTIALS: {
    // Deliberately identical whether the username is unknown, the password is
    // wrong, or the account is inactive (PLAN/04 §4.3). Distinguishing them
    // tells an attacker which usernames exist.
    status: 401,
    message: "User ID atau Password salah.",
    channel: "banner-login",
  },
  SESSION_EXPIRED: {
    status: 401,
    message: "Sesi Anda sudah berakhir. Silakan masuk kembali.",
    channel: "banner",
  },
  MFA_REQUIRED: {
    status: 401,
    message: "Masukkan kode autentikasi dari aplikasi authenticator Anda.",
    channel: "banner-login",
  },
  STEP_UP_REQUIRED: {
    status: 403,
    message: "Aksi ini memerlukan verifikasi ulang. Masukkan kode autentikasi Anda.",
    channel: "banner",
  },
  CSRF_MISMATCH: {
    status: 403,
    message: "Permintaan ditolak karena token keamanan tidak cocok. Muat ulang halaman.",
    channel: "banner",
  },
  FORBIDDEN_ROLE: {
    status: 403,
    message: "Anda tidak memiliki akses untuk melakukan tindakan ini.",
    channel: "banner",
  },
  NOT_FOUND: {
    // Also returned for a resource that exists but is outside the caller's
    // scope. Answering "this exists but you may not see it" leaks the existence
    // of another supplier's Serial Number (PLAN/04 §2.2).
    status: 404,
    message: "Data yang Anda cari tidak ditemukan.",
    channel: "banner",
  },
  DUPLICATE_PLATE: {
    status: 409,
    message: "Kendaraan ini sedang dalam pemeriksaan yang belum selesai.",
    channel: "inline",
  },
  DUPLICATE_CHASSIS: {
    status: 409,
    message: "Nomor rangka ini sudah terdaftar pada kendaraan lain.",
    channel: "inline",
  },
  DUPLICATE_USERNAME: {
    status: 409,
    message: "User ID ini sudah dipakai.",
    channel: "inline",
  },
  INVALID_STATE_TRANSITION: {
    status: 409,
    message: "Perubahan status ini tidak diizinkan dari status saat ini.",
    channel: "banner",
  },
  CONCURRENT_MODIFICATION: {
    status: 409,
    message: "Data ini sudah diubah orang lain sejak Anda membukanya. Muat ulang untuk melihat versi terbaru.",
    channel: "banner",
  },
  FILE_TOO_LARGE: {
    status: 413,
    message: "Ukuran foto melebihi batas 5 MB.",
    channel: "inline",
  },
  UNSUPPORTED_FILE_TYPE: {
    status: 415,
    message: "Format berkas tidak didukung. Gunakan foto berformat WebP atau JPEG.",
    channel: "inline",
  },
  VALIDATION_ERROR: {
    status: 422,
    message: "Beberapa isian belum lengkap atau tidak valid.",
    channel: "inline",
  },
  ACCOUNT_LOCKED: {
    status: 423,
    message: "Akun terkunci sementara karena terlalu banyak percobaan masuk yang gagal. Coba lagi dalam 15 menit.",
    channel: "banner-login",
  },
  RATE_LIMITED: {
    status: 429,
    message: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.",
    channel: "banner",
  },
  INTERNAL_ERROR: {
    status: 500,
    message:
      "Terjadi kesalahan pada sistem. Silakan coba lagi atau laporkan kode berikut ke admin.",
    channel: "banner",
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: "Sistem sedang tidak dapat dijangkau. Periksa koneksi Anda lalu coba lagi.",
    channel: "banner",
  },
};

/**
 * Field-level codes carried inside a VALIDATION_ERROR envelope. These are the
 * machine-readable half; the message beside them is what the user reads under
 * the input.
 */
export const FIELD_ERROR_CODES = [
  "REQUIRED",
  "INVALID_FORMAT",
  "OUT_OF_RANGE",
  "NOT_ALLOWED",
  "AXLE_SUM_MISMATCH",
  "PHOTO_LIMIT_EXCEEDED",
  "TOO_SHORT",
  "TOO_LONG",
  "PASSWORD_TOO_COMMON",
  "PASSWORD_UNCHANGED",
] as const;

export type FieldErrorCode = (typeof FIELD_ERROR_CODES)[number];

export function httpStatusFor(code: ErrorCode): number {
  return ERROR_DEFINITIONS[code].status;
}

export function messageFor(code: ErrorCode): string {
  return ERROR_DEFINITIONS[code].message;
}

export function channelFor(code: ErrorCode): ErrorChannel {
  return ERROR_DEFINITIONS[code].channel;
}
