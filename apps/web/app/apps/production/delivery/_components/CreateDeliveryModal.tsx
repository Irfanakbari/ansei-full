/*By Irfan Akbari Vuteq Indonesia - 2026-06-10*/
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Modal, Form, Select, App, Button, Space } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import {
  createDelivery,
  CreateDeliveryRequest,
  fetchPalletOptions,
} from "@/store/features/production/delivery/deliverySlice";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateDeliveryModal: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { message: antMessage } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const { data: preDeliveryData } = useSelector(
    (state: RootState) => state.preDelivery,
  );
  const {
    data: deliveryData,
    palletOptions,
    loadingPallets,
  } = useSelector((state: RootState) => state.delivery);

  useEffect(() => {
    if (visible) {
      void dispatch(fetchPalletOptions());
    }
  }, [visible, dispatch]);

  // DeliveryHistory.LabelDataId stores the label number.
  const deliveredLabelNumbers = useMemo(() => {
    return new Set(deliveryData.map((d) => d.labelNumber));
  }, [deliveryData]);

  // Filter preDelivery to only show labels that can be delivered
  const availableLabels = useMemo(() => {
    // Only show labels that are scanned (ready for delivery)
    return preDeliveryData.filter((label) => label.scanned);
  }, [preDeliveryData]);

  const handleFinish = async (values: CreateDeliveryRequest) => {
    try {
      setLoading(true);
      const resultAction = await dispatch(createDelivery(values));

      if (createDelivery.fulfilled.match(resultAction)) {
        antMessage.success("Delivery created successfully");
        form.resetFields();
        onClose();
        onSuccess?.();
      } else if (createDelivery.rejected.match(resultAction)) {
        const errorMsg = resultAction.payload as string;
        antMessage.error(errorMsg || "Delivery failed");
      }
    } catch (error: any) {
      antMessage.error(error?.message || "Delivery failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Create New Delivery"
      open={visible}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      footer={null}
      centered
      width={600}
      zIndex={1050}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="labelNumber"
          label="Label Number"
          rules={[{ required: true, message: "Please select Label Number" }]}
          extra="Select label to deliver. Labels already delivered cannot be selected."
        >
          <Select
            placeholder="Select Label Number"
            showSearch={{ optionFilterProp: "label" }}
            size="large"
            options={availableLabels.map((label) => ({
              value: label.labelNumber,
              label: `${label.labelNumber} · ${label.finishGoodName} · Qty ${label.qtyThisBox} · Order ${label.forecastId}`,
              disabled: deliveredLabelNumbers.has(label.labelNumber),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="palletNumber"
          label="Pallet ID (Optional)"
          extra="Select Pallet ID associated with this delivery (from Pallet API)."
        >
          <Select
            placeholder="Select Pallet ID"
            allowClear
            showSearch={{ optionFilterProp: "label" }}
            size="large"
            loading={loadingPallets}
            options={palletOptions.map((pallet) => ({
              value: pallet.kode,
              label: `${pallet.kode}${pallet.name ? ` · ${pallet.name}` : ""}${pallet.partName ? ` (${pallet.partName})` : ""}`,
            }))}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
          <Space>
            <Button
              onClick={() => {
                form.resetFields();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Delivery
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateDeliveryModal;
