import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/**
 * Daftar tabel yang AKAN DIBERSIHKAN (Total 26 model sesuai schema.prisma).
 * Mencakup Master Data, Transaksi Produksi, Warehouse, Ledger, dan Audit Logs.
 */
const TABLES_TO_CLEAR = [
  // 1. Audit Logs & Traceability
  'ActionAuditEvent',
  'ProductionTraceEvent',
  'LogProcessDetail',
  'LogProcess',

  // 2. Production & Delivery Operations
  'BusinessCommand',
  'ShoppingCompletion',
  'Shopping',
  'MaterialNgCase',
  'MaterialNG',
  'AssemblySession',
  'PokayokeScanHistory',
  'DeliveryHistory',
  'LabelData',
  'ProductionReport',
  'DeliveryAttachment',
  'Forecast',
  'ProductionBomSnapshotLine',
  'ProductionBomSnapshot',
  'BomRevisionLine',
  'BomRevisionEvent',
  'BomRevision',
  'ProductionRelease',

  // 3. Warehouse & Inventory Operations
  'IncomingMaterial',
  'Incoming',
  'MaterialDeliveryNoteDetail',
  'MaterialDeliveryNote',
  'StockOpnameAttachment',
  'StockOpnameDetail',
  'StockOpname',
  'InventoryLedger',

  // 4. Master Data
  'LineStatus',
  'BillOfMaterials',
  'BoxQTY',
  'SkillMatrix',
  'ManPower',
  'SupplierBarcodeFormat',
  'Material',
  'FinishGood',
  'Supplier',
  'Satuan',
] as const;

/**
 * Daftar tabel yang DIKECUALIKAN / TETAP DIPERTAHANKAN (TIDAK BOLEH DIHAPUS):
 * - User, Role, & Permission: MTCUserManagement, MTCRole, MTCPermission, _MTCPermissionToMTCRole, MTCUserSession, MTCAuthLog, ApiKey
 * - System Config & Settings: EmailNotification, DashboardSetting, PrintAgent, PrintAgentEnrollment, PrintAgentCredential, ProfilePrinter, PrintJob, PrintJobEvent, DisplayConfig
 */
const PRESERVED_TABLES = [
  'MTCUserManagement',
  'MTCRole',
  'MTCPermission',
  '_MTCPermissionToMTCRole',
  'MTCUserSession',
  'MTCAuthLog',
  'ApiKey',
  'EmailNotification',
  'DashboardSetting',
  'PrintAgent',
  'PrintAgentEnrollment',
  'PrintAgentCredential',
  'ProfilePrinter',
  'PrintJob',
  'PrintJobEvent',
  'DisplayConfig',
] as const;

async function getTableRowCount(tableName: string): Promise<number> {
  try {
    const result = await prisma.$queryRawUnsafe<
      Array<{ count: bigint | number | string }>
    >(`SELECT count(*)::text AS count FROM "${tableName}"`);
    return Number(result[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function getExistingTables(): Promise<Set<string>> {
  const result = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  return new Set(result.map((r) => r.table_name));
}

async function main(): Promise<void> {
  console.log('🧹 Menyiapkan pembersihan database...');
  console.log('   (Semua tabel operasional & master data akan di-clear;');
  console.log(
    '    Tabel User, Role, Permission, dan Config/Settings TETAP DIPERTAHANKAN)\n',
  );

  const existingDbTables = await getExistingTables();

  // 1. Ambil jumlah data sebelum pembersihan
  const clearBeforeCounts: Record<string, number> = {};
  for (const table of TABLES_TO_CLEAR) {
    if (existingDbTables.has(table)) {
      clearBeforeCounts[table] = await getTableRowCount(table);
    }
  }

  const preservedBeforeCounts: Record<string, number> = {};
  for (const table of PRESERVED_TABLES) {
    if (existingDbTables.has(table)) {
      preservedBeforeCounts[table] = await getTableRowCount(table);
    }
  }

  // 2. Filter tabel yang benar-benar ada di database
  const activeTablesToClear = TABLES_TO_CLEAR.filter((table) =>
    existingDbTables.has(table),
  );

  if (activeTablesToClear.length === 0) {
    console.log('ℹ️  Tidak ada tabel target yang ditemukan untuk dibersihkan.');
    return;
  }

  // 3. Eksekusi TRUNCATE TABLE ... RESTART IDENTITY CASCADE
  console.log(
    `Menjalankan TRUNCATE CASCADE pada ${activeTablesToClear.length} tabel...`,
  );
  const truncateSql = `TRUNCATE TABLE ${activeTablesToClear.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
  await prisma.$executeRawUnsafe(truncateSql);

  // 4. Verifikasi jumlah data setelah pembersihan
  const clearAfterCounts: Record<string, number> = {};
  let totalClearedRows = 0;
  for (const table of activeTablesToClear) {
    const after = await getTableRowCount(table);
    clearAfterCounts[table] = after;
    const deletedCount = (clearBeforeCounts[table] ?? 0) - after;
    if (deletedCount > 0) totalClearedRows += deletedCount;
  }

  const preservedAfterCounts: Record<string, number> = {};
  for (const table of PRESERVED_TABLES) {
    if (existingDbTables.has(table)) {
      preservedAfterCounts[table] = await getTableRowCount(table);
    }
  }

  // 5. Cetak laporan pembersihan tabel
  console.log('\n================ HASIL PEMBERSIHAN TABEL ================');
  for (const table of activeTablesToClear) {
    const before = clearBeforeCounts[table] ?? 0;
    const after = clearAfterCounts[table] ?? 0;
    console.log(
      `[CLEARED]   ${table.padEnd(28)} : ${before} -> ${after} baris`,
    );
  }

  console.log('\n=========== TABEL YANG DIPERTAHANKAN (AMAN) ===========');
  for (const table of PRESERVED_TABLES) {
    if (existingDbTables.has(table)) {
      const count = preservedAfterCounts[table] ?? 0;
      const before = preservedBeforeCounts[table] ?? 0;
      console.log(
        `[PRESERVED] ${table.padEnd(28)} : ${count} baris (${count === before ? 'tidak berubah' : 'BERUBAH!'})`,
      );
    }
  }

  console.log('========================================================');
  console.log(
    `✅ Selesai! Total ${totalClearedRows} baris data operasional/master berhasil dibersihkan.`,
  );
  console.log(
    `✅ Seluruh tabel User, Role, Permission, dan Config/Settings tetap utuh.\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('❌ Pembersihan database gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
