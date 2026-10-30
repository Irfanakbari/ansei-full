/* By Irfan Akbari Vuteq Indonesia - 2026-10-29 */
"use client";

import React, { useRef, useState } from "react";
import { Modal, Form, Input, App, Descriptions, Alert, Space } from "antd";
import { RollbackOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  revertTransfer,
  type TransferHistoryItem,
} from "@/store/features/warehouse/transfer/transferSlice";
import { formatDateTime } from "@/lib/utils/dateTime";

interface RevertTransferModalProps {
  visible: boolean;
  onClose: () => void;
  record: TransferHistoryItem | null;
  onSuccess: () => void;
}

export default function RevertTransferModal({
  visible,
  onClose,
  record,
  onSuccess,
}: RevertTransferModalProps) {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  if (!record) return null;

  const handleOk = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const values = await form.validateFields();
      setLoading(true);

      const result = await dispatch(
        revertTransfer({
          referenceDoc: record.referenceDoc,
          reason: values.reason,
        }),
      );

      if (revertTransfer.rejected.match(result)) {
        throw new Error(
          (result.payload as string) || "Failed to revert transfer",
        );
      }

      message.success(
        `Transfer ${record.referenceDoc} reverted successfully. ${record.qty} returned to warehouse.`,
      );
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as Error;
      if (err?.message?.includes("validateFields")) return;
      message.error(err?.message || String(error) || "Failed to revert transfer");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <RollbackOutlined style={{ color: "#ff4d4f" }} />
          <span>Revert Transfer to Rack</span>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      centered
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Revert Transfer"
      okButtonProps={{ danger: true }}
      width={600}
      destroyOnHidden
      zIndex={1050}
    >
      <Alert
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="Stock Reversal Confirmation"
        description={`Reverting this transfer will atomically deduct ${record.qty} units from Rack and return them back to Warehouse for material ${record.materialId}.`}
        style={{ marginBottom: 16 }}
      />

      <Descriptions
        bordered
        size="small"
        column={1}
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="Reference Doc">
          <code>{record.referenceDoc}</code>
        </Descriptions.Item>
        <Descriptions.Item label="Part Number">
          <b>{record.materialId}</b>
        </Descriptions.Item>
        <Descriptions.Item label="Part Name">
          {record.partName}
        </Descriptions.Item>
        <Descriptions.Item label="Transferred Qty">
          <b style={{ color: "#1677ff" }}>{record.qty} units</b>
        </Descriptions.Item>
        <Descriptions.Item label="Transfer Date">
          {formatDateTime(record.transactionDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Transferred By">
          {record.createdByName || record.createdBy || "-"}
        </Descriptions.Item>
        {record.notes ? (
          <Descriptions.Item label="Original Notes">
            {record.notes}
          </Descriptions.Item>
        ) : null}
      </Descriptions>

      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="reason"
          label="Reason for Reverting"
          rules={[
            {
              required: true,
              message: "Please enter the reason for reverting this transfer",
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="e.g. Salah input quantity, double transfer, salah pilih part..."
            maxLength={500}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
