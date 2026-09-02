import { type ReactNode } from "react";

/**
 * Pure TypeScript SVG QR Code Generator for TOTP / 2MFA (PLAN/13 §3).
 *
 * Generates clean, scannable QR Code SVGs for Google Authenticator, Authy,
 * Microsoft Authenticator, 1Password, etc., with zero third-party dependencies
 * and zero inline styles (100% CSP compliant).
 */

export interface QRCodeSVGProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeSVG({ value, size = 200, className }: QRCodeSVGProps): ReactNode {
  const qr = generateQRCodeMatrix(value);
  if (!qr) {
    return (
      <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500">
        Gagal memuat Kode QR
      </div>
    );
  }

  const { matrix, moduleCount } = qr;
  const margin = 2;
  const totalSize = moduleCount + margin * 2;

  let pathData = "";
  for (let r = 0; r < moduleCount; r++) {
    const row = matrix[r];
    if (!row) continue;
    for (let c = 0; c < moduleCount; c++) {
      if (row[c]) {
        const x = c + margin;
        const y = r + margin;
        pathData += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-md dark:border-slate-800 dark:bg-slate-900 ${
        className ?? ""
      }`}
    >
      <svg
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        width={size}
        height={size}
        className="h-auto w-full max-w-[210px] rounded-lg"
        aria-label="Kode QR TOTP Authenticator"
      >
        <rect x="0" y="0" width={totalSize} height={totalSize} fill="#FFFFFF" />
        <path d={pathData} fill="#0F172A" />
      </svg>
    </div>
  );
}

// ── QR Code Matrix Generator Engine ──────────────────────────────────────────

interface QRMatrix {
  matrix: boolean[][];
  moduleCount: number;
}

interface VersionInfo {
  version: number;
  size: number;
  totalCodewords: number;
  ecCodewords: number;
  dataCapacity: number;
  alignPos: number[];
}

const VERSIONS: VersionInfo[] = [
  { version: 1, size: 21, totalCodewords: 26, ecCodewords: 10, dataCapacity: 16, alignPos: [] },
  { version: 2, size: 25, totalCodewords: 44, ecCodewords: 16, dataCapacity: 28, alignPos: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, ecCodewords: 26, dataCapacity: 44, alignPos: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, ecCodewords: 36, dataCapacity: 64, alignPos: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, ecCodewords: 48, dataCapacity: 86, alignPos: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, ecCodewords: 64, dataCapacity: 108, alignPos: [6, 34] },
  { version: 7, size: 45, totalCodewords: 196, ecCodewords: 72, dataCapacity: 124, alignPos: [6, 22, 38] },
  { version: 8, size: 49, totalCodewords: 242, ecCodewords: 88, dataCapacity: 154, alignPos: [6, 24, 42] },
  { version: 9, size: 53, totalCodewords: 292, ecCodewords: 110, dataCapacity: 182, alignPos: [6, 26, 46] },
  { version: 10, size: 57, totalCodewords: 346, ecCodewords: 130, dataCapacity: 216, alignPos: [6, 28, 50] },
];

function generateQRCodeMatrix(text: string): QRMatrix | null {
  const bytes = new TextEncoder().encode(text);
  const dataLen = bytes.length;

  const verInfo = VERSIONS.find((v) => v.dataCapacity >= dataLen + 3);
  if (!verInfo) return null;

  const N = verInfo.size;
  const matrix: boolean[][] = Array.from({ length: N }, () => Array<boolean>(N).fill(false));
  const reserved: boolean[][] = Array.from({ length: N }, () => Array<boolean>(N).fill(false));

  drawFinderPattern(matrix, reserved, 0, 0);
  drawFinderPattern(matrix, reserved, N - 7, 0);
  drawFinderPattern(matrix, reserved, 0, N - 7);

  for (const r of verInfo.alignPos) {
    for (const c of verInfo.alignPos) {
      if ((r === 6 && c === 6) || (r === 6 && c === N - 7) || (r === N - 7 && c === 6)) continue;
      drawAlignmentPattern(matrix, reserved, r, c);
    }
  }

  for (let i = 8; i < N - 8; i++) {
    if (!reserved[6]![i]) {
      matrix[6]![i] = i % 2 === 0;
      reserved[6]![i] = true;
    }
    if (!reserved[i]![6]) {
      matrix[i]![6] = i % 2 === 0;
      reserved[i]![6] = true;
    }
  }

  for (let i = 0; i < 9; i++) {
    reserved[8]![i] = true;
    reserved[i]![8] = true;
    if (i < 8) {
      reserved[8]![N - 1 - i] = true;
      reserved[N - 1 - i]![8] = true;
    }
  }
  reserved[N - 8]![8] = true;

  const bits = encodeBitstream(bytes, verInfo.dataCapacity);
  const dataCodewords = bitsToCodewords(bits, verInfo.dataCapacity);
  const ecCodewords = calcReedSolomon(dataCodewords, verInfo.ecCodewords);
  const allCodewords = [...dataCodewords, ...ecCodewords];

  const fullBits: boolean[] = [];
  for (const byte of allCodewords) {
    for (let b = 7; b >= 0; b--) {
      fullBits.push(((byte >> b) & 1) === 1);
    }
  }

  let bitIdx = 0;
  let dirUp = true;
  for (let c = N - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    const rows = dirUp
      ? Array.from({ length: N }, (_, i) => N - 1 - i)
      : Array.from({ length: N }, (_, i) => i);

    for (const r of rows) {
      for (const col of [c, c - 1]) {
        if (!reserved[r]![col]) {
          const bitVal = bitIdx < fullBits.length ? (fullBits[bitIdx++] ?? false) : false;
          matrix[r]![col] = (r + col) % 2 === 0 ? !bitVal : bitVal;
        }
      }
    }
    dirUp = !dirUp;
  }

  const formatInfo = 0b101010000010010;
  drawFormatBits(matrix, N, formatInfo);

  return { matrix, moduleCount: N };
}

function drawFinderPattern(m: boolean[][], r: boolean[][], top: number, left: number) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const y = top + dy;
      const x = left + dx;
      if (y >= 0 && y < m.length && x >= 0 && x < m.length) {
        r[y]![x] = true;
        if (dy >= 0 && dy < 7 && dx >= 0 && dx < 7) {
          const isOuter = dy === 0 || dy === 6 || dx === 0 || dx === 6;
          const isInner = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
          m[y]![x] = isOuter || isInner;
        }
      }
    }
  }
}

function drawAlignmentPattern(m: boolean[][], r: boolean[][], cy: number, cx: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const y = cy + dy;
      const x = cx + dx;
      if (y >= 0 && y < m.length && x >= 0 && x < m.length) {
        r[y]![x] = true;
        const isOuter = Math.abs(dy) === 2 || Math.abs(dx) === 2;
        const isCenter = dy === 0 && dx === 0;
        m[y]![x] = isOuter || isCenter;
      }
    }
  }
}

function drawFormatBits(m: boolean[][], N: number, formatBits: number) {
  const getBit = (i: number) => ((formatBits >> i) & 1) === 1;

  for (let i = 0; i < 6; i++) m[8]![i] = getBit(14 - i);
  m[8]![7] = getBit(8);
  m[8]![8] = getBit(7);
  m[7]![8] = getBit(6);
  for (let i = 0; i < 6; i++) m[5 - i]![8] = getBit(5 - i);

  for (let i = 0; i < 8; i++) m[8]![N - 1 - i] = getBit(i);
  for (let i = 0; i < 7; i++) m[N - 1 - i]![8] = getBit(14 - i);
  m[N - 8]![8] = true;
}

function encodeBitstream(bytes: Uint8Array, capacityBytes: number): boolean[] {
  const bits: boolean[] = [];

  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push(((val >> i) & 1) === 1);
    }
  };

  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);

  for (const b of bytes) {
    pushBits(b, 8);
  }

  const maxBits = capacityBytes * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  while (bits.length % 8 !== 0) {
    bits.push(false);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2]!, 8);
    padIdx++;
  }

  return bits;
}

function bitsToCodewords(bits: boolean[], capacityBytes: number): number[] {
  const codewords: number[] = [];
  for (let i = 0; i < capacityBytes; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      val = (val << 1) | (bits[i * 8 + b] ? 1 : 0);
    }
    codewords.push(val);
  }
  return codewords;
}

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x]! + GF_LOG[y]!]!;
}

function calcReedSolomon(data: number[], ecCount: number): number[] {
  let genPoly = [1];
  for (let i = 0; i < ecCount; i++) {
    const nextPoly = new Array<number>(genPoly.length + 1).fill(0);
    for (let j = 0; j < genPoly.length; j++) {
      const gVal = genPoly[j]!;
      nextPoly[j] = (nextPoly[j] ?? 0) ^ gfMul(gVal, GF_EXP[i]!);
      nextPoly[j + 1] = (nextPoly[j + 1] ?? 0) ^ gVal;
    }
    genPoly = nextPoly;
  }

  const result = new Array<number>(ecCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result[0] ?? 0);
    result.shift();
    result.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i++) {
        result[i] = (result[i] ?? 0) ^ gfMul(genPoly[i]!, factor);
      }
    }
  }

  return result;
}
