/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { Table } from "antd";
import type { MaterialUsage } from "@/store/features/traceability/types";
export default function MaterialUsageTable({
  data,
}: {
  data: MaterialUsage[];
}) {
  return (
    <Table
      size="small"
      className="small-table"
      rowKey="materialId"
      dataSource={data}
      pagination={false}
      scroll={{ x: 1100 }}
      columns={[
        { title: "Material", dataIndex: "materialId" },
        { title: "Name", dataIndex: "materialName" },
        { title: "Unit", dataIndex: "unitName" },
        { title: "Standard Required", dataIndex: "standardRequired" },
        { title: "Standard Issued", dataIndex: "standardIssued" },
        { title: "Replacement Issued", dataIndex: "replacementIssued" },
        { title: "Total Issued", dataIndex: "totalIssued" },
        { title: "Outstanding Replacement", dataIndex: "remainingReplacement" },
      ]}
    />
  );
}
