/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState } from "react";
import { Modal, Form, Input, InputNumber, Switch, App } from "antd";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store";
import { createFinishGood } from "@/store/features/master/finishGoodSlice";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateFinishGoodModal: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm<Parameters<typeof createFinishGood>[0]>();
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        partNumber: values.partNumber,
        partNumberSAP: values.partNumberSAP?.trim() || null,
        partName: values.partName,
        alias: values.alias,
        price: values.price,
        isPassthrough: values.isPassthrough ?? false,
        qty: values.qty || 0,
      };

      await dispatch(createFinishGood(payload)).unwrap();
      message.success("Finish good created successfully");
      onSuccess?.();
      form.resetFields();
      onClose();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error)
        return;
      message.error(
        (typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : undefined) || "Failed to create finish good",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Create New Finish Good"
      open={visible}
      onOk={handleOk}
      centered={true}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={loading}
      destroyOnHidden
      forceRender
      width={500}
      zIndex={1050}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ isPassthrough: false }}
      >
        <Form.Item
          name="partNumber"
          label="Part Number"
          rules={[{ required: true, message: "Please enter part number" }]}
        >
          <Input placeholder="Enter part number" />
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
          rules={[{ required: true, message: "Please enter part name" }]}
        >
          <Input placeholder="Enter part name" />
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
          <Input placeholder="Enter alias (optional)" />
        </Form.Item>
        <Form.Item name="price" label="Price">
          <InputNumber
            placeholder="0"
            min={0}
            style={{ width: "100%" }}
            formatter={(value) =>
              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
            }
          />
        </Form.Item>
        <Form.Item name="qty" label="Qty">
          <InputNumber placeholder="0" min={0} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateFinishGoodModal;
