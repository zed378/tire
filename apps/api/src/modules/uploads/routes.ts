import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ACCEPTED_PHOTO_MIME_TYPES, MAX_PHOTO_BYTES } from "@c26/contracts";
import { loadConfig } from "../../kernel/config.ts";
import { AppError, wrapRoute } from "../../kernel/envelope/index.ts";
import { getObject } from "../../kernel/storage/index.ts";
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

  app.get<{ Params: { token: string } }>(
    "/api/uploads/:token",
    async (request, reply) => {
      const payload = verifyStorageToken(request.params.token);
      if (payload === null || payload.operation !== "get") {
        return reply.status(404).send();
      }

      const body = await getObject(payload.key);
      if (body === null) return reply.status(404).send();

      const extension = payload.key.split(".").pop()?.toLowerCase();
      const mimeType = extension === "webp" ? "image/webp" : "image/jpeg";

      return reply
        .header("content-type", mimeType)
        // Private and short-lived: this is customer fleet data, and the token in
        // the URL is what authorises it (PLAN/06 §5).
        .header("cache-control", "private, max-age=300")
        .header("x-content-type-options", "nosniff")
        .send(body);
    },
  );
}
