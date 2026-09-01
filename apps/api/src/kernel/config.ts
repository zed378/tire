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
  COOKIE_DOMAIN: z.string().default("localhost"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_PUBLIC_URL: z.string().url(),
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
