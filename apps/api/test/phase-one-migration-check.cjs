/* Disposable PostgreSQL only. Does not read the application's .env. */
const { Pool } = require('pg');
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const url = new URL(process.env.PHASE1_MIGRATION_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/ansei_phase1_upgrade');
  const pool = new Pool({ connectionString: url.toString() });
  try {
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(tables.rowCount, 0, 'Requires an empty disposable database');
    const root = join(__dirname, '../prisma/migrations');
    const migrations = readdirSync(root).filter(name => /^\d/.test(name)).sort();
    const boundary = '20260919090000_bom_traceability';
    for (const name of migrations.filter(name => name < boundary)) {
      await pool.query(readFileSync(join(root, name, 'migration.sql'), 'utf8'));
    }
    await pool.query(`INSERT INTO "Material" ("PartNumber","PartName","CreatedBy","UpdatedAt","QtyRack") VALUES ('LEGACY-M','Legacy material','fixture',now(),7)`);
    await pool.query(`INSERT INTO "Shopping" ("Id","Type","CreatedBy","UpdatedAt","QtyPick","MaterialId") VALUES ('LEGACY-S','REGULER','fixture',now(),1,'LEGACY-M'),('LEGACY-A','ADDITIONAL','fixture',now(),2,'LEGACY-M')`);
    for (const name of migrations.filter(name => name >= boundary)) {
      await pool.query(readFileSync(join(root, name, 'migration.sql'), 'utf8'));
    }
    const legacy = await pool.query('SELECT "Id","Purpose","SnapshotLineId","CommandId" FROM "Shopping" ORDER BY "Id"');
    assert.deepEqual(legacy.rows, [
      { Id: 'LEGACY-A', Purpose: 'LEGACY_UNCLASSIFIED', SnapshotLineId: null, CommandId: null },
      { Id: 'LEGACY-S', Purpose: 'STANDARD', SnapshotLineId: null, CommandId: null },
    ]);
    assert.equal((await pool.query('SELECT "QtyRack" FROM "Material"')).rows[0].QtyRack, 7);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM "ProductionBomSnapshot"')).rows[0].count, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM "InventoryLedger"')).rows[0].count, 0);
    console.log('PASS: upgrade preserves stock, classifies legacy conservatively, and invents no historical BOM or ledger.');
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
