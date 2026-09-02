import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/index.js";
import {
  isInsideContainer,
  isProductionEnv,
  parsePasswordFromArgs,
  parseUsernameFromArgs,
  seedProdAdmin,
} from "./seed-prod-admin.ts";

describe("seed-prod-admin script", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("argument parsing", () => {
    it("parses password from positional argument", () => {
      expect(parsePasswordFromArgs(["SecretPass123!"])).toBe("SecretPass123!");
    });

    it("parses password from --password argument", () => {
      expect(parsePasswordFromArgs(["--password=SecretPass123!"])).toBe("SecretPass123!");
    });

    it("falls back to environment variable for password", () => {
      expect(parsePasswordFromArgs([], "EnvPass12345!")).toBe("EnvPass12345!");
    });

    it("parses username from --username argument", () => {
      expect(parseUsernameFromArgs(["--username=superadmin"])).toBe("superadmin");
    });

    it("defaults username to admin", () => {
      expect(parseUsernameFromArgs([])).toBe("admin");
    });
  });

  describe("environment gates", () => {
    it("returns false for isProductionEnv when APP_ENV is local or staging", () => {
      process.env.APP_ENV = "local";
      expect(isProductionEnv()).toBe(false);

      process.env.APP_ENV = "staging";
      expect(isProductionEnv()).toBe(false);
    });

    it("returns true for isProductionEnv when APP_ENV is production", () => {
      process.env.APP_ENV = "production";
      expect(isProductionEnv()).toBe(true);
    });

    it("returns true for isInsideContainer when IS_CONTAINER=true", () => {
      process.env.IS_CONTAINER = "true";
      expect(isInsideContainer()).toBe(true);
    });

    it("returns false for isInsideContainer by default on host without container env", () => {
      delete process.env.IS_CONTAINER;
      delete process.env.DOCKER_CONTAINER;
      expect(typeof isInsideContainer()).toBe("boolean");
    });
  });

  describe("seedProdAdmin execution gates", () => {
    it("throws error if APP_ENV is not production", async () => {
      process.env.APP_ENV = "local";

      await expect(
        seedProdAdmin({
          args: ["Password123!"],
          checkProductionEnv: () => false,
          checkInsideContainer: () => true,
        }),
      ).rejects.toThrow("HANYA dapat dijalankan pada lingkungan produksi");
    });

    it("throws error if not running inside container", async () => {
      await expect(
        seedProdAdmin({
          args: ["Password123!"],
          checkProductionEnv: () => true,
          checkInsideContainer: () => false,
        }),
      ).rejects.toThrow("HANYA dapat ditrigger dengan menjalankannya dari dalam container");
    });

    it("throws error if password is missing or under 10 characters", async () => {
      // The script falls back to SEED_ADMIN_PASSWORD, and the developer's own
      // .env sets it. Without this the "no password supplied" case quietly
      // received one, passed validation, and went on to open a database
      // connection — so the test passed or failed depending on whether Postgres
      // happened to be reachable.
      delete process.env.SEED_ADMIN_PASSWORD;

      await expect(
        seedProdAdmin({
          args: [],
          checkProductionEnv: () => true,
          checkInsideContainer: () => true,
        }),
      ).rejects.toThrow("parameter input password (minimal 10 karakter) wajib diberikan");

      await expect(
        seedProdAdmin({
          args: ["short"],
          checkProductionEnv: () => true,
          checkInsideContainer: () => true,
        }),
      ).rejects.toThrow("parameter input password (minimal 10 karakter) wajib diberikan");
    });

    it("seeds admin user when in prod, container, and valid password given", async () => {
      const mockUserCreate = vi.fn().mockResolvedValue({});
      const mockUserFindFirst = vi.fn().mockResolvedValue(null);

      const fakePrisma = {
        user: {
          findFirst: mockUserFindFirst,
          create: mockUserCreate,
        },
        $disconnect: vi.fn(),
      } as unknown as PrismaClient;

      const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

      await seedProdAdmin({
        args: ["SuperSecretPass123!"],
        prisma: fakePrisma,
        checkProductionEnv: () => true,
        checkInsideContainer: () => true,
      });

      expect(mockUserFindFirst).toHaveBeenCalledWith({ where: { username: "admin", deletedAt: null } });
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: "admin",
          role: "admin",
          mustChangePassword: true,
        }),
      });
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("berhasil dibuat"));
    });

    it("leaves user untouched if admin already exists", async () => {
      const mockUserCreate = vi.fn();
      const mockUserFindFirst = vi.fn().mockResolvedValue({ id: "existing-admin-id" });

      const fakePrisma = {
        user: {
          findFirst: mockUserFindFirst,
          create: mockUserCreate,
        },
        $disconnect: vi.fn(),
      } as unknown as PrismaClient;

      const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

      await seedProdAdmin({
        args: ["SuperSecretPass123!"],
        prisma: fakePrisma,
        checkProductionEnv: () => true,
        checkInsideContainer: () => true,
      });

      expect(mockUserFindFirst).toHaveBeenCalledWith({ where: { username: "admin", deletedAt: null } });
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("sudah ada — tidak ada perubahan"));
    });
  });
});
