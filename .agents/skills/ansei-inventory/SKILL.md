---
name: ansei-inventory
description: Change or review ANSEI inventory, warehouse, production consumption/result, stock opname, transfer, delivery, MRP, and Poka-Yoke flows. Use whenever quantities or stock locations can change.
---

# ANSEI inventory integrity

## Invariants

- `InventoryLedger` is the stock source of truth.
- Material/finish-good quantity columns are UI caches, not independent authorities.
- Every stock mutation creates the appropriate ledger entry.
- Preserve `BalanceAfter = BalanceBefore + QtyIn - QtyOut`.
- Use exact existing `LocationType`, `TransactionType`, `ItemCategory`, status, reference-document, and ID conventions.
- Coupled business record, ledger, and cache updates must succeed or fail atomically.

## Workflow

1. Trace the complete flow from controller/DTO through service, Prisma models, audit logs, cache update, and downstream reports.
2. Identify source/destination locations and whether one or multiple ledger entries are required.
3. Confirm available balance, duplicate/idempotency handling, cancellation/reversal behavior, and concurrent-write protection from existing code.
4. Preserve production release, BOM, shopping, delivery, stock-opname, and Poka-Yoke status rules; do not infer transitions.
5. Add tests for normal movement, insufficient stock, duplicate requests, rollback, and boundary quantities as applicable.
6. Apply Prisma, API, security, and quality skills.

## Safety

Never repair stock by directly editing cache quantities. Do not silently alter historical ledger rows or recompute history from current master data. Any reconciliation or reversal must follow an explicit, auditable product rule.
