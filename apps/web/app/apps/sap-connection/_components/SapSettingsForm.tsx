/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
"use client";
import { useEffect, useState } from "react";
import { App, Button, Form, Input, Switch } from "antd";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  fetchSapOverview,
  saveSapSettings,
  type SapOverview,
} from "@/store/features/system-administration/sapConnectionSlice";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
export default function SapSettingsForm({
  settings,
}: {
  settings: SapOverview["settings"];
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const { can } = usePhasePermission();
  const allowed =
    can("IPCS.SAP_MAPPING_UPDATE") && can("IPCS.INTEGRATION_RECOVER");
  useEffect(() => {
    form.setFieldsValue(settings);
  }, [form, settings]);
  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!allowed || saving}
      onFinish={async (
        values: SapOverview["settings"] & { reason: string },
      ) => {
        setSaving(true);
        try {
          await dispatch(saveSapSettings(values)).unwrap();
          message.success("SAP settings saved");
          form.setFieldValue("reason", "");
          await dispatch(fetchSapOverview());
        } catch (error) {
          message.error(String(error));
        } finally {
          setSaving(false);
        }
      }}
    >
      <Form.Item
        name="enabled"
        label="SAP synchronization"
        valuePropName="checked"
      >
        <Switch checkedChildren="On" unCheckedChildren="Paused" />
      </Form.Item>
      <Form.Item
        name="projectCode"
        label="Project Code"
        rules={[{ required: true, whitespace: true, max: 20 }]}
      >
        <Input maxLength={20} />
      </Form.Item>
      <Form.Item
        name="costCenter"
        label="Cost Center (dimension 1)"
        rules={[{ required: true, whitespace: true, max: 20 }]}
      >
        <Input maxLength={20} />
      </Form.Item>
      {allowed && (
        <>
          <Form.Item
            name="reason"
            label="Reason for change"
            rules={[{ required: true, whitespace: true, max: 500 }]}
          >
            <Input maxLength={500} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            Save settings
          </Button>
        </>
      )}
    </Form>
  );
}
