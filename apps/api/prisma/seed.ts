import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Load environment variables
config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.log('   Please set DATABASE_URL in your .env file');
  console.log(
    '   Example: DATABASE_URL=postgresql://user:password@localhost:5432/ansei',
  );
  process.exit(1);
}

// Type assertion since we already checked above
const dbUrl = connectionString;

// Extract database name from connection string for checking
const dbName = dbUrl.split('/').pop()?.split('?')[0];

async function checkDatabase(): Promise<boolean> {
  try {
    // Connect without database to check if it exists
    const url = new URL(dbUrl);
    const adminPool = new Pool({ connectionString: dbUrl });
    const result = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );
    await adminPool.end();
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function createDatabase(): Promise<void> {
  try {
    const url = new URL(dbUrl);
    const username = url.username || 'postgres';
    const password = url.password || '';
    const baseUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${url.host}/postgres`;
    const adminPool = new Pool({ connectionString: baseUrl });
    await adminPool.query(`CREATE DATABASE ${dbName}`);
    await adminPool.end();
    console.log(`✅ Database '${dbName}' created successfully`);
  } catch (error: any) {
    if (error.code === '42P04') {
      console.log(`ℹ️  Database '${dbName}' already exists`);
    } else {
      throw error;
    }
  }
}

const pool = new Pool({ connectionString: dbUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearAllData(): Promise<void> {
  console.log('🗑️  Clearing all data (except user management tables)...');

  // Tables to clear - using TRUNCATE CASCADE to handle FK constraints automatically
  const tablesToClear = [
    'LogProcessDetail',
    'LogProcess',
    'MTCAuthLog',
    'MTCUserSession',
    'StockOpnameDetail',
    'StockOpname',
    'IncomingMaterial',
    'Incoming',
    'MaterialNG',
    'Shopping',
    'ProductionReport',
    'DeliveryHistory',
    'DeliveryAttachment',
    'PokayokeScanHistory',
    'LabelData',
    'LineStatus',
    'InventoryLedger',
    'BillOfMaterials',
    'BoxQTY',
    'FinishGood',
    'Material',
    'Forecast',
    'ProductionRelease',
    'ManPower',
    'Supplier',
    'Satuan',
    'EmailNotification',
    'DashboardSetting',
  ];

  let clearedCount = 0;
  for (const table of tablesToClear) {
    try {
      // Use TRUNCATE CASCADE - PostgreSQL handles FK constraints automatically
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
      clearedCount++;
    } catch (error: any) {
      // Ignore errors for tables that might not exist
      if (error.code !== '42P01') {
        console.log(
          `⚠️  Warning: Could not truncate ${table}: ${error.message}`,
        );
      }
    }
  }

  console.log(`✅ Cleared ${clearedCount} tables`);
}

async function main() {
  console.log('🚀 Starting database seed...');

  // Check if database exists, create if not
  const dbExists = await checkDatabase();
  if (!dbExists) {
    console.log(`ℹ️  Database '${dbName}' does not exist. Creating...`);
    await createDatabase();
    console.log('✅ Database is ready');
  }

  // Upsert-only mode: never clears data or runs migrations.
  // Usage: SEED_MODE=upsert pnpm --filter @ansei/api exec ts-node prisma/seed.ts
  const upsertOnly = process.env.SEED_MODE === 'upsert';

  if (!upsertOnly) {
    // Clear all data before seeding (except user management tables)
    await clearAllData();

    // Run migrations
    console.log('📦 Running migrations...');
    const { execSync } = require('child_process');
    try {
      execSync('pnpm prisma migrate deploy', { stdio: 'inherit' });
      console.log('✅ Migrations applied successfully');
    } catch (error) {
      console.log('⚠️  Migration warning (tables may already exist)');
    }
  } else {
    console.log('♻️  SEED_MODE=upsert: skipping data clear and migrations');
  }

  // ============================================
  // 1. Create SUPER role
  // ============================================
  const superRole = await prisma.mTCRole.upsert({
    where: { RoleName: 'SUPER' },
    update: {},
    create: {
      RoleName: 'SUPER',
      Description: 'Super Administrator with full access',
    },
  });
  console.log(
    `✅ SUPER role created/found: ${superRole.RoleName} (ID: ${superRole.Id})`,
  );

  // ============================================
  // 1b. Create READONLY role
  // ============================================
  const readonlyRole = await prisma.mTCRole.upsert({
    where: { RoleName: 'READONLY' },
    update: {},
    create: {
      RoleName: 'READONLY',
      Description: 'Read-only access - can view data but cannot modify',
    },
  });
  console.log(
    `✅ READONLY role created/found: ${readonlyRole.RoleName} (ID: ${readonlyRole.Id})`,
  );

  // ============================================
  // 2. Create all permissions (aligned with the exact set enforced by
  //    @Permission() on every controller in apps/api/src)
  // ============================================
  const allPermissions = [
    // Dashboard
    { Action: 'DASHBOARD_VIEW', Description: 'View dashboard' },
    // Master data (also used by settings: printer, email, dashboard)
    { Action: 'IPCS.MASTER_READ', Description: 'Read master data' },
    { Action: 'IPCS.MASTER_CREATE', Description: 'Create master data' },
    { Action: 'IPCS.MASTER_UPDATE', Description: 'Update master data' },
    { Action: 'IPCS.MASTER_DELETE', Description: 'Delete master data' },
    // Incoming warehouse
    { Action: 'IPCS.INCOMING_READ', Description: 'Read incoming material' },
    { Action: 'IPCS.INCOMING_CREATE', Description: 'Create incoming material' },
    { Action: 'IPCS.INCOMING_UPDATE', Description: 'Update incoming material' },
    { Action: 'IPCS.INCOMING_DELETE', Description: 'Delete incoming material' },
    // Transfer to rack
    { Action: 'IPCS.TRANSFER_CREATE', Description: 'Create material transfer' },
    // MRP (material run-out)
    { Action: 'IPCS.MRP_READ', Description: 'Read material run-out' },
    // Inventory counting
    { Action: 'IPCS.INVENTORY_COUNTING_READ', Description: 'Read inventory counting' },
    { Action: 'IPCS.INVENTORY_COUNTING_CREATE', Description: 'Create inventory counting' },
    { Action: 'IPCS.INVENTORY_COUNTING_UPDATE', Description: 'Update inventory counting' },
    { Action: 'IPCS.INVENTORY_COUNTING_DELETE', Description: 'Delete inventory counting' },
    // Transfer material (material delivery note)
    { Action: 'IPCS.TRANSFER_MATERIAL_READ', Description: 'Read material delivery note' },
    { Action: 'IPCS.TRANSFER_MATERIAL_CREATE', Description: 'Create material delivery note' },
    { Action: 'IPCS.TRANSFER_MATERIAL_UPDATE', Description: 'Update material delivery note' },
    { Action: 'IPCS.TRANSFER_MATERIAL_DELETE', Description: 'Delete material delivery note' },
    // Forecast
    { Action: 'IPCS.FORECAST_READ', Description: 'Read forecast' },
    { Action: 'IPCS.FORECAST_CREATE', Description: 'Create forecast' },
    { Action: 'IPCS.FORECAST_UPDATE', Description: 'Update forecast' },
    { Action: 'IPCS.FORECAST_DELETE', Description: 'Delete forecast' },
    // Production release
    { Action: 'IPCS.PRODUCTION_RELEASE_READ', Description: 'Read production release' },
    { Action: 'IPCS.PRODUCTION_RELEASE_CREATE', Description: 'Create production release' },
    { Action: 'IPCS.PRODUCTION_RELEASE_UPDATE', Description: 'Update production release' },
    { Action: 'IPCS.PRODUCTION_RELEASE_DELETE', Description: 'Delete production release' },
    // Shopping
    { Action: 'IPCS.SHOPPING_READ', Description: 'Read shopping' },
    { Action: 'IPCS.SHOPPING_CREATE', Description: 'Create shopping' },
    { Action: 'IPCS.SHOPPING_DELETE', Description: 'Delete shopping' },
    // Pre-delivery goods
    { Action: 'IPCS.PRE_DELIVERY_READ', Description: 'Read pre-delivery goods' },
    // Pokayoke validation
    { Action: 'IPCS.POKAYOKE_READ', Description: 'Read Pokayoke validation' },
    { Action: 'IPCS.POKAYOKE_CREATE', Description: 'Create Pokayoke validation' },
    // Delivery
    { Action: 'IPCS.DELIVERY_READ', Description: 'Read delivery' },
    { Action: 'IPCS.DELIVERY_CREATE', Description: 'Create delivery' },
    // Production report
    { Action: 'IPCS.PRODUCTION_REPORT_READ', Description: 'Read production report' },
    { Action: 'IPCS.PRODUCTION_REPORT_UPDATE', Description: 'Update production report' },
    { Action: 'IPCS.PRODUCTION_REPORT_DELETE', Description: 'Delete production report' },
    // Reports
    { Action: 'IPCS.REPORT_READ', Description: 'Read reports' },
    // System log
    { Action: 'IPCS.SYSTEM_LOG_READ', Description: 'Read system logs' },
    // API key management
    { Action: 'IPCS.API_KEY_READ', Description: 'Read API keys' },
    { Action: 'IPCS.API_KEY_CREATE', Description: 'Create API keys' },
    { Action: 'IPCS.API_KEY_UPDATE', Description: 'Update API keys' },
    { Action: 'IPCS.API_KEY_DELETE', Description: 'Delete API keys' },
    // User management
    { Action: 'IPCS.USER_MANAGEMENT', Description: 'Manage users, roles, and permissions' },
    // Display configuration
    { Action: 'DISPLAY_CONFIG_READ', Description: 'Read display configuration' },
    { Action: 'DISPLAY_CONFIG_CREATE', Description: 'Create display configuration' },
    { Action: 'DISPLAY_CONFIG_UPDATE', Description: 'Update display configuration' },
    { Action: 'DISPLAY_CONFIG_DELETE', Description: 'Delete display configuration' },
  ];

  for (const perm of allPermissions) {
    await prisma.mTCPermission.upsert({
      where: { Action: perm.Action },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ Created/found ${allPermissions.length} permissions`);

  // Assign all permissions to SUPER role
  await prisma.mTCRole.update({
    where: { Id: superRole.Id },
    data: {
      Permission: {
        connect: allPermissions.map((p) => ({ Action: p.Action })),
      },
    },
  });
  console.log(`✅ Assigned all permissions to SUPER role`);

  // ============================================
  // 2b. Assign READ-only permissions to READONLY role
  // ============================================
  const readonlyPermissions = allPermissions.filter(
    (p) =>
      (p.Action.endsWith('_READ') && !p.Action.includes('DASHBOARDSETTING')) ||
      p.Action === 'DASHBOARD_VIEW',
  );
  await prisma.mTCRole.update({
    where: { Id: readonlyRole.Id },
    data: {
      Permission: {
        connect: readonlyPermissions.map((p) => ({ Action: p.Action })),
      },
    },
  });
  console.log(
    `✅ Assigned ${readonlyPermissions.length} READ-only permissions to READONLY role`,
  );

  // ============================================
  // 3. Create admin user
  // ============================================
  const adminUser = await prisma.mTCUserManagement.upsert({
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
  console.log(
    `✅ Admin user created/found: ${adminUser.UserId} (${adminUser.Email})`,
  );

  // ============================================
  // 3b. Create admin2 user with READONLY role
  // ============================================
  const admin2User = await prisma.mTCUserManagement.upsert({
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
  console.log(
    `✅ Admin2 user created/found: ${admin2User.UserId} (${admin2User.Email}) - READONLY role`,
  );

  // ============================================
  // 4. Create sample master data
  // ============================================
  console.log('\n📦 Creating sample master data...');

  // ---4.1 Satuan (Units) ---
  const satuanData = [
    { Name: 'PCS' },
    { Name: 'KG' },
    { Name: 'BOX' },
    { Name: 'METER' },
    { Name: 'LITER' },
    { Name: 'GRAM' },
    { Name: 'SET' },
  ];

  const createdSatuan: any[] = [];
  for (const data of satuanData) {
    const existing = await prisma.satuan.findFirst({ where: data });
    if (!existing) {
      const satuan = await prisma.satuan.create({ data });
      createdSatuan.push(satuan);
    } else {
      createdSatuan.push(existing);
    }
  }
  console.log(`✅ Created/found ${satuanData.length} Satuan (units)`);

  // --- 4.2 Suppliers ---
  const supplierData = [
    { Name: 'PT Fastener Indonesia' },
    { Name: 'PT Plastic Manufacturing' },
    { Name: 'PT Metal Works Jaya' },
    { Name: 'CV Elektronik Supply' },
    { Name: 'PT Chemical Industries' },
  ];

  const createdSuppliers: any[] = [];
  for (const data of supplierData) {
    const existing = await prisma.supplier.findFirst({ where: data });
    if (!existing) {
      const supplier = await prisma.supplier.create({ data });
      createdSuppliers.push(supplier);
    } else {
      createdSuppliers.push(existing);
    }
  }
  console.log(`✅ Created/found ${supplierData.length} Suppliers`);

  // --- 4.3 Materials ---
  const materialData = [
    {
      PartNumber: 'MAT-SCR-001',
      PartName: 'Screw M3x10mm',
      Supplier: 'PT Fastener Indonesia',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'A-01-01',
    },
    {
      PartNumber: 'MAT-SCR-002',
      PartName: 'Screw M4x15mm',
      Supplier: 'PT Fastener Indonesia',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'A-01-02',
    },
    {
      PartNumber: 'MAT-SCR-003',
      PartName: 'Screw M5x20mm',
      Supplier: 'PT Fastener Indonesia',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'A-01-03',
    },
    {
      PartNumber: 'MAT-NUT-001',
      PartName: 'Nut M3',
      Supplier: 'PT Fastener Indonesia',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'A-02-01',
    },
    {
      PartNumber: 'MAT-NUT-002',
      PartName: 'Nut M4',
      Supplier: 'PT Fastener Indonesia',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'A-02-02',
    },
    {
      PartNumber: 'MAT-PLT-001',
      PartName: 'Plastic Housing Small',
      Supplier: 'PT Plastic Manufacturing',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'B-01-01',
    },
    {
      PartNumber: 'MAT-PLT-002',
      PartName: 'Plastic Housing Large',
      Supplier: 'PT Plastic Manufacturing',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'B-01-02',
    },
    {
      PartNumber: 'MAT-MTL-001',
      PartName: 'Metal Bracket 50mm',
      Supplier: 'PT Metal Works Jaya',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'C-01-01',
    },
    {
      PartNumber: 'MAT-MTL-002',
      PartName: 'Metal Bracket 100mm',
      Supplier: 'PT Metal Works Jaya',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'C-01-02',
    },
    {
      PartNumber: 'MAT-CHM-001',
      PartName: 'Adhesive Chemical100ml',
      Supplier: 'PT Chemical Industries',
      QtyRack: 100,
      QtyWarehouse: 100,
      RackLocation: 'D-01-01',
    },
  ];

  const createdMaterials: any[] = [];
  for (const data of materialData) {
    const material = await prisma.material.upsert({
      where: { PartNumber: data.PartNumber },
      update: {},
      create: {
        ...data,
        CreatedBy: 'admin',
      },
    });
    createdMaterials.push(material);
  }
  console.log(`✅ Created ${materialData.length} Materials`);

  // --- 4.4 Finish Goods ---
  const finishGoodData = [
    {
      PartNumber: 'FG-WIDGET-001',
      PartName: 'Widget Type A',
      Price: 25000,
      Qty: 0,
    },
    {
      PartNumber: 'FG-WIDGET-002',
      PartName: 'Widget Type B',
      Price: 35000,
      Qty: 0,
    },
    {
      PartNumber: 'FG-GADGET-001',
      PartName: 'Gadget Series1',
      Price: 75000,
      Qty: 0,
    },
    {
      PartNumber: 'FG-GADGET-002',
      PartName: 'Gadget Series 2',
      Price: 95000,
      Qty: 0,
    },
    {
      PartNumber: 'FG-DOODAD-001',
      PartName: 'Doodad Premium',
      Price: 120000,
      Qty: 0,
    },
  ];

  const createdFinishGoods: any[] = [];
  for (const data of finishGoodData) {
    const fg = await prisma.finishGood.upsert({
      where: { PartNumber: data.PartNumber },
      update: {},
      create: {
        ...data,
        CreatedBy: 'admin',
      },
    });
    createdFinishGoods.push(fg);
  }
  console.log(`✅ Created ${finishGoodData.length} Finish Goods`);

  // --- 4.5 Bill of Materials ---
  const bomData = [
    // Widget Type A BOM
    {
      MaterialId: createdMaterials[0].Id,
      FinishGoodId: createdFinishGoods[0].Id,
      Qty: 4,
    },
    {
      MaterialId: createdMaterials[3].Id,
      FinishGoodId: createdFinishGoods[0].Id,
      Qty: 4,
    },
    {
      MaterialId: createdMaterials[5].Id,
      FinishGoodId: createdFinishGoods[0].Id,
      Qty: 1,
    },
    // Widget Type B BOM
    {
      MaterialId: createdMaterials[1].Id,
      FinishGoodId: createdFinishGoods[1].Id,
      Qty: 6,
    },
    {
      MaterialId: createdMaterials[4].Id,
      FinishGoodId: createdFinishGoods[1].Id,
      Qty: 6,
    },
    {
      MaterialId: createdMaterials[6].Id,
      FinishGoodId: createdFinishGoods[1].Id,
      Qty: 1,
    },
    // Gadget Series 1 BOM
    {
      MaterialId: createdMaterials[2].Id,
      FinishGoodId: createdFinishGoods[2].Id,
      Qty: 8,
    },
    {
      MaterialId: createdMaterials[7].Id,
      FinishGoodId: createdFinishGoods[2].Id,
      Qty: 2,
    },
    {
      MaterialId: createdMaterials[5].Id,
      FinishGoodId: createdFinishGoods[2].Id,
      Qty: 2,
    },
    {
      MaterialId: createdMaterials[9].Id,
      FinishGoodId: createdFinishGoods[2].Id,
      Qty: 1,
    },
    // Gadget Series 2 BOM
    {
      MaterialId: createdMaterials[2].Id,
      FinishGoodId: createdFinishGoods[3].Id,
      Qty: 10,
    },
    {
      MaterialId: createdMaterials[8].Id,
      FinishGoodId: createdFinishGoods[3].Id,
      Qty: 3,
    },
    {
      MaterialId: createdMaterials[6].Id,
      FinishGoodId: createdFinishGoods[3].Id,
      Qty: 2,
    },
    {
      MaterialId: createdMaterials[9].Id,
      FinishGoodId: createdFinishGoods[3].Id,
      Qty: 2,
    },
    // Doodad Premium BOM
    {
      MaterialId: createdMaterials[0].Id,
      FinishGoodId: createdFinishGoods[4].Id,
      Qty: 12,
    },
    {
      MaterialId: createdMaterials[1].Id,
      FinishGoodId: createdFinishGoods[4].Id,
      Qty: 12,
    },
    {
      MaterialId: createdMaterials[7].Id,
      FinishGoodId: createdFinishGoods[4].Id,
      Qty: 4,
    },
    {
      MaterialId: createdMaterials[8].Id,
      FinishGoodId: createdFinishGoods[4].Id,
      Qty: 4,
    },
    {
      MaterialId: createdMaterials[9].Id,
      FinishGoodId: createdFinishGoods[4].Id,
      Qty: 3,
    },
  ];

  let bomCreated = 0;
  for (const data of bomData) {
    // Check if BOM already exists
    const existingBOM = await prisma.billOfMaterials.findFirst({
      where: {
        MaterialId: data.MaterialId,
        FinishGoodId: data.FinishGoodId,
      },
    });

    if (!existingBOM) {
      await prisma.billOfMaterials.create({ data });
      bomCreated++;
    }
  }
  console.log(`✅ Created ${bomCreated} Bill of Materials entries`);

  // --- 4.6 Box Qty ---
  const boxQtyData = [
    { PartNumber: 'FG-WIDGET-001', Qty: 12 },
    { PartNumber: 'FG-WIDGET-002', Qty: 10 },
    { PartNumber: 'FG-GADGET-001', Qty: 6 },
    { PartNumber: 'FG-GADGET-002', Qty: 6 },
    { PartNumber: 'FG-DOODAD-001', Qty: 4 },
  ];

  let boxQtyCreated = 0;
  for (const data of boxQtyData) {
    const existingBoxQty = await prisma.boxQTY.findUnique({
      where: { PartNumber: data.PartNumber },
    });

    if (!existingBoxQty) {
      await prisma.boxQTY.create({ data });
      boxQtyCreated++;
    }
  }
  console.log(`✅ Created ${boxQtyCreated} Box Qty entries`);

  // --- 4.7 Man Power ---
  const manPowerData = [
    { Nik: 'EMP001', Name: 'Ahmad Wijaya', Line: 'LINE-A', Status: true },
    { Nik: 'EMP002', Name: 'Budi Santoso', Line: 'LINE-A', Status: true },
    { Nik: 'EMP003', Name: 'Citra Dewi', Line: 'LINE-B', Status: true },
    { Nik: 'EMP004', Name: 'Dian Pratama', Line: 'LINE-B', Status: true },
    { Nik: 'EMP005', Name: 'Eko Susanto', Line: 'LINE-C', Status: true },
    { Nik: 'EMP006', Name: 'Fitri Handayani', Line: 'LINE-C', Status: true },
    { Nik: 'EMP007', Name: 'Gunawan Hidayat', Line: 'LINE-A', Status: false },
    { Nik: 'EMP008', Name: 'Hendra Kusuma', Line: 'LINE-B', Status: true },
  ];

  let manPowerCreated = 0;
  for (const data of manPowerData) {
    const existingManPower = await prisma.manPower.findUnique({
      where: { Nik: data.Nik },
    });

    if (!existingManPower) {
      await prisma.manPower.create({
        data: {
          ...data,
          Uid: crypto.randomUUID(),
        },
      });
      manPowerCreated++;
    }
  }
  console.log(`✅ Created ${manPowerCreated} Man Power entries`);

  // ============================================
  // Summary
  // ============================================
  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📋 Seeded SSO users:');
  console.log('   Username: admin');
  console.log('   Email: irfan@vuteq.co.id');
  console.log('   Role: SUPER (full access)');
  console.log('\n   Username: admin2');
  console.log('   Email: admin2@vuteq.co.id');
  console.log('   Role: READONLY (read-only access)');

  console.log('\n📦 Sample Master Data Created:');
  console.log(`   - ${satuanData.length} Satuan (units)`);
  console.log(`   - ${supplierData.length} Suppliers`);
  console.log(`   - ${materialData.length} Materials`);
  console.log(`   - ${finishGoodData.length} Finish Goods`);
  console.log(`   - ${bomCreated} Bill of Materials`);
  console.log(`   - ${boxQtyCreated} Box Qty`);
  console.log(`   - ${manPowerCreated} Man Power`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
