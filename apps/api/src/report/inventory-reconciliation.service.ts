import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ReconciliationIssue {
  issue: string;
  key: string;
  expected: number | string | boolean | null;
  actual: number | string | boolean | null;
}

export interface InventoryReconciliationResult {
  generatedAt: Date;
  readOnly: true;
  summary: {
    totalIssues: number;
    ledgerChainBreaks: number;
    cacheVsLedgerMismatches: number;
    negativeStock: number;
    duplicateProductionResults: number;
    pokayokeLabelInconsistencies: number;
    releaseTotalInconsistencies: number;
    multipleReleasedReleases: number;
  };
  issues: {
    ledgerChainBreaks: ReconciliationIssue[];
    cacheVsLedgerMismatches: ReconciliationIssue[];
    negativeStock: ReconciliationIssue[];
    duplicateProductionResults: ReconciliationIssue[];
    pokayokeLabelInconsistencies: ReconciliationIssue[];
    releaseTotalInconsistencies: ReconciliationIssue[];
    multipleReleasedReleases: ReconciliationIssue[];
  };
}

@Injectable()
export class InventoryReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcile(): Promise<InventoryReconciliationResult> {
    const [
      ledgerChainBreaks,
      cacheVsLedgerMismatches,
      negativeStock,
      duplicateProductionResults,
      pokayokeLabelInconsistencies,
      releaseTotalInconsistencies,
      multipleReleasedReleases,
    ] = await Promise.all([
      this.ledgerChainBreaks(),
      this.cacheVsLedgerMismatches(),
      this.negativeStock(),
      this.duplicateProductionResults(),
      this.pokayokeLabelInconsistencies(),
      this.releaseTotalInconsistencies(),
      this.multipleReleasedReleases(),
    ]);

    const issues = {
      ledgerChainBreaks,
      cacheVsLedgerMismatches,
      negativeStock,
      duplicateProductionResults,
      pokayokeLabelInconsistencies,
      releaseTotalInconsistencies,
      multipleReleasedReleases,
    };
    const summary = {
      totalIssues: Object.values(issues).reduce(
        (total, entries) => total + entries.length,
        0,
      ),
      ledgerChainBreaks: ledgerChainBreaks.length,
      cacheVsLedgerMismatches: cacheVsLedgerMismatches.length,
      negativeStock: negativeStock.length,
      duplicateProductionResults: duplicateProductionResults.length,
      pokayokeLabelInconsistencies: pokayokeLabelInconsistencies.length,
      releaseTotalInconsistencies: releaseTotalInconsistencies.length,
      multipleReleasedReleases: multipleReleasedReleases.length,
    };

    return { generatedAt: new Date(), readOnly: true, summary, issues };
  }

  private ledgerChainBreaks() {
    return this.prisma.$queryRaw<ReconciliationIssue[]>`
      WITH ordered AS (
        SELECT "Id", "ItemCategory", COALESCE("MaterialId", "FinishGoodId") AS item,
               "Location", "BalanceBefore", "QtyIn", "QtyOut", "BalanceAfter",
               lag("BalanceAfter") OVER (
                 PARTITION BY "ItemCategory", COALESCE("MaterialId", "FinishGoodId"), "Location"
                 ORDER BY "TransactionDate", "Id"
               ) AS previous_balance
        FROM "InventoryLedger"
      )
      SELECT 'LEDGER_CHAIN_BREAK' AS issue, "Id" AS key,
             COALESCE(previous_balance, "BalanceBefore")::text AS expected,
             "BalanceBefore"::text AS actual
      FROM ordered
      WHERE "BalanceAfter" <> "BalanceBefore" + "QtyIn" - "QtyOut"
         OR (previous_balance IS NOT NULL AND "BalanceBefore" <> previous_balance)
      ORDER BY key
    `;
  }

  private cacheVsLedgerMismatches() {
    return this.prisma.$queryRaw<ReconciliationIssue[]>`
      WITH latest AS (
        SELECT DISTINCT ON ("ItemCategory", COALESCE("MaterialId", "FinishGoodId"), "Location")
          "ItemCategory", COALESCE("MaterialId", "FinishGoodId") AS item,
          "Location", "BalanceAfter"
        FROM "InventoryLedger"
        ORDER BY "ItemCategory", COALESCE("MaterialId", "FinishGoodId"), "Location", "TransactionDate" DESC, "Id" DESC
      ), caches AS (
        SELECT 'MATERIAL:RACK:' || "PartNumber" AS key, "QtyRack" AS actual,
               COALESCE((SELECT "BalanceAfter" FROM latest WHERE "ItemCategory" = 'MATERIAL' AND item = m."PartNumber" AND "Location" = 'RACK'), 0) AS expected
        FROM "Material" m
        UNION ALL
        SELECT 'MATERIAL:WAREHOUSE:' || "PartNumber", "QtyWarehouse",
               COALESCE((SELECT "BalanceAfter" FROM latest WHERE "ItemCategory" = 'MATERIAL' AND item = m."PartNumber" AND "Location" = 'WAREHOUSE'), 0)
        FROM "Material" m
        UNION ALL
        SELECT 'FINISH_GOOD:FINISH_GOOD_AREA:' || "PartNumber", "Qty",
               COALESCE((SELECT "BalanceAfter" FROM latest WHERE "ItemCategory" = 'FINISH_GOOD' AND item = f."PartNumber" AND "Location" = 'FINISH_GOOD_AREA'), 0)
        FROM "FinishGood" f
      )
      SELECT 'CACHE_LEDGER_MISMATCH' AS issue, key, expected::text, actual::text
      FROM caches WHERE expected <> actual ORDER BY key
    `;
  }

  private negativeStock() {
    return this.prisma.$queryRaw<ReconciliationIssue[]>`
      SELECT 'NEGATIVE_LEDGER_BALANCE' AS issue, "Id" AS key, '>=0' AS expected, "BalanceAfter"::text AS actual
      FROM "InventoryLedger" WHERE "BalanceAfter" < 0
      UNION ALL
      SELECT 'NEGATIVE_MATERIAL_RACK', "PartNumber", '>=0', "QtyRack"::text FROM "Material" WHERE "QtyRack" < 0
      UNION ALL
      SELECT 'NEGATIVE_MATERIAL_WAREHOUSE', "PartNumber", '>=0', "QtyWarehouse"::text FROM "Material" WHERE "QtyWarehouse" < 0
      UNION ALL
      SELECT 'NEGATIVE_FINISH_GOOD', "PartNumber", '>=0', "Qty"::text FROM "FinishGood" WHERE "Qty" < 0
      ORDER BY key
    `;
  }

  private duplicateProductionResults() {
    return this.prisma.$queryRaw<ReconciliationIssue[]>`
      SELECT 'DUPLICATE_PRODUCTION_RESULT' AS issue, "ReferenceDoc" AS key,
             '1' AS expected, count(*)::text AS actual
      FROM "InventoryLedger"
      WHERE "TransactionType" = 'PRODUCTION_RESULT'
      GROUP BY "ReferenceDoc" HAVING count(*) > 1
      ORDER BY key
    `;
  }

  private pokayokeLabelInconsistencies() {
    return this.prisma.$queryRaw<ReconciliationIssue[]>`
      WITH successful AS (
        SELECT "LabelDataId", count(*) AS count
        FROM "PokayokeScanHistory" WHERE "Status" = 'SUKSES'
        GROUP BY "LabelDataId"
      )
      SELECT 'LABEL_SCAN_HISTORY_MISMATCH' AS issue, l."LabelNumber" AS key,
             l."Scanned"::text AS expected, COALESCE((s.count > 0), false)::text AS actual
      FROM "LabelData" l LEFT JOIN successful s ON s."LabelDataId" = l."Id"
      WHERE l."Scanned" <> COALESCE((s.count > 0), false)
      UNION ALL
      SELECT 'LABEL_FORECAST_MISMATCH', l."LabelNumber", f."FinishGoodId", l."FinishGoodId"
      FROM "LabelData" l JOIN "ProductionOrder" f ON f."PoId" = l."ProductionDemandId"
      WHERE l."FinishGoodId" <> f."FinishGoodId"
      UNION ALL
      SELECT 'DELIVERED_LABEL_NOT_SCANNED', l."LabelNumber", 'true', l."Scanned"::text
      FROM "DeliveryHistory" d JOIN "LabelData" l ON l."LabelNumber" = d."LabelDataId"
      WHERE NOT l."Scanned"
      ORDER BY key
    `;
  }

  private releaseTotalInconsistencies() {
    return this.prisma.$queryRaw<ReconciliationIssue[]>`
      WITH totals AS (
        SELECT r."Id", r."ReleaseNumber", r."TotalTargetQty", r."TotalGoodQty", r."TotalNgQty",
          COALESCE((SELECT sum(f."Qty") FROM "ProductionOrder" f WHERE f."ProductionReleaseId" = r."Id"), 0) AS target,
          COALESCE((SELECT sum(l."QtyThisBox") FROM "LabelData" l WHERE l."ProductionReleaseId" = r."Id" AND l."Scanned"), 0) AS good,
          COALESCE((SELECT sum(p."NgQty") FROM "ProductionReport" p JOIN "ProductionOrder" f ON f."PoId" = p."ProductionDemandId" WHERE f."ProductionReleaseId" = r."Id"), 0) AS ng
        FROM "ProductionRelease" r
      )
      SELECT 'RELEASE_TARGET_TOTAL_MISMATCH' AS issue, "ReleaseNumber" AS key, target::text AS expected, "TotalTargetQty"::text AS actual FROM totals WHERE target <> "TotalTargetQty"
      UNION ALL
      SELECT 'RELEASE_GOOD_TOTAL_MISMATCH', "ReleaseNumber", good::text, "TotalGoodQty"::text FROM totals WHERE good <> "TotalGoodQty"
      UNION ALL
      SELECT 'RELEASE_NG_TOTAL_MISMATCH', "ReleaseNumber", ng::text, "TotalNgQty"::text FROM totals WHERE ng <> "TotalNgQty"
      ORDER BY key
    `;
  }

  private multipleReleasedReleases() {
    return this.prisma.$queryRaw<ReconciliationIssue[]>`
      SELECT 'MULTIPLE_RELEASED_RELEASES' AS issue, string_agg("ReleaseNumber", ', ' ORDER BY "ReleaseNumber") AS key,
             '<=1' AS expected, count(*)::text AS actual
      FROM "ProductionRelease" WHERE "Status" = 'RELEASED'
      HAVING count(*) > 1
    `;
  }
}
