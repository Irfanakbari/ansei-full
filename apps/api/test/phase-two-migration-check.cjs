/* By Irfan Akbari Vuteq Indonesia - 2026-09-19; disposable database only. */
const { Pool } = require('pg');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const url = new URL(process.env.PHASE2_MIGRATION_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/ansei_phase2_upgrade');
  const db = new Pool({ connectionString: url.toString() });
  try {
    assert.equal(
      (
        await db.query(
          "SELECT tablename FROM pg_tables WHERE schemaname='public'",
        )
      ).rowCount,
      0,
    );
    const root = join(__dirname, '../prisma/migrations');
    const migrations = readdirSync(root)
      .filter((name) => /^\d/.test(name))
      .sort();
    const boundary = '20260919110000_transaction_action_audit';
    for (const name of migrations.filter((name) => name < boundary))
      await db.query(readFileSync(join(root, name, 'migration.sql'), 'utf8'));
    await db.query(
      `INSERT INTO "Material" ("PartNumber", "PartName", "CreatedBy", "UpdatedAt", "QtyRack") VALUES ('UPGRADE', 'Fixture', 'fixture', now(), 7)`,
    );
    await db.query(
      `INSERT INTO "LogProcess" ("ProcessId", "FunctionId", "FunctionName", "ProcessStatus", "ProcessStart", "ProcessEnd", "ProcessDate", "CreatedAt", "CreatedBy") VALUES ('LEGACY-PROCESS', 'FIXTURE', 'Fixture', 'SUCCESS', now(), now(), now(), now(), 'fixture')`,
    );
    await db.query(
      `INSERT INTO "BusinessCommand" ("Id", "Scope", "RequestId", "Fingerprint", "Actor", "Result") VALUES ('LEGACY-COMMAND', 'FIXTURE', 'old-key', 'old-fingerprint', 'fixture', '{"reference":"old-reference"}')`,
    );
    for (const name of migrations.filter((name) => name >= boundary))
      await db.query(readFileSync(join(root, name, 'migration.sql'), 'utf8'));
    assert.equal(
      (await db.query('SELECT count(*)::int AS count FROM "ActionAuditEvent"'))
        .rows[0].count,
      0,
    );
    assert.equal(
      (await db.query('SELECT "QtyRack" FROM "Material"')).rows[0].QtyRack,
      7,
    );
    assert.deepEqual(
      (await db.query('SELECT "Result" FROM "BusinessCommand"')).rows[0].Result,
      { reference: 'old-reference' },
    );
    await assert.rejects(
      db.query(
        `UPDATE "BusinessCommand" SET "Result"='{}' WHERE "Id"='LEGACY-COMMAND'`,
      ),
    );
    await assert.rejects(
      db.query(
        `UPDATE "LogProcess" SET "ProcessStatus"='FAILED' WHERE "ProcessId"='LEGACY-PROCESS'`,
      ),
    );
    console.log(
      'PASS: phase 2 upgrade preserves stock and completed results, invents no prior audit evidence, and protects old completed commands/processes.',
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
