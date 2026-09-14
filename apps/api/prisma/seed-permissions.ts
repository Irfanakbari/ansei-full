/* By Irfan Akbari Vuteq Indonesia - 2026-09-14 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

import type { MTCPermissionModel } from '../src/generated/prisma/models/MTCPermission.js';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const permissions = [
  ['IPCS.MASTER_READ', 'Read master data'],
  ['IPCS.MASTER_CREATE', 'Create master data'],
  ['IPCS.MASTER_UPDATE', 'Update master data'],
  ['IPCS.MASTER_DELETE', 'Delete master data'],
  ['IPCS.INCOMING_READ', 'Read incoming material'],
  ['IPCS.INCOMING_CREATE', 'Create incoming material'],
  ['IPCS.INCOMING_UPDATE', 'Update incoming material'],
  ['IPCS.INCOMING_DELETE', 'Delete incoming material'],
  ['IPCS.TRANSFER_CREATE', 'Create material transfer'],
  ['IPCS.MRP_READ', 'Read material run-out'],
  ['IPCS.INVENTORY_COUNTING_READ', 'Read inventory counting'],
  ['IPCS.INVENTORY_COUNTING_CREATE', 'Create inventory counting'],
  ['IPCS.INVENTORY_COUNTING_UPDATE', 'Update inventory counting'],
  ['IPCS.INVENTORY_COUNTING_DELETE', 'Delete inventory counting'],
  ['IPCS.TRANSFER_MATERIAL_READ', 'Read material delivery note'],
  ['IPCS.TRANSFER_MATERIAL_CREATE', 'Create material delivery note'],
  ['IPCS.TRANSFER_MATERIAL_UPDATE', 'Update material delivery note'],
  ['IPCS.TRANSFER_MATERIAL_DELETE', 'Delete material delivery note'],
  ['IPCS.FORECAST_READ', 'Read forecast'],
  ['IPCS.FORECAST_CREATE', 'Create forecast'],
  ['IPCS.FORECAST_UPDATE', 'Update forecast'],
  ['IPCS.FORECAST_DELETE', 'Delete forecast'],
  ['IPCS.PRODUCTION_RELEASE_READ', 'Read production release'],
  ['IPCS.PRODUCTION_RELEASE_CREATE', 'Create production release'],
  ['IPCS.PRODUCTION_RELEASE_UPDATE', 'Update production release'],
  ['IPCS.PRODUCTION_RELEASE_DELETE', 'Delete production release'],
  ['IPCS.SHOPPING_READ', 'Read shopping'],
  ['IPCS.SHOPPING_CREATE', 'Create shopping'],
  ['IPCS.SHOPPING_DELETE', 'Delete shopping'],
  ['IPCS.PRE_DELIVERY_READ', 'Read pre-delivery goods'],
  ['IPCS.POKAYOKE_READ', 'Read Pokayoke validation'],
  ['IPCS.POKAYOKE_CREATE', 'Create Pokayoke validation'],
  ['IPCS.DELIVERY_READ', 'Read delivery'],
  ['IPCS.DELIVERY_CREATE', 'Create delivery'],
  ['IPCS.PRODUCTION_REPORT_READ', 'Read production report'],
  ['IPCS.PRODUCTION_REPORT_UPDATE', 'Update production report'],
  ['IPCS.PRODUCTION_REPORT_DELETE', 'Delete production report'],
  ['IPCS.REPORT_READ', 'Read reports'],
  ['IPCS.SYSTEM_LOG_READ', 'Read system logs'],
  ['IPCS.API_KEY_READ', 'Read API keys'],
  ['IPCS.API_KEY_CREATE', 'Create API keys'],
  ['IPCS.API_KEY_UPDATE', 'Update API keys'],
  ['IPCS.API_KEY_DELETE', 'Delete API keys'],
  ['IPCS.USER_MANAGEMENT', 'Manage users, roles, and permissions'],
  ['DISPLAY_CONFIG_READ', 'Read display configuration'],
  ['DISPLAY_CONFIG_CREATE', 'Create display configuration'],
  ['DISPLAY_CONFIG_UPDATE', 'Update display configuration'],
  ['DISPLAY_CONFIG_DELETE', 'Delete display configuration'],
] as const;

async function main(): Promise<void> {
  const permissionRecords: MTCPermissionModel[] = [];

  for (const [action, description] of permissions) {
    const permission = await prisma.mTCPermission.upsert({
      where: { Action: action },
      update: { Description: description },
      create: { Action: action, Description: description, CreateBy: 'SYSTEM' },
    });
    permissionRecords.push(permission);
  }

  const readonlyPermissions = permissionRecords.filter(({ Action }) =>
    Action.endsWith('_READ'),
  );

  const superRole = await prisma.mTCRole.upsert({
    where: { RoleName: 'SUPER' },
    update: {
      Description: 'Super administrator with full access',
      UpdateBy: 'SYSTEM',
      Permission: { set: permissionRecords.map(({ Action }) => ({ Action })) },
    },
    create: {
      RoleName: 'SUPER',
      Description: 'Super administrator with full access',
      CreateBy: 'SYSTEM',
      Permission: { connect: permissionRecords.map(({ Action }) => ({ Action })) },
    },
  });

  const readonlyRole = await prisma.mTCRole.upsert({
    where: { RoleName: 'READONLY' },
    update: {
      Description: 'Read-only access',
      UpdateBy: 'SYSTEM',
      Permission: { set: readonlyPermissions.map(({ Action }) => ({ Action })) },
    },
    create: {
      RoleName: 'READONLY',
      Description: 'Read-only access',
      CreateBy: 'SYSTEM',
      Permission: { connect: readonlyPermissions.map(({ Action }) => ({ Action })) },
    },
  });

  console.log(`Initialized ${permissionRecords.length} permissions`);
  console.log(`Synchronized roles: ${superRole.RoleName}, ${readonlyRole.RoleName}`);
  console.log('No operational data was deleted or modified.');
}

main()
  .catch((error: unknown) => {
    console.error('Permission seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
