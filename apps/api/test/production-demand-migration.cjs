/* Isolated SQL migration and compatibility verification; never mutates the configured database. */
require('dotenv/config');
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const name = `ansei_demand_${Date.now()}_test`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = `/${name}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    const migrations = path.resolve('prisma/migrations');
    for (const folder of fs.readdirSync(migrations).sort()) {
      const sql = path.join(migrations, folder, 'migration.sql');
      if (!fs.existsSync(sql)) continue;
      if (folder === '20261007090000_production_demand') {
        await db.query(`INSERT INTO "FinishGood" ("PartNumber","PartName","CreatedBy","UpdatedBy","UpdatedAt") VALUES ('TEST-FG','Test FG','test','test',now());
          INSERT INTO "Forecast" ("PoId","Date","VendorCode","VendorName","ReceivingArea","DeliveryDate","DeliveryPeriod","Classification","PoNumber","Item","Qty","FinishGoodId") VALUES ('OLD-PO',now(),'V','Vendor','A',now(),1,'C','PO',1,7,'TEST-FG');
          INSERT INTO "LabelData" ("LabelNumber","FinishGoodId","ForecastId","QtyThisBox") VALUES ('UNCHANGED-BARCODE','TEST-FG','OLD-PO',7);`);
      }
      if (folder === '20261007090000_production_demand') {
        await db.query(`INSERT INTO "ProductionRelease" ("Id","ReleaseNumber","PlanDate","CreatedBy","UpdatedAt") VALUES ('R-HISTORY','R-HISTORY',now(),'test',now());
          INSERT INTO "BomRevision" ("Id","FinishGoodId","Revision","Reason","CreatedBy","LastEditedBy","UpdatedAt") SELECT 'B-HISTORY',"Id",99,'test','test','test',now() FROM "FinishGood" WHERE "PartNumber"='TEST-FG';
          INSERT INTO "ProductionBomSnapshot" ("Id","ForecastId","ReleaseId","RevisionId","Version","TargetQty","FinishGoodPartNumber","FinishGoodPartName","CreatedBy") VALUES ('S-HISTORY','OLD-PO','R-HISTORY','B-HISTORY',1,7,'TEST-FG','Test FG','test');
          INSERT INTO "ProductionTraceEvent" ("Id","ForecastId","Type","SourceType","SourceId","Actor","CorrelationId") VALUES ('T-HISTORY','OLD-PO','TEST','TEST','TEST','test','test');`);
      }
      await db.query(fs.readFileSync(sql, 'utf8'));
    }
    assert.equal(
      (
        await db.query(
          `SELECT "ProductionDemandId" FROM "LabelData" WHERE "LabelNumber"='UNCHANGED-BARCODE'`,
        )
      ).rows[0].ProductionDemandId,
      'OLD-PO',
    );
    await db.query(`INSERT INTO "ForecastNonPo" ("ReferenceNumber","PartNumber","DeliveryDate","ReceivingArea","DeliveryPeriod","Qty","CreatedBy","UpdatedBy","UpdatedAt") VALUES ('NPO-TEST','TEST-FG',now(),'A',2,9,'test','test',now());
      INSERT INTO "LabelData" ("LabelNumber","FinishGoodId","ProductionDemandId","QtyThisBox") VALUES ('NONPO-BARCODE','TEST-FG','NPO-TEST',9);`);
    assert.equal(
      (
        await db.query(
          `SELECT \"TargetQty\" FROM \"ProductionBomSnapshot\" WHERE \"Id\"='S-HISTORY'`,
        )
      ).rows[0].TargetQty,
      7,
    );
    await assert.rejects(
      db.query(
        `UPDATE \"ProductionTraceEvent\" SET \"Type\"='CHANGED' WHERE \"Id\"='T-HISTORY'`,
      ),
      /append-only/,
    );
    const nonpo = (
      await db.query(`SELECT * FROM "ProductionOrder" WHERE "PoId"='NPO-TEST'`)
    ).rows[0];
    assert.equal(nonpo.Qty, 9);
    assert.equal(nonpo.PoNumber, '');
    assert.equal(nonpo.SourceType, 'NON_PO');
    assert.equal(
      (
        await db.query(
          `SELECT "ForecastId" FROM "LabelData" WHERE "LabelNumber"='NONPO-BARCODE'`,
        )
      ).rows[0].ForecastId,
      null,
    );
    await db.query(
      `UPDATE "ForecastNonPo" SET "PoNumber"='LATE-PO' WHERE "ReferenceNumber"='NPO-TEST'`,
    );
    assert.equal(
      (
        await db.query(
          `SELECT "PoNumber" FROM "ProductionOrder" WHERE "PoId"='NPO-TEST'`,
        )
      ).rows[0].PoNumber,
      'LATE-PO',
    );
    await db.query(
      `INSERT INTO "ProductionRelease" ("Id","ReleaseNumber","PlanDate","CreatedBy","UpdatedAt") VALUES ('R-PO','R-PO',now(),'test',now())`,
    );
    await assert.rejects(
      db.query(
        `UPDATE "ProductionDemand" SET "ProductionReleaseId"='R-PO' WHERE "Id"='NPO-TEST'`,
      ),
      /cannot mix/,
    );
    await db.query(
      `UPDATE "ProductionDemand" SET "ProductionReleaseId"='R-PO' WHERE "Id"='OLD-PO'`,
    );
    assert.equal(
      (
        await db.query(
          `SELECT "ProductionReleaseId" FROM "Forecast" WHERE "PoId"='OLD-PO'`,
        )
      ).rows[0].ProductionReleaseId,
      'R-PO',
    );
    await require('./production-demand-services.cjs')(url.toString());
    console.log(
      'PASS: all migrations replay, legacy backfill/barcode, Non PO projection/late PO, canonical/legacy FK, mixed release rejection.',
    );
  } finally {
    await db.end();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
