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

const SEED_ACTOR = 'SYSTEM_PROD';

async function main() {
  console.log('🚀 Starting database seed for Master Finish Good (PROD)...');

  const filePath = path.join(__dirname, 'fg-data.json');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Data file not found: ${filePath}`);
    process.exit(1);
  }

  const finishGoods = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`📦 Seeding ${finishGoods.length} Master Finish Goods...`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of finishGoods) {
    // Cek apakah PartNumber sudah ada (pakai Unique column PartNumber)
    const existing = await prisma.finishGood.findUnique({
      where: { PartNumber: item.PartNumber },
    });

    if (existing) {
      // Upsert: update data yang ada
      await prisma.finishGood.update({
        where: { PartNumber: item.PartNumber },
        data: {
          PartName: item.PartName,
          Price: item.Price,
          IsPassthrough: item.IsPassthrough,
          UpdatedBy: SEED_ACTOR,
        },
      });
      updatedCount++;
    } else {
      // Upsert: create data baru
      await prisma.finishGood.create({
        data: {
          PartNumber: item.PartNumber,
          PartName: item.PartName,
          Price: item.Price,
          IsPassthrough: item.IsPassthrough,
          Qty: 0,
          CreatedBy: SEED_ACTOR,
          UpdatedBy: SEED_ACTOR,
        },
      });
      createdCount++;
    }
  }

  console.log(
    `\n🎉 Seed Finish Goods completed successfully! Created: ${createdCount}, Updated: ${updatedCount}`,
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
