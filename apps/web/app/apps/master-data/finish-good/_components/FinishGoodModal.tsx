/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  App,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
} from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store";
import {
  deleteFinishGood,
  FinishGoodEntity,
  updateFinishGood,
} from "@/store/features/master/finishGoodSlice";
import { formatDateTime } from "@/lib/utils/dateTime";

type FormValues = {
  partNumber: string;
  partNumberSAP?: string;
  partName: string;
  alias?: string;
  price?: number;
  isPassthrough?: boolean;
};
type Props = {
  open: boolean;
  data: FinishGoodEntity | null;
  onClose: () => void;
  onChanged: () => void;
};

export default function FinishGoodModal({
  open,
  data,
  onClose,
  onChanged,
}: Props) {
  const { message, modal } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm<FormValues>();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const saveInFlight = useRef(false);
  const deleteInFlight = useRef(false);

  useEffect(() => {
    if (!open) {
      setEditing(false);
    }
  }, [open]);
  useEffect(() => {
    if (open && editing && data)
      form.setFieldsValue({
        partNumber: data.PartNumber,
        partNumberSAP: data.PartNumberSAP ?? "",
        partName: data.PartName,
        alias: data.Alias ?? undefined,
        price: data.Price ?? undefined,
        isPassthrough: data.IsPassthrough,
      });
  }, [data, editing, form, open]);
  if (!data) return null;
  const getError = (error: unknown, fallback: string) =>
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : fallback;
  const close = () => {
    if (saving || deleting) return;
    if (editing) {
      form.resetFields();
      setEditing(false);
    }
    onClose();
  };
  const save = async () => {
    if (saveInFlight.current) return;
    try {
      const values = await form.validateFields();
      saveInFlight.current = true;
      setSaving(true);
      await dispatch(
        updateFinishGood({
          id: data.Id,
          data: {
            ...values,
            partNumberSAP: values.partNumberSAP?.trim() || null,
            isPassthrough: values.isPassthrough ?? false,
          },
        }),
      ).unwrap();
      message.success("Finish good updated successfully");
      form.resetFields();
      setEditing(false);
      onChanged();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error)
        return;
      message.error(getError(error, "Failed to update finish good"));
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };
  const remove = () =>
    modal.confirm({
      title: "Delete Finish Good?",
      icon: <DeleteOutlined />,
      content: `Delete finish good ${data.PartNumber}?`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      centered: true,
      onOk: async () => {
        if (deleteInFlight.current) return;
        deleteInFlight.current = true;
        setDeleting(true);
        try {
          await dispatch(deleteFinishGood(data.Id)).unwrap();
          message.success("Finish good deleted successfully");
          onChanged();
          onClose();
        } catch (error: unknown) {
          message.error(getError(error, "Failed to delete finish good"));
          throw error;
        } finally {
          deleteInFlight.current = false;
          setDeleting(false);
        }
      },
    });

  return (
    <Modal
      title={
        <Space>
          {editing ? <EditOutlined /> : <EyeOutlined />}
          <span>
            {editing ? "Edit" : "Detail"} Finish Good - {data.PartNumber}
          </span>
        </Space>
      }
      open={open}
      onCancel={close}
      centered
      width={550}
      destroyOnHidden
      forceRender
      mask={{ closable: !saving && !deleting }}
      closable={!saving && !deleting}
      footer={
        editing
          ? [
              <Button
                key="cancel"
                onClick={() => {
                  form.resetFields();
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>,
              <Button key="save" type="primary" onClick={save} loading={saving}>
                Save
              </Button>,
            ]
          : [
              <Button
                key="delete"
                danger
                icon={<DeleteOutlined />}
                onClick={remove}
                loading={deleting}
              >
                Delete
              </Button>,
              <Button
                key="edit"
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setEditing(true)}
                disabled={deleting}
              >
                Edit
              </Button>,
            ]
      }
    >
      {editing ? (
        <Form form={form} layout="vertical">
          <Form.Item
            name="partNumber"
            label="Part Number"
            extra="Note: Part Number cannot be modified if ledger transaction history exists."
            rules={[
              {
                required: true,
                message: "Please enter part number",
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="partNumberSAP"
            label="Part Number SAP"
            extra="Multiple Genba part numbers may map to the same SAP item."
          >
            <Input allowClear placeholder="Enter SAP part number (optional)" />
          </Form.Item>
          <Form.Item
            name="partName"
            label="Part Name"
            rules={[
              {
                required: true,
                message: "Please enter part name",
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="isPassthrough"
            label="Passthrough (skip Assy)"
            valuePropName="checked"
            extra="Applies to labels created in the next production release."
          >
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
          </Form.Item>
          <Form.Item name="alias" label="Alias">
            <Input />
          </Form.Item>
          <Form.Item name="price" label="Price">
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
            />
          </Form.Item>
          <Form.Item
            label="Qty"
            tooltip="Stok kuantitas tidak dapat diedit langsung. Mutasi stok dikelola melalui proses produksi dan inventaris."
            extra="Qty tidak dapat diedit secara manual"
          >
            <InputNumber value={data.Qty} disabled style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      ) : (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Part Number">
            {data.PartNumber}
          </Descriptions.Item>
          <Descriptions.Item label="Part Number SAP">
            {data.PartNumberSAP || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Part Name">
            {data.PartName}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            {data.IsActive ? (
              <span style={{ color: "#52c41a", fontWeight: "bold" }}>
                Active
              </span>
            ) : (
              <span style={{ color: "#ff4d4f", fontWeight: "bold" }}>
                Discontinued
              </span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Discontinue Date">
            {data.DiscontinueDate ? formatDateTime(data.DiscontinueDate) : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Passthrough">
            {data.IsPassthrough ? "Yes — skip Assy" : "No — Assy required"}
          </Descriptions.Item>
          <Descriptions.Item label="Alias">
            {data.Alias || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Price">
            {data.Price == null
              ? "-"
              : `Rp ${data.Price.toLocaleString("id-ID")}`}
          </Descriptions.Item>
          <Descriptions.Item label="Qty">{data.Qty}</Descriptions.Item>
          <Descriptions.Item label="Created Date">
            {formatDateTime(data.CreatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Created By">
            {data.CreatedByName || data.CreatedBy || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Updated Date">
            {formatDateTime(data.UpdatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Updated By">
            {data.UpdatedByName || data.UpdatedBy || "-"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
