import {
  normalizePlateDisplay,
  plateKeyOf,
  PLATE_DISPLAY_PATTERN,
  SUB_SEGMENTS_BY_SEGMENT,
  validateAxleConfiguration,
  type AxleConfig,
  type VehicleCategory,
  type VehicleSegment,
} from "@c26/contracts";

/**
 * Transformations from the legacy sheets (PLAN/07 §3.1).
 *
 * Every function returns either a value or a quarantine reason. None of them
 * guesses. PLAN/07 §2 rule 3 is the governing principle: dirty data is carried
 * across and quarantined, never silently corrected, because a script that infers
 * what a human meant produces mistakes that are harder to find than the dirty
 * data was.
 */

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string; detail: string };

function fail<T>(reason: string, detail: string): Outcome<T> {
  return { ok: false, reason, detail };
}

// ── Plate numbers ───────────────────────────────────────────────────────────

/**
 * D-05 means the source data already contains invalid plates: `!` was observed
 * getting through the legacy form.
 *
 * The character is NOT stripped. `B1234ABC!` might be a typo for `B1234ABC1`,
 * and silently deleting the character would turn an obvious error into a wrong
 * value that looks correct.
 */
export function normalisePlate(raw: string): Outcome<{ display: string; key: string }> {
  const display = normalizePlateDisplay(raw);

  if (display === "") return fail("INVALID_PLATE", "empty plate");
  if (!PLATE_DISPLAY_PATTERN.test(display)) {
    return fail("INVALID_PLATE", `does not match the Indonesian civil plate pattern: "${raw}"`);
  }

  const key = plateKeyOf(display);
  if (key.length < 3 || key.length > 9) {
    return fail("INVALID_PLATE", `normalised key has an implausible length: "${key}"`);
  }

  return { ok: true, value: { display, key } };
}

// ── Segmentation ────────────────────────────────────────────────────────────

export interface Segmentation {
  category: VehicleCategory;
  segment: VehicleSegment;
  subSegment: string;
}

/**
 * The legacy system stored one combined string: `"TB - Truck (General Cargo)"`.
 * The target uses three typed columns.
 *
 * A row that does not match the pattern is quarantined rather than guessed at.
 */
export function parseSegmentation(raw: string): Outcome<Segmentation> {
  const match = raw.trim().match(/^(TB|LT)\s*-\s*(Truck|Bus)\s*\((.+)\)$/i);
  if (match === null) {
    return fail("UNPARSEABLE_SEGMENTATION", `does not match "{category} - {segment} ({sub})": "${raw}"`);
  }

  const category = match[1]!.toUpperCase() as VehicleCategory;
  const segment = match[2]!.toLowerCase() as VehicleSegment;
  const subSegment = match[3]!.trim();

  // V-09. D-03 means the source may well contain LT + Bus, because the legacy
  // form never stopped it. That is a real contradiction in the data and a person
  // has to decide which half is right.
  if (category === "LT" && segment === "bus") {
    return fail("LT_WITH_BUS_SEGMENT", `category LT with segment bus: "${raw}"`);
  }

  const allowed: readonly string[] = SUB_SEGMENTS_BY_SEGMENT[segment];
  if (!allowed.includes(subSegment)) {
    return fail("UNKNOWN_SUB_SEGMENT", `"${subSegment}" is not a known ${segment} sub-segment`);
  }

  return { ok: true, value: { category, segment, subSegment } };
}

// ── Axle configuration ──────────────────────────────────────────────────────

export interface AxleSource {
  axleCount: number;
  steerCount: number;
  steerMounting: string;
  driveCount: number;
  driveMounting: string;
  freeRollingCount: number;
  freeRollingMounting: string;
}

export interface AxleResolution {
  axleCount: number;
  configs: AxleConfig[];
  /** True when the declared axle count was corrected to match the detail. */
  adjusted: boolean;
}

function mounting(raw: string): "single" | "double" {
  return raw.trim().toLowerCase().startsWith("d") ? "double" : "single";
}

/**
 * Resolves an axle configuration, applying the D-04 policy from PLAN/07 §3.2.
 *
 * The source was never validated, so `Jumlah Poros = 6` with three detailed
 * axles is expected to appear. Three routes exist and the document recommends
 * choosing by status:
 *
 *   passed_qc  -> quarantine. A human already reviewed those photographs and
 *                 approved them; the data is too important to guess at.
 *   everything -> trust the detail and correct the declared count. The tire
 *   else         total stays right, and the tire total is what QC was looking
 *                at when it decided.
 *
 * `PLAN/08` R-05 rates this likely and asks for it to be measured in F6 week 1
 * before the policy is fixed.
 */
export function resolveAxleConfiguration(
  source: AxleSource,
  legacyStatus: string,
): Outcome<AxleResolution> {
  const configs: AxleConfig[] = [
    { axleType: "steer", axleCount: source.steerCount, mounting: "single" },
    { axleType: "drive", axleCount: source.driveCount, mounting: mounting(source.driveMounting) },
  ];

  if (source.freeRollingCount > 0) {
    configs.push({
      axleType: "free_rolling",
      axleCount: source.freeRollingCount,
      mounting: mounting(source.freeRollingMounting),
    });
  }

  const detailSum = configs.reduce((sum, config) => sum + config.axleCount, 0);
  const consistent = detailSum === source.axleCount;

  if (!consistent && legacyStatus === "passed_qc") {
    return fail(
      "AXLE_SUM_MISMATCH_ON_PASSED",
      `declared ${String(source.axleCount)} axles, detail sums to ${String(detailSum)}, and the inspection already passed QC`,
    );
  }

  const axleCount = consistent ? source.axleCount : detailSum;
  const errors = validateAxleConfiguration({ axleCount, configs });

  if (errors.length > 0) {
    return fail(
      "INVALID_AXLE_CONFIGURATION",
      errors.map((error) => error.message).join("; "),
    );
  }

  return { ok: true, value: { axleCount, configs, adjusted: !consistent } };
}

// ── Photo paths ─────────────────────────────────────────────────────────────

/**
 * Parses the legacy Drive path convention `{SerialNumber}_{PlatNomor}_{Posisi}`.
 *
 * The position part is an Indonesian LABEL, because the legacy system used the
 * label as its storage path. That is exactly the coupling PLAN/03 §2.3 removes
 * — and the reason the target keeps a stable code separately. Matching here has
 * to go label -> code, using the engine's own naming so migrated photographs
 * land on the positions this system derives.
 *
 * `PLAN/07` §4.1 warns that plates carrying invalid characters (D-05) end up in
 * these paths too. A path that cannot be parsed goes on the orphan list for
 * manual review, never skipped quietly.
 */
export function parsePhotoPath(
  path: string,
  labelToCode: ReadonlyMap<string, string>,
): Outcome<{ serialNumber: string; plateKey: string; positionCode: string | null }> {
  const filename = path.split("/").pop() ?? path;
  const match = filename.match(/^(SN\d{4}-\d+)_([^_]+)_(.+?)(\.[a-z0-9]+)?$/i);

  if (match === null) {
    return fail("UNPARSEABLE_PHOTO_PATH", `does not match the legacy convention: "${path}"`);
  }

  const [, serialNumber, plateRaw, positionRaw] = match;
  const label = positionRaw!.replace(/_/g, " ").trim();

  // The two general slots have no position.
  if (/tampak/i.test(label)) {
    return {
      ok: true,
      value: { serialNumber: serialNumber!, plateKey: plateKeyOf(plateRaw!), positionCode: null },
    };
  }

  const positionCode = labelToCode.get(label.toLowerCase());
  if (positionCode === undefined) {
    return fail("UNKNOWN_POSITION_LABEL", `"${label}" does not match any derived position name`);
  }

  return {
    ok: true,
    value: { serialNumber: serialNumber!, plateKey: plateKeyOf(plateRaw!), positionCode },
  };
}

// ── Status ──────────────────────────────────────────────────────────────────

/**
 * Three legacy statuses map straight across. `draft` and `needs_revision` have
 * no source and stay empty — they are new (PLAN/07 §3.1).
 */
export function mapStatus(raw: string): Outcome<"pending_qc" | "passed_qc" | "dropped_qc"> {
  const normalised = raw.trim().toLowerCase();

  if (normalised.includes("pending")) return { ok: true, value: "pending_qc" };
  if (normalised.includes("pass")) return { ok: true, value: "passed_qc" };
  if (normalised.includes("drop")) return { ok: true, value: "dropped_qc" };

  return fail("UNKNOWN_STATUS", `unrecognised status: "${raw}"`);
}
