import { PrismaClient } from "./src/generated/prisma/index.js";
import { seedMasterData } from "./prisma/seed/master-data.ts";
import { seedCsvData } from "./prisma/seed/csv-data.ts";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const prisma = new PrismaClient();
  await mkdir(resolve("/app/uploads"), { recursive: true });
  console.log("upload directory ready: /app/uploads");
  console.log("Seeding master data...");
  await seedMasterData(prisma);
  console.log("Seeding CSV data...");
  await seedCsvData(prisma);
  await prisma.$disconnect();
  console.log("Seeding completed!");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => process.exit(0));