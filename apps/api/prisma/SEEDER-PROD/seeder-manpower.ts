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

interface SkillMatrixItem {
  label: string;
  point: number;
}

interface ManPowerItem {
  nik: string;
  name: string;
  line: string;
  status: boolean;
  picturePath: string | null;
  skillMatrix: SkillMatrixItem[];
}

async function main() {
  console.log(
    '🚀 Starting database seed for Master Man Power & Skill Matrix (PROD)...',
  );

  const filePath = path.join(__dirname, 'manpower-data.json');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Data file not found: ${filePath}`);
    process.exit(1);
  }

  const manPowerList: ManPowerItem[] = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(
    `📦 Seeding ${manPowerList.length} Man Power entries with Skill Matrix...`,
  );

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of manPowerList) {
    const existing = await prisma.manPower.findUnique({
      where: { Nik: item.nik },
      include: { SkillMatrix: true },
    });

    if (existing) {
      // Update manpower info
      await prisma.manPower.update({
        where: { Nik: item.nik },
        data: {
          Name: item.name,
          Line: item.line,
          EmployeeType: 'PCS',
          Status: item.status,
          PicturePath: item.picturePath,
          UpdatedBy: SEED_ACTOR,
        },
      });

      // Clear old skill matrix and re-insert
      await prisma.skillMatrix.deleteMany({
        where: { ManPowerUid: existing.Uid },
      });

      if (item.skillMatrix && item.skillMatrix.length > 0) {
        await prisma.skillMatrix.createMany({
          data: item.skillMatrix.map((sm) => ({
            ManPowerUid: existing.Uid,
            Label: sm.label,
            Point: sm.point,
          })),
        });
      }

      updatedCount++;
    } else {
      const uid = crypto.randomUUID();

      await prisma.manPower.create({
        data: {
          Uid: uid,
          Nik: item.nik,
          Name: item.name,
          Line: item.line,
          EmployeeType: 'PCS',
          Status: item.status,
          PicturePath: item.picturePath,
          CreatedBy: SEED_ACTOR,
          UpdatedBy: SEED_ACTOR,
          SkillMatrix: {
            create: item.skillMatrix.map((sm) => ({
              Label: sm.label,
              Point: sm.point,
            })),
          },
        },
      });

      createdCount++;
    }
  }

  console.log(
    `\n🎉 Man Power Seeding completed successfully! Created: ${createdCount}, Updated: ${updatedCount}`,
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
