import { randomBytes } from "node:crypto";
import { getPrisma } from "../db.ts";

/**
 * Short, permanent URLs for photographs (`PLAN/05` §7).
 *
 * WHY THIS EXISTS. The signed download token is roughly 300 characters, and an
 * Excel cell stops at 32,767. A six-axle truck has 22 tire positions at up to
 * ten photographs each, so an export that lists every link by signed URL does
 * not fit in the cell it belongs in — the links had to be truncated with a note
 * pointing at another sheet. A code of sixteen characters makes the same link
 * about sixty, and 220 of them fit with room to spare.
 *
 * THE CODE IS THE AUTHORISATION, exactly as the signature was. There is no
 * session behind it and no other check: whoever holds the URL can see that
 * photograph. So the code is generated from a CSPRNG rather than from anything
 * sequential, derived, or guessable — a counter, a hash of the key, or a short
 * random string would each turn the table into a directory of every customer's
 * fleet.
 */

/**
 * base58: the digits and letters, less the four that are misread.
 *
 * `0`/`O` and `1`/`l`/`I` are dropped because these links get read aloud and
 * typed by hand in the field. Sixteen characters of it is about 93 bits.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const CODE_LENGTH = 16;

/**
 * The path a short link is served from.
 *
 * Under `/api/uploads/` on purpose: `kernel/http/hosts.ts` restricts the storage
 * hostname to exactly that prefix, and a new top-level path would mean widening
 * that boundary to save four characters.
 */
export const SHORT_LINK_PREFIX = "/api/uploads/s/";

export function generatePhotoLinkCode(): string {
  // Rejection-free: 58 does not divide 256, so a plain modulo would bias the
  // first fourteen characters of the alphabet. Drawing a byte at a time and
  // discarding the biased tail keeps the distribution flat.
  const code: string[] = [];
  while (code.length < CODE_LENGTH) {
    for (const byte of randomBytes(CODE_LENGTH)) {
      if (byte >= 232) continue; // 232 = 4 × 58; above it the modulo is skewed.
      code.push(ALPHABET[byte % ALPHABET.length] ?? "");
      if (code.length === CODE_LENGTH) break;
    }
  }
  return code.join("");
}

/**
 * The code for a storage key, minting one the first time it is asked for.
 *
 * Stable per key, so re-exporting the same inspection produces the same links.
 * A new code each time would work, and would leave the table growing by one row
 * per photograph per export forever.
 */
export async function photoLinkCodeFor(storageKey: string): Promise<string> {
  const existing = await getPrisma().photoLink.findUnique({
    where: { storageKey },
    select: { code: true },
  });
  if (existing !== null) return existing.code;

  const code = generatePhotoLinkCode();

  // Two exports of the same photograph can race here. The unique index on
  // `storage_key` decides, and the loser reads the winner's code rather than
  // failing the export it was in the middle of.
  const created = await getPrisma()
    .photoLink.create({ data: { code, storageKey }, select: { code: true } })
    .catch(async () => {
      const winner = await getPrisma().photoLink.findUnique({
        where: { storageKey },
        select: { code: true },
      });
      return winner;
    });

  return created?.code ?? code;
}

/** The storage key a code stands for, or `null` if it stands for nothing. */
export async function storageKeyForPhotoLink(code: string): Promise<string | null> {
  const row = await getPrisma().photoLink.findUnique({
    where: { code },
    select: { storageKey: true },
  });
  return row?.storageKey ?? null;
}
