import type { PrismaClient } from "../../generated/prisma/index.js";
import type { Actor } from "../../kernel/authorization.ts";
import type { AuditActor } from "../../kernel/audit.ts";
import { withTransaction } from "../../kernel/db.ts";
import { recordAudit } from "../../kernel/audit.ts";
import { AppError } from "../../kernel/envelope/app-error.js";
import type {
  CreateTireSizeInput,
  UpdateTireSizeInput,
  TireSize,
  TireSizeListResponse,
} from "@c26/contracts";

export class TireSizeService {
  constructor(private prisma: PrismaClient) {}

  async listTireSizes(type: "TB" | "LT", page: number = 1, perPage: number = 100): Promise<TireSizeListResponse> {
    const skip = (page - 1) * perPage;
    const [items, total] = await Promise.all([
      this.prisma.tireSize.findMany({
        where: { type },
        skip,
        take: perPage,
        orderBy: [{ size: "asc" }],
      }),
      this.prisma.tireSize.count({ where: { type } }),
    ]);
    return { items: items.map((item) => this.toDto(item)), total, page, perPage };
  }

  async getTireSize(id: number): Promise<TireSize> {
    const size = await this.prisma.tireSize.findUnique({ where: { id: BigInt(id) } });
    if (!size) throw new AppError("NOT_FOUND", { message: `Ukuran ban dengan ID ${id} tidak ditemukan` });
    return this.toDto(size);
  }

  async createTireSize(_actor: Actor, auditActor: AuditActor, input: CreateTireSizeInput): Promise<TireSize> {
    const existing = await this.prisma.tireSize.findFirst({
      where: { size: input.size, type: input.type },
    });
    if (existing) {
      throw new AppError("VALIDATION_ERROR", {
        message: `Ukuran ban "${input.size}" (${input.type}) sudah ada`,
        fieldErrors: [{ field: "size", code: "INVALID_FORMAT", message: "Ukuran ban sudah ada untuk kategori ini" }],
      });
    }

    return withTransaction(async (tx) => {
      const size = await tx.tireSize.create({
        data: { size: input.size, type: input.type },
      });
      await recordAudit(tx, auditActor, {
        action: "tire_size.created",
        entity: "tire_size",
        entityId: Number(size.id),
        after: { size: size.size, type: size.type },
      });
      return this.toDto(size);
    });
  }

  async updateTireSize(_actor: Actor, auditActor: AuditActor, id: number, input: UpdateTireSizeInput): Promise<TireSize> {
    const size = await this.prisma.tireSize.findUnique({ where: { id: BigInt(id) } });
    if (!size) throw new AppError("NOT_FOUND", { message: `Ukuran ban dengan ID ${id} tidak ditemukan` });

    if (input.size && input.size !== size.size) {
      const existing = await this.prisma.tireSize.findFirst({
        where: { size: input.size, type: size.type },
      });
      if (existing) {
        throw new AppError("VALIDATION_ERROR", {
          message: `Ukuran ban "${input.size}" sudah ada untuk kategori ini`,
          fieldErrors: [{ field: "size", code: "INVALID_FORMAT", message: "Ukuran ban sudah ada untuk kategori ini" }],
        });
      }
    }

    return withTransaction(async (tx) => {
      const updated = await tx.tireSize.update({
        where: { id: BigInt(id) },
        data: { size: input.size, isActive: input.isActive },
      });
      const after: Record<string, unknown> = {};
      if (input.size) after.size = updated.size;
      if (input.isActive !== undefined) after.isActive = updated.isActive;
      await recordAudit(tx, auditActor, {
        action: "tire_size.updated",
        entity: "tire_size",
        entityId: Number(updated.id),
        after,
      });
      return this.toDto(updated);
    });
  }

  async deleteTireSize(_actor: Actor, auditActor: AuditActor, id: number): Promise<void> {
    const size = await this.prisma.tireSize.findUnique({ where: { id: BigInt(id) } });
    if (!size) throw new AppError("NOT_FOUND", { message: `Ukuran ban dengan ID ${id} tidak ditemukan` });

    return withTransaction(async (tx) => {
      await tx.tireSize.delete({ where: { id: BigInt(id) } });
      await recordAudit(tx, auditActor, {
        action: "tire_size.deleted",
        entity: "tire_size",
        entityId: Number(id),
      });
    });
  }

  private toDto(item: {
    id: bigint;
    size: string;
    type: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): TireSize {
    return {
      id: Number(item.id),
      size: item.size,
      type: item.type as "TB" | "LT",
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
