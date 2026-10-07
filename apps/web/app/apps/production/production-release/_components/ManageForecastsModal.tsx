/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
"use client";
import { useEffect, useState } from "react";
import { App, Form, Input, Modal, Segmented } from "antd";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  tagProductionReleaseForecasts,
  untagProductionReleaseForecasts,
  type ProductionReleaseEntity,
} from "@/store/features/production/productionRelease/productionReleaseSlice";
import ProductionOrderPicker from "./ProductionOrderPicker";
interface Props {
  open: boolean;
  release: ProductionReleaseEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}
export default function ManageForecastsModal({
  open,
  release,
  onClose,
  onSuccess,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ reason: string }>();
  const [mode, setMode] = useState<"tag" | "untag">("tag");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    setSelected([]);
    setSelecting(false);
    form.resetFields();
  }, [open, release?.Id, mode, form]);
  const submit = async () => {
    if (!release || selecting || submitting) return;
    if (!selected.length) {
      message.warning("Select at least one production order");
      return;
    }
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const thunk =
        mode === "tag"
          ? tagProductionReleaseForecasts
          : untagProductionReleaseForecasts;
      await dispatch(
        thunk({
          id: release.Id,
          demandIds: selected,
          reason: values.reason.trim(),
        }),
      ).unwrap();
      message.success(
        mode === "tag" ? "Forecasts tagged" : "Forecasts untagged",
      );
      setSelected([]);
      onClose();
      onSuccess();
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Modal
      title={`Manage Forecasts (${release?.SourceType ?? "PO"}) (${release?.Status ?? ""}) - ${release?.ReleaseNumber ?? ""}`}
      open={open}
      centered
      forceRender
      width={800}
      confirmLoading={submitting}
      okButtonProps={{ disabled: selecting }}
      onOk={() => void submit()}
      onCancel={onClose}
    >
      <Segmented
        block
        value={mode}
        options={[
          { label: "Tag Unlinked Forecasts", value: "tag" },
          { label: "Untag Linked Forecasts", value: "untag" },
        ]}
        onChange={(value) => setMode(value as "tag" | "untag")}
        style={{ marginBottom: 16 }}
      />
      {open && release && (
        <ProductionOrderPicker
          key={`${release.Id}:${mode}`}
          releaseId={release.Id}
          sourceType={release.SourceType}
          mode={mode}
          selected={selected}
          onChange={setSelected}
          onBusyChange={setSelecting}
        />
      )}
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="reason"
          label="Reason"
          rules={[
            { required: true, whitespace: true, message: "Reason is required" },
            { max: 500 },
          ]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
