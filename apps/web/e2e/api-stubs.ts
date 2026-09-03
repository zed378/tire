import type { Page, Route } from "@playwright/test";
import {
  EVENT_TYPES,
  INSPECTION_STATUSES,
  PERMISSIONS,
  USER_ROLES,
  VEHICLE_CATEGORIES,
  type AuditEntry,
  type CurrentUser,
  type DashboardMetrics,
  type HealthReport,
  type InspectionDetail,
  type InspectionListItem,
  type JobRecord,
  type MasterDataBundle,
  type NotificationPreference,
  type NotificationRecord,
  type OrphanUpload,
  type Paginated,
  type PendingBrandReview,
  type PhotoRecord,
  type QcReviewRecord,
  type QcStats,
  type RegionProgressResult,
  type SessionSummary,
  type TireBrandPatternListResponse,
  type TireSizeListResponse,
  type TireSpecSheet,
  type UserRecord,
  type VehicleBrandListResponse,
} from "@c26/contracts";

/**
 * A whole application's worth of answers, with no server behind them.
 *
 * WHY THIS EXISTS: the accessibility sweep could only reach the four public
 * pages, and the worst defect it found — `accent-text` on `accent-soft` under
 * AA in the dark theme — belongs to the active sidebar item, the highlighted
 * option in a searchable select, and the accent badge. Every one of those lives
 * behind a session. The sweep found it by accident, through the single tile on
 * the landing page that happened to use the same fill.
 *
 * The alternative was a seeded database, which is what gate G-11 needs and does
 * not have. That is a heavier dependency than an audit should carry: an audit
 * that needs Postgres running is an audit that gets skipped. These fixtures are
 * typed against `@c26/contracts`, so a response shape that changes breaks the
 * typecheck rather than quietly rendering an empty screen that passes.
 *
 * They are NOT a substitute for `qc-flow.spec.ts`. Nothing here tests behaviour;
 * the values exist to put pixels on a screen so axe-core has something to read.
 */

const NOW = "2026-09-03T04:00:00.000Z";

/**
 * Every permission, deliberately.
 *
 * No real account holds all of them — `ROLE_PERMISSIONS` splits admin from
 * operator on purpose. This fixture is not modelling a person; it is opening
 * every door so that every screen renders and gets audited. Authorisation is
 * enforced on the server and tested there.
 */
const ALL_PERMISSIONS: string[] = [...PERMISSIONS];

export const CURRENT_USER: CurrentUser = {
  id: 1,
  username: "auditor_a11y",
  displayName: "Auditor Aksesibilitas",
  role: "admin",
  mustChangePassword: false,
  mfaEnrolled: true,
  mfaEnrollmentRequired: false,
  permissions: ALL_PERMISSIONS,
  regions: [],
  unreadNotifications: 3,
};

function countsOf<Key extends string>(keys: readonly Key[], start: number): Record<Key, number> {
  return Object.fromEntries(keys.map((key, index) => [key, start + index * 3])) as Record<
    Key,
    number
  >;
}

const INSPECTIONS: InspectionListItem[] = INSPECTION_STATUSES.map((status, index) => ({
  id: index + 1,
  serialNumber: `SN2026-${String(index + 1).padStart(5, "0")}`,
  status,
  plateDisplay: `B ${String(1000 + index)} ABC`,
  cityName: "Jakarta Timur",
  provinceName: "DKI Jakarta",
  category: index % 2 === 0 ? "TB" : "LT",
  totalTires: 6 + index,
  photoCount: index * 2,
  submittedAt: status === "draft" ? null : NOW,
  createdAt: NOW,
  submittedByName: "Joko Supplier",
  // Only the two statuses that carry one, so the row that renders a reason and
  // the row that does not are both audited.
  latestQcNotes:
    status === "needs_revision" || status === "dropped_qc"
      ? "Foto posisi ban kiri belakang buram, mohon diambil ulang."
      : null,
}));

const TIRE_POSITIONS: InspectionDetail["tirePositions"] = [
  {
    id: 1,
    positionCode: "S1L",
    positionLabel: "Steer 1 Kiri",
    axleType: "steer",
    axleIndex: 1,
    side: "left",
    depth: null,
    sortOrder: 1,
    photoCount: 2,
    hasSpec: true,
  },
  {
    id: 2,
    positionCode: "S1R",
    positionLabel: "Steer 1 Kanan",
    axleType: "steer",
    axleIndex: 1,
    side: "right",
    depth: null,
    sortOrder: 2,
    photoCount: 0,
    hasSpec: false,
  },
  {
    id: 3,
    positionCode: "D1LO",
    positionLabel: "Drive 1 Kiri Luar",
    axleType: "drive",
    axleIndex: 1,
    side: "left",
    depth: "outer",
    sortOrder: 3,
    photoCount: 1,
    hasSpec: false,
  },
];

const INSPECTION_DETAIL: InspectionDetail = {
  ...(INSPECTIONS[1] ?? INSPECTIONS[0]!),
  vehicleId: 7,
  chassisNumber: "MHFXW42G1K1234567",
  segment: "truck",
  subSegment: "Tronton",
  vehicleBrandName: "Hino",
  cargoType: "Semen curah",
  axleCount: 2,
  axleConfigs: [
    { axleType: "steer", axleCount: 1, mounting: "single" },
    { axleType: "drive", axleCount: 1, mounting: "double" },
  ],
  tirePositions: TIRE_POSITIONS,
  generalPhotos: [
    { slot: "front_rear", photoIds: [1] },
    { slot: "side", photoIds: [] },
  ],
  specProgress: { filled: 1, total: 3 },
  canSubmit: false,
  submitBlockedReason: "Dua posisi ban belum punya foto.",
};

const PHOTOS: PhotoRecord[] = [
  {
    id: 1,
    slot: "front_rear",
    tirePositionId: null,
    tirePositionLabel: null,
    // A real file from the build, so the screen renders an actual image rather
    // than a broken-image icon that axe would judge on different pixels.
    url: "/img/depot-640.jpg",
    thumbnailUrl: "/img/depot-640.jpg",
    byteSize: 24_844,
    width: 640,
    height: 427,
    capturedAt: NOW,
    uploadedByName: "Joko Supplier",
    createdAt: NOW,
    commentCount: 1,
  },
];

const MASTER_DATA: MasterDataBundle = {
  provinces: [
    { id: 1, code: "31", name: "DKI Jakarta", isActive: true, cityCount: 6 },
    { id: 2, code: "32", name: "Jawa Barat", isActive: true, cityCount: 27 },
    { id: 3, code: "33", name: "Jawa Tengah", isActive: false, cityCount: 35 },
  ],
  cities: [
    { id: 11, provinceId: 1, provinceName: "DKI Jakarta", code: "3172", name: "Jakarta Timur", isActive: true },
    { id: 12, provinceId: 1, provinceName: "DKI Jakarta", code: "3174", name: "Jakarta Selatan", isActive: true },
    { id: 21, provinceId: 2, provinceName: "Jawa Barat", code: "3273", name: "Bandung", isActive: true },
  ],
  vehicleBrands: [
    { id: 1, name: "Hino", isActive: true },
    { id: 2, name: "Mitsubishi Fuso", isActive: true },
    { id: 3, name: "Scania", isActive: false },
  ],
  tireBrands: [
    { id: 1, name: "Bridgestone", isActive: true },
    { id: 2, name: "GT Radial", isActive: true },
  ],
  subSegments: [
    { segment: "truck", values: ["Tronton", "Trailer", "Engkel"] },
    { segment: "bus", values: ["Bus Besar", "Bus Sedang"] },
  ],
};

const USERS: Paginated<UserRecord> = {
  items: USER_ROLES.map((role, index) => ({
    id: index + 1,
    username: `pengguna_${role}`,
    displayName: `Contoh ${role}`,
    role,
    email: index === 0 ? null : `${role}@example.test`,
    phone: null,
    isActive: index !== 3,
    mfaEnrolled: index < 2,
    mustChangePassword: index === 2,
    lastLoginAt: index === 3 ? null : NOW,
    createdAt: NOW,
    regions: index === 0 ? [{ provinceId: 1, cityId: null, name: "DKI Jakarta" }] : [],
  })),
  page: 1,
  perPage: 25,
  total: USER_ROLES.length,
  totalPages: 1,
};

const HEALTH: HealthReport = {
  status: "degraded",
  version: "0.1.0-a11y",
  checks: [
    { name: "Basis data", status: "ok", detail: "Terhubung", latencyMs: 4 },
    { name: "Penyimpanan objek", status: "degraded", detail: "Latensi tinggi", latencyMs: 812 },
    { name: "Antrean", status: "ok", detail: "Berjalan", latencyMs: null },
  ],
  queue: { depth: 12, failedLast24h: 2, deadLetterCount: 0, oldestUnprocessedOutboxSeconds: 420 },
  storage: { usedBytes: 4_200_000_000, objectCount: 18_402, trendBytesPerDay: 120_000_000 },
  backup: { lastRunAt: NOW, lastVerifiedAt: NOW, lastResult: "ok" },
};

const JOBS: JobRecord[] = [
  {
    id: "job_1",
    name: "export-build",
    state: "failed",
    retryCount: 3,
    createdAt: NOW,
    startedAt: NOW,
    completedAt: null,
    errorMessage: "Timeout saat membaca lampiran.",
    requestId: "req_20260901_143022_a91f",
  },
];

const ORPHANS: OrphanUpload[] = [
  { storageKey: "uploads/2026/09/01/abandoned-a91f.jpg", byteSize: 1_204_992, uploadedAt: NOW, ageHours: 39 },
];

const AUDIT: Paginated<AuditEntry> = {
  items: [
    {
      id: 1,
      action: "inspection.transition",
      entity: "inspections",
      entityId: 42,
      actorId: 2,
      actorName: "Rina Admin",
      actorRole: "admin",
      before: { status: "pending_qc" },
      after: { status: "passed_qc" },
      requestId: "req_20260901_143022_a91f",
      ipAddress: "10.0.0.12",
      createdAt: NOW,
    },
  ],
  page: 1,
  perPage: 25,
  total: 1,
  totalPages: 1,
};

const NOTIFICATIONS: Paginated<NotificationRecord> = {
  items: EVENT_TYPES.slice(0, 4).map((eventType, index) => ({
    id: index + 1,
    eventType,
    channel: "in_app",
    status: "sent",
    title: "Pemeriksaan SN2026-00042 lolos QC",
    body: "Lanjutkan dengan mengisi spesifikasi ban.",
    link: "/inspections/SN2026-00042",
    readAt: index % 2 === 0 ? null : NOW,
    createdAt: NOW,
  })),
  page: 1,
  perPage: 25,
  total: 4,
  totalPages: 1,
};

const NOTIFICATION_PREFERENCES: NotificationPreference[] = [
  {
    eventType: "inspection.passed_qc",
    channel: "in_app",
    enabled: true,
    locked: true,
    lockedReason: "Notifikasi dalam aplikasi adalah arsip, bukan interupsi.",
  },
  { eventType: "inspection.passed_qc", channel: "email", enabled: false, locked: false, lockedReason: null },
];

const TIRE_SPECS: TireSpecSheet = {
  serialNumber: "SN2026-00002",
  plateDisplay: "B 1001 ABC",
  status: "passed_qc",
  editable: true,
  specs: TIRE_POSITIONS.map((position, index) => ({
    tirePositionId: position.id,
    positionCode: position.positionCode,
    positionLabel: position.positionLabel,
    sortOrder: position.sortOrder,
    tireBrandId: index === 0 ? 1 : null,
    tireBrandName: index === 0 ? "Bridgestone" : null,
    brandOther: null,
    pattern: index === 0 ? "R150" : null,
    size: index === 0 ? "10.00R20" : null,
    plyRating: index === 0 ? "16PR" : null,
    isRetread: false,
    filledByName: index === 0 ? "Rina Admin" : null,
    filledAt: index === 0 ? NOW : null,
    isComplete: index === 0,
  })),
  progress: { filled: 1, total: 3 },
};

const QC_REVIEWS: QcReviewRecord[] = [
  {
    id: 1,
    decision: "revision",
    statusBefore: "pending_qc",
    statusAfter: "needs_revision",
    notes: "Foto posisi ban kiri belakang buram, mohon diambil ulang.",
    reviewerName: "Rina Admin",
    reviewedAt: NOW,
    comments: [
      { id: 1, photoId: 1, tirePositionId: 1, tirePositionLabel: "Steer 1 Kiri", body: "Tidak fokus." },
    ],
  },
];

const REGION_PROGRESS: RegionProgressResult = {
  points: MASTER_DATA.cities.map((city, index) => ({
    period: "2026-09",
    cityId: city.id,
    cityName: city.name,
    provinceId: city.provinceId,
    provinceName: city.provinceName,
    tb: 10 + index * 4,
    lt: 5 + index * 2,
    total: 15 + index * 6,
  })),
  totals: { tb: 42, lt: 21, total: 63 },
  refreshedAt: NOW,
};

const DASHBOARD: DashboardMetrics = {
  type: "admin",
  users: { total: 24, active: 21, byRole: countsOf(USER_ROLES, 3) },
  inspections: {
    total: 148,
    byStatus: countsOf(INSPECTION_STATUSES, 7),
    thisMonth: 31,
    thisMonthByCategory: countsOf(VEHICLE_CATEGORIES, 12),
  },
  recentAuditEvents: [
    { occurredAt: NOW, action: "user.role_changed", actor: "Rina Admin", entity: "users" },
  ],
};

const SESSIONS: SessionSummary[] = [
  {
    id: "sess_1",
    deviceLabel: "Chrome di Windows",
    ipAddress: "10.0.0.12",
    approximateLocation: "Jakarta",
    lastSeenAt: NOW,
    createdAt: NOW,
    current: true,
  },
];

const VEHICLE_BRAND_LIST: VehicleBrandListResponse = {
  items: MASTER_DATA.vehicleBrands.map((brand) => ({
    ...brand,
    createdAt: NOW,
    updatedAt: NOW,
  })),
  total: MASTER_DATA.vehicleBrands.length,
  page: 1,
  perPage: 25,
};

const TIRE_PATTERN_LIST: TireBrandPatternListResponse = {
  items: [
    { id: 1, brand: "Bridgestone", pattern: "R150", type: "TB", isActive: true, createdAt: NOW, updatedAt: NOW },
    { id: 2, brand: "GT Radial", pattern: "GTX1", type: "TB", isActive: false, createdAt: NOW, updatedAt: NOW },
  ],
  total: 2,
  page: 1,
  perPage: 25,
};

const TIRE_SIZE_LIST: TireSizeListResponse = {
  items: [
    { id: 1, size: "10.00R20", type: "TB", isActive: true, createdAt: NOW, updatedAt: NOW },
    { id: 2, size: "7.50-16", type: "LT", isActive: true, createdAt: NOW, updatedAt: NOW },
  ],
  total: 2,
  page: 1,
  perPage: 25,
};

const BRAND_REVIEWS: PendingBrandReview[] = [
  { value: "bridgstone", occurrences: 4, firstSeenAt: NOW, source: "tire" },
];

const QC_STATS: QcStats = { pending: 6, passed: 41, dropped: 3, needsRevision: 2, total: 52 };

/**
 * Path (without query) to the payload it answers with, longest match first.
 *
 * The list is ordered by specificity because `/api/masterdata/brand-reviews`
 * would otherwise be swallowed by `/api/masterdata`.
 */
const ROUTES: { match: (path: string) => boolean; body: unknown }[] = [
  { match: (p) => p === "/api/auth/me", body: CURRENT_USER },
  { match: (p) => p === "/api/auth/sessions", body: SESSIONS },
  { match: (p) => p === "/api/auth/mfa", body: { enrolled: true, required: true, remainingRecoveryCodes: 8 } },
  { match: (p) => p === "/api/dashboard/metrics", body: DASHBOARD },
  { match: (p) => p === "/api/masterdata/brand-reviews", body: BRAND_REVIEWS },
  { match: (p) => p === "/api/masterdata", body: MASTER_DATA },
  { match: (p) => p === "/api/vehicle-brands", body: VEHICLE_BRAND_LIST },
  { match: (p) => p.startsWith("/api/tire-brand-patterns"), body: TIRE_PATTERN_LIST },
  { match: (p) => p.startsWith("/api/tire-sizes"), body: TIRE_SIZE_LIST },
  { match: (p) => p === "/api/users", body: USERS },
  { match: (p) => p === "/api/audit", body: AUDIT },
  { match: (p) => p === "/api/ops/health", body: HEALTH },
  { match: (p) => p === "/api/ops/jobs", body: JOBS },
  { match: (p) => p === "/api/ops/orphans", body: ORPHANS },
  { match: (p) => p === "/api/ops/logs", body: [] },
  { match: (p) => p === "/api/notifications/preferences", body: NOTIFICATION_PREFERENCES },
  { match: (p) => p === "/api/notifications", body: NOTIFICATIONS },
  { match: (p) => p === "/api/qc/stats", body: QC_STATS },
  { match: (p) => p === "/api/qc/queue", body: { items: INSPECTIONS, page: 1, perPage: 25, total: INSPECTIONS.length, totalPages: 1 } },
  { match: (p) => /^\/api\/qc\/[^/]+\/reviews$/.test(p), body: QC_REVIEWS },
  { match: (p) => /^\/api\/inspections\/[^/]+\/tire-specs$/.test(p), body: TIRE_SPECS },
  { match: (p) => /^\/api\/inspections\/[^/]+\/photos$/.test(p), body: PHOTOS },
  { match: (p) => /^\/api\/inspections\/[^/]+$/.test(p), body: INSPECTION_DETAIL },
  { match: (p) => p === "/api/inspections", body: { items: INSPECTIONS, page: 1, perPage: 25, total: INSPECTIONS.length, totalPages: 1 } },
  { match: (p) => p === "/api/reports/region-progress", body: REGION_PROGRESS },
  { match: (p) => p === "/api/vehicles/search", body: [] },
];

async function answer(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    // `PLAN/05` §2: one envelope, success included. A stub that answered with
    // the bare payload would be testing a client this application does not have.
    body: JSON.stringify({ ok: true, data: body, requestId: "req_e2e_a11y" }),
  });
}

/**
 * Answers every API call as a signed-in administrator.
 *
 * Anything not in the table above gets an empty object rather than a hang: an
 * unstubbed endpoint should leave the screen thin, not leave the sweep waiting
 * for a network timeout it will then blame on the page.
 */
export async function stubSignedInApi(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const matched = ROUTES.find((entry) => entry.match(path));
    await answer(route, matched?.body ?? {});
  });
}

/**
 * Answers the session bootstrap the way a visitor with no cookie is answered.
 *
 * `SESSION_EXPIRED` is a real answer — "there is no session" — and the session
 * provider treats it as one. Anything else puts a SERVICE_UNAVAILABLE banner on
 * top of every page in the sweep.
 */
export async function stubSignedOutSession(page: Page): Promise<void> {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "SESSION_EXPIRED",
        message: "Sesi Anda telah berakhir. Silakan masuk kembali.",
        requestId: "req_e2e_a11y",
      }),
    });
  });
}
