import { z } from "zod";

/**
 * Environment configuration, validated once at boot.
 *
 * Failing to start is the right response to a missing secret. A server that
 * boots with `STORAGE_SECRET_ACCESS_KEY` undefined works fine until the first
 * photo upload, hours later, in the field — which is precisely the class of
 * silent failure this rewrite exists to remove.
 */

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  APP_VERSION: z.string().default("0.0.0"),

  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  // Comma-separated allowlist. Never '*', never a reflected Origin header
  // (PLAN/13 §2).
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  // Empty means a host-only cookie, which is what production uses: a cookie
  // scoped to tire.zedth.my.id is never sent to tire-store.zedth.my.id, so a
  // leaked photo URL carries no session with it.
  COOKIE_DOMAIN: z.string().default(""),
  // `silent` is a real pino level, and the one tests and noisy environments
  // need. Leaving it out made a valid configuration fail to boot.
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // Hostname that serves signed photo URLs and nothing else. Empty disables the
  // restriction, which is right for local development where everything is
  // localhost. See kernel/http/hosts.ts.
  // production: tire-store.zedth.my.id
  STORAGE_HOST: z.string().default(""),

  // Built SPA. Empty means this process serves no static files, which is what
  // local development wants — Vite serves them on :5173 and proxies /api here.
  // production: ./web
  WEB_DIST_DIR: z.string().default(""),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // `local` writes to disk and serves uploads through this API with short-lived
  // signed tokens; `s3` talks to Cloudflare R2. The client-side protocol
  // (presign -> PUT -> confirm, PLAN/05 §7) is identical either way, so moving
  // to R2 when volume justifies it is a driver change and nothing else.
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),

  UPLOAD_DIR: z.string().default("./uploads"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_SIGNING_KEY: z.string().min(16, "STORAGE_SIGNING_KEY must be at least 16 characters"),

  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  // Encrypts TOTP secrets at rest (PLAN/13 §3.2). Rotating it invalidates every
  // enrolled authenticator, so it is treated as permanent.
  MFA_ENCRYPTION_KEY: z.string().min(1),

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@zedth.my.id"),

  SENTRY_DSN: z.string().optional(),
});

export type AppConfig = z.infer<typeof configSchema> & {
  readonly allowedOrigins: readonly string[];
  readonly isProduction: boolean;
};

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached !== null) return cached;

  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const value = parsed.data;

  // Checked here rather than in the schema so the `local` driver is not asked
  // for credentials it will never use.
  if (value.STORAGE_DRIVER === "s3") {
    const missing = (
      [
        "STORAGE_ENDPOINT",
        "STORAGE_BUCKET",
        "STORAGE_ACCESS_KEY_ID",
        "STORAGE_SECRET_ACCESS_KEY",
        "STORAGE_PUBLIC_URL",
      ] as const
    ).filter((key) => value[key] === undefined || value[key] === "");

    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(", ")}`);
    }
  }

  /*
   * If uploads are sent to a different hostname, that hostname must be declared.
   *
   * WHAT WENT WRONG WITHOUT THIS. Production ran with
   * `PUBLIC_API_URL=https://tire-store.zedth.my.id` and no `STORAGE_HOST` at
   * all. The process booted, every screen worked, and only the upload failed —
   * because `STORAGE_HOST` is what puts that origin into the CSP's
   * `connect-src` and `img-src`, so the browser refused the PUT before it left
   * the device. Photographs could not be uploaded and thumbnails could not be
   * displayed, with nothing in the server log to say why: the request never
   * arrived.
   *
   * It was also a silent security downgrade. `isStorageHost` answers false for
   * an empty setting, so the restriction that keeps the storage hostname to
   * `/api/uploads/` was disabled — that hostname served the entire API and the
   * SPA (`kernel/http/hosts.ts`).
   *
   * This is the same shape as the `s3` check above: a configuration that is
   * wrong in a way the process cannot notice until a user is already failing.
   * `STORAGE_DRIVER=s3` refuses to boot without its five keys; this refuses to
   * boot when uploads have been pointed somewhere the browser has not been told
   * to allow.
   */
  const uploadHost = new URL(value.PUBLIC_API_URL).hostname;
  const appHosts = value.WEB_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        return new URL(origin).hostname;
      } catch {
        return "";
      }
    });

  if (!appHosts.includes(uploadHost) && value.STORAGE_HOST.trim() === "") {
    throw new Error(
      `PUBLIC_API_URL points at ${uploadHost}, which is not in WEB_ORIGIN, so STORAGE_HOST must ` +
        `name it. Without it the Content-Security-Policy omits that origin and every photo upload ` +
        `is blocked by the browser. Set STORAGE_HOST=${uploadHost}.`,
    );
  }

  cached = {
    ...value,
    allowedOrigins: value.WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean),
    isProduction: value.APP_ENV === "production",
  };
  return cached;
}

/** Test helper. Never called by application code. */
export function resetConfigCache(): void {
  cached = null;
}
