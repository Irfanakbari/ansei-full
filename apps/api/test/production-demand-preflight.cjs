// Transactional dry run of the authorized migration; all changes roll back.
require('dotenv/config');
const { Client } = require('pg');
const fs = require('node:fs');
async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const sql = fs
      .readFileSync(
        'prisma/migrations/20261007090000_production_demand/migration.sql',
        'utf8',
      )
      .replace(/COMMIT;\s*$/, 'ROLLBACK;');
    await db.query(sql);
    console.log('PASS: migration dry run rolled back successfully.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error({
      code: error.code,
      message: error.message,
      constraint: error.constraint,
      where: error.where,
    });
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
