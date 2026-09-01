import ExcelJS from "exceljs";
import { EXPORT_KIND_LABELS, type ExportKind } from "@c26/contracts";
import { getPrisma, withTransaction } from "../../kernel/db.ts";
import { publishEvent } from "../../kernel/outbox.ts";
import { putObject } from "../../kernel/storage/index.ts";

/**
 * Builds an Excel export (PLAN/05 §8, PLAN/08 F5).
 *
 * K-09 keeps Excel because it is the format people actually work in. What
 * changes is D-09: the legacy buttons produced nothing observable at all, so
 * this job reports progress at every stage and finishes with a download link and
 * an in-app notification.
 *
 * It runs in the worker rather than in the request because tens of thousands of
 * rows exceed any sane request budget — the same limit that made export
 * impossible in Apps Script once data grew (B-05).
 */

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F5F9" },
};

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

async function reportProgress(jobId: string, progress: number, rowCount?: number): Promise<void> {
  await getPrisma().exportJob.update({
    where: { id: jobId },
    data: { progress, ...(rowCount === undefined ? {} : { rowCount }) },
  });
}

interface ExportParams {
  from?: string;
  to?: string;
  provinceId?: number;
  cityId?: number;
  category?: "TB" | "LT";
  status?: string[];
}

function dateFilter(params: ExportParams): { gte?: Date; lte?: Date } | undefined {
  if (params.from === undefined && params.to === undefined) return undefined;
  return {
    ...(params.from !== undefined ? { gte: new Date(params.from) } : {}),
    ...(params.to !== undefined ? { lte: new Date(params.to) } : {}),
  };
}

async function buildQcSheet(
  workbook: ExcelJS.Workbook,
  params: ExportParams,
  jobId: string,
): Promise<number> {
  const sheet = workbook.addWorksheet("Quality Control");
  sheet.columns = [
    { header: "Serial Number", key: "sn", width: 18 },
    { header: "Plat Nomor", key: "plate", width: 14 },
    { header: "Provinsi", key: "province", width: 16 },
    { header: "Kota", key: "city", width: 16 },
    { header: "Kategori", key: "category", width: 10 },
    { header: "Segmen", key: "segment", width: 10 },
    { header: "Kategori Bus/Truck", key: "subSegment", width: 20 },
    { header: "Merk Kendaraan", key: "brand", width: 16 },
    { header: "Jenis Muatan", key: "cargo", width: 16 },
    { header: "Jumlah Poros", key: "axleCount", width: 13 },
    { header: "Total Ban", key: "totalTires", width: 11 },
    { header: "Jumlah Foto", key: "photos", width: 12 },
    { header: "Status QC", key: "status", width: 15 },
    { header: "Supplier", key: "supplier", width: 20 },
    { header: "Tanggal Kirim", key: "submittedAt", width: 18 },
    { header: "Alasan Terakhir", key: "notes", width: 40 },
  ];
  styleHeader(sheet);

  const where = {
    deletedAt: null,
    ...(dateFilter(params) === undefined ? {} : { submittedAt: dateFilter(params) }),
    ...(params.status !== undefined && params.status.length > 0
      ? { status: { in: params.status as never } }
      : {}),
    ...(params.provinceId !== undefined || params.cityId !== undefined || params.category !== undefined
      ? {
          vehicle: {
            ...(params.cityId !== undefined ? { cityId: BigInt(params.cityId) } : {}),
            ...(params.provinceId !== undefined
              ? { city: { provinceId: BigInt(params.provinceId) } }
              : {}),
            ...(params.category !== undefined ? { category: params.category } : {}),
          },
        }
      : {}),
  };

  const total = await getPrisma().inspection.count({ where });
  const pageSize = 500;
  let written = 0;

  // Paged rather than loaded whole: 43,200 inspections with their relations
  // would be a large object graph to hold in one worker's memory.
  for (let skip = 0; skip < total; skip += pageSize) {
    const rows = await getPrisma().inspection.findMany({
      where,
      include: {
        vehicle: {
          include: {
            city: { include: { province: { select: { name: true } } } },
            vehicleBrand: { select: { name: true } },
          },
        },
        submittedBy: { select: { displayName: true } },
        _count: { select: { photos: true } },
        qcReviews: { orderBy: { reviewedAt: "desc" }, take: 1, select: { notes: true } },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: pageSize,
    });

    for (const row of rows) {
      sheet.addRow({
        sn: row.serialNumber,
        plate: row.vehicle.plateDisplay,
        province: row.vehicle.city.province.name,
        city: row.vehicle.city.name,
        category: row.vehicle.category,
        segment: row.vehicle.segment,
        subSegment: row.vehicle.subSegment,
        brand: row.vehicle.vehicleBrand?.name ?? row.vehicle.vehicleBrandOther ?? "",
        cargo: row.vehicle.cargoType,
        axleCount: row.vehicle.axleCount,
        totalTires: row.vehicle.totalTires,
        photos: row._count.photos,
        status: row.status,
        supplier: row.submittedBy.displayName,
        // dd/mm/yyyy throughout the product. The legacy QC filter used mm/dd/yyyy
        // — an American format in an Indonesian application (PLAN/02 §4).
        submittedAt: row.submittedAt === null ? "" : formatWib(row.submittedAt),
        notes: row.qcReviews[0]?.notes ?? "",
      });
    }

    written += rows.length;
    await reportProgress(jobId, Math.min(90, Math.round((written / Math.max(total, 1)) * 90)), written);
  }

  return written;
}

async function buildTireSpecSheet(
  workbook: ExcelJS.Workbook,
  params: ExportParams,
  jobId: string,
): Promise<number> {
  const sheet = workbook.addWorksheet("Spesifikasi Ban");
  sheet.columns = [
    { header: "Serial Number", key: "sn", width: 18 },
    { header: "Plat Nomor", key: "plate", width: 14 },
    { header: "Kota", key: "city", width: 16 },
    { header: "Posisi Ban", key: "position", width: 24 },
    { header: "Kode Posisi", key: "code", width: 18 },
    { header: "Merk Ban", key: "brand", width: 16 },
    { header: "Pattern", key: "pattern", width: 16 },
    { header: "Ukuran", key: "size", width: 14 },
    { header: "PR", key: "ply", width: 8 },
    { header: "Vulkanisir", key: "retread", width: 12 },
    { header: "Diisi Oleh", key: "filledBy", width: 20 },
    { header: "Tanggal Diisi", key: "filledAt", width: 18 },
  ];
  styleHeader(sheet);

  const where = {
    inspection: {
      deletedAt: null,
      status: "passed_qc" as const,
      ...(dateFilter(params) === undefined ? {} : { submittedAt: dateFilter(params) }),
      ...(params.cityId !== undefined || params.provinceId !== undefined
        ? {
            vehicle: {
              ...(params.cityId !== undefined ? { cityId: BigInt(params.cityId) } : {}),
              ...(params.provinceId !== undefined
                ? { city: { provinceId: BigInt(params.provinceId) } }
                : {}),
            },
          }
        : {}),
    },
  };

  const total = await getPrisma().tirePosition.count({ where });
  const pageSize = 1000;
  let written = 0;

  for (let skip = 0; skip < total; skip += pageSize) {
    const positions = await getPrisma().tirePosition.findMany({
      where,
      include: {
        inspection: {
          include: { vehicle: { include: { city: { select: { name: true } } } } },
        },
        tireSpec: {
          include: {
            tireBrand: { select: { name: true } },
            filledBy: { select: { displayName: true } },
          },
        },
      },
      orderBy: [{ inspectionId: "asc" }, { sortOrder: "asc" }],
      skip,
      take: pageSize,
    });

    for (const position of positions) {
      const spec = position.tireSpec;
      sheet.addRow({
        sn: position.inspection.serialNumber,
        plate: position.inspection.vehicle.plateDisplay,
        city: position.inspection.vehicle.city.name,
        // The human label for the report, the stable code beside it. Anyone
        // matching this file against another system uses the code.
        position: position.positionLabel,
        code: position.positionCode,
        brand: spec?.tireBrand?.name ?? spec?.brandOther ?? "",
        pattern: spec?.pattern ?? "",
        size: spec?.size ?? "",
        ply: spec?.plyRating ?? "",
        retread: spec?.isRetread === true ? "Y" : "N",
        filledBy: spec?.filledBy?.displayName ?? "",
        filledAt: spec?.filledAt === null || spec?.filledAt === undefined ? "" : formatWib(spec.filledAt),
      });
    }

    written += positions.length;
    await reportProgress(jobId, Math.min(90, Math.round((written / Math.max(total, 1)) * 90)), written);
  }

  return written;
}

async function buildRegionSheet(workbook: ExcelJS.Workbook, jobId: string): Promise<number> {
  const sheet = workbook.addWorksheet("Progres Wilayah");
  sheet.columns = [
    { header: "Tanggal", key: "day", width: 14 },
    { header: "Provinsi", key: "province", width: 18 },
    { header: "Kota", key: "city", width: 18 },
    { header: "TB", key: "tb", width: 8 },
    { header: "LT", key: "lt", width: 8 },
    { header: "Total", key: "total", width: 10 },
  ];
  styleHeader(sheet);

  const rows = await getPrisma().$queryRaw<
    { day: Date; province_name: string; city_name: string; tb: bigint; lt: bigint }[]
  >`
    SELECT mv.day,
           p.name AS province_name,
           c.name AS city_name,
           sum(mv.unit_count) FILTER (WHERE mv.category = 'TB') AS tb,
           sum(mv.unit_count) FILTER (WHERE mv.category = 'LT') AS lt
      FROM mv_region_progress mv
      JOIN cities c    ON c.id = mv.city_id
      JOIN provinces p ON p.id = mv.province_id
     GROUP BY 1, 2, 3
     ORDER BY 1 DESC, 2, 3
  `;

  for (const row of rows) {
    const tb = Number(row.tb ?? 0);
    const lt = Number(row.lt ?? 0);
    sheet.addRow({
      day: formatWibDate(row.day),
      province: row.province_name,
      city: row.city_name,
      tb,
      lt,
      total: tb + lt,
    });
  }

  await reportProgress(jobId, 90, rows.length);
  return rows.length;
}

function formatWib(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatWibDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export async function buildExport(jobId: string): Promise<{ rowCount: number }> {
  const prisma = getPrisma();

  const job = await prisma.exportJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date(), progress: 5 },
  });

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Commercial 2026";
    workbook.created = new Date();

    const params = (job.params ?? {}) as ExportParams;
    const kind = job.kind as ExportKind;

    const rowCount =
      kind === "qc"
        ? await buildQcSheet(workbook, params, jobId)
        : kind === "tire_specs"
          ? await buildTireSpecSheet(workbook, params, jobId)
          : await buildRegionSheet(workbook, jobId);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const storageKey = `exports/${new Date().getFullYear()}/${jobId}.xlsx`;

    await putObject({
      storageKey,
      body: buffer,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await withTransaction(async (tx) => {
      await tx.exportJob.update({
        where: { id: jobId },
        data: {
          status: "done",
          progress: 100,
          rowCount,
          storageKey,
          finishedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await publishEvent(tx, { id: job.requestedById, requestId: job.requestId ?? jobId }, {
        type: "export.ready",
        aggregateId: 0,
        payload: {
          userId: job.requestedById.toString(),
          kindLabel: EXPORT_KIND_LABELS[kind],
          rowCount,
        },
      });
    });

    return { rowCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    await withTransaction(async (tx) => {
      await tx.exportJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          // Indonesian and safe to display. The stack trace goes to the log,
          // never to the browser (PLAN/05 §4 rule 2).
          errorMessage: "Berkas export gagal disusun. Laporkan kode permintaan ke admin.",
          finishedAt: new Date(),
        },
      });

      await publishEvent(tx, { id: job.requestedById, requestId: job.requestId ?? jobId }, {
        type: "export.failed",
        aggregateId: 0,
        payload: {
          userId: job.requestedById.toString(),
          kindLabel: EXPORT_KIND_LABELS[job.kind as ExportKind],
          requestId: job.requestId ?? jobId,
        },
      });
    });

    throw new Error(`export ${jobId} failed: ${message}`);
  }
}
