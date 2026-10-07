/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  App,
  Select,
  Radio,
  Tag,
  Progress,
  Space,
  Divider,
  Table,
  Button,
} from "antd";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import {
  createShopping,
  fetchCheckRequirement,
} from "@/store/features/production/shopping/shoppingSlice";
import {
  fetchMaterialOptions,
  MaterialOption,
} from "@/store/features/master/materialSlice";
import { fetchProductionRelease } from "@/store/features/production/productionRelease/productionReleaseSlice";
import { DeleteOutlined } from "@ant-design/icons";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface MaterialWithRequirement extends MaterialOption {
  isCompleted: boolean;
  qtyRemaining: number;
}

// Flattened forecast for dropdown
interface FlattenedForecast {
  PoId: string;
  FinishGoodId: string;
  Qty: number;
  PartData: {
    PartNumber: string;
    PartName: string;
  };
  ReleaseNumber: string;
}

// Selected material item with qty
interface SelectedMaterialItem {
  materialId: string;
  partNumber: string;
  partName: string;
  qtyPick: number;
  isCompleted: boolean;
  qtyRemaining: number;
}

const CreateShoppingModal: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const requestIds = useRef(new Map<string, string>());
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [shoppingType, setShoppingType] = useState<"REGULER" | "ADDITIONAL">(
    "REGULER",
  );
  const [selectedForecastId, setSelectedForecastId] = useState<
    string | undefined
  >();
  const [selectedMaterials, setSelectedMaterials] = useState<
    SelectedMaterialItem[]
  >([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressCount, setProgressCount] = useState({ current: 0, total: 0 });

  const { options: materials, optionsLoading: materialOptionsLoading } =
    useSelector((state: RootState) => state.material);
  const { data: productionReleases, loading: prLoading } = useSelector(
    (state: RootState) => state.productionRelease,
  );
  const { checkRequirement } = useSelector(
    (state: RootState) => state.shopping,
  );

  // Flatten all forecasts from all production releases
  const allForecasts = useMemo((): FlattenedForecast[] => {
    const forecasts: FlattenedForecast[] = [];
    const seen = new Set<string>();
    productionReleases.forEach((pr) => {
      pr.Forecasts?.forEach((f) => {
        // Use PoId as unique key
        if (!seen.has(f.PoId)) {
          seen.add(f.PoId);
          forecasts.push({
            PoId: f.PoId,
            FinishGoodId: f.FinishGoodId,
            Qty: f.Qty,
            PartData: f.PartData,
            ReleaseNumber: pr.ReleaseNumber,
          });
        }
      });
    });
    return forecasts;
  }, [productionReleases]);

  // Get selected forecast data
  const selectedForecast = useMemo(() => {
    return allForecasts.find((f) => f.PoId === selectedForecastId);
  }, [allForecasts, selectedForecastId]);

  // Get PoId from selected forecast
  const selectedForecastPoId = useMemo(() => {
    return selectedForecast?.PoId || "";
  }, [selectedForecast]);

  useEffect(() => {
    if (visible) {
      requestIds.current.clear();
      dispatch(fetchMaterialOptions());
      dispatch(fetchProductionRelease());
      setShoppingType("REGULER");
      setSelectedForecastId(undefined);
      setSelectedMaterials([]);
      setCurrentIndex(0);
      setProgressCount({ current: 0, total: 0 });
    }
  }, [visible, dispatch]);

  useEffect(() => {
    // Call check requirement when forecast PoId is selected
    if (selectedForecastPoId && shoppingType === "REGULER") {
      dispatch(fetchCheckRequirement(selectedForecastPoId));
    }
  }, [selectedForecastPoId, shoppingType, dispatch]);

  const handleTypeChange = (e: any) => {
    setShoppingType(e.target.value);
    if (e.target.value === "ADDITIONAL") {
      form.setFieldValue("forecastId", undefined);
      setSelectedForecastId(undefined);
      setSelectedMaterials([]);
    }
  };

  const handleForecastChange = (forecastId: string) => {
    setSelectedForecastId(forecastId);
    setSelectedMaterials([]);
  };

  // Filter materials based on check requirement - only show from requirement list
  const availableMaterials = useMemo((): MaterialWithRequirement[] => {
    if (shoppingType === "ADDITIONAL") {
      // For ADDITIONAL, show all materials
      return materials.map((m) => ({
        ...m,
        isCompleted: false,
        qtyRemaining: 0,
      }));
    }

    if (!checkRequirement || !selectedForecastPoId) {
      return [];
    }

    // Only show materials that exist in checkRequirement response
    const mappedMaterials: MaterialWithRequirement[] = materials
      .filter((m) =>
        checkRequirement.requirements.some(
          (r) => r.materialId === m.PartNumber,
        ),
      )
      .map((m) => {
        const requirement = checkRequirement.requirements.find(
          (r) => r.materialId === m.PartNumber,
        );
        return {
          ...m,
          isCompleted: requirement?.isCompleted ?? false,
          qtyRemaining: requirement?.qtyRemaining ?? 0,
        };
      });
    return mappedMaterials;
  }, [shoppingType, checkRequirement, selectedForecastPoId, materials]);

  const handleMaterialSelectChange = (selectedIds: string[]) => {
    const selected = selectedIds.map((id) => {
      const material = materials.find((m) => m.Id === Number(id));
      const requirement = checkRequirement?.requirements.find(
        (r) => r.materialId === material?.PartNumber,
      );
      return {
        materialId: material?.Id || "",
        partNumber: material?.PartNumber || "",
        partName: material?.PartName || "",
        qtyPick: requirement?.qtyRemaining || 1,
        isCompleted: requirement?.isCompleted ?? false,
        qtyRemaining: requirement?.qtyRemaining ?? 0,
      } as SelectedMaterialItem;
    });
    setSelectedMaterials(selected);
  };

  const handleQtyChange = (materialId: string, qty: number) => {
    setSelectedMaterials((prev) =>
      prev.map((m) =>
        m.materialId === materialId ? { ...m, qtyPick: qty } : m,
      ),
    );
  };

  const handleRemoveMaterial = (materialId: string) => {
    setSelectedMaterials((prev) =>
      prev.filter((m) => m.materialId !== materialId),
    );
    // Also remove from form values
    const currentValues = form.getFieldValue("materialIds") || [];
    form.setFieldValue(
      "materialIds",
      currentValues.filter((id: string) => id !== materialId),
    );
  };

  const handleOk = async () => {
    if (selectedMaterials.length === 0) {
      message.warning("Please select at least one material");
      return;
    }

    try {
      await form.validateFields();
      setLoading(true);
      setProgressCount({ current: 0, total: selectedMaterials.length });

      const selectedForecastItem = allForecasts.find(
        (f) => f.PoId === selectedForecastId,
      );

      // Call API one by one
      for (let i = 0; i < selectedMaterials.length; i++) {
        const material = selectedMaterials[i];
        setCurrentIndex(i + 1);

        const fingerprint = JSON.stringify([
          shoppingType,
          selectedForecastId,
          material.partNumber,
          material.qtyPick,
          form.getFieldValue("description"),
          form.getFieldValue("destination"),
        ]);
        if (!requestIds.current.has(fingerprint))
          requestIds.current.set(fingerprint, crypto.randomUUID());
        const payload = {
          snapshotId:
            shoppingType === "REGULER"
              ? checkRequirement?.snapshotId
              : undefined,
          requestId: requestIds.current.get(fingerprint)!,
          purpose:
            shoppingType === "REGULER"
              ? ("STANDARD" as const)
              : ("NON_PRODUCTION" as const),
          destination:
            shoppingType === "ADDITIONAL"
              ? form.getFieldValue("destination")
              : undefined,
          forecastId:
            shoppingType === "ADDITIONAL"
              ? undefined
              : selectedForecastItem?.PoId || "",
          materialId: material.partNumber,
          qtyPick: material.qtyPick,
          type: shoppingType,
          description: form.getFieldValue("description") || "",
        };

        const result = await dispatch(createShopping(payload));

        if (createShopping.rejected.match(result)) {
          throw new Error(
            (result.payload as string) || `Failed for ${material.partNumber}`,
          );
        }
      }

      message.success(
        `Successfully created ${selectedMaterials.length} shopping items`,
      );
      form.resetFields();
      setSelectedMaterials([]);
      onClose();
      onSuccess?.();
    } catch (error: unknown) {
      const err = error as Error;
      message.error(
        err?.message || String(error) || "Failed to create shopping",
      );
    } finally {
      setLoading(false);
      setCurrentIndex(0);
      setProgressCount({ current: 0, total: 0 });
    }
  };

  const renderRequirementSummary = () => {
    if (!checkRequirement || shoppingType === "ADDITIONAL") return null;

    return (
      <div
        style={{
          marginBottom: 16,
          padding: 12,
          background: "#f5f5f5",
          borderRadius: 8,
        }}
      >
        <Space style={{ marginBottom: 8 }}>
          <span>
            <strong>Forecast:</strong> {checkRequirement.forecastId}
            {" · BOM revision "}
            {checkRequirement.bomRevision}
          </span>
          <span>|</span>
          <span>
            <strong>Finish Good:</strong> {checkRequirement.finishGoodName}
          </span>
          <span>|</span>
          <span>
            <strong>PR Status:</strong>{" "}
            <Tag
              color={
                checkRequirement.productionReleaseStatus === "RELEASED"
                  ? "green"
                  : "default"
              }
            >
              {checkRequirement.productionReleaseStatus || "N/A"}
            </Tag>
          </span>
        </Space>
        <Divider style={{ margin: "8px 0" }} />
        <Progress
          percent={checkRequirement.summary.overallPercentage}
          size="small"
          status={
            checkRequirement.summary.overallPercentage === 100
              ? "success"
              : "active"
          }
          format={(percent) =>
            `${percent}% (${checkRequirement.summary.completedMaterials}/${checkRequirement.summary.totalMaterials} materials)`
          }
        />
      </div>
    );
  };

  const selectedMaterialColumns = [
    {
      title: "Material",
      key: "material",
      render: (_: any, record: SelectedMaterialItem) => (
        <span>
          <strong>{record.partNumber}</strong> - {record.partName}
        </span>
      ),
    },
    {
      title: "Remaining",
      key: "remaining",
      align: "center" as const,
      render: (_: any, record: SelectedMaterialItem) =>
        record.isCompleted ? (
          <Tag color="success">Done</Tag>
        ) : (
          <Tag color="warning">{record.qtyRemaining}</Tag>
        ),
    },
    {
      title: "Qty Pick",
      key: "qtyPick",
      render: (_: any, record: SelectedMaterialItem) => (
        <InputNumber
          min={1}
          value={record.qtyPick}
          onChange={(val) => handleQtyChange(record.materialId, val || 1)}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: "",
      key: "action",
      render: (_: any, record: SelectedMaterialItem) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveMaterial(record.materialId)}
        />
      ),
    },
  ];

  return (
    <Modal
      title="Create New Shopping"
      open={visible}
      onOk={handleOk}
      centered={true}
      onCancel={() => {
        form.resetFields();
        setSelectedMaterials([]);
        onClose();
      }}
      confirmLoading={loading}
      width={800}
      okText={
        loading
          ? `Processing ${currentIndex}/${progressCount.total}`
          : "Create Shopping"
      }
      okButtonProps={{ disabled: selectedMaterials.length === 0 }}
      zIndex={1050}
    >
      {loading && (
        <div style={{ marginBottom: 16 }}>
          <Progress
            percent={Math.round((currentIndex / progressCount.total) * 100)}
            status="active"
          />
        </div>
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          name="type"
          label="Type"
          rules={[{ required: true, message: "Please select type" }]}
        >
          <Radio.Group onChange={handleTypeChange}>
            <Radio value="REGULER">Production (PO / Non PO)</Radio>
            <Radio value="ADDITIONAL">Non-production</Radio>
          </Radio.Group>
        </Form.Item>
        {shoppingType === "REGULER" && (
          <Form.Item
            name="forecastId"
            label="Forecast"
            rules={[{ required: true, message: "Please select forecast" }]}
          >
            <Select
              placeholder="Select forecast"
              showSearch={{ optionFilterProp: "label" }}
              onChange={handleForecastChange}
              loading={prLoading}
              options={allForecasts.map((forecast) => ({
                value: forecast.PoId,
                label: `${forecast.PoId} - ${forecast.PartData?.PartNumber} · ${forecast.ReleaseNumber}`,
              }))}
            />
          </Form.Item>
        )}
        {shoppingType === "ADDITIONAL" && (
          <Form.Item label="Forecast">
            <Input
              disabled
              placeholder="ADDITIONAL - Additional free material"
            />
          </Form.Item>
        )}

        {renderRequirementSummary()}

        <Form.Item
          name="materialIds"
          label="Select Materials"
          rules={[{ required: true, message: "Please select materials" }]}
        >
          <Select
            mode="multiple"
            placeholder={
              shoppingType === "REGULER" && !selectedForecastId
                ? "Select forecast first"
                : "Select materials"
            }
            showSearch={{ optionFilterProp: "label" }}
            loading={materialOptionsLoading}
            disabled={
              materialOptionsLoading ||
              (shoppingType === "REGULER" && !selectedForecastId)
            }
            onChange={handleMaterialSelectChange}
            value={selectedMaterials.map((m) => m.materialId)}
            options={availableMaterials.map((material) => ({
              value: material.Id,
              label: `${material.PartNumber} - ${material.PartName} · ${material.isCompleted ? "Completed" : `Remaining ${material.qtyRemaining || "N/A"}`}`,
              disabled: material.isCompleted,
            }))}
          />
        </Form.Item>

        {selectedMaterials.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <strong>Selected Materials ({selectedMaterials.length}):</strong>
            <Table
              columns={selectedMaterialColumns}
              dataSource={selectedMaterials}
              rowKey="materialId"
              size="small"
              pagination={false}
              style={{ marginTop: 8 }}
            />
          </div>
        )}

        {shoppingType === "ADDITIONAL" && (
          <Form.Item
            name="destination"
            label="Non-production Destination"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input />
          </Form.Item>
        )}
        <Form.Item
          name="description"
          label="Description"
          rules={
            shoppingType === "ADDITIONAL"
              ? [{ required: true, whitespace: true }]
              : []
          }
        >
          <Input.TextArea placeholder="Description (optional)" rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateShoppingModal;
