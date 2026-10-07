import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  MaterialSource,
} from '../../src/generated/prisma/client';
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
const INITIAL_STOCK_PER_LOCATION = 1000;

async function main() {
  console.log('🚀 Starting database seed for Master Material (PROD)...');

  const filePath = path.join(__dirname, 'material-data.json');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Data file not found: ${filePath}`);
    process.exit(1);
  }

  const materials = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Load all suppliers to map for quick lookup
  const suppliers = await prisma.supplier.findMany();
  const supplierMap = new Map();
  for (const s of suppliers) {
    supplierMap.set(s.Name, s.Id);
  }

  // Set default UOM if available (PCS is common)
  const defaultUom = await prisma.satuan.findFirst({ where: { Name: 'PCS' } });

  console.log(`📦 Seeding ${materials.length} Master Materials...`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of materials) {
    const supplierId = supplierMap.get(item.Supplier) || null;

    // Cek apakah PartNumber sudah ada (pakai Unique column PartNumber)
    const existing = await prisma.material.findUnique({
      where: { PartNumber: item.PartNumber },
    });

    await prisma.$transaction(async (tx) => {
      if (existing) {
        updatedCount++;
        await tx.material.update({
          where: { PartNumber: item.PartNumber },
          data: {
            PartName: item.PartName,
            Supplier: item.Supplier,
            SupplierId: supplierId,
            Remark: item.Remark,
            MaterialSource: item.MaterialSource as MaterialSource,
            UpdatedBy: SEED_ACTOR,
          },
        });
        return;
      }

      createdCount++;
      const material = await tx.material.create({
        data: {
          PartNumber: item.PartNumber,
          PartName: item.PartName,
          Supplier: item.Supplier,
          SupplierId: supplierId,
          Remark: item.Remark,
          MaterialSource: item.MaterialSource as MaterialSource,
          SatuanId: defaultUom?.Id || null,
          QtyRack: INITIAL_STOCK_PER_LOCATION,
          QtyWarehouse: INITIAL_STOCK_PER_LOCATION,
          CreatedBy: SEED_ACTOR,
          UpdatedBy: SEED_ACTOR,
        },
      });

      await tx.inventoryLedger.createMany({
        data: [
          {
            Id: crypto.randomUUID(),
            ItemCategory: 'MATERIAL',
            MaterialId: material.PartNumber,
            Location: 'WAREHOUSE',
            TransactionType: 'ADJUSTMENT_MANUAL',
            ReferenceDoc: `SEED-INITIAL-WAREHOUSE-${material.PartNumber}`,
            BalanceBefore: 0,
            QtyIn: INITIAL_STOCK_PER_LOCATION,
            QtyOut: 0,
            BalanceAfter: INITIAL_STOCK_PER_LOCATION,
            CreatedBy: SEED_ACTOR,
            Notes: 'Initial production seed stock',
          },
          {
            Id: crypto.randomUUID(),
            ItemCategory: 'MATERIAL',
            MaterialId: material.PartNumber,
            Location: 'RACK',
            TransactionType: 'ADJUSTMENT_MANUAL',
            ReferenceDoc: `SEED-INITIAL-RACK-${material.PartNumber}`,
            BalanceBefore: 0,
            QtyIn: INITIAL_STOCK_PER_LOCATION,
            QtyOut: 0,
            BalanceAfter: INITIAL_STOCK_PER_LOCATION,
            CreatedBy: SEED_ACTOR,
            Notes: 'Initial production seed stock',
          },
        ],
      });
    });
  }

  console.log(
    `\n🎉 Seed Materials completed successfully! Created: ${createdCount}, Updated: ${updatedCount}`,
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
