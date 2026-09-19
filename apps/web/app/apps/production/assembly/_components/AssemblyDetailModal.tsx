"use client";

import { Descriptions, Modal, Tag } from "antd";
import type { AssemblySession } from "@/store/features/production/assembly/assemblySlice";

interface Props {
  session: AssemblySession | null;
  onClose: () => void;
}

const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    : "-";

const duration = (session: AssemblySession) => {
  if (!session.EndedAt) return "-";
  const minutes = Math.max(0, Math.floor((Date.parse(session.EndedAt) - Date.parse(session.StartedAt)) / 60000));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

export default function AssemblyDetailModal({ session, onClose }: Props) {
  return (
    <Modal title={`Assembly Detail · ${session?.LabelData.LabelNumber ?? ""}`} open={Boolean(session)} onCancel={onClose} footer={null} centered width={760} destroyOnHidden>
      {session && (
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Release Number">{session.LabelData.ProductionRelease?.ReleaseNumber ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="PO Number">{session.LabelData.ForecastId}</Descriptions.Item>
          <Descriptions.Item label="Label Number"><code>{session.LabelData.LabelNumber}</code></Descriptions.Item>
          <Descriptions.Item label="Finish Good">{session.LabelData.FinishGoodId} - {session.LabelData.PartData.PartName}</Descriptions.Item>
          <Descriptions.Item label="Manpower">{session.ManPowerName}</Descriptions.Item>
          <Descriptions.Item label="Qty/Box">{session.LabelData.QtyThisBox}</Descriptions.Item>
          <Descriptions.Item label="Status"><Tag>{session.Status.replace("_", " ")}</Tag></Descriptions.Item>
          <Descriptions.Item label="Duration (HH:mm)">{duration(session)}</Descriptions.Item>
          <Descriptions.Item label="Started At">{formatDateTime(session.StartedAt)}</Descriptions.Item>
          <Descriptions.Item label="Ended At">{formatDateTime(session.EndedAt)}</Descriptions.Item>
          <Descriptions.Item label="Cancelled By">{session.CancelledBy || "-"}</Descriptions.Item>
          <Descriptions.Item label="Cancellation Reason" span={2}>{session.CancelReason || "-"}</Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
