import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH } from "./constants.ts";
import { changePasswordSchema, loginSchema, passwordSchema, registerSchema } from "./auth.ts";

/**
 * The credential rules, which both sides import rather than restate.
 *
 * `D-07` is closed by this package existing: the legacy system relied on HTML5
 * `required`, which produced an English browser tooltip in an Indonesian UI and
 * could be bypassed by anyone. Every message asserted here is the one the server
 * uses too, because there is only one of each.
 */

function messagesFor(schema: { safeParse: (input: unknown) => unknown }, input: unknown): string[] {
  const result = schema.safeParse(input) as
    | { success: true }
    | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };

  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("passwordSchema", () => {
  it("asks for length rather than a symbol", () => {
    // Length decides far more than a composition rule, and a mandatory symbol is
    // what produces `Password1!` on every account in the building.
    expect(passwordSchema.safeParse("a".repeat(MIN_PASSWORD_LENGTH)).success).toBe(true);
    expect(passwordSchema.safeParse("kalimat pendek yang mudah diingat").success).toBe(true);
  });

  it("refuses one that is too short, in Indonesian", () => {
    const messages = messagesFor(passwordSchema, "a".repeat(MIN_PASSWORD_LENGTH - 1));
    expect(messages).toEqual([`: Password minimal ${String(MIN_PASSWORD_LENGTH)} karakter.`]);
  });

  it("refuses one long enough to be a denial of service", () => {
    expect(messagesFor(passwordSchema, "a".repeat(201))).toEqual([
      ": Password maksimal 200 karakter.",
    ]);
  });

  it("says it is required rather than saying it is too short", () => {
    expect(messagesFor(passwordSchema, undefined)).toEqual([": Password wajib diisi."]);
  });
});

describe("changePasswordSchema", () => {
  const valid = {
    currentPassword: "kata sandi lama",
    newPassword: "kata sandi yang baru",
    confirmPassword: "kata sandi yang baru",
  };

  it("accepts a change that is spelled the same twice", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("puts a mismatch under the confirmation, where it was typed", () => {
    // Not under `newPassword`: the field the user has to fix is the second one.
    expect(messagesFor(changePasswordSchema, { ...valid, confirmPassword: "salah ketik" })).toEqual([
      "confirmPassword: Konfirmasi password tidak sama.",
    ]);
  });

  it("refuses a change that changes nothing", () => {
    expect(
      messagesFor(changePasswordSchema, {
        currentPassword: "kata sandi lama",
        newPassword: "kata sandi lama",
        confirmPassword: "kata sandi lama",
      }),
    ).toEqual(["newPassword: Password baru tidak boleh sama dengan password saat ini."]);
  });

  it("reports both problems at once when both apply", () => {
    const messages = messagesFor(changePasswordSchema, {
      currentPassword: "kata sandi lama",
      newPassword: "kata sandi lama",
      confirmPassword: "berbeda lagi",
    });

    expect(messages).toHaveLength(2);
  });

  it("still applies the length rule to the new password", () => {
    expect(messagesFor(changePasswordSchema, { ...valid, newPassword: "pendek", confirmPassword: "pendek" })).toEqual(
      [`newPassword: Password minimal ${String(MIN_PASSWORD_LENGTH)} karakter.`],
    );
  });
});

describe("registerSchema", () => {
  const valid = {
    username: "zawawi_supplier",
    displayName: "Zawawi",
    password: "kata sandi yang baru",
    confirmPassword: "kata sandi yang baru",
  };

  it("accepts an ordinary registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a username with a space or a symbol", () => {
    // The username becomes part of a storage path and a URL, and it is the
    // identity every later record is created under.
    expect(messagesFor(registerSchema, { ...valid, username: "za wawi" })).toEqual([
      "username: User ID hanya boleh berisi huruf, angka, titik, garis bawah, dan strip.",
    ]);
    expect(messagesFor(registerSchema, { ...valid, username: "zawawi@mail" })).toHaveLength(1);
  });

  it("accepts the punctuation it does allow", () => {
    // All at least three characters: the length rule applies as well, and a
    // two-character example would fail for a reason that has nothing to do with
    // punctuation.
    for (const username of ["a.b", "a_b", "a-b", "Ab1"]) {
      expect(registerSchema.safeParse({ ...valid, username }).success, username).toBe(true);
    }
  });

  it("trims a username before measuring it", () => {
    const parsed = registerSchema.safeParse({ ...valid, username: "  zawawi  " });
    expect(parsed.success && parsed.data.username).toBe("zawawi");
  });

  it("puts a password mismatch under the confirmation", () => {
    expect(messagesFor(registerSchema, { ...valid, confirmPassword: "lain" })).toEqual([
      "confirmPassword: Konfirmasi password tidak sama.",
    ]);
  });

  it("refuses a display name of one character", () => {
    expect(messagesFor(registerSchema, { ...valid, displayName: "Z" })).toEqual([
      "displayName: Nama minimal 2 karakter.",
    ]);
  });
});

describe("loginSchema", () => {
  it("accepts credentials", () => {
    expect(loginSchema.safeParse({ username: "zawawi", password: "apa saja" }).success).toBe(true);
  });

  it("refuses an empty submission in Indonesian, not in English", () => {
    // D-07 in one assertion: without this schema the browser would say "Please
    // fill out this field."
    const messages = messagesFor(loginSchema, { username: "", password: "" });
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) expect(message).not.toMatch(/[Pp]lease/);
  });
});
