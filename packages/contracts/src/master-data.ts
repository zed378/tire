import { z } from "zod";

/**
 * Master data (PLAN/02 §5), closing Q-07.
 *
 * Province, city, and brand lists were constants in the legacy code. Coverage
 * today is Java only; the moment the business touches Sumatra or Kalimantan,
 * a constant becomes a deployment. So they are managed rows instead.
 *
 * The tire brand change is a behaviour change worth stating: free text made
 * `Bridgestone`, `bridgestone`, and `Bridgstone` three different brands in every
 * report. The managed list keeps a free-text escape hatch (`brand_other`) that
 * surfaces in an admin review queue, so real new brands get promoted rather than
 * blocked.
 */

const nameSchema = z
  .string({ required_error: "Nama wajib diisi." })
  .trim()
  .min(2, "Nama minimal 2 karakter.")
  .max(120, "Nama maksimal 120 karakter.");

export const createProvinceSchema = z.object({
  /** BPS code: '31' for DKI Jakarta, '32' for Jawa Barat. */
  code: z
    .string({ required_error: "Kode provinsi wajib diisi." })
    .trim()
    .regex(/^[0-9]{2}$/, "Kode provinsi terdiri dari 2 angka."),
  name: nameSchema,
});

export const createCitySchema = z.object({
  provinceId: z.number({ required_error: "Provinsi wajib dipilih." }).int().positive(),
  code: z
    .string({ required_error: "Kode kota wajib diisi." })
    .trim()
    .regex(/^[0-9]{4}$/, "Kode kota terdiri dari 4 angka."),
  name: nameSchema,
});

export const createBrandSchema = z.object({ name: nameSchema });

export const updateMasterSchema = z.object({
  name: nameSchema.optional(),
  /**
   * Deactivation, not deletion. A city that stops being served still has
   * inspections pointing at it.
   */
  isActive: z.boolean().optional(),
});

export type CreateProvinceInput = z.infer<typeof createProvinceSchema>;
export type CreateCityInput = z.infer<typeof createCitySchema>;
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateMasterInput = z.infer<typeof updateMasterSchema>;

export interface Province {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  cityCount: number;
}

export interface City {
  id: number;
  provinceId: number;
  provinceName: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface Brand {
  id: number;
  name: string;
  isActive: boolean;
}

/** Everything a form needs in one request, cached by the service worker. */
export interface MasterDataBundle {
  provinces: Province[];
  cities: City[];
  vehicleBrands: Brand[];
  tireBrands: Brand[];
  /** Values the form offers but that live in code, not in tables. */
  subSegments: { segment: string; values: string[] }[];
}

/** Free-text brands awaiting promotion into the managed list. */
export interface PendingBrandReview {
  value: string;
  occurrences: number;
  firstSeenAt: string;
  source: "vehicle" | "tire";
}
