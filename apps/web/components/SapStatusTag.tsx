/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
"use client";
import { Tag, Tooltip } from "antd";
export interface SapOperationStatus {
  status: string;
  events: { id: string; status: string; documentNumber: number | null }[];
}
export default function SapStatusTag({
  value,
}: {
  value?: SapOperationStatus;
}) {
  const status = value?.status ?? "NOT_CAPTURED";
  return (
    <Tooltip
      title={
        value?.events
          .map((e) => (e.documentNumber ? `SAP ${e.documentNumber}` : e.status))
          .join(", ") || "No SAP transaction captured for this operation."
      }
    >
      <Tag
        color={
          status === "SYNCED"
            ? "success"
            : ["FAILED", "RECONCILE", "BLOCKED"].includes(status)
              ? "error"
              : status === "NOT_CAPTURED"
                ? "default"
                : "processing"
        }
      >
        {status.replaceAll("_", " ")}
      </Tag>
    </Tooltip>
  );
}
