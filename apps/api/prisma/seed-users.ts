import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main(): Promise<void> {
  const superRole = await prisma.mTCRole.upsert({
    where: { RoleName: 'SUPER' },
    update: {},
    create: {
      RoleName: 'SUPER',
      Description: 'Super Administrator with full access',
    },
  });
  const readonlyRole = await prisma.mTCRole.upsert({
    where: { RoleName: 'READONLY' },
    update: {},
    create: {
      RoleName: 'READONLY',
      Description: 'Read-only access - can view data but cannot modify',
    },
  });

  // admin: SUPER role
  await prisma.mTCUserManagement.upsert({
    where: { UserId: 'admin' },
    update: {
      SsoObjectId: 'admin',
      Name: 'Administrator',
      Email: 'irfan@vuteq.co.id',
      RoleId: superRole.Id,
      IsActive: true,
    },
    create: {
      UserId: 'admin',
      SsoObjectId: 'admin',
      Name: 'Administrator',
      Email: 'irfan@vuteq.co.id',
      RoleId: superRole.Id,
      IsActive: true,
    },
  });

  // admin2: READONLY role
  await prisma.mTCUserManagement.upsert({
    where: { UserId: 'admin2' },
    update: {
      SsoObjectId: 'admin2',
      Name: 'Administrator 2 (Read Only)',
      Email: 'admin2@vuteq.co.id',
      RoleId: readonlyRole.Id,
      IsActive: true,
    },
    create: {
      UserId: 'admin2',
      SsoObjectId: 'admin2',
      Name: 'Administrator 2 (Read Only)',
      Email: 'admin2@vuteq.co.id',
      RoleId: readonlyRole.Id,
      IsActive: true,
    },
  });

  console.log('Upserted admin and admin2 users with role assignments');
}

main()
  .catch((error: unknown) => {
    console.error('User seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });