import { z } from "zod";
import { USER_ROLES, type UserRole } from "./constants.ts";
import { paginationQuerySchema } from "./envelope.ts";

/**
 * User management (PLAN/04 §5).
 *
 * The legacy system had add and delete, nothing else — no edit, no password
 * reset, no deactivate (D-12). The four guards at the bottom of PLAN/04 §5 are
 * the part that matters most: `uq_users_username_active` lets a username be
 * reused after deletion, so without them one click can lock everyone out of the
 * system permanently.
 */

export const usernameSchema = z
  .string({ required_error: "User ID wajib diisi." })
  .trim()
  .min(3, "User ID minimal 3 karakter.")
  .max(64, "User ID maksimal 64 karakter.")
  .regex(/^[A-Za-z0-9._-]+$/, "User ID hanya boleh berisi huruf, angka, titik, garis bawah, dan strip.");

/**
 * Q-13 answered: email and phone are added from the first migration even though
 * the email channel arrives in F4. Adding a column to an empty table is free;
 * adding one to a live table is not (PLAN/12 §10, N-07).
 */
const contactShape = {
  email: z
    .string()
    .trim()
    .email("Format alamat email tidak valid.")
    .max(200)
    .nullable()
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Nomor telepon hanya boleh berisi angka, 8–15 digit.")
    .nullable()
    .optional(),
};

/**
 * Region assignment (D-13). No rows at all means no restriction; a province row
 * grants every city in it; rows combine as a union, never an intersection.
 */
export const userRegionSchema = z
  .object({
    provinceId: z.number().int().positive().nullable().optional(),
    cityId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (v) =>
      (v.provinceId !== null && v.provinceId !== undefined) !==
      (v.cityId !== null && v.cityId !== undefined),
    { message: "Setiap penugasan wilayah harus berupa provinsi ATAU kota, tidak keduanya." },
  );

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z
    .string({ required_error: "Nama wajib diisi." })
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(120),
  role: z.enum(USER_ROLES, { errorMap: () => ({ message: "Peran wajib dipilih." }) }),
  ...contactShape,
  regions: z.array(userRegionSchema).max(50).default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** The username is immutable: it is the identity other records were created under. */
export const updateUserSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
  ...contactShape,
  regions: z.array(userRegionSchema).max(50).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userListQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  isActive: z.coerce.boolean().optional(),
  q: z.string().trim().max(60).optional(),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

/**
 * PLAN/04 §5 guard 4: deletion requires retyping the username, not a browser
 * `confirm()`. The dialog compares this against the record being deleted.
 */
export const deleteUserSchema = z.object({
  confirmUsername: z.string().trim().min(1, "Ketik ulang User ID untuk mengonfirmasi."),
});

export type DeleteUserInput = z.infer<typeof deleteUserSchema>;

export interface UserRecord {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  mfaEnrolled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  regions: { provinceId: number | null; cityId: number | null; name: string }[];
}

export interface PasswordResetResult {
  /** Shown once to the admin, delivered out of band. Never stored in plain text. */
  temporaryPassword: string;
  /** Downgrading or resetting always revokes every session (PLAN/04 §5 guard 3). */
  revokedSessions: number;
}
