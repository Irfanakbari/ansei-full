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

  // Pre-fetch FinishGoods and Materials with relations for fast lookup
  const finishGoods = await prisma.finishGood.findMany();
  const materials = await prisma.material.findMany({
    include: { SatuanData: true },
  });

  const fgMap = new Map<string, (typeof finishGoods)[0]>();
  for (const fg of finishGoods) {
    fgMap.set(fg.PartNumber, fg);
  }

  const matMap = new Map<string, (typeof materials)[0]>();
  for (const mat of materials) {
    matMap.set(mat.PartNumber, mat);
  }

  console.log(
    `📦 Seeding ${bomList.length} BOM relations across finish goods...`,
  );

  // Group BOM items by FinishGood
  const fgBomMap = new Map<
    number,
    Array<{ material: (typeof materials)[0]; qty: number }>
  >();

  for (const item of bomList) {
    const fg = fgMap.get(item.fgPartNumber);
    const mat = matMap.get(item.rawPartNumberCleaned);

    if (!fg) {
      console.warn(
        `⚠️ FinishGood not found in DB: ${item.fgPartNumber}. Skipping.`,
      );
      continue;
    }

    if (!mat) {
      console.warn(
        `⚠️ Material not found in DB: ${item.rawPartNumberCleaned}. Skipping.`,
      );
      continue;
    }

    if (!fgBomMap.has(fg.Id)) {
      fgBomMap.set(fg.Id, []);
    }
    fgBomMap.get(fg.Id)!.push({ material: mat, qty: item.qty });
  }

  let totalBomLines = 0;
  let totalRevisions = 0;

  for (const [fgId, lines] of fgBomMap.entries()) {
    // 1. Sync legacy BillOfMaterials table
    for (const line of lines) {
      await prisma.billOfMaterials.upsert({
        where: {
          FinishGoodId_MaterialId: {
            FinishGoodId: fgId,
            MaterialId: line.material.Id,
          },
        },
        update: {
          Qty: line.qty,
        },
        create: {
          FinishGoodId: fgId,
          MaterialId: line.material.Id,
          Qty: line.qty,
        },
      });
      totalBomLines++;
    }

    // 2. Create Active BomRevision (Revision 1, Status: APPROVED) for UI & Traceability Phase One
    const existingRevision = await prisma.bomRevision.findFirst({
      where: {
        FinishGoodId: fgId,
        Revision: 1,
      },
    });

    if (existingRevision) {
      // If already approved, update status to DRAFT first to allow modifying lines
      await prisma.bomRevision.update({
        where: { Id: existingRevision.Id },
        data: { Status: 'DRAFT' },
      });

      await prisma.bomRevisionLine.deleteMany({
        where: { RevisionId: existingRevision.Id },
      });

      await prisma.bomRevisionLine.createMany({
        data: lines.map((l) => ({
          RevisionId: existingRevision.Id,
          MaterialId: l.material.Id,
          Qty: l.qty,
          PartNumber: l.material.PartNumber,
          PartName: l.material.PartName,
          UnitName: l.material.SatuanData?.Name ?? null,
        })),
      });

      await prisma.bomRevision.update({
        where: { Id: existingRevision.Id },
        data: {
          Status: 'APPROVED',
          Reason: 'Initial production BOM release',
          ApprovedBy: SEED_ACTOR,
          ApprovedAt: new Date(),
          LastEditedBy: SEED_ACTOR,
        },
      });

      await prisma.finishGood.update({
        where: { Id: fgId },
        data: {
          ActiveBomRevisionId: existingRevision.Id,
          UpdatedBy: SEED_ACTOR,
        },
      });
    } else {
      const revisionId = crypto.randomUUID();

      // Step A: Create DRAFT revision
      await prisma.bomRevision.create({
        data: {
          Id: revisionId,
          FinishGoodId: fgId,
          Revision: 1,
          Status: 'DRAFT',
          Reason: 'Initial production BOM release',
          Version: 1,
          CreatedBy: SEED_ACTOR,
          LastEditedBy: SEED_ACTOR,
          Lines: {
            create: lines.map((l) => ({
              MaterialId: l.material.Id,
              Qty: l.qty,
              PartNumber: l.material.PartNumber,
              PartName: l.material.PartName,
              UnitName: l.material.SatuanData?.Name ?? null,
            })),
          },
          Events: {
            create: {
              Action: 'CREATED',
              Actor: SEED_ACTOR,
              Reason: 'Initial production BOM release',
              Version: 1,
            },
          },
        },
      });

      // Step B: Transition to APPROVED
      await prisma.bomRevision.update({
        where: { Id: revisionId },
        data: {
          Status: 'APPROVED',
          ApprovedBy: SEED_ACTOR,
          ApprovedAt: new Date(),
          Events: {
            create: {
              Action: 'APPROVED',
              Actor: SEED_ACTOR,
              Reason: 'Approved initial production BOM',
              Version: 2,
            },
          },
        },
      });

      // Step C: Link ActiveBomRevisionId to FinishGood
      await prisma.finishGood.update({
        where: { Id: fgId },
        data: {
          ActiveBomRevisionId: revisionId,
          UpdatedBy: SEED_ACTOR,
        },
      });
    }

    totalRevisions++;
  }

  console.log(
    `\n🎉 BOM Seeding completed successfully! Processed ${totalBomLines} BOM lines and activated ${totalRevisions} BOM Revisions for Finish Goods.`,
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
