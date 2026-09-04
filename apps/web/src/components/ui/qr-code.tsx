import { type ReactNode } from "react";
import qrcode from "qrcode-generator";

/**
 * The TOTP enrolment QR code (PLAN/13 §3), rendered as SVG.
 *
 * ── WHY THE ENCODER IS NOT HAND-WRITTEN ─────────────────────────────────────
 * It was, and it did not work. Authenticator apps showed the code, refused to
 * scan it, and reported "something went wrong" — nobody could enrol.
 *
 * The reason is the payload's length. `otpauth://totp/Commercial%202026:<user>
 * ?secret=…&period=30&digits=6&algorithm=SHA1&issuer=Commercial%202026` runs to
 * 122–136 characters, which forces QR **version 7**. Two requirements arrive at
 * exactly that version, and the hand-written encoder met neither:
 *
 *   VERSION INFORMATION. From version 7 the symbol must carry an 18-bit version
 *   block, duplicated beside the top-right and bottom-left finder patterns
 *   (ISO/IEC 18004 §8.10). It is how a decoder learns the symbol's size. The old
 *   code never drew it — and never reserved its area either, so data was written
 *   where a decoder expects that block to be.
 *
 *   BLOCK INTERLEAVING. Above the smallest versions the codewords are split into
 *   several Reed-Solomon blocks and interleaved (§8.6). The old code computed a
 *   single block over all the data, which no decoder can resolve.
 *
 * Either alone makes the symbol unreadable. Implementing both correctly is a few
 * hundred lines of specification work with no decoder on hand to check it
 * against — which is how the first attempt came to be confidently wrong. The
 * encoding is now `qrcode-generator`: Kazuhiko Arase's implementation, no
 * dependencies, ~10 KB, and old enough to have been read by a great many people.
 *
 * ── WHAT IS STILL OURS ──────────────────────────────────────────────────────
 * The rendering. The library can emit its own markup, and that markup carries
 * inline styles, which decision A-07's CSP forbids outright. So we take the
 * module matrix and draw the SVG here: one `<path>`, no `style` attribute
 * anywhere. That was the right half of the original idea.
 */

export interface QRCodeSVGProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Quiet zone, in modules.
 *
 * Four is the specification's minimum (§9.1) and not decoration: a scanner
 * needs the blank margin to find the symbol's edges at all. The previous two
 * made an already-invalid symbol harder still to acquire.
 */
const QUIET_ZONE = 4;

export function QRCodeSVG({ value, size = 200, className }: QRCodeSVGProps): ReactNode {
  const modules = buildModules(value);

  if (modules === null) {
    return (
      <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-line bg-surface-sunken text-xs text-muted">
        Gagal memuat Kode QR
      </div>
    );
  }

  const moduleCount = modules.length;
  const totalSize = moduleCount + QUIET_ZONE * 2;

  let pathData = "";
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (modules[row]?.[column] === true) {
        pathData += `M${String(column + QUIET_ZONE)},${String(row + QUIET_ZONE)}h1v1h-1z `;
      }
    }
  }

  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-2xl border border-line bg-surface p-4 shadow-md ${
        className ?? ""
      }`}
    >
      <svg
        viewBox={`0 0 ${String(totalSize)} ${String(totalSize)}`}
        width={size}
        height={size}
        className="h-auto w-full max-w-[210px] rounded-lg"
        role="img"
        aria-label="Kode QR untuk aplikasi authenticator"
      >
        {/*
          Fixed black on fixed white, in both themes. A QR code is read by a
          camera measuring contrast, not by a person reading a page — theming it
          would be theming a measurement. The white ground is what the quiet zone
          is made of, so it must be painted rather than inherited.
        */}
        <rect x="0" y="0" width={totalSize} height={totalSize} fill="#FFFFFF" />
        <path d={pathData} fill="#000000" />
      </svg>
    </div>
  );
}

/**
 * The module matrix, or `null` if the payload cannot be encoded at all.
 *
 * Error correction level M — the level the enrolment URI has always used, and
 * the usual choice for one: enough redundancy for a phone camera at an angle,
 * without inflating the symbol until its modules are too small to resolve on a
 * screen.
 */
function buildModules(value: string): boolean[][] | null {
  if (value === "") return null;

  try {
    // Type version 0 asks the library to choose the smallest version that fits.
    const qr = qrcode(0, "M");
    qr.addData(value, "Byte");
    qr.make();

    const count = qr.getModuleCount();
    return Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (_, column) => qr.isDark(row, column)),
    );
  } catch {
    // Only a payload too large for the largest symbol reaches here. Showing the
    // fallback beats throwing inside a render.
    return null;
  }
}
