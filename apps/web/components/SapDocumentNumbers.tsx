/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
"use client";
import { Button, Popover, Tag, Tooltip } from "antd";

export interface SapDocumentSummary {
  key: string;
  kind: string;
  documentNumber: number | null;
  references: { partNumber: string; demandId: string | null }[];
  statuses: string[];
}
const labels: Record<string, string> = {
  SYNCED: "Synced",
  PENDING: "Pending",
  PROCESSING: "Processing",
  FAILED: "Failed",
  BLOCKED: "Blocked",
  RECONCILE: "Perlu Rekonsiliasi",
  UNVERIFIED: "Belum terverifikasi",
  CANCELLED: "Cancelled",
};
const kinds: Record<string, string> = {
  GOODS_RECEIPT: "Goods Receipt",
  PRODUCTION_ORDER: "Production Order",
  SALES_ORDER: "Sales Order",
  INVENTORY_COUNTING: "Inventory Counting",
  INVENTORY_POSTING: "Inventory Posting",
};
const color = (status: string) =>
  ["FAILED", "BLOCKED", "RECONCILE"].includes(status)
    ? "error"
    : status === "SYNCED"
      ? "success"
      : status === "UNVERIFIED"
        ? "warning"
        : "processing";

export default function SapDocumentNumbers({
  value = [],
}: {
  value?: SapDocumentSummary[];
}) {
  if (!value.length)
    return (
      <Tooltip title="Belum ada dokumen SAP">
        <span>—</span>
      </Tooltip>
    );
  const numbered = value.filter((document) => document.documentNumber !== null);
  const counts = new Map<string, number>();
  value.forEach((document) =>
    new Set(document.statuses).forEach((status) => {
      if (status !== "SYNCED")
        counts.set(status, (counts.get(status) ?? 0) + 1);
    }),
  );
  const detail = (
    <div style={{ maxHeight: 320, maxWidth: 480, overflow: "auto" }}>
      {value.map((document) => (
        <div key={document.key} style={{ padding: "6px 0" }}>
          <strong>
            {kinds[document.kind] ?? document.kind}:{" "}
            {document.documentNumber ?? "—"}
          </strong>
          {document.references.map((ref) => (
            <div key={`${ref.partNumber}:${ref.demandId}`}>
              {ref.partNumber}
              {ref.demandId ? ` · Forecast: ${ref.demandId}` : ""}
            </div>
          ))}
          <div>
            {document.statuses.map((status) => (
              <Tag key={status} color={color(status)}>
                {labels[status] ?? status}
              </Tag>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 4,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {numbered.slice(0, 2).map((document) => (
        <Popover
          key={document.key}
          content={detail}
          title="SAP Documents"
          trigger="click"
        >
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontSize: "inherit" }}
            aria-label={`SAP document ${document.documentNumber}`}
          >
            {document.documentNumber}
          </Button>
        </Popover>
      ))}
      {numbered.length > 2 && (
        <Popover content={detail} title="SAP Documents" trigger="click">
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontSize: "inherit" }}
            aria-label="Show all SAP documents"
          >
            +{numbered.length - 2}
          </Button>
        </Popover>
      )}
      {[...counts].map(([status, count]) => (
        <Popover
          key={status}
          content={detail}
          title="SAP Documents"
          trigger={["hover", "click"]}
        >
          <Button
            type="text"
            size="small"
            style={{ padding: 0, height: "auto" }}
          >
            <Tag
              color={color(status)}
              style={{ margin: 0, fontSize: "inherit" }}
            >
              {count > 1 || numbered.length ? `${count} ` : ""}
              {labels[status] ?? status}
            </Tag>
          </Button>
        </Popover>
      ))}
    </div>
  );
}
