/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, App, Form, Modal, Select } from "antd";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  fetchAssemblyCreateOptions,
  startInternalAssembly,
  type AssemblyCreateOptions,
} from "@/store/features/production/assembly/assemblySlice";
import { createAssemblyRequestId } from "@/store/features/production/assembly/requestId";

export default function CreateAssemblyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ labelNumber: string; manPowerNik: string }>();
  const [options, setOptions] = useState<AssemblyCreateOptions>({
    labels: [],
    manpower: [],
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      dispatch(fetchAssemblyCreateOptions(search))
        .unwrap()
        .then((data) => {
          if (current) {
            setOptions(data);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (current) {
            setOptions({ labels: [], manpower: [] });
            setError(String(err));
          }
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [dispatch, search]);
  const submit = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const values = await form.validateFields();
      const key = JSON.stringify(values);
      if (request.current?.key !== key)
        request.current = { key, id: createAssemblyRequestId() };
      setSaving(true);
      await dispatch(
        startInternalAssembly({ ...values, requestId: request.current.id }),
      ).unwrap();
      message.success("Assembly started");
      onCreated();
    } catch (err) {
      if (typeof err === "string" || err instanceof Error)
        message.error(String(err));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      title="Create Assembly"
      open
      centered
      onCancel={() => {
        if (!pending.current) onClose();
      }}
      onOk={() => void submit()}
      okText="Start Assembly"
      confirmLoading={saving}
      okButtonProps={{ disabled: loading || Boolean(error) }}
      closable={!saving}
      cancelButtonProps={{ disabled: saving }}
    >
      {error && <Alert type="error" title={error} showIcon className="mb-4" />}
      <Form form={form} layout="vertical" disabled={saving}>
        <Form.Item
          name="labelNumber"
          label="Label"
          rules={[{ required: true, message: "Select a ready label" }]}
          extra="Only labels ready for assembly are listed. Search to find more labels (up to 100 results)."
        >
          <Select
            showSearch={{ onSearch: setSearch, filterOption: false }}
            loading={loading}
            placeholder="Select or search label number"
            options={options.labels.map((label) => ({
              value: label.LabelNumber,
              label: `${label.LabelNumber} · ${label.FinishGoodId} · ${label.PartData.PartName} · ${label.QtyThisBox} pcs`,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="manPowerNik"
          label="Manpower"
          rules={[{ required: true, message: "Select manpower" }]}
          extra="Active manpower without an ongoing assembly session."
        >
          <Select
            showSearch={{ optionFilterProp: "label" }}
            loading={loading}
            placeholder="Select manpower"
            options={options.manpower.map((operator) => ({
              value: operator.Nik,
              label: `${operator.Nik} · ${operator.Name}`,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
