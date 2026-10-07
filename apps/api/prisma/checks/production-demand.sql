-- Read-only reconciliation after the coordinated production cutover.
-- Every result below should be zero.
SELECT count(*) AS missing_or_incorrect_po_demands
FROM "Forecast" f LEFT JOIN "ProductionDemand" d ON d."ForecastPoId" = f."PoId"
WHERE d."Id" IS NULL OR d."Id" <> f."PoId" OR d."SourceType" <> 'PO'
   OR d."ProductionReleaseId" IS DISTINCT FROM f."ProductionReleaseId";

SELECT count(*) AS missing_or_incorrect_nonpo_demands
FROM "ForecastNonPo" n LEFT JOIN "ProductionDemand" d ON d."ForecastNonPoId" = n."Id"
WHERE d."Id" IS NULL OR d."Id" <> n."ReferenceNumber" OR d."SourceType" <> 'NON_PO';

SELECT count(*) AS inconsistent_child_references FROM (
  SELECT "ProductionDemandId", "ForecastId" FROM "Shopping"
  UNION ALL SELECT "ProductionDemandId", "ForecastId" FROM "ShoppingCompletion"
  UNION ALL SELECT "ProductionDemandId", "ForecastId" FROM "LabelData"
  UNION ALL SELECT "ProductionDemandId", "ForecastId" FROM "DeliveryHistory"
  UNION ALL SELECT "ProductionDemandId", "ForecastId" FROM "ProductionReport"
  UNION ALL SELECT "ProductionDemandId", "ForecastId" FROM "ProductionBomSnapshot"
  UNION ALL SELECT "ProductionDemandId", "ForecastId" FROM "ProductionFinding"
  UNION ALL SELECT "ProductionDemandId", "ForecastId" FROM "ProductionTraceEvent"
) child LEFT JOIN "ProductionDemand" d ON d."Id" = child."ProductionDemandId"
WHERE (child."ProductionDemandId" IS NOT NULL AND d."Id" IS NULL)
   OR child."ForecastId" IS DISTINCT FROM d."ForecastPoId";

SELECT count(*) AS mixed_release_sources FROM "ProductionDemand" d
JOIN "ProductionRelease" r ON r."Id" = d."ProductionReleaseId"
WHERE r."SourceType" <> d."SourceType";

SELECT GREATEST(count(*) - 1, 0) AS excess_active_releases
FROM "ProductionRelease" WHERE "Status" = 'RELEASED';

SELECT count(*) AS invalid_ledger_balances FROM "InventoryLedger"
WHERE "BalanceAfter" <> "BalanceBefore" + "QtyIn" - "QtyOut";
