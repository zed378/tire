import { z } from "zod";
import {
  EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  type EventType,
  type NotificationChannel,
  type NotificationStatus,
} from "./constants.ts";
import { paginationQuerySchema } from "./envelope.ts";

/**
 * Notifications (PLAN/12).
 *
 * Two things that are often treated as one: a queue answers "when is this work
 * done?", a notification answers "who needs to know, and through what?". Mixing
 * them produces a system that emails people about transactions that rolled back.
 *
 * The transactional outbox is what joins them correctly, and it is the part most
 * often skipped. If the transaction rolls back, the outbox row goes with it, so
 * a notification about an event that never happened becomes impossible rather
 * than merely rare.
 */

export const notificationListQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().default(false),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const markReadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;

export const notificationPreferenceSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  channel: z.enum(NOTIFICATION_CHANNELS),
  enabled: z.boolean(),
});

export const updatePreferencesSchema = z.object({
  preferences: z.array(notificationPreferenceSchema).max(200),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export interface NotificationRecord {
  id: number;
  eventType: EventType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  /** Where clicking it goes, e.g. `/inspections/SN2026-00042`. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  eventType: EventType;
  channel: NotificationChannel;
  enabled: boolean;
  /** In-app is an archive, not an interruption — it can never be switched off. */
  locked: boolean;
  lockedReason: string | null;
}

/**
 * Rendered titles and bodies. Held here rather than in the worker so a wording
 * change does not require touching queue code, and so the client can render an
 * in-app notification from the same source.
 */
export const NOTIFICATION_TEMPLATES: Record<EventType, { title: string; body: string }> = {
  "inspection.submitted": {
    title: "Pengajuan baru menunggu QC",
    body: "{{serialNumber}} ({{plateDisplay}}) dari {{supplierName}} masuk antrean QC.",
  },
  "inspection.passed_qc": {
    title: "Pengajuan Anda lolos QC",
    body: "{{serialNumber}} ({{plateDisplay}}) dinyatakan Pass QC.",
  },
  "inspection.dropped_qc": {
    title: "Pengajuan Anda ditolak",
    body: "{{serialNumber}} ({{plateDisplay}}) ditolak. Alasan: {{notes}}",
  },
  "inspection.needs_revision": {
    title: "Pengajuan Anda perlu diperbaiki",
    body: "{{serialNumber}} ({{plateDisplay}}) dikembalikan untuk revisi. Alasan: {{notes}}",
  },
  "inspection.resubmitted": {
    title: "Pengajuan diperbaiki dan dikirim ulang",
    body: "{{serialNumber}} ({{plateDisplay}}) kembali ke antrean QC.",
  },
  "export.ready": {
    title: "Berkas export siap diunduh",
    body: "Export {{kindLabel}} selesai, {{rowCount}} baris.",
  },
  "export.failed": {
    title: "Export gagal",
    body: "Export {{kindLabel}} gagal disusun. Kode: {{requestId}}",
  },
  "user.password_reset": {
    title: "Password Anda telah direset",
    body: "Admin mereset password akun Anda. Gunakan password sementara yang diberikan lalu segera ganti.",
  },
  "user.login_from_new_device": {
    title: "Masuk dari perangkat baru",
    body: "Akun Anda dipakai masuk dari {{deviceLabel}} ({{location}}). Kalau ini bukan Anda, segera ganti password.",
  },
  "job.repeatedly_failed": {
    title: "Pekerjaan latar gagal berulang",
    body: "Pekerjaan {{jobName}} gagal {{failureCount}} kali dalam 24 jam terakhir.",
  },
  "storage.threshold_exceeded": {
    title: "Pemakaian penyimpanan melewati ambang",
    body: "Penyimpanan foto mencapai {{usedGb}} GB ({{percent}}% dari ambang peringatan).",
  },
  "vehicle.duplicate_suspected": {
    title: "Kendaraan perlu ditinjau",
    body: "{{plateDisplay}} didaftarkan supplier lain dan kini diperiksa oleh {{supplierName}}.",
  },
};

export function renderTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ""));
}
