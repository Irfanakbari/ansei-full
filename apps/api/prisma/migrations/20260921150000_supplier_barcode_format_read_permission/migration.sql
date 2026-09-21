INSERT INTO "MTCPermission" (
  "Action",
  "Description",
  "CreateDate",
  "CreateBy",
  "UpdateDate",
  "UpdateBy"
)
VALUES (
  'IPCS.SUPPLIER_BARCODE_FORMAT_READ',
  'Read supplier barcode formats for receiving',
  CURRENT_TIMESTAMP,
  'MIGRATION',
  CURRENT_TIMESTAMP,
  'MIGRATION'
)
ON CONFLICT ("Action") DO UPDATE
SET
  "Description" = EXCLUDED."Description",
  "UpdateDate" = CURRENT_TIMESTAMP,
  "UpdateBy" = 'MIGRATION';
