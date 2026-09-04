import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import qrcode from "qrcode-generator";
import { QRCodeSVG } from "./qr-code.tsx";

/**
 * The enrolment QR code had to be scannable, and was not.
 *
 * Authenticator apps displayed it, refused it, and said "something went wrong".
 * The cause was the payload's length: a real `otpauth://` URI for this issuer is
 * 122–136 characters, which forces QR version 7 — the exact version at which
 * version-information blocks and Reed-Solomon block interleaving both become
 * mandatory, and the hand-written encoder implemented neither.
 *
 * These tests are written against the payload the server actually produces, not
 * against a short string that would have fitted in a version the old encoder
 * happened to get right.
 */

/** Exactly what `buildOtpauthUri` returns: `otplib`'s `keyuri`, issuer and all. */
const REAL_URI =
  "otpauth://totp/Commercial%202026:zawawi" +
  "?secret=MBYWWTICCUQWMLYE&period=30&digits=6&algorithm=SHA1&issuer=Commercial%202026";

const LONG_USERNAME_URI =
  "otpauth://totp/Commercial%202026:zawawi_data_supplier" +
  "?secret=MBYWWTICCUQWMLYE&period=30&digits=6&algorithm=SHA1&issuer=Commercial%202026";

/**
 * The dark modules of the rendered symbol, read back out of the SVG path.
 *
 * The component draws one `M<x>,<y>h1v1h-1z` per dark module, so the path is a
 * faithful record of the matrix — which is what a camera sees, and therefore the
 * only thing worth asserting on.
 */
function renderedModules(value: string): { points: Set<string>; viewBox: number } {
  const { container } = render(<QRCodeSVG value={value} />);

  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("no svg rendered");

  const viewBox = Number(svg.getAttribute("viewBox")?.split(" ")[2] ?? 0);
  const path = svg.querySelector("path")?.getAttribute("d") ?? "";

  const points = new Set<string>();
  for (const match of path.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    points.add(`${String(match[1])},${String(match[2])}`);
  }

  return { points, viewBox };
}

/** The same payload through the reference encoder, offset by the quiet zone. */
function referenceModules(value: string, quietZone: number): Set<string> {
  const qr = qrcode(0, "M");
  qr.addData(value, "Byte");
  qr.make();

  const points = new Set<string>();
  for (let row = 0; row < qr.getModuleCount(); row += 1) {
    for (let column = 0; column < qr.getModuleCount(); column += 1) {
      if (qr.isDark(row, column)) {
        points.add(`${String(column + quietZone)},${String(row + quietZone)}`);
      }
    }
  }
  return points;
}

describe("the QR code an authenticator has to read", () => {
  it("encodes the real enrolment URI exactly as a reference encoder does", () => {
    // Module for module. Anything less would pass on a symbol that merely looks
    // like a QR code, which is what the previous encoder produced.
    const rendered = renderedModules(REAL_URI);
    expect(rendered.points).toEqual(referenceModules(REAL_URI, 4));
  });

  it("encodes it correctly at the length a longer username produces", () => {
    const rendered = renderedModules(LONG_USERNAME_URI);
    expect(rendered.points).toEqual(referenceModules(LONG_USERNAME_URI, 4));
  });

  it("reaches version 7, which is where the old encoder broke", () => {
    // 45 modules is version 7 — ((45 - 17) / 4). Version information blocks and
    // block interleaving are both mandatory from here, and neither was
    // implemented. This asserts the payload really does land in that territory,
    // so the test above is exercising the case that failed rather than a small
    // symbol that happened to work.
    const qr = qrcode(0, "M");
    qr.addData(REAL_URI, "Byte");
    qr.make();

    expect(qr.getModuleCount()).toBe(45);
    expect((qr.getModuleCount() - 17) / 4).toBeGreaterThanOrEqual(7);
  });

  it("surrounds the symbol with the four-module quiet zone the spec requires", () => {
    // §9.1. A scanner needs the blank margin to find the symbol's edges; the
    // previous rendering left two.
    const { viewBox } = renderedModules(REAL_URI);
    expect(viewBox).toBe(45 + 4 * 2);
  });
});

describe("what it renders", () => {
  it("uses no inline style, because the CSP has no unsafe-inline", () => {
    // Decision A-07. The library can emit its own markup and that markup carries
    // inline styles, which is the reason the drawing stays here.
    const { container } = render(<QRCodeSVG value={REAL_URI} />);
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("paints fixed black on fixed white in either theme", () => {
    // A camera measures contrast. Theming a QR code themes a measurement.
    const { container } = render(<QRCodeSVG value={REAL_URI} />);
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("#FFFFFF");
    expect(container.querySelector("path")?.getAttribute("fill")).toBe("#000000");
  });

  it("names itself for a screen reader", () => {
    const { container } = render(<QRCodeSVG value={REAL_URI} />);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("authenticator");
  });

  it("says so rather than rendering an empty symbol when there is nothing to encode", () => {
    const { container } = render(<QRCodeSVG value="" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toContain("Gagal memuat Kode QR");
  });
});
