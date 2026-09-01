import {
  derivePositions,
  totalTires,
  type AxleConfig,
  type InspectionStatus,
} from "@c26/contracts";
import type { PrismaClient } from "../../src/generated/prisma/index.js";
import { hashPassword } from "../../src/kernel/security/password.ts";
import { generateSamplePhoto } from "./sample-photos.ts";

/**
 * Demo data for `local` and `staging` (PLAN/04 §4.4).
 *
 * Never for production, and the entry point enforces that. This is where D-16
 * has to be kept in mind: the legacy login page offered three buttons that
 * authenticated as Supplier, Admin, or PM/SPV with no credentials at all. Demo
 * ACCOUNTS are fine in a development database; a demo LOGIN PATH is not, and
 * there is none — every account below has a real Argon2id hash and goes through
 * the same login as any other, with its password supplied by the environment
 * rather than written in this file (gate G-10 greps for the alternative).
 *
 * The scenarios cover every branch of the status machine (PLAN/03 §7), because
 * a QC queue with one pending row proves almost nothing about the flow.
 */

interface DemoScenario {
  plateDisplay: string;
  chassisNumber: string | null;
  cityCode: string;
  category: "TB" | "LT";
  segment: "bus" | "truck";
  subSegment: string;
  brandName: string;
  cargoType: string;
  axleCount: number;
  configs: AxleConfig[];
  status: InspectionStatus;
  /** Present for statuses that came from a QC decision. */
  review: { decision: "pass" | "drop" | "revision"; notes: string } | null;
  fillSpecs: boolean;
  note: string;
}

const steer = (n: number): AxleConfig => ({ axleType: "steer", axleCount: n, mounting: "single" });
const drive = (n: number, mounting: "single" | "double"): AxleConfig => ({
  axleType: "drive",
  axleCount: n,
  mounting,
});
const free = (n: number, mounting: "single" | "double"): AxleConfig => ({
  axleType: "free_rolling",
  axleCount: n,
  mounting,
});

/**
 * Six scenarios, one per meaningful state.
 *
 * Note which vehicles repeat: `B 4021 KLM` carries a dropped inspection AND a
 * fresh draft, because `dropped_qc` releases the lock and `draft` never takes
 * one (PLAN/11 §5.4, §5.6). That pairing is the single most useful thing to see
 * in seeded data — it is the rule most likely to be misread later.
 */
const SCENARIOS: DemoScenario[] = [
  {
    plateDisplay: "B 9876 UYT",
    chassisNumber: "MHF1KZ4G200123456",
    cityCode: "3172",
    category: "TB",
    segment: "truck",
    subSegment: "General Cargo",
    brandName: "Hino",
    cargoType: "Semen",
    axleCount: 2,
    configs: [steer(1), drive(1, "double")],
    status: "passed_qc",
    review: { decision: "pass", notes: "" },
    fillSpecs: true,
    note: "Lolos QC, spesifikasi ban sudah terisi penuh.",
  },
  {
    plateDisplay: "D 1122 XYZ",
    chassisNumber: null,
    cityCode: "3273",
    category: "TB",
    segment: "bus",
    subSegment: "Intercity Bus (Bus AKAP)",
    brandName: "Mercedes-Benz",
    cargoType: "Penumpang",
    axleCount: 3,
    configs: [steer(1), drive(2, "double")],
    status: "pending_qc",
    review: null,
    fillSpecs: false,
    note: "Menunggu keputusan QC — ini yang muncul di antrean kerja admin.",
  },
  {
    plateDisplay: "L 3344 MNO",
    chassisNumber: "MHF2AB9K300987654",
    cityCode: "3578",
    category: "TB",
    segment: "truck",
    subSegment: "Dump Truck",
    brandName: "Isuzu",
    cargoType: "Pasir",
    axleCount: 4,
    configs: [steer(1), drive(2, "double"), free(1, "single")],
    status: "needs_revision",
    review: {
      decision: "revision",
      notes:
        "Foto posisi Drive 2 Kanan Luar terlalu gelap sehingga merk dan pattern tidak terbaca. Mohon diambil ulang di tempat yang lebih terang.",
    },
    fillSpecs: false,
    note: "Dikembalikan untuk revisi — status yang tidak ada di sistem lama (D-11).",
  },
  {
    plateDisplay: "B 4021 KLM",
    chassisNumber: null,
    cityCode: "3275",
    category: "LT",
    segment: "truck",
    subSegment: "General Cargo",
    brandName: "Mitsubishi Fuso",
    cargoType: "Barang campuran",
    axleCount: 2,
    configs: [steer(1), drive(1, "single")],
    status: "dropped_qc",
    review: {
      decision: "drop",
      notes:
        "Plat nomor pada foto tidak sesuai dengan yang diisikan pada formulir. Pengajuan ditolak, silakan buat pemeriksaan baru dengan data yang benar.",
    },
    fillSpecs: false,
    note: "Ditolak QC. Perhatikan: kendaraan yang sama masih boleh dibuat pemeriksaan baru.",
  },
  {
    plateDisplay: "B 4021 KLM",
    chassisNumber: null,
    cityCode: "3275",
    category: "LT",
    segment: "truck",
    subSegment: "General Cargo",
    brandName: "Mitsubishi Fuso",
    cargoType: "Barang campuran",
    axleCount: 2,
    configs: [steer(1), drive(1, "single")],
    status: "draft",
    review: null,
    fillSpecs: false,
    note: "Draf pada kendaraan yang pernah ditolak — dropped_qc membuka kuncinya.",
  },
  {
    plateDisplay: "H 7788 PQR",
    chassisNumber: null,
    cityCode: "3374",
    category: "TB",
    segment: "truck",
    subSegment: "Trailer",
    brandName: "Scania",
    cargoType: "Kontainer",
    axleCount: 6,
    configs: [steer(1), drive(2, "double"), free(3, "double")],
    status: "draft",
    review: null,
    fillSpecs: false,
    note: "Draf 6 poros, 22 ban — konfigurasi terbesar yang didukung.",
  },
];

const DEMO_USERS = [
  {
    username: "supplier1",
    displayName: "Budi Santoso (Supplier)",
    role: "supplier" as const,
    email: "supplier1@example.test",
    /** Region-restricted, so V-12 is visible in the seeded data (D-13). */
    regionProvinceCodes: ["31", "32"],
  },
  {
    username: "supplier2",
    displayName: "Sari Wulandari (Supplier)",
    role: "supplier" as const,
    email: "supplier2@example.test",
    regionProvinceCodes: [],
  },
  {
    username: "admin1",
    displayName: "Dewi Anggraini (Admin QC)",
    role: "admin" as const,
    email: "admin1@example.test",
    regionProvinceCodes: [],
  },
  {
    username: "manager1",
    displayName: "Rudi Hartono (PM/PIC/SPV)",
    role: "manager" as const,
    email: "manager1@example.test",
    regionProvinceCodes: [],
  },
  {
    username: "operator1",
    displayName: "Agus Prasetyo (Operator)",
    role: "operator" as const,
    email: "operator1@example.test",
    regionProvinceCodes: [],
  },
];

async function seedDemoUsers(prisma: PrismaClient, password: string): Promise<Map<string, bigint>> {
  const passwordHash = await hashPassword(password);
  const ids = new Map<string, bigint>();

  for (const demo of DEMO_USERS) {
    const existing = await prisma.user.findFirst({
      where: { username: demo.username, deletedAt: null },
      select: { id: true },
    });

    if (existing !== null) {
      ids.set(demo.username, existing.id);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        username: demo.username,
        displayName: demo.displayName,
        role: demo.role,
        email: demo.email,
        passwordHash,
        // Demo accounts skip the forced change so the flow can be walked through
        // immediately; the real first admin does not (see the entry point).
        mustChangePassword: false,
      },
      select: { id: true },
    });

    if (demo.regionProvinceCodes.length > 0) {
      const provinces = await prisma.province.findMany({
        where: { code: { in: demo.regionProvinceCodes } },
        select: { id: true },
      });
      await prisma.userRegion.createMany({
        data: provinces.map((province) => ({ userId: user.id, provinceId: province.id })),
      });
    }

    ids.set(demo.username, user.id);
  }

  return ids;
}

async function nextSerial(
  prisma: PrismaClient,
  year: number,
): Promise<{ serialNumber: string; serialYear: number; serialSeq: number }> {
  const rows = await prisma.$queryRaw<
    { serial_number: string; serial_year: number; serial_seq: number }[]
    // The `::int` cast is required: Prisma sends a JS number as int8, and the
    // function takes int4, so without it PostgreSQL reports that
    // next_serial_number(bigint) does not exist.
  >`SELECT * FROM next_serial_number(${year}::int)`;

  const row = rows[0];
  if (row === undefined) throw new Error("next_serial_number returned no row");
  return {
    serialNumber: row.serial_number,
    serialYear: row.serial_year,
    serialSeq: row.serial_seq,
  };
}

export async function seedDemoData(prisma: PrismaClient, password: string): Promise<void> {
  const userIds = await seedDemoUsers(prisma, password);
  const supplierId = userIds.get("supplier1");
  const adminId = userIds.get("admin1");
  if (supplierId === undefined || adminId === undefined) {
    throw new Error("demo users were not created");
  }

  const existingInspections = await prisma.inspection.count();
  if (existingInspections > 0) {
    process.stdout.write("  demo inspections already present — left untouched\n");
    return;
  }

  const year = new Date().getFullYear();
  const tireBrands = await prisma.tireBrand.findMany({ take: 3, orderBy: { name: "asc" } });
  let photoCount = 0;

  for (const [index, scenario] of SCENARIOS.entries()) {
    const city = await prisma.city.findUniqueOrThrow({ where: { code: scenario.cityCode } });
    const brand = await prisma.vehicleBrand.findUnique({ where: { name: scenario.brandName } });

    // The engine decides the tire count and the position names — never this
    // script, and never a hand-written list (PLAN/03 §1).
    const positions = derivePositions(scenario.configs);
    const tireTotal = totalTires(scenario.configs);

    const plateKey = scenario.plateDisplay.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    let vehicle = await prisma.vehicle.findFirst({ where: { plateKey, deletedAt: null } });

    if (vehicle === null) {
      vehicle = await prisma.vehicle.create({
        data: {
          plateDisplay: scenario.plateDisplay,
          chassisNumber: scenario.chassisNumber,
          category: scenario.category,
          segment: scenario.segment,
          subSegment: scenario.subSegment,
          vehicleBrandId: brand?.id ?? null,
          vehicleBrandOther: brand === null ? scenario.brandName : null,
          cargoType: scenario.cargoType,
          cityId: city.id,
          axleCount: scenario.axleCount,
          totalTires: tireTotal,
          createdById: supplierId,
          axleConfigs: {
            create: scenario.configs.map((config) => ({
              axleType: config.axleType,
              axleCount: config.axleCount,
              mounting: config.mounting,
            })),
          },
        },
      });
    }

    const serial = await nextSerial(prisma, year);
    const submittedAt = scenario.status === "draft" ? null : new Date(Date.now() - index * 86_400_000);

    const inspection = await prisma.inspection.create({
      data: {
        vehicleId: vehicle.id,
        serialNumber: serial.serialNumber,
        serialYear: serial.serialYear,
        serialSeq: serial.serialSeq,
        status: scenario.status,
        submittedById: supplierId,
        submittedAt,
        notes: scenario.note,
        tirePositions: {
          create: positions.map((position) => ({
            positionCode: position.positionCode,
            positionLabel: position.positionLabel,
            axleType: position.axleType,
            axleIndex: position.axleIndex,
            side: position.side,
            depth: position.depth,
            sortOrder: position.sortOrder,
          })),
        },
      },
      include: { tirePositions: { orderBy: { sortOrder: "asc" } } },
    });

    // Photo caps: 10 per slot and 30 per inspection, both enforced by
    // trg_photo_limit (K-06, PLAN/06 §6). The 6-axle scenario has 22 positions,
    // so its per-position photos plus the two general ones land at 24.
    const generalSlots = [
      { slot: "front_rear" as const, label: "Tampak Depan / Belakang" },
      { slot: "side" as const, label: "Tampak Samping" },
    ];

    for (const [slotIndex, general] of generalSlots.entries()) {
      const generated = await generateSamplePhoto({
        year: serial.serialYear,
        serialNumber: serial.serialNumber,
        slot: general.slot,
        positionCode: null,
        label: general.label,
        sublabel: `${serial.serialNumber} · ${scenario.plateDisplay}`,
        index: slotIndex,
      });

      await prisma.photo.create({
        data: {
          inspectionId: inspection.id,
          slot: general.slot,
          storageKey: generated.storageKey,
          checksumSha256: generated.checksumSha256,
          byteSize: generated.byteSize,
          mimeType: generated.mimeType,
          width: generated.width,
          height: generated.height,
          capturedAt: submittedAt,
          uploadedById: supplierId,
        },
      });
      photoCount++;
    }

    for (const [positionIndex, position] of inspection.tirePositions.entries()) {
      const generated = await generateSamplePhoto({
        year: serial.serialYear,
        serialNumber: serial.serialNumber,
        slot: "tire_position",
        positionCode: position.positionCode,
        label: position.positionLabel,
        sublabel: `${serial.serialNumber} · ${position.positionCode}`,
        index: positionIndex + 2,
      });

      await prisma.photo.create({
        data: {
          inspectionId: inspection.id,
          tirePositionId: position.id,
          slot: "tire_position",
          storageKey: generated.storageKey,
          checksumSha256: generated.checksumSha256,
          byteSize: generated.byteSize,
          mimeType: generated.mimeType,
          width: generated.width,
          height: generated.height,
          capturedAt: submittedAt,
          uploadedById: supplierId,
        },
      });
      photoCount++;
    }

    // A QC decision is a history row, not a status column. The legacy system
    // kept `Nama Admin QC` on the record, so a second decision erased the first
    // and nobody could tell there had been one (PLAN/02 §9).
    if (scenario.review !== null) {
      const statusBefore: InspectionStatus = "pending_qc";
      const review = await prisma.qcReview.create({
        data: {
          inspectionId: inspection.id,
          reviewerId: adminId,
          decision: scenario.review.decision,
          statusBefore,
          statusAfter: scenario.status,
          notes: scenario.review.notes === "" ? null : scenario.review.notes,
          reviewedAt: new Date(Date.now() - index * 43_200_000),
        },
      });

      if (scenario.review.decision === "revision") {
        const target = inspection.tirePositions.find((p) => p.positionCode === "DRIVE_2_R_OUT");
        if (target !== undefined) {
          await prisma.qcComment.create({
            data: {
              reviewId: review.id,
              tirePositionId: target.id,
              body: "Terlalu gelap, merk dan pattern tidak terbaca.",
            },
          });
        }
      }
    }

    if (scenario.fillSpecs) {
      for (const [positionIndex, position] of inspection.tirePositions.entries()) {
        const brandRow = tireBrands[positionIndex % Math.max(tireBrands.length, 1)];
        await prisma.tireSpec.create({
          data: {
            tirePositionId: position.id,
            tireBrandId: brandRow?.id ?? null,
            pattern: positionIndex % 2 === 0 ? "R187" : "M840",
            size: "1000-20",
            plyRating: "16PR",
            isRetread: positionIndex % 4 === 3,
            filledById: adminId,
            filledAt: new Date(),
          },
        });
      }
    }

    process.stdout.write(
      `  ${serial.serialNumber}  ${scenario.plateDisplay.padEnd(12)} ` +
        `${scenario.status.padEnd(15)} ${String(tireTotal).padStart(2)} ban  ${scenario.note}\n`,
    );
  }

  // The dashboard reads the materialised view, so it stays empty until this runs.
  await prisma.$executeRawUnsafe("REFRESH MATERIALIZED VIEW mv_region_progress");

  process.stdout.write(
    `  demo data: ${DEMO_USERS.length} users, ${SCENARIOS.length} inspections, ${photoCount} photos\n`,
  );
}
