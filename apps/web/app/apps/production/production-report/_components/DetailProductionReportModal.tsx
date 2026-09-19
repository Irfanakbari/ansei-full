"use client";

import { Descriptions, Modal, Tag } from "antd";
import type { ProductionReportEntity } from "@/store/features/production/productionReport/productionReportSlice";

interface Props {
  report: ProductionReportEntity | null;
  onClose: () => void;
}

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-";

export default function DetailProductionReportModal({ report, onClose }: Props) {
  return (
    <Modal title={`Production Report Detail · ${report?.fgData?.PartNumber ?? ""}`} open={Boolean(report)} onCancel={onClose} footer={null} centered width={780} destroyOnHidden>
      {report && (
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Finish Good">{report.fgData?.PartNumber || report.finishGoodId} - {report.fgData?.PartName || "-"}</Descriptions.Item>
          <Descriptions.Item label="PO Number">{report.forecastData?.PoId || report.forecastId || report.poNumber || "-"}</Descriptions.Item>
          <Descriptions.Item label="Manpower">{report.manPowerData?.Name || report.manPowerUid}</Descriptions.Item>
          <Descriptions.Item label="Part Type"><Tag>{report.recordType}</Tag></Descriptions.Item>
          <Descriptions.Item label="Production Date">{new Date(report.date).toLocaleDateString("id-ID")}</Descriptions.Item>
          <Descriptions.Item label="Production Time">{report.time || "-"}</Descriptions.Item>
          <Descriptions.Item label="Qty">{report.qty}</Descriptions.Item>
          <Descriptions.Item label="NG Qty">{report.ngQty}</Descriptions.Item>
          <Descriptions.Item label="Stop Time">{report.stopMinute} minutes</Descriptions.Item>
          <Descriptions.Item label="Production Stamp">{dateTime(report.productionStamp)}</Descriptions.Item>
          <Descriptions.Item label="Start">{dateTime(report.startStamp)}</Descriptions.Item>
          <Descriptions.Item label="End">{dateTime(report.endStamp)}</Descriptions.Item>
          <Descriptions.Item label="Validation"><Tag color={report.validatedAt ? "success" : "warning"}>{report.validatedAt ? "Validated" : "Pending"}</Tag></Descriptions.Item>
          <Descriptions.Item label="Validated By">{report.validatedBy || "-"}</Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
