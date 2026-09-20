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
const SEED_ACTOR = 'SYSTEM';

const allPermissions = [
  { Action: 'IPCS.ASSEMBLY_READ', Description: 'Read assembly sessions' },
  {
    Action: 'IPCS.ASSEMBLY_CREATE',
    Description: 'Start and complete assembly',
  },
  {
    Action: 'IPCS.ASSEMBLY_CANCEL',
    Description: 'Cancel active assembly with reason',
  },
  { Action: 'DASHBOARD_VIEW', Description: 'View dashboard' },
  { Action: 'IPCS.BOM_REVISION_READ', Description: 'Read bom revision' },
  { Action: 'IPCS.BOM_REVISION_CREATE', Description: 'Create bom revision' },
  { Action: 'IPCS.BOM_REVISION_UPDATE', Description: 'Update bom revision' },
  { Action: 'IPCS.BOM_REVISION_SUBMIT', Description: 'Submit bom revision' },
  { Action: 'IPCS.BOM_REVISION_APPROVE', Description: 'Approve bom revision' },
  { Action: 'IPCS.MATERIAL_NG_READ', Description: 'Read material ng' },
  { Action: 'IPCS.MATERIAL_NG_CREATE', Description: 'Create material ng' },
  { Action: 'IPCS.MATERIAL_NG_ISSUE', Description: 'Issue material ng' },
  { Action: 'IPCS.MATERIAL_NG_CLOSE', Description: 'Close material ng' },
  { Action: 'IPCS.TRACEABILITY_READ', Description: 'Read traceability' },
  { Action: 'IPCS.MASTER_READ', Description: 'Read master data' },
  { Action: 'IPCS.MASTER_CREATE', Description: 'Create master data' },
  { Action: 'IPCS.MASTER_UPDATE', Description: 'Update master data' },
  { Action: 'IPCS.MASTER_DELETE', Description: 'Delete master data' },
  { Action: 'IPCS.INCOMING_READ', Description: 'Read incoming material' },
  { Action: 'IPCS.INCOMING_CREATE', Description: 'Create incoming material' },
  { Action: 'IPCS.INCOMING_UPDATE', Description: 'Update incoming material' },
  { Action: 'IPCS.INCOMING_DELETE', Description: 'Delete incoming material' },
  { Action: 'IPCS.TRANSFER_CREATE', Description: 'Create material transfer' },
  { Action: 'IPCS.MRP_READ', Description: 'Read material run-out' },
  {
    Action: 'IPCS.INVENTORY_COUNTING_READ',
    Description: 'Read inventory counting',
  },
  {
    Action: 'IPCS.INVENTORY_COUNTING_CREATE',
    Description: 'Create inventory counting',
  },
  {
    Action: 'IPCS.INVENTORY_COUNTING_UPDATE',
    Description: 'Update inventory counting',
  },
  {
    Action: 'IPCS.INVENTORY_COUNTING_DELETE',
    Description: 'Delete inventory counting',
  },
  {
    Action: 'IPCS.INVENTORY_COUNTING_APPROVE',
    Description: 'Approve inventory counting',
  },
  {
    Action: 'IPCS.TRANSFER_MATERIAL_READ',
    Description: 'Read material delivery note',
  },
  {
    Action: 'IPCS.TRANSFER_MATERIAL_CREATE',
    Description: 'Create material delivery note',
  },
  {
    Action: 'IPCS.TRANSFER_MATERIAL_UPDATE',
    Description: 'Update material delivery note',
  },
  {
    Action: 'IPCS.TRANSFER_MATERIAL_DELETE',
    Description: 'Delete material delivery note',
  },
  { Action: 'IPCS.FORECAST_READ', Description: 'Read forecast' },
  { Action: 'IPCS.FORECAST_CREATE', Description: 'Create forecast' },
  { Action: 'IPCS.FORECAST_UPDATE', Description: 'Update forecast' },
  { Action: 'IPCS.FORECAST_DELETE', Description: 'Delete forecast' },
  {
    Action: 'IPCS.PRODUCTION_RELEASE_READ',
    Description: 'Read production release',
  },
  {
    Action: 'IPCS.PRODUCTION_RELEASE_CREATE',
    Description: 'Create production release',
  },
  {
    Action: 'IPCS.PRODUCTION_RELEASE_UPDATE',
    Description: 'Update production release',
  },
  {
    Action: 'IPCS.PRODUCTION_RELEASE_DELETE',
    Description: 'Delete production release',
  },
  { Action: 'IPCS.SHOPPING_READ', Description: 'Read shopping' },
  { Action: 'IPCS.SHOPPING_CREATE', Description: 'Create shopping' },
  { Action: 'IPCS.SHOPPING_DELETE', Description: 'Delete shopping' },
  { Action: 'IPCS.PRE_DELIVERY_READ', Description: 'Read pre-delivery goods' },
  { Action: 'IPCS.POKAYOKE_READ', Description: 'Read Pokayoke validation' },
  { Action: 'IPCS.POKAYOKE_CREATE', Description: 'Create Pokayoke validation' },
  { Action: 'IPCS.DELIVERY_READ', Description: 'Read delivery' },
  { Action: 'IPCS.DELIVERY_CREATE', Description: 'Create delivery' },
  {
    Action: 'IPCS.PRODUCTION_REPORT_READ',
    Description: 'Read production report',
  },
  {
    Action: 'IPCS.INTEGRATION_RECOVER',
    Description: 'Reconcile and recover failed integration deliveries',
  },
  {
    Action: 'IPCS.PRODUCTION_REPORT_CREATE',
    Description: 'Create production report as an authenticated user or station',
  },
  {
    Action: 'IPCS.PRODUCTION_REPORT_UPDATE',
    Description: 'Update production report',
  },
  {
    Action: 'IPCS.PRODUCTION_REPORT_DELETE',
    Description: 'Delete production report',
  },
  { Action: 'IPCS.REPORT_READ', Description: 'Read reports' },
  { Action: 'IPCS.SYSTEM_LOG_READ', Description: 'Read system logs' },
  { Action: 'IPCS.API_KEY_READ', Description: 'Read API keys' },
  { Action: 'IPCS.API_KEY_CREATE', Description: 'Create API keys' },
  { Action: 'IPCS.API_KEY_UPDATE', Description: 'Update API keys' },
  { Action: 'IPCS.API_KEY_DELETE', Description: 'Delete API keys' },
  {
    Action: 'IPCS.USER_MANAGEMENT',
    Description: 'Manage users, roles, and permissions',
  },
  { Action: 'DISPLAY_CONFIG_READ', Description: 'Read display configuration' },
  {
    Action: 'DISPLAY_CONFIG_CREATE',
    Description: 'Create display configuration',
  },
  {
    Action: 'DISPLAY_CONFIG_UPDATE',
    Description: 'Update display configuration',
  },
  {
    Action: 'DISPLAY_CONFIG_DELETE',
    Description: 'Delete display configuration',
  },
] as const;

async function main(): Promise<void> {
  const superRole = await prisma.mTCRole.upsert({
    where: { RoleName: 'SUPER' },
    update: { UpdatedBy: SEED_ACTOR },
    create: {
      RoleName: 'SUPER',
      Description: 'Super Administrator with full access',
      CreatedBy: SEED_ACTOR,
      UpdatedBy: SEED_ACTOR,
    },
  });
  const readonlyRole = await prisma.mTCRole.upsert({
    where: { RoleName: 'READONLY' },
    update: { UpdatedBy: SEED_ACTOR },
    create: {
      RoleName: 'READONLY',
      Description: 'Read-only access - can view data but cannot modify',
      CreatedBy: SEED_ACTOR,
      UpdatedBy: SEED_ACTOR,
    },
  });

  for (const permission of allPermissions) {
    await prisma.mTCPermission.upsert({
      where: { Action: permission.Action },
      update: {
        Description: permission.Description,
        UpdatedBy: SEED_ACTOR,
      },
      create: {
        ...permission,
        CreatedBy: SEED_ACTOR,
        UpdatedBy: SEED_ACTOR,
      },
    });
  }

  await prisma.mTCRole.update({
    where: { Id: superRole.Id },
    data: {
      UpdatedBy: SEED_ACTOR,
      Permission: { connect: allPermissions.map(({ Action }) => ({ Action })) },
    },
  });

  const readonlyPermissions = allPermissions.filter(
    ({ Action }) =>
      (Action.endsWith('_READ') && !Action.includes('DASHBOARDSETTING')) ||
      Action === 'DASHBOARD_VIEW',
  );
  await prisma.mTCRole.update({
    where: { Id: readonlyRole.Id },
    data: {
      UpdatedBy: SEED_ACTOR,
      Permission: {
        connect: readonlyPermissions.map(({ Action }) => ({ Action })),
      },
    },
  });

  console.log(
    `Upserted ${allPermissions.length} permissions and role assignments`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Permission seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
