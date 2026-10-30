/* By Irfan Akbari Vuteq Indonesia - 2026-10-29 */
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Form,
  InputNumber,
  Input,
  Select,
  App,
  Descriptions,
  Alert,
  Space,
  Tag,
} from "antd";
import { SwapOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchMaterial,
  type MaterialEntity,
} from "@/store/features/master/materialSlice";
import { transferToRack } from "@/store/features/warehouse/transfer/transferSlice";

interface CreateTransferModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateTransferModal({
  visible,
  onClose,
  onSuccess,
}: CreateTransferModalProps) {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const materials = useSelector((state: RootState) => state.material.data);
  const materialsLoading = useSelector(
    (state: RootState) => state.material.loading,
  );

  const [selectedPartNumber, setSelectedPartNumber] = useState<string | null>(
    null,
  );
  const [previewQty, setPreviewQty] = useState<number>(0);

  useEffect(() => {
    if (visible) {
      dispatch(fetchMaterial({ page: 1, limit: 1000 }));
      form.resetFields();
      setSelectedPartNumber(null);
      setPreviewQty(0);
    }
  }, [visible, dispatch, form]);

  const selectedMaterial: MaterialEntity | undefined = materials.find(
    (m) => m.PartNumber === selectedPartNumber,
  );

  const handleMaterialChange = (partNumber: string) => {
    setSelectedPartNumber(partNumber);
    form.setFieldsValue({ qty: undefined });
    setPreviewQty(0);
  };

  const handleQtyChange = (val: number | null) => {
    setPreviewQty(val || 0);
  };

  const handleOk = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const values = await form.validateFields();
      if (!selectedMaterial) {
        message.error("Please select a material first");
        return;
      }

      if (values.qty > selectedMaterial.QtyWarehouse) {
        message.error(
          `Transfer quantity cannot exceed warehouse stock (${selectedMaterial.QtyWarehouse})`,
        );
        return;
      }

      setLoading(true);
      const result = await dispatch(
        transferToRack({
          partNumber: selectedMaterial.PartNumber,
          qty: values.qty,
          notes: values.notes,
        }),
      );

      if (transferToRack.rejected.match(result)) {
        throw new Error(
          (result.payload as string) || "Failed to transfer to rack",
        );
      }

      message.success(
        `Transferred ${values.qty} of ${selectedMaterial.PartNumber} to rack successfully`,
      );
      form.resetFields();
      setSelectedPartNumber(null);
      setPreviewQty(0);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as Error;
      if (err?.message?.includes("validateFields")) return;
      message.error(
        err?.message || String(error) || "Failed to transfer to rack",
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedPartNumber(null);
    setPreviewQty(0);
    onClose();
  };

  const warehouseAfter = selectedMaterial
    ? selectedMaterial.QtyWarehouse - previewQty
    : 0;
  const rackAfter = selectedMaterial
    ? selectedMaterial.QtyRack + previewQty
    : 0;

  return (
    <Modal
      title={
        <Space>
          <SwapOutlined style={{ color: "#1677ff" }} />
          <span>Create Transfer to Rack</span>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      centered
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
      destroyOnHidden
      zIndex={1050}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="partNumber"
          label="Select Material"
          rules={[{ required: true, message: "Please select a material" }]}
        >
          <Select
            showSearch
            placeholder="Search by part number or name..."
            loading={materialsLoading}
            onChange={handleMaterialChange}
            filterOption={(input, option) => {
              const label = String(option?.label ?? "").toLowerCase();
              return label.includes(input.toLowerCase());
            }}
            options={materials
              .filter((m) => m.IsActive)
              .map((m) => ({
                value: m.PartNumber,
                label: `${m.PartNumber} - ${m.PartName} (WH: ${m.QtyWarehouse}, Rack: ${m.QtyRack})`,
              }))}
          />
        </Form.Item>

        {selectedMaterial && (
          <>
            <Descriptions
              bordered
              size="small"
              column={2}
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="Part Number">
                <code>{selectedMaterial.PartNumber}</code>
              </Descriptions.Item>
              <Descriptions.Item label="Part Name">
                {selectedMaterial.PartName}
              </Descriptions.Item>
              <Descriptions.Item label="Rack Location">
                {selectedMaterial.RackLocation || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Unit">
                {selectedMaterial.SatuanData?.Name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Stock Warehouse">
                <Tag color="blue">{selectedMaterial.QtyWarehouse}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Stock Rack">
                <Tag color="green">{selectedMaterial.QtyRack}</Tag>
              </Descriptions.Item>
            </Descriptions>

            {selectedMaterial.QtyWarehouse <= 0 ? (
              <Alert
                type="warning"
                showIcon
                message="Warehouse stock is 0. Transfer cannot be performed."
                style={{ marginBottom: 16 }}
              />
            ) : null}
          </>
        )}

        <Form.Item
          name="qty"
          label="Transfer Quantity"
          rules={[
            { required: true, message: "Please enter transfer quantity" },
            {
              type: "number",
              min: 1,
              message: "Quantity must be at least 1",
            },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            placeholder="Enter quantity to transfer"
            min={1}
            max={selectedMaterial?.QtyWarehouse ?? undefined}
            disabled={!selectedMaterial || selectedMaterial.QtyWarehouse <= 0}
            onChange={handleQtyChange}
          />
        </Form.Item>

        {selectedMaterial && previewQty > 0 && (
          <div
            style={{
              padding: "10px 14px",
              background: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Preview Stock After Transfer:
            </div>
            <Space size="large">
              <span>
                Warehouse:{" "}
                <b style={{ color: warehouseAfter < 0 ? "#ff4d4f" : "#1677ff" }}>
                  {warehouseAfter}
                </b>
              </span>
              <span>
                Rack: <b style={{ color: "#52c41a" }}>{rackAfter}</b>
              </span>
            </Space>
          </div>
        )}

        <Form.Item name="notes" label="Notes (Optional)">
          <Input.TextArea
            rows={2}
            placeholder="Enter transfer notes or reasons..."
            maxLength={500}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
