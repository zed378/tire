import { describe, expect, it } from "vitest";
import { generatePhotoLinkCode, SHORT_LINK_PREFIX } from "./photo-link.ts";

/**
 * The code that replaces the signature.
 *
 * A short link carries no session and no other check: whoever holds the URL sees
 * that photograph. The code is therefore doing exactly the job the HMAC
 * signature does on the long form, and the properties that matter are the same
 * ones — enough entropy that guessing is not a strategy, and no structure an
 * attacker can walk.
 *
 * These are the properties, not the implementation. A different alphabet or a
 * different length would be fine; a predictable code would not.
 */

const ALPHABET = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

describe("generatePhotoLinkCode", () => {
  it("is long enough that guessing is not a strategy", () => {
    // 16 characters of a 58-symbol alphabet is about 93 bits. The migration
    // carries the same floor as a CHECK constraint, so a shorter one cannot be
    // written even by a different code path.
    expect(generatePhotoLinkCode()).toHaveLength(16);
  });

  it("uses only characters that survive being read aloud", () => {
    // base58: no 0/O, no 1/l/I. These links get dictated over the phone and
    // typed by hand in a workshop.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(generatePhotoLinkCode()).toMatch(ALPHABET);
    }
  });

  it("never repeats", () => {
    // Not a proof, but a collision here would be a photograph served under
    // another photograph's link, so the cheap check earns its place.
    const codes = new Set(Array.from({ length: 2_000 }, () => generatePhotoLinkCode()));
    expect(codes.size).toBe(2_000);
  });

  it("draws every symbol about equally often", () => {
    /*
     * The bias this guards against, and why it is worth the arithmetic.
     *
     * 58 does not divide 256, so a plain `byte % 58` maps the top of the byte
     * range onto the first fourteen symbols and makes them roughly a third more
     * likely than the rest. The output still looks random and still uses the
     * whole alphabet — counting distinct symbols would not notice — while
     * quietly costing entropy, which is the one property this scheme rests on.
     *
     * So the frequencies are compared rather than the variety: the fourteen
     * symbols a naive modulo would favour against the forty-four it would not.
     */
    const SYMBOLS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const FAVOURED = 256 % SYMBOLS.length; // The 14 a modulo would over-draw.

    const counts = new Map<string, number>();
    for (let attempt = 0; attempt < 2_000; attempt += 1) {
      for (const character of generatePhotoLinkCode()) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }

    const mean = (symbols: string): number => {
      const total = [...symbols].reduce((sum, symbol) => sum + (counts.get(symbol) ?? 0), 0);
      return total / symbols.length;
    };

    const favoured = mean(SYMBOLS.slice(0, FAVOURED));
    const rest = mean(SYMBOLS.slice(FAVOURED));

    // A fair draw sits at 1.0; the naive modulo sits near 1.33. Ten per cent of
    // slack keeps this from flaking on ordinary sampling noise.
    expect(favoured / rest).toBeLessThan(1.1);
  });

  it("is not derived from anything", () => {
    // Two calls in the same millisecond must not agree. A timestamp, a counter,
    // or a hash of the storage key would each turn the table into a directory.
    expect(generatePhotoLinkCode()).not.toBe(generatePhotoLinkCode());
  });
});

describe("SHORT_LINK_PREFIX", () => {
  it("stays under the path the storage host is restricted to", () => {
    // `kernel/http/hosts.ts` serves exactly `/api/uploads/` on that hostname. A
    // top-level path would mean widening that boundary to save four characters.
    expect(SHORT_LINK_PREFIX.startsWith("/api/uploads/")).toBe(true);
  });

  it("makes a link short enough for the cell that needed it", () => {
    // The reason this exists: 220 signed URLs at ~340 characters overflow an
    // Excel cell. The same count of short links has to fit with room to spare.
    const url = `https://tire-store.zedth.my.id${SHORT_LINK_PREFIX}${generatePhotoLinkCode()}`;

    expect(url.length).toBeLessThan(70);
    expect(220 * (url.length + 1)).toBeLessThan(32_767);
  });
});
