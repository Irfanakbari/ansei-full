# Assembly per box (1.29.0)

## Behavior

Master FinishGood has `IsPassthrough` (default false). API create/update uses `isPassthrough`; responses return `IsPassthrough`. Create/edit modals and the master table expose the setting. Release snapshots its inverse as `LabelData.RequiresAssembly`; later master changes never rewrite released labels. Clean forecast quantity edits preserve the snapshot; switching the part takes its new master rule. Any assembly history, including cancellation, blocks forecast edits and untagging.

Shopping completion always claims `ShoppingCompletion` and creates the label-print outbox event. Passthrough credits the forecast quantity immediately. Mandatory assembly credits only each completed box. There is no WIP inventory location. InventoryLedger is the source of balance; ledger/cache/session/audit completion writes are atomic.

Display uses its saved manpower NIK (including the old saved config format). The API resolves active manpower to UID and snapshots their name. Part follows the scanned label without changing saved media/target settings. One operator and one label can each have only one active session. Scan to start; scan the same label again and explicitly confirm to finish. Server timestamps survive refresh and support more than 24 hours. Idle time is included. No offline completion, partial boxes, pause/resume, or operator handoff.

Display is intentionally public as requested. Operator selection is attribution, not proof of identity; public audit actor/channel is DISPLAY. Public operations do not include global session listing or cancellation. Leader cancellation requires IPCS.ASSEMBLY_CANCEL and a nonblank reason, preserves history, and never changes stock. Completed sessions cannot be cancelled.

Pre-delivery and delivery recheck label prerequisites. Mandatory assembly needs a completed session and its box ledger result. Poka-Yoke remains the source of good quantity; manual release production minutes remain separate from assembly durations. Existing ProductionReport remains independent.

## Interfaces

- Public `/v1/display/assembly/operator?manPowerNik=...`, `/labels/:labelNumber`, POST `/start`, POST `/:id/complete`.
- Protected `/v1/production/assembly/sessions`, `/progress`, `/labels/:labelNumber`, POST `/start`, POST `/:id/complete`, POST `/:id/cancel`.
- Start body: `labelNumber`, `manPowerNik`, UUID `requestId`; complete body: `manPowerNik`, UUID `requestId`; cancel body: `reason`.
- Queries for sessions: page/limit, status, productionReleaseId, labelNumber, manPowerNik. Progress shows active-release label counts across all manpower and accepts release/label filters.
- Uses the existing global success envelope and pagination metadata. Display proxy only forwards the explicitly allowed public operations; internal operations use the authenticated proxy.

## Rollout

1. Finish all RELEASED releases using the currently deployed application. Do not start the new application against the old schema.
2. Stop production writes for maintenance. Back up the database using the normal operational procedure.
3. Run `pnpm --filter @ansei/api exec prisma migrate deploy`. The assembly migration locks release writes, rejects any active RELEASED release, renames the completion marker preserving its rows, and adds the schema, partial unique indexes, and three permission records atomically.
4. Use the generated Prisma client matching this schema; deploy API and web together (version 1.29.0). Grant IPCS.ASSEMBLY_READ/CREATE/CANCEL to appropriate internal roles using the existing permission configuration; synchronize SSO grants where applicable. Do not give cancellation to the public Display routes.
5. Configure passthrough parts in master FinishGood before releasing new production. The default requires assembly. Historical labels remain nullable and no synthetic historical assembly sessions or durations are created.
6. Smoke test one assy box and one passthrough box through Poka-Yoke and delivery. Confirm one ledger result per box and release close prerequisites.

Once assembly transactions exist, do not roll back to application code that books all FG during shopping. Keep the new schema/history and use a forward fix.

## Verification

`pnpm --filter @ansei/api exec tsx test/production/assembly.postgres.ts` creates a random disposable PostgreSQL schema, applies a pre-feature schema then the real migration, runs real service transactions, and drops only that schema. It uses ASSEMBLY_TEST_DATABASE_URL when provided, otherwise DATABASE_URL; no public business rows are modified. It verifies migration maintenance guard and history preservation, concurrent scans/completions, partial unique indexes, per-box gates, cancellation/restart, cross-day duration, and rollback after ledger/cache writes. Redis, printers, SSO, and email are not exercised by this test.

Unit checks: `pnpm --filter @ansei/api exec jest --runInBand`.
Validation: `pnpm --filter @ansei/api exec prisma validate`, `pnpm lint:api`, `pnpm lint:web`, `pnpm build:api`, `pnpm build:web`, `git diff --check`.

Browser regression: after `pnpm --filter @ansei/web build`, start a local server with `pnpm --filter @ansei/web exec next start --hostname 127.0.0.1 --port 3219`, then run `node apps/web/test/assembly-display.mjs`. The test launches a fresh headless Edge profile, intercepts all API calls with synthetic data, exercises Display and the FinishGood edit modal/table, then deletes only its temporary profile. Set EDGE_EXECUTABLE or ASSEMBLY_WEB_TEST_URL to override the browser or local URL. This is a frontend interaction test, not an SSO or live backend integration test.

### Implementation verification (2026-09-18)

- `pnpm --filter @ansei/api exec prisma generate`: passed; generated client refreshed from schema.
- `pnpm --filter @ansei/api exec prisma validate`: passed.
- `pnpm --filter @ansei/api exec jest --runInBand`: 77 suites passed, 760 tests passed, 4 existing tests skipped. Subsequent focused assembly/shopping checks also passed.
- `pnpm --filter @ansei/api exec tsx test/production/assembly.postgres.ts`: passed on real PostgreSQL in a disposable schema, including applying the actual migration and preserving legacy marker/label records.
- `node apps/web/test/assembly-display.mjs`: passed for saved manpower, scanned part, start/confirm/complete, refresh, cross-day timer, config lock, connection failure/recovery, inactive manpower, UUID generation without crypto.randomUUID (HTTP LAN compatibility), and master passthrough edit/table persistence.
- API/web lint and production builds passed. Existing Next.js middleware deprecation remains outside this change.
- Source diff whitespace check passed. Full `git diff --check` reports four trailing whitespace lines emitted by Prisma in generated files; generated output was not hand-edited.
- Dev migration applied on 2026-09-18 after explicitly authorized cleanup: six compensating ledger entries returned 1,008 material units to rack and reversed 48 FG units, preserving original ledger history. Deleted one RELEASED release, five shopping records, and three labels; preserved and unlinked one forecast. Cleanup and stock reversal committed atomically with audit records. `pnpm --filter @ansei/api exec prisma migrate dev` applied `20260918170000_label_assembly`; migrate status reports all 38 migrations up to date, Prisma validation passed, and the client was regenerated. Post-cleanup verification found zero active releases, zero invalid reversal balances, and zero affected stock-cache mismatches.
