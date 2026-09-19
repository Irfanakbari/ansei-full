/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { Alert, Table, Tag } from "antd";
import type { BomSnapshot } from "@/store/features/traceability/types";
export default function SnapshotTable({
  snapshot,
}: {
  snapshot: BomSnapshot | null;
}) {
  if (!snapshot)
    return (
      <Alert
        type="warning"
        showIcon
        title="Legacy — historical BOM unavailable"
        description="The current master BOM is not evidence of this order's historical requirements."
      />
    );
  return (
    <>
      <p>
        <Tag>BOM revision {snapshot.Revision.Revision}</Tag>
        <Tag>Snapshot {snapshot.Version}</Tag>{" "}
        {new Date(snapshot.CreatedAt).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
        })}
      </p>
      <Table
        size="small"
        className="small-table"
        rowKey="Id"
        dataSource={snapshot.Lines}
        pagination={false}
        scroll={{ x: 650 }}
        columns={[
          { title: "Material", dataIndex: "PartNumber" },
          { title: "Name", dataIndex: "PartName" },
          { title: "Unit", dataIndex: "UnitName" },
          { title: "Qty / Unit", dataIndex: "QtyPerUnit" },
          { title: "Standard Required", dataIndex: "RequiredQty" },
        ]}
      />
    </>
  );
}
