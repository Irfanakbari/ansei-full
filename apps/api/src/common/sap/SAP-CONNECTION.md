# SAP Connection — 6.15.6

Posting dates now use the Asia/Jakarta business date, independent of server
timezone, for new Incoming receipts, ledger-derived SAP events and automatic
Sales Orders. Forecast delivery dates remain their explicit calendar dates.
Existing immutable snapshots/submitted requests are not silently rewritten.
Tests cover the 17:00 UTC Jakarta midnight boundary and month/year changes;
45 focused SAP tests, API lint and API build passed.

The requested date-only correction of trial GR 261811042 was attempted and
audited on 2026-10-10. SAP rejected DocDate changes with error -1029:
`[OIGN.DocDate], Field cannot be updated (ODBC -1029)`.
Readback confirmed the existing GR still has DocDate 2026-10-09, with its two
original lines, totals and remarks unchanged. No replacement receipt was posted.

Incoming receipts captured from 6.15.5 use one event per Incoming (`incoming:<id>`)
and one InventoryGenEntries POST with all received material lines. The first ledger
ID anchors existing operational lookups; every ledger ID, MES/SAP part mapping and
quantity is frozen in Snapshot.lines, with stock effects for every line. Capture,
ledger and stock-cache writes share the existing inventory transaction. Historical
single-line events remain supported and are never merged or reposted automatically.
An Incoming partly outside the trial allowlist is held as a whole. Every line must
pass item/unit/warehouse/zero-cost validation. POST readback and unknown-outcome
recovery require the complete line set; a partial match cannot confirm the event.

Live dev trial on 2026-10-10: INC-101026-001 / DEV-SAP-GROUPED-10-20261010 was
checked and closed with A1A-C4380 and AA-06A658, 10 each. VuteqSimulasi contains
exactly one correlated Goods Receipt, DocNum 261811042 / DocEntry 169432, with
both lines in DMY-ANS, Project 2010, Cost Center 2000 and UnitPrice 0. Each material
changed from Warehouse 500 / Rack 0 / SAP 500 to 510 / 0 / 510. Replaying the same
receive command created no extra ledger rows. The existing UTC date conversion
produced SAP DocDate 2026-10-09; the MES Incoming number uses local 2026-10-10.
Validation: 108 API suites / 1,163 tests passed, 25 environment-gated tests skipped;
API lint and build passed. No migration was needed and the production DB was not used.

Incoming, Production Release and Forecast list/detail responses include
`SAPDocuments`: grouped verified DocNum values, part/demand references and local
posting/lifecycle statuses. Incoming shows Goods Receipts, releases show Production
Orders and forecasts show Sales Orders. Production attribution uses the frozen
release number; ambiguous historical links and manual SO mappings without local
DocNum evidence are marked UNVERIFIED. Existing SAPIntegration stays compatible.
The Web SAP Doc Number column displays two numbers plus an overflow popup and
outstanding statuses. Refresh uses batched PostgreSQL reads, never SAP calls.
No schema migration or historical reposting is required.

Validation for 6.15.4 (2026-10-09):

- `pnpm --filter @ansei/api exec jest --runInBand`: 107 suites / 1,155 tests
  passed; 2 suites / 25 integration tests skipped by existing environment gates.
- After adding two pagination regressions, `pnpm --filter @ansei/api exec jest
forecast.service.spec --runInBand`: all 44 tests passed.
- `pnpm --filter @ansei/web exec node --test test/sap-document-numbers.test.mjs`:
  4 rendering tests passed, using synthetic data and the real shared component.
- `pnpm lint`, `pnpm build:api`, `pnpm build:web`, `pnpm prisma:validate`: exit 0.
  Web retains the existing middleware-to-proxy deprecation warning.
- The root `pnpm test -- --runInBand` wrapper forwarded an extra separator and
  selected no tests; the direct Jest command above supplied regression coverage.
- No live SAP posting, database migration or interactive browser verification was
  performed for this feature.

Sales Order Customer Ref. No. (`NumAtCard`) comes from the frozen MES forecast
`PoNumber`. Remarks (`Comments`) show the captured Release Number and PO number;
the internal event marker stays in `JournalMemo`. Recovery searches both the old
Comments marker and the new JournalMemo marker to avoid duplicate posting.

## Operational contract

MES remains authoritative for operational stock. PostgreSQL stores ledger writes,
SAP transaction intent, and audit in the same transaction. The existing outbox
dispatcher rebuilds Redis execution jobs; Redis is not the transaction source.
No historic transactions are automatically replayed.

SAP Connection is a top-level Web menu with five submenu routes under
`/apps/sap-connection`: `overview`, `transactions`, `stock-reconciliation`,
`mappings`, and `connection-cache`. The previous System Administration route
redirects to Overview. These pages use authenticated Redux transport and the
shared breadcrumb, toolbar, and compact table patterns. Ordinary Refresh reads local state. Test Connection
and Refresh SAP Stock use shared Redis leases/cache (30/60 seconds respectively).
Stock fetches use batches of 40 mapped MES item codes; failed fetches do not
publish a partial snapshot. Credentials and SAP cookies stay on the server.

Permissions: `IPCS.SYSTEM_LOG_READ` for viewing, `IPCS.SAP_MAPPING_UPDATE` for
binding a demand to a Sales Order line, and `IPCS.INTEGRATION_RECOVER` for connection
checks, refresh and recovery. Assign the new permission through role management.
Material/FG/BOM mapping remains in its existing master screen, linked from Mappings.

PDA source and endpoints are unchanged. Operational responses gain an optional
`SAPIntegration` property. Web shows it on incoming, shopping, assembly and delivery.

## Capture and posting

Runtime controls live in SAP Connection > Connection & Cache. The PostgreSQL
IntegrationSettings record controls sending, Project Code and dimension-1 Cost
Center. Both mapping-update and recovery permissions are required to save it.
Pausing does not turn off event capture. The deployment capture flag stays on;
the dispatcher skips SAP jobs while paused, and queued workers re-check the
setting before sending. Pending events resume without consuming retry budget
while paused. Requests already sent may complete. Business failures and unknown
outcomes remain held for explicit recovery; they are not blindly replayed.
Dimensions are frozen at capture time, so setting changes affect new events.
SAP requests run only in the worker, outside MES business transactions. Local
ledger and outbox persistence remain atomic: database failures must not silently
drop an integration event.

Draft release creation/tagging now captures a Planned SAP Production Order.
Production Order Remarks show the frozen MES Release Number; JournalRemarks
stores the correlation marker. Recovery accepts this and the legacy Remarks
marker. Trial document 260013434 was updated and read back as PR-20261009-001.
MES release captures a separate PRODUCTION_RELEASE PATCH after its order and
Sales Order dependencies. Cancellation/deletion captures cancellation; a pending
unsent release is stopped before cancellation. Changes that make an existing
planned quantity/BOM incompatible with release remain Blocked for review.
The already-released trial order is not recreated or downgraded by this change.

- Approved incoming: inventory receipt, zero unit price only for reviewed zero-cost items.
  New receipts show `PO: <incoming PoId>` in Comments (SAP Remarks), with the
  correlation marker in JournalMemo. Recovery and external monitoring accept
  both this format and the previous Comments marker. Previously submitted
  immutable requests and posted documents retain their original text.
  Current capture creates one receipt per material ledger line, so a multi-line
  MES incoming still produces multiple SAP receipts with the same PO reference.
- Production release/tag: automatic Sales Order per demand when enabled, followed by one production order per demand activation. MES BOM,
  item mapping and units are frozen. SAP BOM must match; component warehouses
  are explicitly set to the configured trial warehouse.
- Standard shopping: backflush bridge, no separate SAP Goods Issue.
- Assembly/passthrough: production receipt with its verified production order as base.
- Delivery: exact mapped open Sales Order line; price/tax are inherited from SAP.
- Cancellation/untag: production cancellation intent. Reactivation waits for it.
- Close: waits for postings, reconciled backflush quantities and SAP completed quantity.
- Material NG/additional consumption: Goods Issue once; allocation creates no second issue.
- Full FG scrap: approval invalidates/splits the label and creates replacement lineage.
  Before receipt, only wasted components are issued; after receipt, only FG is issued.
  Replacement picking is separately audited and waits for backflush of replacement output.
- Delivered FG: Customer Return before returned-stock scrap. Original delivery history
  remains intact. Return is not automatic approval for a replacement commercial delivery.

Warehouse-to-rack movement stays local for the one-SAP-warehouse pilot. Other
manual stock adjustments/counting and supplier-return workflows do not yet have
SAP posting adapters; do not include them in an activated trial without reviewing
their integration policy. Reconciliation exposes their resulting unexplained differences.

## Recovery

Events use immutable captured payloads and persist the exact first submitted
request. Compare-and-swap state transitions fence competing workers. Dependency
waits do not exhaust the retry budget. Known pre-send outages retry with backoff;
business rejection is Blocked. A timeout after sending is Needs Reconciliation.

Reconcile searches the correlation marker and checks the unique document,
item/quantity/warehouse, commercial base references or production components.
It never reposts an unknown outcome. A missing/ambiguous/cancelled document stays
held. There is intentionally no automatic “not found means retry” operation.
Generic System Logs recovery cannot manually mark SAP transaction jobs delivered.
System Logs and SAP Connection use the same outbox/audit records.

Stock comparison is at the displayed snapshot cutoff:
`expected SAP = MES Warehouse + MES Rack + awaiting backflush - pending effect`.
MES aliases aggregate to one SAP item. Missing SAP data is unknown, not zero.
Expired snapshots and transactions changing after the cutoff are not final matches.
Review cutover opening balances before enabling capture; do not hide differences
by directly overwriting MES balances.

The external-document monitor starts at current DocEntry watermarks (no historic
replay), scans up to 100 new documents per resource per refresh and persists its
cursors. It flags untracked receipts, issues, deliveries, returns and transfers.
It does not comprehensively detect edits/cancellations of old DocEntry values;
stock differences remain visible. Automatic background scanning is not enabled.

## Activation and outstanding acceptance

Development trial on 2026-10-09: capture, posting and automatic SO are enabled
in the local API env for FG `5715B132-KD` and its five allowlisted components,
company `VuteqSimulasi`, warehouse `DMY-ANS`. Project `2010` and Cost Center
`2000` are frozen into newly captured events. This does not activate production.
Trial demand `200373886400010` is verified as SO `260616547` and Production
Order `260013434` (Released, quantity 30). Its production due date was explicitly
corrected to 2026-10-09 for the trial with an audit of the rejected request.
SAP requires creation as Planned, followed by a Released PATCH. Failure after
creation is held for reconciliation; recovery verifies the existing document
and completes that same release instead of posting another Production Order.
The remaining notes below describe earlier pre-activation validation.

The operational, external-monitor and automatic-SO migrations were deployed with `prisma migrate deploy` on
2026-10-09. Capture and posting remain disabled in the actual runtime environment.
The examples document the flags:

```
SAP_TRANSACTION_CAPTURE_ENABLED=false
SAP_TRANSACTION_WRITE_ENABLED=false
SAP_TRANSACTION_WAREHOUSE=DMY-ANS
SAP_TRANSACTION_ITEM_ALLOWLIST=5715B132-KD
SAP_TRANSACTION_MATERIAL_ALLOWLIST=
SAP_AUTO_SALES_ORDER_ENABLED=false
```

Before activation, set the reviewed component allowlist, confirm opening balances,
grant permissions and bind the actual SO. Capture must precede operational trial
transactions. Never enable by replaying all historical ledger rows. Then enable
posting only for the verified pilot scope.

Live read validation confirmed SAP connectivity, inventory-enabled trial FG and
its five backflush BOM components. Snapshot refresh and paginated local reads
worked. Forecast `200373886400010` refers to FG `5715B132KD`, SAP `5715B132-KD`,
quantity 30, PO `2003738864`; it is not released. Its PO reference was not found
in SAP. A complete scan of 153 open SOs found no open line for this FG, so no existing Sales Order was guessed. After the user selected automatic SO creation,
customer C000053 (PT. ANSEI INDONESIA JAYA) was matched and saved for this demand;
its existing Price List 1 contains a positive IDR price for the trial item.
Automatic SO preflight passed for quantity 30; no SO was posted.

No SAP business document was posted by this validation. Posting permissions,
partial production/delivery, all live NG/return scenarios, inventory valuation,
service price inheritance and accounting journals still require the controlled
trial with a valid SO. Multi-process/restart recovery is covered by software
guards/tests but has not been proven end-to-end against SAP. This release must
not be described as fully accepted production integration until those checks pass.

## Durability evidence

Remote Redis at 10.10.10.102 uses AOF/everysec/persistent volume; the earlier
AOF-disabled observation concerned local Redis. An isolated networkless Redis
container on the remote host retained a test key after forced termination and
container recreation with its temporary volume. Test resources were removed;
the production Redis container was not restarted.

A real PostgreSQL transaction containing SAP intent/outbox/audit was deliberately
rolled back; no test transaction or outbox event remained. This verifies database
atomicity, not actual SAP duplicate-delivery recovery. One persistent server is
not high availability; retain independent backups and operational monitoring.

## Automatic Sales Orders

Enable SAP_AUTO_SALES_ORDER_ENABLED together with the reviewed capture/posting flags.
In Mappings, Automatic SO selects the active customer CardCode for each demand.
A unique sales-order:<demand> event prevents duplicate SOs across release retries.
Release creation in draft status does not post; transition to Released captures
the SO and dependent production order. Cancellation/reactivation of production
reuses the original commercial SO; it does not silently cancel a customer order.

Orders are sent without UnitPrice, discounts or tax overrides. SAP calculates the
price for the customer's pricing rules. The pilot preflight requires a positive
item price on the customer's assigned list; special-price-only/zero-base-price
scenarios need explicit further support. Delivery inherits the confirmed SO line.
The worker reads back a created SO before linking DocEntry/line 0 atomically with
outbox completion. Unknown outcomes remain held and use the same correlation
reconciliation; manual SO creation must not bypass an uncertain automatic job.

Reference: [SAP price determination](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/77cc8a21b6e042008bfef8fa9a63defd.html).

## Final validation record, 2026-10-09

- `pnpm lint:api`, `pnpm lint:web`: exit 0.
- `pnpm build:api`, `pnpm build:web`: exit 0. Web retains the existing Next.js
  middleware-to-proxy deprecation warning.
- `pnpm --filter @ansei/api exec jest --runInBand`: 103 suites / 1,136 tests
  passed; 2 suites / 25 tests skipped by their existing environment gates.
- `pnpm prisma:validate`: valid; `prisma migrate status`: all 64 migrations applied.
- Nest SAP module dependency injection compiled successfully.
- Source-only `git diff --check` passed. Full diff check reports trailing whitespace
  emitted by the Prisma generator in generated client comments; generated files
  were not hand-edited.
- Live SAP connection, item/BOM, batched stock snapshots, local transaction/mapping
  pagination, customer mapping and SO request preparation passed.
- Fresh reconciliation found unexplained opening differences on all five trial
  BOM components (none missing). These require an approved cutover reconciliation;
  no balance was changed to conceal them. Capture/posting remain disabled.
- SAP business POSTs, journal/valuation acceptance and production-server deployment
  of the new application build were not performed.

## Production trial verification, 2026-10-10 (6.15.8)

Dev database `192.168.1.122/ansei`, SAP company `VuteqSimulasi`, warehouse
`DMY-ANS`, release `PR-20261009-001`, demand `200373886400010`:

- Transferred 30 units of each of the five frozen BOM components from Warehouse
  to Rack through the normal service, then picked all 30 through standard shopping.
  Shopping records `SHP-101026-001` through `SHP-101026-005` are complete.
- Before assembly, MES material totals decreased by 30 each; SAP remained unchanged.
  Five persistent backflush pick records explained the difference. Picking replays
  returned the same records without another stock deduction.
- Completed two assembly labels of 15 FG each using a dedicated dev trial operator.
  SAP receipts `261811046` (entry 169436) and `261811047` (entry 169437) reference
  Production Order `260013434` (entry 175874), with posting date 2026-10-10.
- Fixed SAP rejection -5002: production receipts must omit explicit `ItemCode` and
  derive it from `BaseType=202` and `BaseEntry`. The first rejected request was
  corrected with field-level audit and unchanged mapping/quantity after verifying
  no correlated SAP document existed. No MES stock transaction was replayed as new.
- SAP then rejected zero-cost backflush with 10001287. The user explicitly approved
  enabling `EnableStockRelNoCostPrice` for the entire **VuteqSimulasi** company.
  CompanyInfo was read, updated with its required fields preserved, and read back;
  the other returned company properties were unchanged. This setting remains enabled.
- SAP Production Order completed quantity is 30, and each component issued quantity
  is 30. FG stock is 30 in both systems. A1A-C4380 and AA-06A658 are 485 each;
  B1K-A4050, B1K-A4060 and A1J-C4400 are 475 each; MES Rack stock is zero.
- Refreshed the shared stock snapshot through SapConnectionService: all five trial
  components show MATCHED, awaitingBackflush 0 and unexplained 0. Both receipt jobs
  are SUCCEEDED with local verified DocNum/DocEntry. Assembly completion replay
  did not create another FG ledger entry. SAP receipt totals are zero; this trial
  does not constitute accounting approval or a full journal review.
- Release remains RELEASED. Poka-Yoke, delivery and production close were not run.
- Focused command: `pnpm --filter @ansei/api exec jest --runInBand sap-production-receipt.spec.ts sap-incoming-document.spec.ts assembly.service.spec.ts shopping.service.spec.ts`:
  43 passed / 4 skipped. `pnpm lint:api`, `pnpm build:api`, and source diff checks passed.

Reference: [SAP EnableStockRelNoCostPrice](https://help.sap.com/doc/089315d8d0f8475a9fc84fb919b501a3/10.0/en-US/SDKHelp/SAPbobsCOM~CompanyInfo~EnableStockRelNoCostPrice.html).
