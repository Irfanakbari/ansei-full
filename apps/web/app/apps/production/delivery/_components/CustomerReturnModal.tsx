/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
"use client";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
} from "antd";
import type { AppDispatch } from "@/store";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import {
  fetchCustomerReturns,
  recordCustomerReturn,
  type CustomerReturnRow,
  type DeliveryEntity,
} from "@/store/features/production/delivery/deliverySlice";
export default function CustomerReturnModal({
  delivery,
  onClose,
}: {
  delivery?: DeliveryEntity;
  onClose: () => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const { can } = usePhasePermission();
  const [rows, setRows] = useState<CustomerReturnRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string>();
  const [form] = Form.useForm<{ quantity: number; reason: string }>();
  useEffect(() => {
    let active = true;
    form.resetFields();
    setError(undefined);
    if (delivery) {
      void dispatch(fetchCustomerReturns(delivery.id))
        .unwrap()
        .then((result) => {
          if (active) setRows(result);
        })
        .catch((failure) => {
          if (active) setError(String(failure));
        });
    }
    return () => {
      active = false;
    };
  }, [delivery, dispatch, form, reload]);
  async function submit(returnId?: string) {
    if (!delivery || saving) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await dispatch(
        recordCustomerReturn({ ...values, deliveryId: delivery.id, returnId }),
      ).unwrap();
      message.success(
        returnId ? "Returned FG scrap recorded." : "Customer return recorded.",
      );
      setReload((v) => v + 1);
    } catch (failure) {
      if (!(failure && typeof failure === "object" && "errorFields" in failure))
        message.error(String(failure));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      centered
      forceRender
      open={!!delivery}
      title="Customer return and returned FG scrap"
      width={850}
      footer={null}
      onCancel={() => {
        if (!saving) onClose();
      }}
    >
      <Space orientation="vertical" className="w-full">
        <Alert
          type="info"
          title="Return adds FG stock. Scrap removes only the returned quantity; the original delivery history remains intact."
        />
        {error && <Alert type="error" title={error} />}
        <Form form={form} layout="vertical">
          <Form.Item
            name="quantity"
            label="Quantity"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} precision={0} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, whitespace: true, max: 500 }]}
          >
            <Input.TextArea maxLength={500} />
          </Form.Item>
        </Form>
        {can("IPCS.DELIVERY_CREATE") && (
          <Button
            type="primary"
            loading={saving}
            onClick={() => {
              void submit();
            }}
          >
            Record Return
          </Button>
        )}
        <Table<CustomerReturnRow>
          rowKey="Id"
          dataSource={rows}
          size="small"
          columns={[
            { title: "Returned", dataIndex: "Quantity" },
            { title: "Scrapped", dataIndex: "ScrappedQuantity" },
            { title: "Reason", dataIndex: "Reason" },
            {
              title: "Action",
              render: (_, row) =>
                can("IPCS.MATERIAL_NG_REVIEW") && (
                  <Button
                    disabled={saving || row.ScrappedQuantity >= row.Quantity}
                    onClick={() => {
                      void submit(row.Id);
                    }}
                  >
                    Scrap Returned FG
                  </Button>
                ),
            },
          ]}
          pagination={{ pageSize: 5 }}
        />
      </Space>
    </Modal>
  );
}
