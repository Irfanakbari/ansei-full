# Delivery Report (Monthly)

`GET /v1/report/delivery-monthly?month=YYYY-MM` returns an XLSX attachment containing **Forecast**, **Delivered**, and **Received**. It uses the existing `IPCS.REPORT_READ` permission. The Report page opens a month picker before downloading through a typed Redux thunk and `fetchWithAuth`.

## Data rules

- Forecast uses the read-only `ProductionOrder` projection, including PO and non-PO demand, filtered by `DeliveryDate` using the existing UTC date-only contract. Quantity remains the planned quantity.
- Actual Date is populated only when cumulative delivery reaches the planned quantity. Remarks show delivered/planned quantities and the latest actual date, as of the end of the selected month. Partial deliveries never turn the entire planned quantity into actual output.
- Delivered uses the planned Forecast quantity on its `DeliveryDate` after cumulative `DeliveryHistory.Qty` reaches the Forecast quantity. Partial orders remain zero, and actual shipment dates do not move the quantity to another daily column.
- Received uses closed Incoming documents whose `ApprovedAt` falls in Asia/Jakarta during the month. Every Incoming material is one row, and `Hashtag` is the Incoming `PoId` / PO Number.
- All worksheets are queried in one read-only RepeatableRead transaction. No stock, audit, master-data, SAP, or source workbook writes occur.
- Only the selected calendar month's 28–31 days are counted. The September reference's hidden October columns do not add next-month quantities.

## Reference layout and mapping

`delivery-monthly.template.ts` contains presentation metadata inspected from **SEPTEMBER 2026 REPORT (version 1).xlsb** on 2026-10-10: part order, car names, destination lookup, row dimensions, and unit-summary formulas. It contains no copied operational quantities.

The four reference Delivered sections, zero-activity catalog rows, header colors, weekend colors, frozen panes, and vehicle-unit summaries are preserved. The reference Parts Received presentation is retained as the compact Received log. Daily section totals count parts; the vehicle-unit summaries deliberately use the reference's selected-part formulas and are not a sum of all part quantities. Known active part names come from the current order's master relation.

The current schema has no car-name/report-destination master fields. Receiving areas use the reference DB-sheet lookup or an explicitly matching destination. Unrecognized receiving areas and parts appear in an additional section marked **UNMAPPED** rather than being silently omitted or assigned a guessed car. Maintain the catalog and area lookup when business mapping changes; do not add inferred mappings from part-number suffixes.

## Validation

- `pnpm --filter @ansei/api test --runInBand delivery-monthly.spec.ts report.controller.spec.ts report.service.spec.ts`
- `pnpm lint:api` and `pnpm lint:web`
- `pnpm --filter @ansei/api build` and `pnpm --filter @ansei/web build`
- `pnpm prisma:validate`
- Scoped `git diff --check`

The focused tests cover month validation, Jakarta Incoming boundaries, completed versus partial Forecast delivery, PO/non-PO data, destination separation, unknown mappings, leap years, empty months, formula cached results, binary transport, and permission metadata. Tests use mocks and synthetic workbooks; they do not establish production database or browser/SSO integration coverage.

Synthetic visual fixtures can be regenerated with `node artifacts/delivery-monthly-qa/create-preview.cjs`. Temporary print settings affect only the QA copies, not the application download.
