# Inventory Counting / STO and SAP

Implemented in version 6.16.0. InventoryLedger remains the MES stock authority.

## Customer-owned inventory

Material inventory belongs to the customer and has zero inventory cost. FG sales prices are assembly/service prices and are never used to value a stock adjustment. The current STO integration posts `Price: 0` with `PriceSource: ippsItemCost`; it blocks unknown/nonzero item cost (or warehouse cost when warehouse costing is enabled). Confirmation requires zero actual price and zero posted values in local/system currency.

SAP must allow **Allow Inbound Posting with Zero Price** for positive differences. This company setting is under Administration → System Initialization → Document Settings → Per Document → Inventory Posting. It was enabled with approval in **VuteqSimulasi only** on 10 October 2026. The worker checks it before surplus posting; it never changes company settings itself.

## Workflow

1. Start/count cutoff: store the immutable item mapping, dimensions, date, quantities and outbox intent in the same PostgreSQL transaction. One MES STO creates one SAP Inventory Counting containing all eligible SAP items.
2. Aggregate Warehouse + Rack and all MES aliases for a SAP item. Included items must cover their nonzero locations and aliases. Existing ledger/cache mismatches, unfinished stock transactions or outstanding backflush must be resolved first.
3. SAP freezes each counted item in the trial warehouse. MES approval waits for verified SAP freeze. Bin-managed warehouses and unreviewed unit/batch/serial configurations are blocked.
4. Approve: capture absolute final counts, local stock ledger/cache changes, audit and dependent SAP events atomically. Worker updates the counting, posts one Inventory Posting containing all changed items, then closes the counting. Zero difference skips the posting.
5. The durable `STO_HOLD` survives local completion, SAP outages and missing Redis jobs. Stock stays held until SAP close is verified. Deletion rechecks DRAFT state under the inventory transaction lock to prevent deleting a concurrently started counting.

Normal PostgreSQL outbox dispatch/sweeper, shared SAP sessions and cache are reused. Capture and posting flags/allowlists remain applicable; this release does not replay old STO history. Once a held STO has been captured, its finish/recovery still follows its frozen mapping.

## Identity, status and recovery

- Human reference: `STO: AIC-10102604`; SAP Reference2: `AIC10102604` (11-character field limit). SAP may append its base counting number to Remarks.
- Local verified DocNum is shown under **Warehouse → Inventory Counting → SAP Doc Number** and detail. List/detail reads local PostgreSQL data, not SAP.
- **SAP Connection → Transactions** shows counting/create, update, posting and close jobs. Synced requires read-back proof, including matching item/warehouse, cutoff, approved quantities and base counting.
- An unknown POST result must be reconciled by its correlation reference and direct document read before another POST. Never retry merely because a response timed out.
- **Cancel Rejected STO** requires integration recovery permission and a reason. It accepts only a known rejected, unposted Inventory Posting with unchanged affected MES balances and unsent close work. It appends inverse ledger entries, cancels obsolete intents, retains original history and queues a verified SAP counting close. Unknown/already-posted results cannot use this action.
- Company, warehouse, item mapping and project/cost center remain frozen per transaction. Recovery does not edit previous payloads or silently overwrite balances.

## Scope and evidence

The live trial uses the dev MES database and VuteqSimulasi / DMY-ANS only. See `artifacts/sap-sto-trial-20261010.md` for document numbers, stock and validation evidence. Native SAP batch/serial/bin counting and nonzero-cost valuation are intentionally blocked until explicit mappings/business rules exist. An infrastructure restart or physical Redis-loss drill was not performed in this STO trial.
