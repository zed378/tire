import { describe, expect, it } from "vitest";
import {
  EXPORT_KINDS,
  EXPORT_KIND_LABELS,
  EXPORT_PHOTO_LINK_TTL_SECONDS,
  EXPORT_RETENTION_SECONDS,
  exportFileName,
} from "./report.ts";

/**
 * The two things an export promises outside the spreadsheet itself: what it is
 * called, and how long its links keep working.
 */

describe("exportFileName", () => {
  it("names the export after what it contains and the day it was asked for", () => {
    // Without this the browser saves the storage key, and an operator ends up
    // with `aae0f09f-ee98-46a6-8b9a-bdb261147f8e.xlsx` in their downloads.
    const requestedAt = new Date("2026-09-04T05:28:08.931Z");
    expect(exportFileName("qc", requestedAt)).toBe("Data Quality Control 04-09-2026.xlsx");
  });

  it("uses dd-mm-yyyy, like every other date this application shows", () => {
    // PLAN/02 §4. The legacy QC filter used mm/dd/yyyy — an American format in
    // an Indonesian application.
    const requestedAt = new Date("2026-01-02T03:00:00.000Z");
    expect(exportFileName("tire_specs", requestedAt)).toContain("02-01-2026");
  });

  it("dates it in WIB, which is the day the person asking will remember", () => {
    // 18:00 UTC on the 3rd is 01:00 WIB on the 4th. Naming this file after the
    // 3rd would disagree with the timestamp shown beside it in the application.
    expect(exportFileName("qc", new Date("2026-09-03T18:00:00.000Z"))).toContain("04-09-2026");
  });

  it("has a name for every kind of export", () => {
    for (const kind of EXPORT_KINDS) {
      const name = exportFileName(kind, new Date("2026-09-04T00:00:00.000Z"));
      expect(name, kind).toContain(EXPORT_KIND_LABELS[kind]);
      expect(name, kind).toMatch(/\.xlsx$/);
    }
  });
});

describe("how long an export and its links last", () => {
  it("keeps the export file for a week", () => {
    expect(EXPORT_RETENTION_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("gives the photo links inside it no expiry at all", () => {
    // Asked for explicitly. It is a grant, not a setting: a signed link carries
    // its own authorisation, so one that never expires is permanent
    // unauthenticated access for anyone the spreadsheet reaches. Revoking means
    // rotating STORAGE_SIGNING_KEY, which kills every link in every export.
    expect(EXPORT_PHOTO_LINK_TTL_SECONDS).toBeNull();
  });

  it("stays within what R2 can sign, if it is ever given a number", () => {
    // AWS SigV4 refuses to sign beyond seven days. `null` is refused outright by
    // the S3 driver rather than capped; any number here has to fit.
    if (EXPORT_PHOTO_LINK_TTL_SECONDS !== null) {
      expect(EXPORT_PHOTO_LINK_TTL_SECONDS).toBeLessThanOrEqual(7 * 24 * 60 * 60);
    }
  });
});
