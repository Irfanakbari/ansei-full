import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

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
  console.log('🚀 Starting database seed for Master UOM & Supplier (PROD)...');

  // ============================================
  // 1. Seed Master UOM (Satuan)
  // ============================================
  const uomData = [
    { Name: 'PCS' },
    { Name: 'SET' },
    { Name: 'KG' },
    { Name: 'LITER' },
  ];

  console.log('\n📦 Seeding Master UOM (Satuan)...');

  for (const data of uomData) {
    // Karena kolom Name tidak unik di schema Prisma, kita gunakan findFirst lalu create (seperti logika upsert)
    const existing = await prisma.satuan.findFirst({
      where: { Name: data.Name },
    });

    if (existing) {
      console.log(`ℹ️  UOM '${data.Name}' already exists. Skipping.`);
    } else {
      await prisma.satuan.create({
        data: {
          ...data,
          CreatedBy: SEED_ACTOR,
          UpdatedBy: SEED_ACTOR,
        },
      });
      console.log(`✅ UOM '${data.Name}' created.`);
    }
  }

  // ============================================
  // 2. Seed Master Supplier
  // ============================================
  const supplierData = [
    { Name: 'ARMSTRONG' },
    { Name: 'HI-LEX' },
    { Name: 'PLASSES' },
    { Name: 'NKP' },
    { Name: 'NITTO' },
    { Name: 'ANSEI NAGOYA' },
    { Name: 'NAGOYA' },
    { Name: 'SAA' },
  ];

  console.log('\n📦 Seeding Master Supplier...');

  for (const data of supplierData) {
    // Karena kolom Name tidak unik di schema Prisma, kita gunakan findFirst lalu create (seperti logika upsert)
    const existing = await prisma.supplier.findFirst({
      where: { Name: data.Name },
    });

    if (existing) {
      console.log(`ℹ️  Supplier '${data.Name}' already exists. Skipping.`);
    } else {
      await prisma.supplier.create({
        data: {
          ...data,
          CreatedBy: SEED_ACTOR,
          UpdatedBy: SEED_ACTOR,
        },
      });
      console.log(`✅ Supplier '${data.Name}' created.`);
    }
  }

  console.log('\n🎉 Master data seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
