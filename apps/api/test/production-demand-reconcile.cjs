// Read-only post-cutover check. Prints aggregate failures, never operational rows.
require('dotenv/config');
const { Client } = require('pg');
const fs = require('node:fs');
async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const results = await db.query(
      fs.readFileSync('prisma/checks/production-demand.sql', 'utf8'),
    );
    for (const result of results) {
      for (const [check, count] of Object.entries(result.rows[0])) {
        console.log(`${check}: ${count}`);
        if (Number(count) !== 0) process.exitCode = 1;
      }
    }
    const guards = await db.query(
      `SELECT count(*) AS active FROM pg_trigger WHERE tgname IN ('snapshot_immutable', 'trace_immutable') AND tgenabled='O'`,
    );
    if (Number(guards.rows[0].active) !== 2)
      throw new Error('History guards are not both enabled.');
    console.log('History guards: enabled.');
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
