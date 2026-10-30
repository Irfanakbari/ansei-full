/* By Irfan Akbari Vuteq Indonesia - 2026-10-29 */
"use client";

import React from "react";
import { Modal, Descriptions, Tag, Space, Button } from "antd";
import { InfoCircleOutlined, RollbackOutlined } from "@ant-design/icons";
import type { TransferHistoryItem } from "@/store/features/warehouse/transfer/transferSlice";
import { formatDateTime } from "@/lib/utils/dateTime";

interface DetailTransferModalProps {
  visible: boolean;
  onClose: () => void;
  record: TransferHistoryItem | null;
  onRevertClick?: (record: TransferHistoryItem) => void;
  canRevert?: boolean;
}

export default function DetailTransferModal({
  visible,
  onClose,
  record,
  onRevertClick,
  canRevert,
}: DetailTransferModalProps) {
  if (!record) return null;

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined style={{ color: "#1677ff" }} />
          <span>Transfer Detail - {record.referenceDoc}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      centered
      width={650}
      destroyOnHidden
      zIndex={1050}
      footer={[
        record.status === "COMPLETED" && canRevert ? (
          <Button
            key="revert"
            danger
            icon={<RollbackOutlined />}
            onClick={() => {
              onClose();
              onRevertClick?.(record);
            }}
          >
            Revert Transfer
          </Button>
        ) : null,
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <Descriptions bordered size="small" column={2} style={{ marginTop: 12 }}>
        <Descriptions.Item label="Reference Doc" span={2}>
          <code>{record.referenceDoc}</code>
        </Descriptions.Item>
        <Descriptions.Item label="Part Number">
          <b>{record.materialId}</b>
        </Descriptions.Item>
        <Descriptions.Item label="Part Name">
          {record.partName}
        </Descriptions.Item>
        <Descriptions.Item label="Rack Location">
          {record.rackLocation || "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Transfer Quantity">
          <Tag color="blue" style={{ fontSize: 13, padding: "2px 8px" }}>
            {record.qty}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Warehouse Balance">
          {record.warehouseBefore} &rarr; <b>{record.warehouseAfter}</b>
        </Descriptions.Item>
        <Descriptions.Item label="Rack Balance">
          {record.rackBefore} &rarr; <b>{record.rackAfter}</b>
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={record.status === "COMPLETED" ? "green" : "red"}>
            {record.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Transfer Date">
          {formatDateTime(record.transactionDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Transferred By" span={2}>
          {record.createdByName || record.createdBy || "-"}
        </Descriptions.Item>
        {record.status === "REVERTED" ? (
          <>
            <Descriptions.Item label="Reverted Date">
              {formatDateTime(record.revertedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Reverted By">
              {record.revertedByName || record.revertedBy || "-"}
            </Descriptions.Item>
          </>
        ) : null}
        <Descriptions.Item label="Notes" span={2}>
          {record.notes || "-"}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}
