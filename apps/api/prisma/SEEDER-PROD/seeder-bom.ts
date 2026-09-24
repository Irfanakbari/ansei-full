import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface BomItem {
  fgPartNumber: string;
  fgPartName: string;
  rawPartNumberOriginal: string;
  rawPartNumberCleaned: string;
  rawPartName: string;
  qty: number;
}

async function main() {
  console.log(
    '🚀 Starting database seed for Bill of Materials / BOM (PROD)...',
  );

  const filePath = path.join(__dirname, 'bom-data.json');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Data file not found: ${filePath}`);
    process.exit(1);
  }

  const bomList: BomItem[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Pre-fetch FinishGoods and Materials for fast lookup
  const finishGoods = await prisma.finishGood.findMany();
  const materials = await prisma.material.findMany();

  const fgMap = new Map<string, number>();
  for (const fg of finishGoods) {
    fgMap.set(fg.PartNumber, fg.Id);
  }

  const matMap = new Map<string, number>();
  for (const mat of materials) {
    matMap.set(mat.PartNumber, mat.Id);
  }

  console.log(`📦 Seeding ${bomList.length} BOM relations...`);

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of bomList) {
    const fgId = fgMap.get(item.fgPartNumber);
    const matId = matMap.get(item.rawPartNumberCleaned);

    if (!fgId) {
      console.warn(
        `⚠️ FinishGood not found in DB: ${item.fgPartNumber}. Skipping.`,
      );
      skippedCount++;
      continue;
    }

    if (!matId) {
      console.warn(
        `⚠️ Material not found in DB: ${item.rawPartNumberCleaned}. Skipping.`,
      );
      skippedCount++;
      continue;
    }

    const existingBom = await prisma.billOfMaterials.findUnique({
      where: {
        FinishGoodId_MaterialId: {
          FinishGoodId: fgId,
          MaterialId: matId,
        },
      },
    });

    if (existingBom) {
      await prisma.billOfMaterials.update({
        where: {
          FinishGoodId_MaterialId: {
            FinishGoodId: fgId,
            MaterialId: matId,
          },
        },
        data: {
          Qty: item.qty,
        },
      });
      updatedCount++;
    } else {
      await prisma.billOfMaterials.create({
        data: {
          FinishGoodId: fgId,
          MaterialId: matId,
          Qty: item.qty,
        },
      });
      createdCount++;
    }
  }

  console.log(
    `\n🎉 BOM Seeding completed successfully! Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
