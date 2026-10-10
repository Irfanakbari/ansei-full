# Material and Finish Good SAP existence status

The material and finish-good list and detail GET responses add `SAPSyncStatus` (`SYNCED`,
`NOT_FOUND`, `UNKNOWN`), `SAPSyncCheckedAt` (ISO timestamp or null), and
`SAPSyncStale`. Option lists and Excel exports keep their existing contract.
This is an existence check, not a stock reconciliation or an SAP write.

Match the trimmed `PartNumberSAP` against SAP `ItemCode`; null/undefined or blank
falls back to `PartNumber`. Matching is case-sensitive. The entire configured
item group is loaded, following every `@odata.nextLink` / `odata.nextLink`.
Only a fully successful scan replaces the cached set, including an empty set.

Finish Good supports many Genba part numbers sharing one SAP item code. For
example, `5715B132-KD` and `5715B132-KD1` may both set `PartNumberSAP` to
`5715B132-KD1`. Their IDs, unique Genba PartNumber, BOM, stock, and transaction
references remain separate. SAP existence status is checked for each mapping.
Material's SAP uniqueness rule is unchanged.

Before using shared FG mappings, apply migration
`20261009100000_allow_shared_finish_good_sap_item` through the approved deployment
workflow. It replaces only the FG SAP unique index with a nonunique index and
does not update any master records. Existing values must be mapped through the
normal audited create/edit flow. Review pending migrations before deploying;
do not mark a migration applied without executing its SQL.

## Configuration

Set these **API-only** environment variables and restart the API:

```dotenv
SAP_SYNC_ENABLED=true
SAP_SERVICE_LAYER_URL=https://your-sap-host:50000/b1s/v2/
SAP_COMPANY_DB=your-company-db
SAP_USERNAME=your-integration-user
SAP_PASSWORD=your-secret
SAP_MATERIAL_ITEM_GROUP=128
SAP_FINISH_GOOD_ITEM_GROUP=120
SAP_TLS_REJECT_UNAUTHORIZED=true
```

Use a dedicated SAP integration account with read access to Items. Keep the
password in deployment secrets or the ignored API `.env`, never in the frontend,
committed files, or logs. For private CA certificates set `NODE_EXTRA_CA_CERTS`
before starting Node. The certificate must match the configured hostname;
TLS verification is enabled by default. An explicit `SAP_TLS_REJECT_UNAUTHORIZED=false`
allows a self-signed SAP endpoint using a SAP-only HTTPS request option; it does
not change global Node TLS or other integrations. This keeps encryption but does
not authenticate the SAP server. Prefer a trusted certificate for production.
HTTP is rejected and redirects are never followed.

## Cache and session lifecycle

- Shared Redis snapshots plus a per-process front cache; independent material/FG groups and refresh tasks. Both caches are fresh for 5 minutes.
- SAP group `120` was verified as `FG - Sales 2`; material remains group `128`.
- A material read triggers a background refresh when cold or expired. The cold
  read returns UNKNOWN immediately. Use the existing Refresh button after the
  scan finishes. Warm reads never wait for SAP.
- Stale snapshots remain usable for up to 30 minutes with their original check
  timestamp and `SAPSyncStale=true`. Older data yields UNKNOWN, never a false
  negative. Failed scans retry no sooner than 60 seconds after failure.
- Concurrent reads share one refresh through a Redis lease across replicas.
- With SAP_SESSION_CACHE_KEY configured, B1SESSION and ROUTEID are cached as
  AES-256-GCM ciphertext in Redis; otherwise sessions remain process-local.
  Reuse until one minute before SAP SessionTimeout. On a 401, invalidate only
  the matching session, renew and retry once.
- Each HTTP request times out after 10 seconds; pagination has a 2 minute
  between-page deadline and a 1000-page cap. A failed/partial scan is discarded.
- Pagination URLs must retain the configured origin and Items path; cookies
  cannot be sent to another host or SAP resource.

See [shared cache operations](../../common/sap/SAP-CACHE.md) for TTLs, failure
behavior, encryption-key deployment and Redis persistence requirements.

The UI shows a green check for SYNCED, red cross for NOT_FOUND, and a gray
question mark for UNKNOWN. Tooltips expose check time and cache staleness.
