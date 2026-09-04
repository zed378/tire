import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ACCEPTED_PHOTO_MIME_TYPES, MAX_PHOTO_BYTES } from "@c26/contracts";
import { loadConfig } from "../../kernel/config.ts";
import { AppError, wrapRoute } from "../../kernel/envelope/index.ts";
import { getObject } from "../../kernel/storage/index.ts";
import { contentTypeFor } from "../../kernel/storage/driver.ts";
import { storageKeyForPhotoLink } from "../../kernel/storage/photo-link.ts";
import { verifyStorageToken, writeUpload } from "../../kernel/storage/local-driver.ts";

/**
 * The endpoints the local storage driver presigns to.
 *
 * They exist only while `STORAGE_DRIVER=local`. With `s3`, the presigned URL
 * points straight at R2 and these routes are never called — which is the whole
 * point of the driver split: the device does exactly the same thing either way.
 *
 * Authorisation here comes from the token, not from a session. That is
 * deliberate and matches how a presigned URL works: the decision about whether
 * this upload is allowed was made when the token was issued, by a route that had
 * a session, checked ownership, checked the inspection status, and checked both
 * photo caps. The token carries that decision, bound to one storage key, one
 * size, one MIME type, one checksum, and ten minutes.
 */
export function registerUploadRoutes(app: FastifyInstance): void {
  const config = loadConfig();
  if (config.STORAGE_DRIVER !== "local") return;

  // Photos arrive as raw bytes, not JSON or multipart. The global body limit is
  // 2 MB because nothing else should be large; this route needs the 5 MB the
  // photo contract allows.
  app.addContentTypeParser(
    [...ACCEPTED_PHOTO_MIME_TYPES],
    { parseAs: "buffer", bodyLimit: MAX_PHOTO_BYTES },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.put<{ Params: { token: string } }>(
    "/api/uploads/:token",
    { bodyLimit: MAX_PHOTO_BYTES },
    wrapRoute(async (request) => {
      const payload = verifyStorageToken(request.params.token);
      // Forged, altered, or expired all read the same: there is nothing here.
      if (payload === null || payload.operation !== "put") throw new AppError("NOT_FOUND");

      const body = request.body;
      if (!Buffer.isBuffer(body)) {
        throw new AppError("UNSUPPORTED_FILE_TYPE");
      }
      if (body.length > MAX_PHOTO_BYTES) {
        throw new AppError("FILE_TOO_LARGE");
      }

      // The token fixed the expected size and checksum when it was issued. A URL
      // that could be reused to store different bytes would make the presign
      // check meaningless.
      if (body.length !== payload.size) {
        throw new AppError("BAD_REQUEST", {
          message: "Ukuran berkas tidak sesuai dengan yang didaftarkan.",
          context: { expected: payload.size, received: body.length },
        });
      }

      const checksum = createHash("sha256").update(body).digest("hex");
      if (checksum !== payload.checksum) {
        throw new AppError("BAD_REQUEST", {
          message: "Isi berkas tidak sesuai dengan checksum yang didaftarkan.",
        });
      }

      await writeUpload(payload.key, body);
      return { stored: true };
    }, 201),
  );

  /*
   * The short form of a photo link.
   *
   * The code IS the authorisation here, exactly as the signature is on the route
   * below. Sixteen characters of CSPRNG base58 — about 93 bits — is what stands
   * between a stranger and a customer's fleet photograph, so nothing else about
   * the request is trusted: no session, no referer, and no host beyond the
   * boundary `kernel/http/hosts.ts` already enforces.
   *
   * It exists because the signed token is ~300 characters and an Excel cell
   * stops at 32,767, which is not enough for a six-axle truck's photographs.
   */
  app.get<{ Params: { code: string } }>(
    "/api/uploads/s/:code",
    async (request, reply) => {
      const storageKey = await storageKeyForPhotoLink(request.params.code);

      // A code that stands for nothing and a photograph that is no longer there
      // answer identically. Telling them apart would make this an oracle for
      // which codes exist.
      if (storageKey === null) return reply.status(404).send();

      const body = await getObject(storageKey);
      if (body === null) return reply.status(404).send();

      return reply
        .header("content-type", contentTypeFor(storageKey))
        .header("cache-control", "private, max-age=300")
        .header("x-content-type-options", "nosniff")
        .send(body);
    },
  );

  app.get<{ Params: { token: string } }>(
    "/api/uploads/:token",
    async (request, reply) => {
      const payload = verifyStorageToken(request.params.token);
      if (payload === null || payload.operation !== "get") {
        return reply.status(404).send();
      }

      const body = await getObject(payload.key);
      if (body === null) return reply.status(404).send();

      /*
       * The type comes from the token, which is where `presignDownload` put it.
       *
       * This used to guess from the extension, and the guess had two outcomes:
       * `webp`, or `image/jpeg` for everything else. An Excel export therefore
       * arrived as a JPEG — and with `nosniff` set, correctly, the browser
       * refused to look past the header and simply would not save it. The
       * comment in `storage/driver.ts` describes precisely this ("a spreadsheet
       * served as an image renders as a broken image icon and cannot be saved at
       * all"), and the token was changed to carry the real type. This half of it
       * was never changed to read it.
       */
      const disposition = contentDispositionFor(payload.filename);

      return reply
        .header("content-type", payload.mime)
        // Private and short-lived: this is customer fleet data, and the token in
        // the URL is what authorises it (PLAN/06 §5).
        .header("cache-control", "private, max-age=300")
        .header("x-content-type-options", "nosniff")
        .headers(disposition === null ? {} : { "content-disposition": disposition })
        .send(body);
    },
  );
}

/**
 * `Content-Disposition` for a download that has a name.
 *
 * Photos are viewed inline and carry no filename, so they get no header at all.
 * An export does: without it the browser saves the storage key, and a user ends
 * up with `aae0f09f-ee98-46a6-8b9a-bdb261147f8e.xlsx` in their downloads folder.
 *
 * Both forms are emitted, per RFC 6266. The plain `filename` is an ASCII
 * fallback for anything that cannot read `filename*`; the starred form carries
 * the real name, so an Indonesian label survives. Quotes and backslashes are
 * stripped from the fallback rather than escaped — a filename is not worth a
 * header-injection surface.
 */
function contentDispositionFor(filename: string | undefined): string | null {
  if (filename === undefined || filename === "") return null;

  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
