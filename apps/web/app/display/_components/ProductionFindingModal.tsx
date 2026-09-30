/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Table,
  Tabs,
} from "antd";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchFinishGoodFindingContext,
  fetchPublicLabelFindingOptions,
  fetchPublicMaterialFindingOptions,
  submitFinishGoodFinding,
  submitMaterialFinding,
  type FinishGoodFindingContext,
  type PublicLabelFindingOption,
  type PublicMaterialFindingOption,
} from "@/store/features/production/productionFinding/productionFindingSlice";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  reporter?: string | null;
  getContainer: () => HTMLElement;
}

interface MaterialValues {
  reporter: string;
  materialId: string;
  location: "WAREHOUSE" | "RACK" | "ASSY";
  qty: number;
  reason: string;
}

interface FinishGoodValues {
  reporter: string;
  labelNumber: string;
  qty: number;
  reason: string;
}

type ComponentDraft = FinishGoodFindingContext["components"][number] & {
  selected: boolean;
  qty: number;
};

export default function ProductionFindingModal({
  open,
  onClose,
  onSuccess,
  reporter,
  getContainer,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const submitting = useSelector(
    (state: RootState) => state.productionFindings.submitting,
  );
  const [tab, setTab] = useState("material");
  const [checking, setChecking] = useState(false);
  const [materialOptions, setMaterialOptions] = useState<PublicMaterialFindingOption[]>([]);
  const [labelOptions, setLabelOptions] = useState<PublicLabelFindingOption[]>([]);
  const [materialOptionsLoading, setMaterialOptionsLoading] = useState(false);
  const [labelOptionsLoading, setLabelOptionsLoading] = useState(false);
  const [materialOptionsError, setMaterialOptionsError] = useState<string | null>(null);
  const [labelOptionsError, setLabelOptionsError] = useState<string | null>(null);
  const [context, setContext] = useState<FinishGoodFindingContext | null>(null);
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [materialForm] = Form.useForm<MaterialValues>();
  const [finishGoodForm] = Form.useForm<FinishGoodValues>();

  const loadMaterialOptions = useCallback(async (search?: string) => {
    setMaterialOptionsLoading(true);
    setMaterialOptionsError(null);
    try {
      setMaterialOptions(await dispatch(fetchPublicMaterialFindingOptions({ search, limit: 50 })).unwrap());
    } catch (error) {
      setMaterialOptions([]);
      setMaterialOptionsError(String(error));
    } finally {
      setMaterialOptionsLoading(false);
    }
  }, [dispatch]);

  const loadLabelOptions = useCallback(async (search?: string) => {
    setLabelOptionsLoading(true);
    setLabelOptionsError(null);
    try {
      setLabelOptions(await dispatch(fetchPublicLabelFindingOptions({ search, limit: 50 })).unwrap());
    } catch (error) {
      setLabelOptions([]);
      setLabelOptionsError(String(error));
    } finally {
      setLabelOptionsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (!open) return;
    materialForm.setFieldValue("reporter", reporter ?? "");
    finishGoodForm.setFieldValue("reporter", reporter ?? "");
    void loadMaterialOptions();
    void loadLabelOptions();
  }, [finishGoodForm, loadLabelOptions, loadMaterialOptions, materialForm, open, reporter]);

  const resetFinishGoodContext = () => {
    setContext(null);
    setComponents([]);
  };

  const submitMaterial = async () => {
    try {
      const values = await materialForm.validateFields();
      const result = await dispatch(
        submitMaterialFinding({ ...values, requestId: crypto.randomUUID() }),
      ).unwrap();
      message.success(`Finding ${result.RecordNumber} submitted`);
      materialForm.resetFields();
      onSuccess?.();
      onClose();
    } catch (error) {
      message.error(String(error));
    }
  };

  const inspectFinishGoodLabel = async (selectedLabel?: string) => {
    const labelNumber = selectedLabel ?? finishGoodForm.getFieldValue("labelNumber")?.trim();
    if (!labelNumber) return;
    setChecking(true);
    resetFinishGoodContext();
    try {
      const result = await dispatch(fetchFinishGoodFindingContext(labelNumber)).unwrap();
      setContext(result);
      finishGoodForm.setFieldValue("qty", result.labelQty);
      setComponents(
        result.components.map((component) => ({
          ...component,
          selected: false,
          qty: result.labelQty * component.QtyPerUnit,
        })),
      );
    } catch (error) {
      message.error(String(error));
    } finally {
      setChecking(false);
    }
  };

  const updateFinishGoodQty = (qty: number | null) => {
    const value = qty ?? 1;
    finishGoodForm.setFieldValue("qty", value);
    setComponents((current) =>
      current.map((component) => ({
        ...component,
        qty: value * component.QtyPerUnit,
      })),
    );
  };

  const submitFinishGood = async () => {
    try {
      const values = await finishGoodForm.validateFields();
      if (!context) {
        message.error("Check the finish-good label before submitting.");
        return;
      }
      const selected = components.filter((component) => component.selected);
      if (!selected.length) {
        message.error("Select at least one affected component.");
        return;
      }
      if (selected.some((component) => component.qty < 1)) {
        message.error("Every selected component needs a quantity of at least one.");
        return;
      }
      const result = await dispatch(
        submitFinishGoodFinding({
          ...values,
          requestId: crypto.randomUUID(),
          components: selected.map((component) => ({
            snapshotLineId: component.snapshotLineId,
            qty: component.qty,
          })),
        }),
      ).unwrap();
      message.success(`Finding ${result.RecordNumber} submitted`);
      finishGoodForm.resetFields();
      resetFinishGoodContext();
      onSuccess?.();
      onClose();
    } catch (error) {
      message.error(String(error));
    }
  };

  const finishGoodContent = (
    <Form form={finishGoodForm} layout="vertical" initialValues={{ qty: 1 }}>
      <Form.Item
        name="reporter"
        label="Reporter / Operator"
        rules={[{ required: true }, { max: 100 }]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        name="labelNumber"
        label="FG Label Number"
        rules={[{ required: true, message: "Enter the finish-good label number." }]}
      >
        <Select
          showSearch
          filterOption={false}
          placeholder="Search released labels"
          loading={checking}
          onSearch={(value) => void loadLabelOptions(value)}
          onChange={(value) => void inspectFinishGoodLabel(value)}
          notFoundContent={labelOptionsLoading ? "Loading..." : labelOptionsError ?? "No released labels found"}
          options={labelOptions.map((option) => ({
            value: option.labelNumber,
            label: `${option.labelNumber} · Qty ${option.labelQty} · ${option.finishGoodPartName}`,
          }))}
        />
      </Form.Item>
      {labelOptionsError && <Alert className="mb-4" type="error" showIcon title={labelOptionsError} />}
      {context && (
        <Alert
          className="mb-4"
          showIcon
          type="success"
          title={`${context.labelNumber} · ${context.finishGoodPartNumber} · ${context.finishGoodPartName}`}
          description="The component list below is resolved from this label's immutable production BOM snapshot."
        />
      )}
      <Form.Item
        name="qty"
        label="Finish Good NG Quantity"
        rules={[{ required: true }]}
      >
        <InputNumber
          min={1}
          precision={0}
          className="w-full"
          onChange={updateFinishGoodQty}
        />
      </Form.Item>
      <Form.Item
        name="reason"
        label="Reason"
        rules={[{ required: true }, { max: 1000 }]}
      >
        <Input.TextArea rows={3} showCount maxLength={1000} />
      </Form.Item>
      {context && (
        <Table<ComponentDraft>
          size="small"
          rowKey="snapshotLineId"
          pagination={false}
          dataSource={components}
          scroll={{ x: "max-content" }}
          columns={[
            {
              title: "Use",
              render: (_, row) => (
                <Checkbox
                  checked={row.selected}
                  onChange={(event) =>
                    setComponents((current) =>
                      current.map((component) =>
                        component.snapshotLineId === row.snapshotLineId
                          ? { ...component, selected: event.target.checked }
                          : component,
                      ),
                    )
                  }
                />
              ),
            },
            {
              title: "Component",
              render: (_, row) =>
                `${row.materialPartNumber} - ${row.materialPartName}`,
            },
            { title: "Qty / FG", dataIndex: "QtyPerUnit" },
            {
              title: "Required / Replace",
              render: (_, row) => (
                <InputNumber
                  min={1}
                  precision={0}
                  disabled={!row.selected}
                  value={row.qty}
                  onChange={(qty) =>
                    setComponents((current) =>
                      current.map((component) =>
                        component.snapshotLineId === row.snapshotLineId
                          ? { ...component, qty: qty ?? 0 }
                          : component,
                      ),
                    )
                  }
                />
              ),
            },
          ]}
        />
      )}
    </Form>
  );

  return (
    <Modal
      centered
      open={open}
      onCancel={onClose}
      destroyOnHidden
      forceRender
      width={760}
      title="Report NG"
      getContainer={getContainer}
      okText="Submit"
      okButtonProps={{ loading: submitting }}
      onOk={() => void (tab === "material" ? submitMaterial() : submitFinishGood())}
    >
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key)}
        items={[
          {
            key: "material",
            label: "Material",
            forceRender: true,
            children: (
              <Form
                form={materialForm}
                layout="vertical"
                initialValues={{ location: "RACK", qty: 1 }}
              >
                <Form.Item
                  name="reporter"
                  label="Reporter / Operator"
                  rules={[{ required: true }, { max: 100 }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  name="materialId"
                  label="Material Part Number"
                  rules={[{ required: true }]}
                >
                  <Select
                    showSearch
                    filterOption={false}
                    placeholder="Search active materials"
                    loading={materialOptionsLoading}
                    onSearch={(value) => void loadMaterialOptions(value)}
                    notFoundContent={materialOptionsLoading ? "Loading..." : materialOptionsError ?? "No active materials found"}
                    options={materialOptions.map((option) => ({
                      value: option.partNumber,
                      label: `${option.partNumber} · ${option.partName}`,
                    }))}
                  />
                </Form.Item>
                {materialOptionsError && <Alert className="mb-4" type="error" showIcon title={materialOptionsError} />}
                <Form.Item
                  name="location"
                  label="Location"
                  rules={[{ required: true }]}
                >
                  <Radio.Group
                    options={[
                      { label: "Warehouse", value: "WAREHOUSE" },
                      { label: "Rack", value: "RACK" },
                      { label: "ASSY", value: "ASSY" },
                    ]}
                  />
                </Form.Item>
                <Alert
                  className="mb-4"
                  type="info"
                  showIcon
                  title="ASSY findings do not deduct stock. After leader approval, complete the required Non Production additional picking and allocation."
                />
                <Form.Item
                  name="qty"
                  label="NG Quantity"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} precision={0} className="w-full" />
                </Form.Item>
                <Form.Item
                  name="reason"
                  label="Reason"
                  rules={[{ required: true }, { max: 1000 }]}
                >
                  <Input.TextArea rows={3} showCount maxLength={1000} />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: "finish-good",
            label: "Finish Good",
            forceRender: true,
            children: finishGoodContent,
          },
        ]}
      />
    </Modal>
  );
}
