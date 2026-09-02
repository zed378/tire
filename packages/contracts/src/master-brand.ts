import { VEHICLE_CATEGORIES } from "./constants.ts";
import { z } from "zod";

/**
 * Vehicle Brand management schemas.
 * Used for CRUD operations on vehicle brands (Hino, Mitsubishi, etc.)
 */

export const vehicleBrandSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VehicleBrand = z.infer<typeof vehicleBrandSchema>;

export const createVehicleBrandSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export type CreateVehicleBrandInput = z.infer<typeof createVehicleBrandSchema>;

export const updateVehicleBrandSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateVehicleBrandInput = z.infer<typeof updateVehicleBrandSchema>;

/**
 * Tire Brand Pattern schemas.
 * Used for CRUD operations on tire brand patterns
 */

export const tireBrandPatternSchema = z.object({
  id: z.number().int().positive(),
  brand: z.string().trim().min(2).max(120),
  pattern: z.string().trim().min(1).max(120),
  type: z.enum(["TB", "LT"]),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TireBrandPattern = z.infer<typeof tireBrandPatternSchema>;

export const createTireBrandPatternSchema = z.object({
  brand: z.string().trim().min(2).max(120),
  pattern: z.string().trim().min(1).max(120),
  type: z.enum(["TB", "LT"]),
});

export type CreateTireBrandPatternInput = z.infer<typeof createTireBrandPatternSchema>;

export const updateTireBrandPatternSchema = z.object({
  brand: z.string().trim().min(2).max(120).optional(),
  pattern: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTireBrandPatternInput = z.infer<typeof updateTireBrandPatternSchema>;

/**
 * List response with pagination
 */

/**
 * The `:type` path segment on the master-brand routes.
 *
 * Uppercased before validation because a URL segment's casing is a weak
 * contract — `/tb` and `/TB` are the same resource to anyone typing it, and to
 * every client that has ever called this. The route used to cast the raw
 * segment straight to `"TB" | "LT"` with no check at all, so `/tb` sailed past,
 * matched no rows, and answered `200` with an empty list. The tire brand
 * pattern screen sent exactly that and therefore never displayed one of the
 * 1,247 patterns behind it.
 *
 * Anything that is not TB or LT is now a 422 rather than a silent empty page.
 */
export const tireTypeParamSchema = z.object({
  type: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(VEHICLE_CATEGORIES)),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(1000).default(100),
});

export const vehicleBrandListResponseSchema = z.object({
  items: z.array(vehicleBrandSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
});

export type VehicleBrandListResponse = z.infer<typeof vehicleBrandListResponseSchema>;

export const tireBrandPatternListResponseSchema = z.object({
  items: z.array(tireBrandPatternSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
});

export type TireBrandPatternListResponse = z.infer<typeof tireBrandPatternListResponseSchema>;

/**
 * Tire Size schemas.
 * Used for CRUD operations on standard tire sizes (TB & LT)
 */

export const tireSizeSchema = z.object({
  id: z.number().int().positive(),
  size: z.string().trim().min(1).max(50),
  type: z.enum(["TB", "LT"]),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TireSize = z.infer<typeof tireSizeSchema>;

export const createTireSizeSchema = z.object({
  size: z.string().trim().min(1).max(50),
  type: z.enum(["TB", "LT"]),
});

export type CreateTireSizeInput = z.infer<typeof createTireSizeSchema>;

export const updateTireSizeSchema = z.object({
  size: z.string().trim().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTireSizeInput = z.infer<typeof updateTireSizeSchema>;

export const tireSizeListResponseSchema = z.object({
  items: z.array(tireSizeSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
});

export type TireSizeListResponse = z.infer<typeof tireSizeListResponseSchema>;

