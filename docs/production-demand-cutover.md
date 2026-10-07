# Forecast PO / Non PO — 6.6.1

## Implemented contracts

- `Forecast` remains the PO source. `ForecastNonPo` owns the seven Non PO business fields, immutable `NPO-` reference, and audit metadata.
- `ProductionDemand` owns source identity and release assignment. Database checks require exactly one source. Release source is immutable; mixed sources are rejected. The existing global single-RELEASED rule remains enforced.
- The read-only `ProductionOrder` database view joins each demand to its source without copying quantities. Production, shopping, assembly, Poka-Yoke, delivery, reports, MRP, dashboard, findings, and traceability read this projection.
- Child records use `ProductionDemandId`. Legacy physical `ForecastId` remains a real PO FK, null for Non PO. HTTP responses retain the legacy identifier alias for existing consumers; it is not a physical FK contract.
- Release requests accept `demandIds`; legacy `forecastIds` is accepted for PO only. Sending both is rejected. Candidate ID endpoints return all eligible matching IDs without pagination; mutations revalidate in a transaction.
- Non PO CRUD, Excel preview/import/template and label routes live under `/v1/production/forecast-non-po`, using existing `IPCS.FORECAST_*` permissions. Operational fields lock after activity; optional PO number and notes remain editable without label regeneration.
- Manual writes use request identity; imports additionally use a successful-file fingerprint. Confirmed duplicate requests are allowed, but retries and the same successfully imported file do not duplicate records.
- Both release modals share a controlled picker: page-local header checkbox, explicit Select All matching orders, deselection, clear/count, filter/source/mode resets and stale-response guards.

## Database application on 2026-10-07

`pnpm --filter @ansei/api exec prisma migrate dev --name production_demand` was attempted as requested. Prisma refused because the previously applied `20260930120000_record_numbers_and_finding_soft_delete` file has a different checksum. No reset was performed and that historical migration record was not rewritten.

A read-only schema comparison found existing default differences on `RecordNumberCounter.Id` and `UpdatedAt`. The new migration was applied forward-only with `prisma migrate deploy` after verification. Its first attempt rolled back because historical snapshots are append-only. The corrected migration temporarily suspends only the snapshot/trace update guards while filling the new identity columns, restoring the guards before commit under transaction-held DDL locks. A transaction ending in ROLLBACK passed on the configured database before retry. Only this task's failed attempt was marked rolled back with `migrate resolve`.

`20261007090000_production_demand` is now applied. `prisma migrate status` reports up to date. `test/production-demand-reconcile.cjs` reports zero missing source links, inconsistent child references, mixed sources, excess active releases and invalid ledger balances; both history guards are enabled.

The older checksum discrepancy still needs independent historical reconciliation before future `migrate dev` use. Do not reset business data or rewrite its checksum just to suppress the warning.

## Verification

Run from the repository root:

| Command                                                                    | Result                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm --filter @ansei/api exec prisma validate`                            | Passed                                                                                            |
| `pnpm --filter @ansei/api exec prisma generate`                            | Passed                                                                                            |
| `pnpm --filter @ansei/api exec jest --runInBand`                           | 92 suites / 976 tests passed; 2 suites / 25 tests skipped                                         |
| `pnpm --filter @ansei/api lint`                                            | Passed                                                                                            |
| `pnpm --filter @ansei/web lint`                                            | Passed                                                                                            |
| `pnpm --filter @ansei/api build`                                           | Passed                                                                                            |
| `pnpm --filter @ansei/web build`                                           | Passed; existing Next middleware convention warning                                               |
| `pnpm --filter @ansei/api exec node test/production-demand-migration.cjs`  | Passed on a newly created disposable database; requires CREATEDB permission and current API build |
| `pnpm --filter @ansei/api exec node test/production-demand-reconcile.cjs`  | Passed read-only on the configured database                                                       |
| `pnpm --filter @ansei/web exec node test/production-release-selection.mjs` | Passed with intercepted synthetic business APIs; also passed with `RELEASE_SOURCE_TYPE=NON_PO`    |
| `git diff --check -- ':!apps/api/src/generated'`                           | Passed; generated Prisma output retains generator whitespace                                      |

The disposable database test exercises migration replay with historical snapshots/trace events, old barcodes, source and child FKs, manual duplicate confirmation/replay, Excel validation/rollback/file replay, PO and Non PO through shopping, assembly/passthrough, partial boxes, Poka-Yoke, delivery and close, late PO metadata, activity locks, ledger equations and concurrent release activation.

The browser test exercises three pages in both modals, all matching IDs, individual deselection, page-size changes, source/mode/filter reset, stale and failed Select All requests, reopen, explicit submission IDs, and manual Non PO creation with empty optional fields.

Both the API PDF generator and the existing Python printer consumer were exercised with a synthetic Non PO payload. Two-box PDFs and full barcode captions were verified, and rendered label layout inspected. Physical printing, PDA scanning and external outbox delivery were not exercised.

The full PDA checkout was located at `E:/Project Vuteq Revamp/pda-app` (the older `E:/Project Vuteq/pda-app` contains only a wrapper). PDA 1.2.0+5 now supports canonical demand identity in release, picking, shopping, Poka-Yoke and delivery, with legacy aliases retained. Optional PO numbers never become scan keys. Delivery and Poka-Yoke API scan responses expose source type, stable reference, demand ID and nullable PO number. Unknown source metadata from older servers remains unknown rather than being classified as PO.

PDA validation: `flutter test --no-pub` passed 31 tests; `flutter analyze --no-pub` reported 0 errors, 6 existing warnings and 91 informational findings. `flutter build apk --release --no-pub --dart-define-from-file=.env` with JDK 17 succeeded (56.8 MB); no device installation or publication was performed. Existing local PDA changes are included in the APK. The added API scan metadata passed focused delivery/Poka-Yoke tests (50 tests across 3 suites), scoped lint and API build. These are local validations; PDA-to-live-API and physical-device journeys remain unverified.

## Runtime rollout

Database migration is complete. Deploy/restart the API and web together using the repository's normal operational process; application deployment was not performed by this change. For another environment, pause production writes for the migration, preserve a recoverable backup, apply the migration, run the read-only reconciliation above, then resume with the matching API/web version.
