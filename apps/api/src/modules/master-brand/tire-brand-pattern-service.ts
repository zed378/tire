import type { PrismaClient } from "../../generated/prisma/index.js";
import type { Actor } from "../../kernel/authorization.ts";
import type { AuditActor } from "../../kernel/audit.ts";
import { withTransaction } from "../../kernel/db.ts";
import { recordAudit } from "../../kernel/audit.ts";
import { AppError } from "../../kernel/envelope/app-error.js";
import type {
  CreateTireBrandPatternInput,
  UpdateTireBrandPatternInput,
  TireBrandPattern,
  TireBrandPatternListResponse,
} from "@c26/contracts";

export class TireBrandPatternService {
  constructor(private prisma: PrismaClient) {}

  async listTireBrandPatterns(type: "TB" | "LT", page: number = 1, perPage: number = 100): Promise<TireBrandPatternListResponse> {
    const skip = (page - 1) * perPage;
    const [items, total] = await Promise.all([
      this.prisma.tireBrandPattern.findMany({ where: { type }, skip, take: perPage, orderBy: [{ brand: "asc" }, { pattern: "asc" }] }),
      this.prisma.tireBrandPattern.count({ where: { type } }),
    ]);
    return { items: items.map((item) => this.toDto(item)), total, page, perPage };
  }

  async getTireBrandPattern(id: number): Promise<TireBrandPattern> {
    const pattern = await this.prisma.tireBrandPattern.findUnique({ where: { id: BigInt(id) } });
    if (!pattern) throw new AppError("NOT_FOUND", { message: `Pattern ban dengan ID ${id} tidak ditemukan` });
    return this.toDto(pattern);
  }

  async createTireBrandPattern(_actor: Actor, auditActor: AuditActor, input: CreateTireBrandPatternInput): Promise<TireBrandPattern> {
    const brand = await this.prisma.tireBrand.findUnique({ where: { name: input.brand } });
    if (!brand) throw new AppError("VALIDATION_ERROR", { message: `Merk ban "${input.brand}" tidak ditemukan`, fieldErrors: [{ field: "brand", code: "INVALID_FORMAT", message: "Merk ban tidak ditemukan" }] });
    
    const existing = await this.prisma.tireBrandPattern.findFirst({ where: { brand: input.brand, pattern: input.pattern, type: input.type } });
    if (existing) throw new AppError("VALIDATION_ERROR", { message: `Pattern "${input.pattern}" untuk merk "${input.brand}" (${input.type}) sudah ada`, fieldErrors: [{ field: "pattern", code: "INVALID_FORMAT", message: "Pattern sudah ada untuk merk ini" }] });
    
    return withTransaction(async (tx) => {
      const pattern = await tx.tireBrandPattern.create({ data: { brand: input.brand, pattern: input.pattern, type: input.type } });
      await recordAudit(tx, auditActor, { action: "tire_brand_pattern.created", entity: "tire_brand_pattern", entityId: Number(pattern.id), after: { brand: pattern.brand, pattern: pattern.pattern, type: pattern.type } });
      return this.toDto(pattern);
    });
  }

  async updateTireBrandPattern(_actor: Actor, auditActor: AuditActor, id: number, input: UpdateTireBrandPatternInput): Promise<TireBrandPattern> {
    const pattern = await this.prisma.tireBrandPattern.findUnique({ where: { id: BigInt(id) } });
    if (!pattern) throw new AppError("NOT_FOUND", { message: `Pattern ban dengan ID ${id} tidak ditemukan` });
    
    if (input.brand && input.brand !== pattern.brand) {
      const brand = await this.prisma.tireBrand.findUnique({ where: { name: input.brand } });
      if (!brand) throw new AppError("VALIDATION_ERROR", { message: `Merk ban "${input.brand}" tidak ditemukan`, fieldErrors: [{ field: "brand", code: "INVALID_FORMAT", message: "Merk ban tidak ditemukan" }] });
    }
    
    if (input.pattern && input.pattern !== pattern.pattern) {
      const existing = await this.prisma.tireBrandPattern.findFirst({ where: { brand: input.brand || pattern.brand, pattern: input.pattern, type: pattern.type } });
      if (existing) throw new AppError("VALIDATION_ERROR", { message: `Pattern "${input.pattern}" sudah ada untuk merk ini`, fieldErrors: [{ field: "pattern", code: "INVALID_FORMAT", message: "Pattern sudah ada untuk merk ini" }] });
    }
    
    return withTransaction(async (tx) => {
      const updated = await tx.tireBrandPattern.update({ where: { id: BigInt(id) }, data: { brand: input.brand, pattern: input.pattern, isActive: input.isActive } });
      const after: Record<string, unknown> = {};
      if (input.brand) after.brand = updated.brand;
      if (input.pattern) after.pattern = updated.pattern;
      if (input.isActive !== undefined) after.isActive = updated.isActive;
      await recordAudit(tx, auditActor, { action: "tire_brand_pattern.updated", entity: "tire_brand_pattern", entityId: Number(updated.id), after });
      return this.toDto(updated);
    });
  }

  async deleteTireBrandPattern(_actor: Actor, auditActor: AuditActor, id: number): Promise<void> {
    const pattern = await this.prisma.tireBrandPattern.findUnique({ where: { id: BigInt(id) } });
    if (!pattern) throw new AppError("NOT_FOUND", { message: `Pattern ban dengan ID ${id} tidak ditemukan` });
    
    return withTransaction(async (tx) => {
      await tx.tireBrandPattern.delete({ where: { id: BigInt(id) } });
      await recordAudit(tx, auditActor, { action: "tire_brand_pattern.deleted", entity: "tire_brand_pattern", entityId: Number(id) });
    });
  }

  private toDto(pattern: { id: bigint; brand: string; pattern: string; type: string; isActive: boolean; createdAt: Date; updatedAt: Date }): TireBrandPattern {
    return { id: Number(pattern.id), brand: pattern.brand, pattern: pattern.pattern, type: pattern.type as "TB" | "LT", isActive: pattern.isActive, createdAt: pattern.createdAt.toISOString(), updatedAt: pattern.updatedAt.toISOString() };
  }
}
