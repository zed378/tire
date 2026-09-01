import { beforeAll, describe, expect, it } from "vitest";
import { z, type ZodError } from "zod";
import { ERROR_DEFINITIONS } from "@c26/contracts";
import { AppError, duplicatePlate, forbidden, invalidTransition, notFound } from "./app-error.ts";
import { errorEnvelope, successEnvelope, wrapRoute, zodErrorToAppError } from "./wrap-route.ts";
import { translateDatabaseError } from "./database-errors.ts";
import { resetConfigCache } from "../config.ts";

beforeAll(() => {
  // `wrapRoute` logs, and the logger reads configuration. Minimum viable
  // environment so the wrapper can be exercised without a running server.
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.STORAGE_SIGNING_KEY ??= "test-signing-key-at-least-16-chars";
  process.env.MFA_ENCRYPTION_KEY ??= Buffer.alloc(32, 5).toString("base64");
  process.env.LOG_LEVEL = "silent";
  resetConfigCache();
});

/**
 * The error contract (PLAN/05 §9 acceptance criteria).
 *
 * Two of those criteria are checked directly here: that no stack trace or raw
 * database message can reach the browser, and that every response is one of the
 * two envelope shapes. Both are tested by deliberately triggering the failures
 * rather than by trusting the code path.
 *
 * D-08 is why this file is worth its length. In the legacy system errors were
 * `alert()` calls: they could not be logged, could not be monitored, and could
 * not be tested. Some failures — pressing Submit Keputusan QC with no status
 * selected — left no trace anywhere at all.
 */

describe("PLAN/05 §2 — envelope shapes", () => {
  it("wraps success with the requestId that ties everything together", () => {
    expect(successEnvelope({ serialNumber: "SN2026-00001" }, "req_x")).toEqual({
      ok: true,
      data: { serialNumber: "SN2026-00001" },
      requestId: "req_x",
    });
  });

  it("omits the errors array unless there are field errors", () => {
    const envelope = errorEnvelope(new AppError("NOT_FOUND"), "req_x");
    expect(envelope).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: ERROR_DEFINITIONS.NOT_FOUND.message,
      requestId: "req_x",
    });
    expect("errors" in envelope).toBe(false);
  });

  it("includes field errors on a validation failure", () => {
    const error = new AppError("VALIDATION_ERROR", {
      fieldErrors: [{ field: "cityId", code: "REQUIRED", message: "Kota wajib dipilih." }],
    });

    expect(errorEnvelope(error, "req_x").errors).toHaveLength(1);
  });

  it("never carries a `status` field in the body", () => {
    // The status code lives in the HTTP header. Duplicating it in the body would
    // create two sources of truth that can disagree — which Apps Script was
    // forced into because it always answered 200 (B-02), and this system is not.
    expect(errorEnvelope(new AppError("FORBIDDEN_ROLE"), "req_x")).not.toHaveProperty("status");
  });
});

describe("PLAN/05 §4 — errors that reach the browser are always safe", () => {
  it("keeps the cause off the envelope", () => {
    const internal = new AppError("INTERNAL_ERROR", {
      cause: new Error("Connection terminated unexpectedly at Socket.<anonymous>"),
    });

    const envelope = errorEnvelope(internal, "req_x");
    expect(JSON.stringify(envelope)).not.toContain("Socket");
    expect(envelope.message).toBe(ERROR_DEFINITIONS.INTERNAL_ERROR.message);
  });

  it("keeps log context off the envelope", () => {
    // `context` exists for the log line; a table name or an internal id has no
    // business being rendered to a user.
    const error = new AppError("NOT_FOUND", { context: { entity: "inspections", id: "42" } });
    expect(JSON.stringify(errorEnvelope(error, "req_x"))).not.toContain("inspections");
  });
});

describe("PLAN/05 §4.5 — every validation failure is reported at once", () => {
  it("converts a Zod error into one field error per issue", () => {
    const schema = z.object({
      plateDisplay: z.string().min(1, "Plat nomor wajib diisi."),
      cityId: z.number({ required_error: "Kota wajib dipilih." }),
      cargoType: z.string().min(1, "Jenis Muatan wajib diisi."),
    });

    const result = schema.safeParse({ plateDisplay: "", cargoType: "" });
    expect(result.success).toBe(false);

    const appError = zodErrorToAppError((result as { error: ZodError }).error);

    // Stopping at the first error makes a user resubmit a twelve-field form over
    // and over to discover the rest.
    expect(appError.fieldErrors.length).toBeGreaterThanOrEqual(3);
    expect(appError.fieldErrors.map((e) => e.field)).toContain("cityId");
    expect(appError.code).toBe("VALIDATION_ERROR");
  });

  it("names a nested field by its path", () => {
    const schema = z.object({ vehicle: z.object({ cityId: z.number() }) });
    const result = schema.safeParse({ vehicle: {} });
    const appError = zodErrorToAppError((result as { error: ZodError }).error);

    expect(appError.fieldErrors[0]?.field).toBe("vehicle.cityId");
  });

  it("falls back to `root` when an issue has no path", () => {
    const schema = z.string();
    const result = schema.safeParse(42);
    const appError = zodErrorToAppError((result as { error: ZodError }).error);

    expect(appError.fieldErrors[0]?.field).toBe("root");
  });
});

describe("PLAN/05 §4.6 — database violations are translated, never leaked", () => {
  /** Mimics the shape Prisma reports for a constraint violation. */
  function prismaError(constraint: string): Error {
    const error = new Error(`Unique constraint failed on the fields: (\`${constraint}\`)`);
    error.name = "PrismaClientKnownRequestError";
    Object.assign(error, { code: "P2002", meta: { target: constraint } });
    return error;
  }

  it("translates the axle-sum trigger and keeps both numbers", () => {
    // This is D-04 finally speaking. The trigger message carries the two figures
    // and the user needs them: "tidak valid" alone leaves them guessing which of
    // three inputs to change.
    const error = new Error(
      "AXLE_SUM_MISMATCH: jumlah poros terinci (3) tidak sama dengan jumlah poros yang dipilih (6)",
    );

    const translated = translateDatabaseError(error);
    expect(translated?.code).toBe("VALIDATION_ERROR");

    const fieldError = translated?.fieldErrors[0];
    expect(fieldError?.code).toBe("AXLE_SUM_MISMATCH");
    expect(fieldError?.message).toContain("3");
    expect(fieldError?.message).toContain("6");
    expect(fieldError?.field).toBe("axleConfigs");
  });

  it("distinguishes the two photo caps", () => {
    const perSlot = translateDatabaseError(
      new Error("PHOTO_LIMIT_EXCEEDED: maksimal 10 foto per slot"),
    );
    const perInspection = translateDatabaseError(
      new Error("PHOTO_LIMIT_EXCEEDED: maksimal 30 foto per pengajuan"),
    );

    expect(perSlot?.fieldErrors[0]?.message).toContain("per slot");
    expect(perInspection?.fieldErrors[0]?.message).toContain("per pengajuan");
  });

  it("returns null for an error it does not recognise", () => {
    // The last row of the PLAN/05 §4.6 table, and the important one: an
    // unmapped constraint becomes a 500 with a requestId, not a PostgreSQL
    // message rendered to a user.
    expect(translateDatabaseError(new Error("something entirely unexpected"))).toBeNull();
  });

  it("never puts the raw database text into the message", () => {
    const translated = translateDatabaseError(
      new Error('AXLE_SUM_MISMATCH: duplicate key value violates unique constraint "uq_x"'),
    );
    expect(translated?.fieldErrors[0]?.message).not.toContain("unique constraint");
  });

  it("falls through for a violation that only LOOKS like a Prisma error", () => {
    // Deliberately a plain Error carrying Prisma-shaped metadata. The translator
    // matches on the real class, not on a duck-typed shape, so this correctly
    // becomes a 500 with a requestId rather than a half-recognised message.
    const lookalike = prismaError("uq_users_username_active");
    expect(translateDatabaseError(lookalike)).toBeNull();
  });
});

describe("error constructors carry the right code and message", () => {
  it("names the blocking inspection on a duplicate plate", () => {
    // "Duplicate" on its own gives the supplier nothing to act on (PLAN/05 §3).
    const error = duplicatePlate({
      plateDisplay: "B 1234 ABC",
      serialNumber: "SN2026-00042",
      statusLabel: "Pending QC",
    });

    expect(error.code).toBe("DUPLICATE_PLATE");
    expect(error.message).toContain("SN2026-00042");
    expect(error.message).toContain("Pending QC");
    expect(error.fieldErrors[0]?.field).toBe("plateDisplay");
  });

  it("states both statuses on an invalid transition", () => {
    const error = invalidTransition("dropped_qc", "pending_qc");
    expect(error.status).toBe(409);
    expect(error.message).toContain("dropped_qc");
    expect(error.message).toContain("pending_qc");
  });

  it("answers 404 for a scoped-out resource and keeps the entity in context only", () => {
    const error = notFound("inspection", 42);
    expect(error.status).toBe(404);
    expect(error.message).toBe(ERROR_DEFINITIONS.NOT_FOUND.message);
    expect(error.context).toEqual({ entity: "inspection", id: "42" });
  });

  it("answers 403 for a missing permission", () => {
    expect(forbidden("qc.review").status).toBe(403);
  });
});

/**
 * `wrapRoute` itself — PLAN/05 §4 rule 1 and §9's first acceptance criterion.
 *
 * A fake request and reply rather than a running server: what is under test is
 * the mapping from "handler returned" or "handler threw" to an envelope and a
 * status code, and that needs no HTTP.
 */
interface FakeReply {
  statusCode: number;
  body: unknown;
  sent: boolean;
  status: (code: number) => FakeReply;
  send: (payload: unknown) => FakeReply;
}

function fakeReply(): FakeReply {
  const reply: FakeReply = {
    statusCode: 200,
    body: undefined,
    sent: false,
    status(code) {
      reply.statusCode = code;
      return reply;
    },
    send(payload) {
      reply.body = payload;
      return reply;
    },
  };
  return reply;
}

function fakeRequest(): { requestId: string; method: string; url: string; routeOptions: { url: string }; actor: null } {
  return {
    requestId: "req_20260901_143022_a91f",
    method: "POST",
    url: "/api/inspections",
    routeOptions: { url: "/api/inspections" },
    actor: null,
  };
}

describe("PLAN/05 §4 — one wrapper for every handler", () => {
  it("wraps a returned value in the success envelope", async () => {
    const reply = fakeReply();
    const handler = wrapRoute(() => Promise.resolve({ serialNumber: "SN2026-00001" }));

    await handler(fakeRequest() as never, reply as never);

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toEqual({
      ok: true,
      data: { serialNumber: "SN2026-00001" },
      requestId: "req_20260901_143022_a91f",
    });
  });

  it("uses 201 where a resource was created", async () => {
    // The status carries meaning the client acts on: it is the signal to show
    // the new Serial Number in a toast (PLAN/05 §3).
    const reply = fakeReply();
    await wrapRoute(() => Promise.resolve({ id: 1 }), 201)(fakeRequest() as never, reply as never);

    expect(reply.statusCode).toBe(201);
  });

  it("maps a thrown AppError onto its documented status", async () => {
    const reply = fakeReply();
    await wrapRoute(() => Promise.reject(new AppError("FORBIDDEN_ROLE")))(
      fakeRequest() as never,
      reply as never,
    );

    expect(reply.statusCode).toBe(403);
    expect((reply.body as { code: string }).code).toBe("FORBIDDEN_ROLE");
  });

  it("maps a thrown ZodError to 422 with field errors", async () => {
    // The shape a route handler actually produces: `schema.parse(request.body)`
    // throwing on invalid input.
    const reply = fakeReply();
    const schema = z.object({ cityId: z.number({ required_error: "Kota wajib dipilih." }) });

    await wrapRoute(() => {
      schema.parse({});
      return Promise.resolve(null);
    })(fakeRequest() as never, reply as never);

    expect(reply.statusCode).toBe(422);

    const body = reply.body as { code: string; errors: { field: string }[] };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.errors.map((e) => e.field)).toContain("cityId");
  });

  it("turns an unrecognised throw into 500 with the requestId and nothing else", async () => {
    // The criterion from PLAN/05 §9: no stack trace and no database text reaches
    // the browser. The user gets a sentence and a code they can quote.
    const reply = fakeReply();
    await wrapRoute(() =>
      Promise.reject(new Error("TypeError: cannot read property id of undefined at Object.<anonymous>")),
    )(fakeRequest() as never, reply as never);

    expect(reply.statusCode).toBe(500);

    const body = reply.body as { code: string; message: string; requestId: string };
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.requestId).toBe("req_20260901_143022_a91f");
    expect(JSON.stringify(body)).not.toContain("TypeError");
    expect(JSON.stringify(body)).not.toContain("Object.<anonymous>");
  });

  it("translates a trigger message into a field error instead of leaking it", async () => {
    const reply = fakeReply();
    await wrapRoute(() =>
      Promise.reject(
        new Error("AXLE_SUM_MISMATCH: jumlah poros terinci (3) tidak sama dengan jumlah poros yang dipilih (6)"),
      ),
    )(fakeRequest() as never, reply as never);

    expect(reply.statusCode).toBe(422);

    const body = reply.body as { errors: { code: string; message: string }[] };
    expect(body.errors[0]?.code).toBe("AXLE_SUM_MISMATCH");
    expect(body.errors[0]?.message).toContain("3");
  });

  it("leaves a reply the handler already sent alone", async () => {
    const reply = fakeReply();
    reply.sent = true;

    await wrapRoute(() => Promise.resolve("ignored"))(fakeRequest() as never, reply as never);

    expect(reply.body).toBeUndefined();
  });
});
