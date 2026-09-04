import { describe, expect, it, vi } from "vitest";
import { applyFieldErrors, hasFieldErrors } from "./form-errors.ts";
import { ApiError } from "./api-client.ts";

/**
 * Which of `PLAN/05` §5.1's three channels an error goes to.
 *
 * The split is not a matter of taste: an error that names a field belongs under
 * that field, and only what is left over becomes the page banner. Eight forms
 * ask this module to decide, so getting it wrong shows a validation message in
 * a banner with no field to point at — or, worse, tells the user the same thing
 * twice in two wordings.
 */

function apiError(errors: { field: string; code: string; message: string }[] = []): ApiError {
  return new ApiError({
    ok: false,
    code: errors.length > 0 ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
    message: "Pesan dari server.",
    requestId: "req_test",
    ...(errors.length > 0 ? { errors: errors as never } : {}),
  });
}

describe("applyFieldErrors", () => {
  it("puts each message under the field it names", () => {
    const setError = vi.fn();

    const consumed = applyFieldErrors(
      apiError([
        { field: "plateDisplay", code: "INVALID_FORMAT", message: "Format plat salah." },
        { field: "cargoType", code: "REQUIRED", message: "Jenis Muatan wajib diisi." },
      ]),
      setError,
    );

    expect(consumed).toBe(true);
    expect(setError).toHaveBeenCalledWith("plateDisplay", { message: "Format plat salah." });
    expect(setError).toHaveBeenCalledWith("cargoType", { message: "Jenis Muatan wajib diisi." });
  });

  it("leaves an error that names no field for the caller to show", () => {
    // A 500 or a FORBIDDEN_ROLE has nowhere to sit on a form. Returning false is
    // how the caller knows to raise the banner instead.
    const setError = vi.fn();

    expect(applyFieldErrors(apiError(), setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("leaves anything that is not an API error alone", () => {
    // A TypeError from a bug in the form itself must not be dressed up as a
    // validation message under a field.
    const setError = vi.fn();

    expect(applyFieldErrors(new TypeError("boom"), setError)).toBe(false);
    expect(applyFieldErrors("just a string", setError)).toBe(false);
    expect(applyFieldErrors(null, setError)).toBe(false);
    expect(applyFieldErrors(undefined, setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("reports every field, not only the first", () => {
    // Fixing one error, resubmitting, and being told about the next is the
    // experience this avoids.
    const setError = vi.fn();

    applyFieldErrors(
      apiError([
        { field: "a", code: "REQUIRED", message: "a" },
        { field: "b", code: "REQUIRED", message: "b" },
        { field: "c", code: "REQUIRED", message: "c" },
      ]),
      setError,
    );

    expect(setError).toHaveBeenCalledTimes(3);
  });
});

describe("hasFieldErrors", () => {
  it("is true when the error names fields", () => {
    expect(hasFieldErrors(apiError([{ field: "a", code: "REQUIRED", message: "a" }]))).toBe(true);
  });

  it("is false when it names none", () => {
    // What keeps a page banner quiet for an error a form has already placed —
    // and what lets it speak for one no form can.
    expect(hasFieldErrors(apiError())).toBe(false);
  });

  it("is false for anything that is not an API error", () => {
    expect(hasFieldErrors(new Error("network"))).toBe(false);
    expect(hasFieldErrors(null)).toBe(false);
  });
});
