require('dotenv/config');
const { Client } = require('pg');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const failures = await db.query(
      'SELECT logs FROM "_prisma_migrations" WHERE migration_name=\'20261007090000_production_demand\' AND finished_at IS NULL AND rolled_back_at IS NULL',
    );
    console.log(failures.rows.map((row) => row.logs));
    const name = '20260930120000_record_numbers_and_finding_soft_delete';
    const text = fs.readFileSync(
      `prisma/migrations/${name}/migration.sql`,
      'utf8',
    );
    const stored = (
      await db.query(
        'SELECT checksum FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL',
        [name],
      )
    ).rows[0].checksum;
    const hash = (value) => createHash('sha256').update(value).digest('hex');
    console.log({
      exactMatch: hash(text) === stored,
      lfMatch: hash(text.replace(/\r\n/g, '\n')) === stored,
      crlfMatch: hash(text.replace(/\r?\n/g, '\r\n')) === stored,
    });
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
