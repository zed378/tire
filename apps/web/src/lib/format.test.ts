import { describe, expect, it } from "vitest";
import {
  endOfDayIso,
  formatBytes,
  formatDate,
  formatDateTime,
  formatRelative,
  startOfDayIso,
} from "./format.ts";

/**
 * Date handling is worth testing precisely because it looks trivial.
 *
 * The legacy QC filter used mm/dd/yyyy — an American format in an Indonesian
 * application (PLAN/02 §4). A date range built on that quietly selects the wrong
 * month, and nothing about the screen says so.
 */
describe("dates render as dd/mm/yyyy in WIB", () => {
  it("formats a date the way an Indonesian reader expects", () => {
    // 2026-03-05 is 5 March, not 3 May.
    expect(formatDate("2026-03-05T04:00:00.000Z")).toBe("05/03/2026");
  });

  it("renders times in WIB rather than UTC", () => {
    // 17:00 UTC is midnight WIB on the following day. The date and time are
    // asserted separately rather than as one literal: the separator between them
    // comes from ICU's id-ID data and varies between Node versions, which would
    // make this test fail for a reason that has nothing to do with the product.
    const rendered = formatDateTime("2026-03-05T17:00:00.000Z");

    expect(rendered).toContain("06/03/2026");
    expect(rendered).toMatch(/00[.:]00/);
  });

  it("shows an em dash rather than 'Invalid Date' for a missing value", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });
});

describe("date inputs convert to WIB day boundaries", () => {
  it("starts the day at 00:00 WIB, not 00:00 UTC", () => {
    // A filter picking 5 March must not include the evening of 4 March.
    expect(startOfDayIso("2026-03-05")).toBe("2026-03-04T17:00:00.000Z");
  });

  it("ends the day at 23:59 WIB", () => {
    expect(endOfDayIso("2026-03-05")).toBe("2026-03-05T16:59:59.000Z");
  });
});

describe("relative time", () => {
  it("reads naturally for recent moments", () => {
    expect(formatRelative(new Date(Date.now() - 30_000))).toBe("baru saja");
    expect(formatRelative(new Date(Date.now() - 5 * 60_000))).toBe("5 menit lalu");
    expect(formatRelative(new Date(Date.now() - 3 * 60 * 60_000))).toBe("3 jam lalu");
  });

  it("falls back to an absolute date once it is far enough away", () => {
    const longAgo = new Date(Date.now() - 200 * 24 * 60 * 60_000);
    expect(formatRelative(longAgo)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe("byte sizes", () => {
  it.each([
    [512, "512 B"],
    [1024 * 400, "400 KB"],
    [1024 * 1024 * 2.5, "2.5 MB"],
    [1024 * 1024 * 1024 * 84, "84.00 GB"],
  ])("formats %i as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
