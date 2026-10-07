/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
"use client";
import { useEffect, useState } from "react";
import {
  App,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import { fetchFinishGood } from "@/store/features/master/finishGoodSlice";
import {
  saveNonPo,
  fetchNonPoDetail,
  type NonPoRecord,
  type NonPoValues,
} from "@/store/features/production/forecastNonPo/forecastNonPoSlice";
import { createAssemblyRequestId } from "@/store/features/production/assembly/requestId";

interface Props {
  open: boolean;
  record?: NonPoRecord;
  detail?: boolean;
  onClose: () => void;
  onSaved: () => void;
}
type Values = Omit<NonPoValues, "deliveryDate"> & { deliveryDate: Dayjs };
export default function NonPoModal({
  open,
  record,
  detail,
  onClose,
  onSaved,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const { data: parts, loading: loadingParts } = useSelector(
    (state: RootState) => state.finishGood,
  );
  const [locked, setLocked] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      void dispatch(
        fetchFinishGood({ page: 1, limit: 50, search: partSearch }),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [open, partSearch, dispatch]);
  useEffect(() => {
    if (!open || !record) {
      setLocked(false);
      return;
    }
    let current = true;
    setLocked(true);
    void dispatch(fetchNonPoDetail(record.Id))
      .unwrap()
      .then((row) => {
        if (current) setLocked(!!row.operationalLocked);
      })
      .catch((reason) => {
        if (current) message.error(String(reason));
      });
    return () => {
      current = false;
    };
  }, [open, record, dispatch, message]);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState(false);
  const [requestId, setRequestId] = useState("");
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setDuplicates(false);
    setRequestId(createAssemblyRequestId());
    setPartSearch("");
    if (record)
      form.setFieldsValue({
        partNumber: record.PartNumber,
        deliveryDate: dayjs(record.DeliveryDate),
        receivingArea: record.ReceivingArea,
        deliveryPeriod: record.DeliveryPeriod,
        qty: record.Qty,
        poNumber: record.PoNumber,
        notes: record.Notes,
      });
  }, [open, record, form, dispatch]);
  const save = async () => {
    if (saving) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await dispatch(
        saveNonPo({
          id: record?.Id,
          requestId,
          confirmDuplicates: duplicates,
          values: {
            ...values,
            deliveryDate: values.deliveryDate.format("YYYY-MM-DD"),
            poNumber: values.poNumber?.trim() || null,
            notes: values.notes?.trim() || null,
          },
        }),
      ).unwrap();
      message.success("Non PO forecast saved");
      onSaved();
      onClose();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      title={
        record
          ? `${detail ? "Detail" : "Edit"} — ${record.ReferenceNumber}`
          : "Create Forecast (Non PO)"
      }
      centered
      forceRender
      width={720}
      onCancel={onClose}
      onOk={() => (detail ? onClose() : void save())}
      confirmLoading={saving}
      okText={detail ? "Close" : "Save"}
    >
      {record?.Demand?.ProductionRelease && (
        <Typography.Paragraph>
          Release: {record.Demand.ProductionRelease.ReleaseNumber} (
          {record.Demand.ProductionRelease.Status}). Operational fields lock
          once processing starts; PO Number and Notes remain editable.
        </Typography.Paragraph>
      )}
      <Form form={form} layout="vertical" disabled={detail || saving}>
        <Form.Item
          name="partNumber"
          label="Part Number"
          rules={[{ required: true }]}
        >
          <Select
            disabled={detail || saving || locked}
            loading={loadingParts}
            showSearch={{ filterOption: false, onSearch: setPartSearch }}
            options={[
              ...(record &&
              !parts.some((part) => part.PartNumber === record.PartNumber)
                ? [{ value: record.PartNumber, label: record.PartNumber }]
                : []),
              ...parts.map((part) => ({
                value: part.PartNumber,
                label: `${part.PartNumber} — ${part.PartName}`,
              })),
            ]}
          />
        </Form.Item>
        <Form.Item
          name="deliveryDate"
          label="Delivery Date"
          rules={[{ required: true }]}
        >
          <DatePicker disabled={detail || saving || locked} />
        </Form.Item>
        <Form.Item
          name="receivingArea"
          label="Receiving Area"
          rules={[{ required: true, whitespace: true }, { max: 200 }]}
        >
          <Input disabled={detail || saving || locked} />
        </Form.Item>
        <Form.Item
          name="deliveryPeriod"
          label="Delivery Period"
          rules={[{ required: true }, { type: "integer", min: 1 }]}
        >
          <InputNumber
            disabled={detail || saving || locked}
            min={1}
            max={2147483647}
            precision={0}
          />
        </Form.Item>
        <Form.Item
          name="qty"
          label="Qty"
          rules={[{ required: true }, { type: "integer", min: 1 }]}
        >
          <InputNumber
            disabled={detail || saving || locked}
            min={1}
            max={2147483647}
            precision={0}
          />
        </Form.Item>
        <Form.Item
          name="poNumber"
          label="PO Number (Optional)"
          rules={[{ max: 200 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="notes"
          label="Notes (Optional)"
          rules={[{ max: 2000 }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
      {!detail && (
        <Checkbox
          checked={duplicates}
          onChange={(event) => setDuplicates(event.target.checked)}
        >
          I confirm that any identical forecast is a separate additional
          request.
        </Checkbox>
      )}
    </Modal>
  );
}
