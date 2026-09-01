/**
 * Domain constants shared by client and server.
 *
 * Values are stable machine identifiers; the label maps beside them are the
 * Indonesian strings users see (K-10). Keeping both here means a wording fix in
 * the UI can never break a database match — the failure mode PLAN/03 §2.3
 * describes, where the legacy system used the Indonesian label as its Drive path.
 */

// ── Roles (PLAN/02 §3, PLAN/04 §2) ──────────────────────────────────────────
export const USER_ROLES = ["supplier", "admin", "manager", "operator"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  supplier: "Data Supplier",
  admin: "Admin",
  manager: "PM/PIC/SPV",
  operator: "Operator",
};

// ── Inspection status (PLAN/02 §3, PLAN/03 §7) ──────────────────────────────
export const INSPECTION_STATUSES = [
  "draft",
  "pending_qc",
  "needs_revision",
  "passed_qc",
  "dropped_qc",
] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  draft: "Draf",
  pending_qc: "Pending QC",
  needs_revision: "Perlu Revisi",
  passed_qc: "Pass QC",
  dropped_qc: "Drop QC",
};

/**
 * Statuses that lock a vehicle against a second inspection (PLAN/11 §5.4).
 * `dropped_qc` releases the lock; `draft` never locks, because an abandoned
 * draft would otherwise hold a plate hostage forever (PLAN/11 §5.6).
 */
export const LOCKING_STATUSES = ["pending_qc", "needs_revision", "passed_qc"] as const;
export type LockingStatus = (typeof LOCKING_STATUSES)[number];

export function isLockingStatus(status: InspectionStatus): status is LockingStatus {
  return (LOCKING_STATUSES as readonly string[]).includes(status);
}

// ── Vehicle segmentation (PLAN/00 §1.4) ─────────────────────────────────────
export const VEHICLE_CATEGORIES = ["TB", "LT"] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  TB: "TB (Truck & Bus)",
  LT: "LT (Light Truck)",
};

export const VEHICLE_SEGMENTS = ["bus", "truck"] as const;
export type VehicleSegment = (typeof VEHICLE_SEGMENTS)[number];

export const VEHICLE_SEGMENT_LABELS: Record<VehicleSegment, string> = {
  bus: "Bus",
  truck: "Truck",
};

/**
 * V-09: `LT` may not carry the `bus` segment, following the literal meaning of
 * the abbreviation. PLAN/03 §4.2 leaves a business question open — whether a
 * minibus counts as LT — and until it is answered, rejecting ambiguous data is
 * cheaper than cleaning it up later.
 */
export const SEGMENTS_BY_CATEGORY: Record<VehicleCategory, readonly VehicleSegment[]> = {
  TB: ["bus", "truck"],
  LT: ["truck"],
};

/** V-10: sub-segment must belong to the chosen segment. */
export const SUB_SEGMENTS_BY_SEGMENT = {
  bus: ["Intercity Bus (Bus AKAP)", "City Bus (Bus Kota)"],
  truck: ["General Cargo", "Dump Truck", "Tanker", "Trailer"],
} as const satisfies Record<VehicleSegment, readonly string[]>;

export const ALL_SUB_SEGMENTS: readonly string[] = [
  ...SUB_SEGMENTS_BY_SEGMENT.bus,
  ...SUB_SEGMENTS_BY_SEGMENT.truck,
];

// ── Axle configuration (PLAN/03 §2) ─────────────────────────────────────────
export const AXLE_TYPES = ["steer", "drive", "free_rolling"] as const;
export type AxleType = (typeof AXLE_TYPES)[number];

/** Generation order is fixed. Changing it renumbers every position code. */
export const AXLE_TYPE_ORDER: readonly AxleType[] = ["steer", "drive", "free_rolling"];

export const AXLE_TYPE_LABELS: Record<AxleType, string> = {
  steer: "Poros Steer (Kemudi)",
  drive: "Poros Drive (Penggerak)",
  free_rolling: "Poros Free Rolling",
};

export const TIRE_MOUNTINGS = ["single", "double"] as const;
export type TireMounting = (typeof TIRE_MOUNTINGS)[number];

export const TIRE_MOUNTING_LABELS: Record<TireMounting, string> = {
  single: "Single",
  double: "Double",
};

export type TireSide = "left" | "right";
export type TireDepth = "inner" | "outer";

/** V-05: the only axle counts the system supports. */
export const SUPPORTED_AXLE_COUNTS = [2, 3, 4, 6] as const;
export type SupportedAxleCount = (typeof SUPPORTED_AXLE_COUNTS)[number];

/** V-04: free rolling axles only exist on 4- and 6-axle vehicles. */
export const AXLE_COUNTS_ALLOWING_FREE_ROLLING: readonly number[] = [4, 6];

/** Physical bounds from enumerating all 34 valid combinations (PLAN/03 §3). */
export const MIN_TOTAL_TIRES = 4;
export const MAX_TOTAL_TIRES = 22;
export const MAX_AXLES_PER_TYPE = 5;

// ── Photos (PLAN/02 §3, PLAN/06 §6) ─────────────────────────────────────────
export const PHOTO_SLOTS = ["front_rear", "side", "tire_position"] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

export const PHOTO_SLOT_LABELS: Record<PhotoSlot, string> = {
  front_rear: "Tampak Depan / Belakang",
  side: "Tampak Samping",
  tire_position: "Foto Posisi Ban",
};

export const GENERAL_PHOTO_SLOTS: readonly PhotoSlot[] = ["front_rear", "side"];

/** K-06, enforced by trg_photo_limit as well as here. */
export const MAX_PHOTOS_PER_SLOT = 10;

/**
 * PLAN/06 §6. New in the rewrite: 10 per slot alone restrains nothing once a
 * 6-axle vehicle has 22 positions — the difference between 84 GB and 562 GB
 * of storage in year one.
 */
export const MAX_PHOTOS_PER_INSPECTION = 30;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_PHOTO_MIME_TYPES = ["image/webp", "image/jpeg"] as const;
export type PhotoMimeType = (typeof ACCEPTED_PHOTO_MIME_TYPES)[number];

/** Client-side compression profile (PLAN/06 §3). */
export const PHOTO_MAX_EDGE_PX = 1600;
export const PHOTO_WEBP_QUALITY = 0.78;
export const PHOTO_JPEG_QUALITY = 0.82;

export const PRESIGN_TTL_SECONDS = 600;

// ── QC (PLAN/02 §9) ─────────────────────────────────────────────────────────
export const QC_DECISIONS = ["pass", "drop", "revision"] as const;
export type QcDecision = (typeof QC_DECISIONS)[number];

export const QC_DECISION_LABELS: Record<QcDecision, string> = {
  pass: "Pass QC (Lanjut ke Spesifikasi Ban)",
  drop: "Drop QC (Tolak)",
  revision: "Kembalikan untuk Revisi",
};

/** V-14: a reason is mandatory for drop and revision. */
export const MIN_QC_NOTES_LENGTH = 10;

// ── Notifications (PLAN/12 §3) ──────────────────────────────────────────────
export const NOTIFICATION_CHANNELS = ["in_app", "email", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["pending", "sent", "failed", "suppressed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/**
 * PLAN/12 §5. The last column of that table is the one that matters: a
 * notification that changes nobody's action is noise, and noise gets important
 * notifications ignored along with it.
 */
export const EVENT_TYPES = [
  "inspection.submitted",
  "inspection.passed_qc",
  "inspection.dropped_qc",
  "inspection.needs_revision",
  "inspection.resubmitted",
  "export.ready",
  "export.failed",
  "user.password_reset",
  "user.login_from_new_device",
  "job.repeatedly_failed",
  "storage.threshold_exceeded",
  "vehicle.duplicate_suspected",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** PLAN/12 §8: these three can never be switched off. */
export const UNMUTABLE_EVENT_TYPES: readonly EventType[] = [
  "user.password_reset",
  "user.login_from_new_device",
  "inspection.needs_revision",
];

// ── Auth (PLAN/04 §4, PLAN/13 §3) ───────────────────────────────────────────
export const MIN_PASSWORD_LENGTH = 10;
export const SESSION_TTL_HOURS = 12;
export const SESSION_ABSOLUTE_TTL_DAYS = 7;
export const STEP_UP_TTL_MINUTES = 15;
export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_ATTEMPT_WINDOW_MINUTES = 15;
export const ACCOUNT_LOCK_MINUTES = 15;
export const MFA_RECOVERY_CODE_COUNT = 10;

/** PLAN/13 §3.1: mandatory for the two roles that hold the most value. */
export const ROLES_REQUIRING_MFA: readonly UserRole[] = ["admin", "operator"];

/** PLAN/00 §4: retention of photos and audit rows. */
export const RETENTION_MONTHS = 24;

/** PLAN/11 §5.6: an untouched draft is deleted by a scheduled job. */
export const DRAFT_EXPIRY_DAYS = 30;

// ── Serial number (PLAN/02 §7.1) ────────────────────────────────────────────
/**
 * Five digits, not four. At 1,200 inspections a month `SN2026-9999` is exhausted
 * in month nine. K-05 preserves the numbering *pattern*, not its digit width,
 * and parsing happens on serial_year + serial_seq rather than on the string.
 */
export const SERIAL_SEQUENCE_DIGITS = 5;

export function formatSerialNumber(year: number, sequence: number): string {
  return `SN${year}-${String(sequence).padStart(SERIAL_SEQUENCE_DIGITS, "0")}`;
}
