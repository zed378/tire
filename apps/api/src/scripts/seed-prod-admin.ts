import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/index.js";
import { loadEnvFile } from "../kernel/load-env.ts";
import { hashPassword } from "../kernel/security/password.ts";

loadEnvFile();

/**
 * Checks if the current process is running inside a Docker/Podman container.
 */
export function isInsideContainer(): boolean {
  if (existsSync("/.dockerenv") || existsSync("/run/.containerenv")) {
    return true;
  }
  try {
    const cgroup = readFileSync("/proc/1/cgroup", "utf8");
    if (
      cgroup.includes("docker") ||
      cgroup.includes("kubepods") ||
      cgroup.includes("containerd") ||
      cgroup.includes("podman") ||
      cgroup.includes("overlay")
    ) {
      return true;
    }
  } catch {
    // /proc/1/cgroup may not exist or be accessible on non-Linux systems
  }
  if (process.env.IS_CONTAINER === "true" || process.env.DOCKER_CONTAINER === "true") {
    return true;
  }
  return false;
}

/**
 * Checks if the current environment is production.
 */
export function isProductionEnv(): boolean {
  return process.env.APP_ENV === "production";
}

/**
 * Parses the password from CLI arguments or fallback env variable.
 */
export function parsePasswordFromArgs(args: string[], envPassword?: string): string | undefined {
  for (const arg of args) {
    if (arg.startsWith("--password=")) {
      return arg.slice("--password=".length);
    }
  }
  const positional = args.find((a) => !a.startsWith("--"));
  if (positional) {
    return positional;
  }
  return envPassword;
}

/**
 * Parses the admin username from CLI arguments or fallback env variable.
 */
export function parseUsernameFromArgs(args: string[], envUsername?: string): string {
  for (const arg of args) {
    if (arg.startsWith("--username=")) {
      return arg.slice("--username=".length);
    }
  }
  return envUsername ?? process.env.SEED_ADMIN_USERNAME ?? "admin";
}

export interface SeedProdAdminOptions {
  args?: string[];
  prisma?: PrismaClient;
  checkProductionEnv?: () => boolean;
  checkInsideContainer?: () => boolean;
}

/**
 * Seeds the initial administrator account in production.
 *
 * Enforces two strict gates:
 * 1. Must run ONLY when APP_ENV=production.
 * 2. Must run ONLY inside a container.
 */
export async function seedProdAdmin(options: SeedProdAdminOptions = {}): Promise<void> {
  const args = options.args ?? process.argv.slice(2);
  const checkProd = options.checkProductionEnv ?? isProductionEnv;
  const checkContainer = options.checkInsideContainer ?? isInsideContainer;

  // Gate 1: Production Environment check
  if (!checkProd()) {
    throw new Error(
      "Gagal: script ini HANYA dapat dijalankan pada lingkungan produksi (APP_ENV=production).",
    );
  }

  // Gate 2: Container Environment check
  if (!checkContainer()) {
    throw new Error(
      "Gagal: script ini HANYA dapat ditrigger dengan menjalankannya dari dalam container Docker/Podman.",
    );
  }

  // Gate 3: Password parameter validation
  const password = parsePasswordFromArgs(args, process.env.SEED_ADMIN_PASSWORD);
  const username = parseUsernameFromArgs(args, process.env.SEED_ADMIN_USERNAME);

  if (!password || password.length < 10) {
    throw new Error(
      "Gagal: parameter input password (minimal 10 karakter) wajib diberikan.\n" +
        "Penggunaan: node dist/scripts/seed-prod-admin.js <password> [--username=admin]",
    );
  }

  const prisma = options.prisma ?? new PrismaClient();

  try {
    const existing = await prisma.user.findFirst({
      where: { username, deletedAt: null },
    });

    if (existing !== null) {
      process.stdout.write(`Pengguna admin '${username}' sudah ada — tidak ada perubahan.\n`);
      return;
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        username,
        displayName: "Administrator",
        role: "admin",
        passwordHash,
        mustChangePassword: true,
      },
    });

    process.stdout.write(
      `Pengguna admin '${username}' berhasil dibuat. Pengguna wajib mengganti password saat login pertama kali.\n`,
    );
  } finally {
    if (!options.prisma) {
      await prisma.$disconnect();
    }
  }
}

// Auto-run if executed directly as entrypoint script
const scriptArg = process.argv[1];
if (
  scriptArg !== undefined &&
  (scriptArg.endsWith("seed-prod-admin.js") || scriptArg.endsWith("seed-prod-admin.ts"))
) {
  seedProdAdmin().catch((err: unknown) => {
    process.stderr.write(`${String(err instanceof Error ? err.message : err)}\n`);
    process.exitCode = 1;
  });
}
