/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
"use client";
import { useEffect, useState } from "react";
import { App, DatePicker, Form, Input, Modal, Segmented } from "antd";
import type { Dayjs } from "dayjs";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import { createProductionRelease } from "@/store/features/production/productionRelease/productionReleaseSlice";
import ProductionOrderPicker from "./ProductionOrderPicker";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}
interface Values {
  releaseNumber?: string;
  planDate: Dayjs;
  notes?: string;
}
export default function CreateProductionReleaseModal({
  visible,
  onClose,
  onSuccess,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [sourceType, setSourceType] = useState<"PO" | "NON_PO">("PO");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    if (!visible) {
      setSelected([]);
      setSelecting(false);
      form.resetFields();
    }
  }, [visible, form]);
  const submit = async () => {
    if (loading || selecting) return;
    try {
      const values = await form.validateFields();
      if (!selected.length) {
        message.warning("Select at least one production order");
        return;
      }
      setLoading(true);
      await dispatch(
        createProductionRelease({
          ...(values.releaseNumber?.trim()
            ? { releaseNumber: values.releaseNumber.trim() }
            : {}),
          planDate: values.planDate.toISOString(),
          notes: values.notes,
          sourceType,
          demandIds: selected,
        }),
      ).unwrap();
      message.success("Production release created successfully");
      setSelected([]);
      form.resetFields();
      onClose();
      onSuccess?.();
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      title="Create New Production Release"
      open={visible}
      onCancel={onClose}
      onOk={() => void submit()}
      centered
      forceRender
      confirmLoading={loading}
      okButtonProps={{ disabled: selecting }}
      width={800}
      zIndex={1050}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Source Type">
          <Segmented
            value={sourceType}
            options={[
              { label: "Forecast (PO)", value: "PO" },
              { label: "Forecast (Non PO)", value: "NON_PO" },
            ]}
            onChange={(value) => {
              setSourceType(value as "PO" | "NON_PO");
              setSelected([]);
              setSelecting(false);
            }}
          />
        </Form.Item>
        <Form.Item name="releaseNumber" label="Release Number (Optional)">
          <Input placeholder="Auto-generated if blank" />
        </Form.Item>
        <Form.Item
          name="planDate"
          label="Plan Date"
          rules={[{ required: true, message: "Please select plan date" }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item label="Production orders" required>
          {visible && (
            <ProductionOrderPicker
              key={sourceType}
              sourceType={sourceType}
              selected={selected}
              onChange={setSelected}
              onBusyChange={setSelecting}
            />
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
}
