import type { PrismaClient } from "../../generated/prisma/index.js";
import type { Actor } from "../../kernel/authorization.ts";
import type { AuditActor } from "../../kernel/audit.ts";
import { withTransaction } from "../../kernel/db.ts";
import { recordAudit } from "../../kernel/audit.ts";
import { AppError } from "../../kernel/envelope/app-error.js";
import type {
  CreateVehicleBrandInput,
  UpdateVehicleBrandInput,
  VehicleBrand,
  VehicleBrandListResponse,
} from "@c26/contracts";

export class VehicleBrandService {
  constructor(private prisma: PrismaClient) {}

  async listVehicleBrands(page: number = 1, perPage: number = 100): Promise<VehicleBrandListResponse> {
    const skip = (page - 1) * perPage;
    const [items, total] = await Promise.all([
      this.prisma.vehicleBrand.findMany({ skip, take: perPage, orderBy: { name: "asc" } }),
      this.prisma.vehicleBrand.count(),
    ]);
    return { items: items.map((item) => this.toDto(item)), total, page, perPage };
  }

  async getVehicleBrand(id: number): Promise<VehicleBrand> {
    const brand = await this.prisma.vehicleBrand.findUnique({ where: { id: BigInt(id) } });
    if (!brand) throw new AppError("NOT_FOUND", { message: `Merk kendaraan dengan ID ${id} tidak ditemukan` });
    return this.toDto(brand);
  }

  async createVehicleBrand(_actor: Actor, auditActor: AuditActor, input: CreateVehicleBrandInput): Promise<VehicleBrand> {
    const existing = await this.prisma.vehicleBrand.findUnique({ where: { name: input.name } });
    if (existing) throw new AppError("VALIDATION_ERROR", { message: `Merk kendaraan "${input.name}" sudah ada`, fieldErrors: [{ field: "name", code: "INVALID_FORMAT", message: "Merk sudah ada" }] });
    
    return withTransaction(async (tx) => {
      const brand = await tx.vehicleBrand.create({ data: { name: input.name } });
      await recordAudit(tx, auditActor, { action: "vehicle_brand.created", entity: "vehicle_brand", entityId: Number(brand.id), after: { name: brand.name } });
      return this.toDto(brand);
    });
  }

  async updateVehicleBrand(_actor: Actor, auditActor: AuditActor, id: number, input: UpdateVehicleBrandInput): Promise<VehicleBrand> {
    const brand = await this.prisma.vehicleBrand.findUnique({ where: { id: BigInt(id) } });
    if (!brand) throw new AppError("NOT_FOUND", { message: `Merk kendaraan dengan ID ${id} tidak ditemukan` });
    if (input.name && input.name !== brand.name) {
      const existing = await this.prisma.vehicleBrand.findUnique({ where: { name: input.name } });
      if (existing) throw new AppError("VALIDATION_ERROR", { message: `Merk kendaraan "${input.name}" sudah ada`, fieldErrors: [{ field: "name", code: "INVALID_FORMAT", message: "Merk sudah ada" }] });
    }
    
    return withTransaction(async (tx) => {
      const updated = await tx.vehicleBrand.update({ where: { id: BigInt(id) }, data: { name: input.name, isActive: input.isActive } });
      const after: Record<string, unknown> = {};
      if (input.name) after.name = updated.name;
      if (input.isActive !== undefined) after.isActive = updated.isActive;
      await recordAudit(tx, auditActor, { action: "vehicle_brand.updated", entity: "vehicle_brand", entityId: Number(updated.id), after });
      return this.toDto(updated);
    });
  }

  async deleteVehicleBrand(_actor: Actor, auditActor: AuditActor, id: number): Promise<void> {
    const brand = await this.prisma.vehicleBrand.findUnique({ where: { id: BigInt(id) } });
    if (!brand) throw new AppError("NOT_FOUND", { message: `Merk kendaraan dengan ID ${id} tidak ditemukan` });
    const inUse = await this.prisma.vehicle.findFirst({ where: { vehicleBrandId: BigInt(id) } });
    if (inUse) throw new AppError("FORBIDDEN_ROLE", { message: `Merk kendaraan "${brand.name}" masih digunakan oleh kendaraan` });
    
    return withTransaction(async (tx) => {
      await tx.vehicleBrand.delete({ where: { id: BigInt(id) } });
      await recordAudit(tx, auditActor, { action: "vehicle_brand.deleted", entity: "vehicle_brand", entityId: Number(id) });
    });
  }

  private toDto(brand: { id: bigint; name: string; isActive: boolean; createdAt: Date; updatedAt: Date }): VehicleBrand {
    return { id: Number(brand.id), name: brand.name, isActive: brand.isActive, createdAt: brand.createdAt.toISOString(), updatedAt: brand.updatedAt.toISOString() };
  }
}
