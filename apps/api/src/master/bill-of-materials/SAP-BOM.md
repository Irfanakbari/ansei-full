# SAP BOM reference in Bill of Materials

Select a revision in the Bill of Materials menu and click **SAP BOM**, or use
the same action in revision details. The modal shows the SAP parent quantity,
component quantities, quantity per FG unit, component type, warehouse and last
successful check. It does not write SAP or replace the local approved BOM.
Local production continues using the existing approved revisions and snapshots.

## Contract

`GET /v1/master/bill-of-materials/sap/:finishGoodId` requires
`IPCS.BOM_REVISION_READ` and uses the normal success envelope (`data`).
The server reads the FG's trimmed `PartNumberSAP`. Missing mapping is `UNMAPPED`;
it does not guess from the Genba part number. Different Genba FGs can share one
SAP code and one cache entry.

- `FOUND`: valid SAP ProductTree, including component lines.
- `NOT_FOUND`: SAP returned 404 with error code -2028. Cached like a found BOM.
- `UNKNOWN`: upstream failure, invalid payload, cooldown or concurrency limit.
- `DISABLED`: `SAP_SYNC_ENABLED` is not `true`.
- `UNMAPPED`: the finish good has no SAP part number.
- Missing local FG: HTTP 404. Invalid ID syntax: HTTP 400.

## SAP load and session handling

Only opening SAP BOM sends a lookup. Parsed BOMs and genuine missing results use
Redis snapshots shared across API replicas, with a bounded per-process front
cache (500 entries). The fresh TTL is 5 minutes; stale results are usable for
30 minutes. A Redis lease deduplicates refreshes for the same SAP code, and a
shared failure cooldown protects SAP for 60 seconds. Each process allows at most
four active BOM lookups. Item, BOM and warehouse reads share the SAP session;
when SAP_SESSION_CACHE_KEY is configured, sessions are encrypted in Redis.

See [shared cache operations](../../common/sap/SAP-CACHE.md) for restart
behavior, deployment, persistence limits and validation of version 6.13.0.

## Validation (2026-10-09)

Using installed pnpm 10.0.0:

- `pnpm --filter @ansei/api test --runInBand src/common/sap src/master/bill-of-materials`
- `pnpm --filter @ansei/api lint`
- `pnpm --filter @ansei/api build`
- `pnpm --filter @ansei/web lint`
- `pnpm --filter @ansei/web build`
- `pnpm --filter @ansei/api exec prisma validate`
- `git diff --check`

Live SAP service check: known BOM returned FOUND with two lines. Two concurrent
calls plus another cached call used one login and one BOM GET. A missing BOM
returned NOT_FOUND with one additional GET and reused the session. No SAP or
local BOM data was modified. HTTP contract tests use a mocked domain service;
they do not establish live SSO authentication coverage.

All listed validation commands passed (exit 0); focused tests: 41 tests in six
suites. The web build reports the existing Next.js middleware deprecation.
The local browser displayed the SAP BOM toolbar action, but the existing list
request reported "Backend service is unavailable". End-to-end UI modal loading
was therefore not verified against the running local backend.

## Component labels and warehouse names (6.11.1)

The UI maps SAP types to Material, Resource and Text. Unknown types retain their
original code. Warehouse columns show code plus WarehouseName; if the master
lookup fails or the code is absent, the original code remains visible.
Warehouse master data is loaded lazily with full pagination, cached for 30 minutes,
shared across BOMs, and refreshed by one task. A failed refresh retains names for
up to 24 hours, with a 60-second retry cooldown; it never invalidates the BOM.
The warehouse lookup reuses the existing SAP session and rejects foreign pagination.

Validation for 6.11.1: focused API tests passed (44 tests, six suites), API build
and web build passed. Web lint passed; API lint initially found test formatting,
resolved with `pnpm --filter @ansei/api exec eslint src/common/sap/sap-item-sync.service.spec.ts --fix`
(exit 0). `git diff --check` passed. A web source encoding error was corrected
before the successful web build. The existing Next.js middleware warning remains.
Live source-service verification found warehouse 900 = General Warehouse; all BOM
lines resolved their warehouse names. Initial lookup used three requests (login,
BOM and warehouse master); the repeated lookup used zero additional requests.
