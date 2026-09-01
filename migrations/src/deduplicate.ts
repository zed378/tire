import { plateKeyOf } from "@c26/contracts";

/**
 * Deduplication before anything is written (PLAN/11 §8).
 *
 * The model change makes this unavoidable: every group of rows sharing a
 * `plate_key` becomes ONE vehicle and SEVERAL inspections. The legacy system had
 * no vehicle entity at all, so nothing there ever had to agree.
 *
 * `PLAN/11` §8 step 5 is where the time goes. The same plate with different axle
 * configurations means one of them is wrong — and D-04 makes that very likely,
 * because the legacy form never validated axle configuration at all. Expect the
 * count to be non-trivial and leave time for it before F6 starts.
 */

export interface SourceRow {
  sourceSheet: string;
  sourceRow: number;
  plateRaw: string;
  serialNumber: string;
  status: string;
  category: string;
  segment: string;
  subSegment: string;
  brand: string;
  axleCount: number;
  totalTires: number;
  submittedAt: string | null;
  raw: Record<string, unknown>;
}

export interface VehicleGroup {
  plateKey: string;
  /** Attributes taken from the most recent row (PLAN/11 §8 step 4). */
  representative: SourceRow;
  inspections: SourceRow[];
}

export interface ConflictGroup {
  plateKey: string;
  rows: SourceRow[];
  /** Which fields disagree across the group. */
  conflictingFields: string[];
}

export interface DeduplicationResult {
  consistent: VehicleGroup[];
  conflicts: ConflictGroup[];
}

/** Fields that must agree for rows to describe the same vehicle. */
const IDENTITY_FIELDS = ["category", "segment", "subSegment", "axleCount", "totalTires"] as const;

function byPlateKey(rows: readonly SourceRow[]): Map<string, SourceRow[]> {
  const groups = new Map<string, SourceRow[]>();

  for (const row of rows) {
    const key = plateKeyOf(row.plateRaw);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return groups;
}

function mostRecent(rows: readonly SourceRow[]): SourceRow {
  return [...rows].sort((a, b) => {
    const left = a.submittedAt ?? "";
    const right = b.submittedAt ?? "";
    return right.localeCompare(left);
  })[0]!;
}

export function deduplicate(rows: readonly SourceRow[]): DeduplicationResult {
  const consistent: VehicleGroup[] = [];
  const conflicts: ConflictGroup[] = [];

  for (const [plateKey, group] of byPlateKey(rows)) {
    // A group of one is always safe.
    if (group.length === 1) {
      consistent.push({ plateKey, representative: group[0]!, inspections: group });
      continue;
    }

    const conflictingFields = IDENTITY_FIELDS.filter((field) => {
      const values = new Set(group.map((row) => String(row[field])));
      return values.size > 1;
    });

    if (conflictingFields.length === 0) {
      consistent.push({ plateKey, representative: mostRecent(group), inspections: group });
      continue;
    }

    conflicts.push({ plateKey, rows: group, conflictingFields: [...conflictingFields] });
  }

  return { consistent, conflicts };
}

/**
 * Which groups actually violate the locking rule.
 *
 * IMPORTANT (PLAN/07 §3.1): a plate that repeats with `dropped_qc` is NOT a
 * duplicate and needs no resolution. It is the correct pattern under
 * `PLAN/11` §5.4 — rejected, then submitted again. Treating those as conflicts
 * produces hundreds of false findings that eat the quarantine time meant for
 * real ones.
 *
 * Only rows in a locking status can collide.
 */
const LOCKING_LEGACY_STATUSES = ["pending_qc", "needs_revision", "passed_qc"];

export function findLockingCollisions(groups: readonly VehicleGroup[]): VehicleGroup[] {
  return groups.filter((group) => {
    const locking = group.inspections.filter((row) =>
      LOCKING_LEGACY_STATUSES.includes(row.status),
    );
    return locking.length > 1;
  });
}

/** Counts for the F6 week-1 report, before any policy is fixed. */
export interface DeduplicationReport {
  totalRows: number;
  distinctVehicles: number;
  groupsWithMultipleInspections: number;
  conflictGroups: number;
  lockingCollisions: number;
  conflictsByField: Record<string, number>;
}

export function report(rows: readonly SourceRow[]): DeduplicationReport {
  const result = deduplicate(rows);
  const conflictsByField: Record<string, number> = {};

  for (const conflict of result.conflicts) {
    for (const field of conflict.conflictingFields) {
      conflictsByField[field] = (conflictsByField[field] ?? 0) + 1;
    }
  }

  return {
    totalRows: rows.length,
    distinctVehicles: result.consistent.length + result.conflicts.length,
    groupsWithMultipleInspections: result.consistent.filter((g) => g.inspections.length > 1).length,
    conflictGroups: result.conflicts.length,
    lockingCollisions: findLockingCollisions(result.consistent).length,
    conflictsByField,
  };
}
