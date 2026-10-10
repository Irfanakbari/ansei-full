# Material edits sent to SAP (6.12.0)

## Behavior

The existing authenticated material update route now saves the material and a
`SAP_MATERIAL_UPDATE` outbox event in one PostgreSQL transaction, when
`SAP_MATERIAL_WRITE_ENABLED=true`. This applies to edits of PartName, minimum /
maximum stock, or the effective SAP item key. Other edits and identical values do
not enqueue a write. Creation, stock movements and bulk backfill do not send SAP
updates. No SAP item is created automatically.

The key is trimmed PartNumberSAP, falling back to trimmed PartNumber for null or
blank mappings. The PATCH contains an absolute snapshot:

```json
{
  "ItemName": "the saved PartName",
  "ForeignName": "the saved PartName",
  "ManageStockByWarehouse": "tNO",
  "MinInventory": 0,
  "MaxInventory": 0
}
```

The stock values come from the saved material, including zero. ANSEI's `Not Set`
maximum is stored as zero and sent as zero. Each relevant edit sends all five
fields, making ANSEI authoritative for those fields. Quantities on hand are not
changed. SAP errors (including unsupported lengths or item configuration) leave
the local edit intact and result in a failed/retryable delivery.

## Delivery, ordering and audit

- The existing PostgreSQL outbox dispatcher publishes to BullMQ every 5 seconds.
  Redis downtime retains committed events in PostgreSQL.
- Worker requests share the existing SAP session. One re-login/retry is allowed
  after a 401. PATCH accepts 204 responses without requiring a JSON body.
- SAP write errors expose only a generic message. Credentials and upstream
  payloads are not returned to the browser or copied to error logs.
- Absolute field assignments can be retried by the existing bounded policy
  (five attempts by default, exponential delay capped at five minutes).
- A PostgreSQL advisory lock serializes worker sends per SAP item across API
  replicas. Material/stock rows are not locked during the network request. The
  worker re-reads local values and skips deleted or superseded snapshots.
- The advisory lock is held in a bounded transaction, with no automatic callback
  retry. Its rollback cannot undo an accepted SAP PATCH; durable retry is used
  if recording the result fails. This is eventual synchronization, not a
  distributed transaction or exactly-once external delivery.
- The local transaction records old/new local values and the initiating user in
  ActionAuditEvent, associated with LogProcess. Outbox transitions record results
  and retries with the existing audit convention. The original actor remains on
  the outbox event; worker transitions use SYSTEM:OUTBOX.

`SAP Update Status` is separate from `SAP Sync Status` (item existence). Material
GET responses provide `SAPUpdateStatus` and `SAPUpdateCheckedAt` based on the
latest event matching current values. Pending, Synced, Failed, Not requested and
Disabled are supported. Refresh the list to observe worker completion. System
Logs > Integrations supports filtering SAP_MATERIAL_UPDATE and the existing
authorized recovery flow. A superseded event is reported as skipped, not applied.

## Activation

1. Apply `20261009120000_sap_material_update_outbox`. It only adds the enum value
   SAP_MATERIAL_UPDATE to OutboxEventType. Prisma client has been regenerated.
2. Set `SAP_MATERIAL_WRITE_ENABLED=true` in the actual API environment.
3. Restart/redeploy the API and workers so they load the updated code and env.
4. Keep Redis and the outbox worker available. Review delivery status after the
   next material edit. Existing unchanged materials are not mass-pushed.

The flag defaults to false and is documented in both example env files. Disabling
it stops new jobs and makes existing jobs fail safely until re-enabled/recovered.
The separate `SAP_SYNC_ENABLED` flag controls the existing read-side status/BOM
integration. Do not expose either credentials or the write flag via NEXT_PUBLIC.

## Validation

Commands use the installed pnpm 10.0.0 runtime:

- `pnpm --filter @ansei/api exec prisma generate`: exit 0, generated client only.
- `pnpm --filter @ansei/api exec prisma validate`: exit 0.
- `pnpm --filter @ansei/api test --runInBand src/common/sap src/common/outbox src/master/material/material.service.spec.ts`:
  96 tests passed; 12 existing database-gated tests skipped.
- `pnpm -r --if-present run build`: API and Web exit 0. Existing Next.js middleware
  deprecation warning remains.
- `pnpm -r --if-present run lint`: Web passed; API initially reported formatting
  in two new worker files. Targeted ESLint --fix completed successfully.
- `git diff --check`: exit 0.
- Read-only `prisma migrate status`: confirms only the SAP material outbox
  migration is pending on the configured database.

Tests cover zero values, shared session, PATCH 401 handling, disabled writes,
transactional enqueue failure, no-op edits, old/new actor audit, stale/deleted
jobs, competing workers, result classification, retry and current-value status.
No real SAP PATCH or live Redis delivery was executed during implementation.

Activation approved by the user: `pnpm --filter @ansei/api exec prisma migrate deploy`
applied only 20261009120000_sap_material_update_outbox successfully (exit 0),
and the actual apps/api/.env now sets SAP_MATERIAL_WRITE_ENABLED=true.
API/worker processes must reload this environment before sending edits.
