/* By Irfan Akbari Vuteq Indonesia - 2026-10-26 */
"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Breadcrumb,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Typography,
} from "antd";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchAssemblyProcessSetting,
  updateAssemblyProcessSetting,
} from "@/store/features/settings/assemblyProcessSettingSlice";

interface ReasonForm {
  reason: string;
}

export default function AssemblyProcessSettingPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const { data, loading, updating, error } = useSelector(
    (state: RootState) => state.assemblyProcessSetting,
  );
  const user = useSelector((state: RootState) => state.auth.user);
  const canUpdate = Boolean(
    user?.RoleName === "SUPER" ||
      user?.GlobalRoles?.includes("SUPER_ADMINISTRATOR") ||
      user?.Permission?.some(
        (permission) =>
          permission === "SUPER" ||
          permission === "*" ||
          permission === "IPCS.MASTER_UPDATE",
      ),
  );
  const [form] = Form.useForm<ReasonForm>();
  const [nextValue, setNextValue] = useState<boolean | null>(null);

  useEffect(() => {
    void dispatch(fetchAssemblyProcessSetting());
  }, [dispatch]);

  const save = async () => {
    const values = await form.validateFields();
    if (nextValue === null || !data || !canUpdate) return;
    await dispatch(
      updateAssemblyProcessSetting({
        bypassAllAssembly: nextValue,
        reason: values.reason.trim(),
        expectedUpdatedAt: data.UpdatedAt,
      }),
    ).unwrap();
    setNextValue(null);
    form.resetFields();
    void message.success("Assembly process setting updated");
  };

  return (
    <Card variant="borderless" loading={loading}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "System Administration" },
          { title: "Assembly Process" },
        ]}
      />
      {error && <Alert type="error" showIcon title={error} />}
      <Typography.Title level={4}>Assembly Process</Typography.Title>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title="Snapshot behavior"
        description="Changes apply only to labels created after the setting is read during label creation. Existing labels are unchanged."
      />
      {!canUpdate && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Read-only access"
          description="IPCS.MASTER_UPDATE permission is required to change this setting."
        />
      )}
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Bypass All Assembly Process">
          <Space>
            <Switch
              checked={data?.BypassAllAssembly ?? false}
              loading={updating}
              disabled={!data || updating || !canUpdate}
              checkedChildren="Enabled"
              unCheckedChildren="Disabled"
              onChange={setNextValue}
            />
            <Typography.Text type="secondary">
              Non-passthrough labels remain assembly-required and receive an
              automatic completed session after shopping completion.
            </Typography.Text>
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Last changed by">
          {data?.UpdatedBy ?? "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Last reason">
          {data?.ChangeReason ?? "-"}
        </Descriptions.Item>
      </Descriptions>
      <Modal
        open={nextValue !== null}
        centered
        forceRender
        title={`${nextValue ? "Enable" : "Disable"} assembly bypass?`}
        okText="Confirm change"
        confirmLoading={updating}
        onCancel={() => {
          setNextValue(null);
          form.resetFields();
        }}
        onOk={() => void save().catch(() => undefined)}
      >
        <Alert
          type={nextValue ? "warning" : "info"}
          showIcon
          style={{ marginBottom: 16 }}
          title="This change affects newly created labels only."
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label="Reason"
            rules={[
              { required: true, message: "Reason is required" },
              { min: 3, message: "Reason must be at least 3 characters" },
              { max: 500, message: "Reason must not exceed 500 characters" },
            ]}
          >
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
