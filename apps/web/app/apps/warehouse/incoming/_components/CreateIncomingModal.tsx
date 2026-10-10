/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  App,
  Select,
  Table,
  Button,
  Space,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import { createIncoming } from "@/store/features/warehouse/incoming/incomingSlice";
import { fetchMaterial } from "@/store/features/master/materialSlice";
import { fetchSupplier } from "@/store/features/master/supplierSlice";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface MaterialItem {
  key: number;
  materialId: number;
  qty: number;
  supplierId: number;
  materialData?: { PartNumber: string; PartName: string };
}

const CreateIncomingModal: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<
    number | undefined
  >();
  const [selectedQty, setSelectedQty] = useState<number | undefined>();
  const supplierId = Form.useWatch<number | undefined>("supplierId", form);
  const [materialSearch, setMaterialSearch] = useState("");

  const { data: supplierData } = useSelector(
    (state: RootState) => state.supplier,
  );
  const {
    data: materialData,
    loading: materialLoading,
    error: materialError,
  } = useSelector((state: RootState) => state.material);
  const eligibleMaterials = materialData.filter(
    (m) => m.SupplierId === supplierId && m.IsActive,
  );

  useEffect(() => {
    if (visible) {
      dispatch(fetchSupplier({ page: 1, limit: 100 }));
      setMaterials([]);
      setSelectedMaterialId(undefined);
      setSelectedQty(undefined);
    }
  }, [visible, dispatch]);

  useEffect(() => {
    if (!visible || !supplierId) return;
    const timer = setTimeout(() => {
      dispatch(
        fetchMaterial({
          page: 1,
          limit: 100,
          supplierId,
          search: materialSearch,
        }),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [visible, supplierId, materialSearch, dispatch]);

  const handleAddMaterial = () => {
    if (selectedMaterialId && selectedQty && selectedQty > 0) {
      const selectedMaterial = eligibleMaterials.find(
        (m) => m.Id === selectedMaterialId,
      );
      if (!supplierId || !selectedMaterial) {
        message.error(
          "Select a material belonging to the Supplier in the header.",
        );
        return;
      }
      setMaterials((current) => {
        const existing = current.find(
          (item) => item.materialId === selectedMaterialId,
        );
        if (existing) {
          return current.map((item) =>
            item.materialId === selectedMaterialId
              ? { ...item, qty: item.qty + selectedQty }
              : item,
          );
        }
        return [
          ...current,
          {
            key: Date.now(),
            materialId: selectedMaterialId,
            qty: selectedQty,
            supplierId,
            materialData: selectedMaterial
              ? {
                  PartNumber: selectedMaterial.PartNumber,
                  PartName: selectedMaterial.PartName,
                }
              : undefined,
          },
        ];
      });
      setSelectedMaterialId(undefined);
      setSelectedQty(undefined);
    } else {
      message.error("Please select material and enter qty");
    }
  };

  const handleRemoveMaterial = (key: number) => {
    setMaterials((prev) => prev.filter((m) => m.key !== key));
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (materials.length === 0) {
        message.error("Please add at least 1 material");
        setLoading(false);
        return;
      }
      if (materials.some((m) => m.supplierId !== Number(values.supplierId))) {
        message.error(
          "All materials must belong to the Supplier in the header.",
        );
        return;
      }

      const payload = {
        poId: values.poId,
        supplierId: Number(values.supplierId),
        receivedBy: values.receivedBy,
        description: values.description,
        materials: materials.map((m) => ({
          materialId: m.materialId,
          qty: m.qty,
        })),
      };

      await dispatch(createIncoming(payload)).unwrap();
      message.success("Incoming created successfully");
      form.resetFields();
      setMaterials([]);
      onClose();
      onSuccess?.();
    } catch (error: unknown) {
      const err = error as Error;
      if (err?.message?.includes("validateFields")) return;
      message.error(
        err?.message || String(error) || "Failed to create incoming",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setMaterials([]);
    onClose();
  };

  const materialColumns = [
    {
      title: "Part Number",
      key: "PartNumber",
      render: (_: unknown, record: MaterialItem) =>
        record.materialData?.PartNumber || "-",
    },
    {
      title: "Part Name",
      key: "PartName",
      render: (_: unknown, record: MaterialItem) =>
        record.materialData?.PartName || "-",
    },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      align: "right" as const,
    },
    {
      title: "",
      key: "action",
      render: (_: unknown, record: MaterialItem) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveMaterial(record.key)}
        />
      ),
    },
  ];

  return (
    <Modal
      title="Create New Incoming"
      open={visible}
      onOk={handleOk}
      centered={true}
      onCancel={handleCancel}
      confirmLoading={loading}
      forceRender
      width={800}
      zIndex={1050}
    >
      <Form form={form} layout="vertical" disabled={loading}>
        <Form.Item
          name="poId"
          label="PO Number"
          rules={[{ required: true, message: "Please enter PO number" }]}
        >
          <Input
            placeholder="PO-2024-001"
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              form.setFieldValue("poId", value);
            }}
          />
        </Form.Item>
        <Form.Item
          name="supplierId"
          label="Supplier"
          rules={[{ required: true, message: "Please select supplier" }]}
        >
          <Select
            placeholder="Select supplier"
            onChange={() => {
              if (materials.length)
                message.info(
                  "Supplier changed. Please select materials again.",
                );
              setMaterials([]);
              setSelectedMaterialId(undefined);
              setSelectedQty(undefined);
              setMaterialSearch("");
            }}
            showSearch={{ optionFilterProp: "label" }}
            options={supplierData.map((supplier) => ({
              value: supplier.Id,
              label: supplier.Name,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="receivedBy"
          label="Received By"
          rules={[{ required: true, message: "Please enter receiver name" }]}
        >
          <Input placeholder="Receiver name" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea placeholder="Description (optional)" rows={2} />
        </Form.Item>
      </Form>

      <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 500 }}>
        Materials
      </div>
      <Space style={{ marginBottom: 8 }}>
        <Select
          placeholder={supplierId ? "Select material" : "Select supplier first"}
          disabled={!supplierId || loading}
          loading={materialLoading}
          style={{ width: 250 }}
          showSearch={{ filterOption: false, onSearch: setMaterialSearch }}
          value={selectedMaterialId}
          onChange={setSelectedMaterialId}
          options={eligibleMaterials.map((material) => ({
            value: material.Id,
            label: `${material.PartNumber} - ${material.PartName}`,
          }))}
        />
        <InputNumber
          placeholder="Qty"
          min={1}
          value={selectedQty}
          onChange={(val) => setSelectedQty(val ?? undefined)}
          style={{ width: 100 }}
        />
        <Button
          disabled={!supplierId || loading || materialLoading}
          icon={<PlusOutlined />}
          onClick={handleAddMaterial}
        >
          Add
        </Button>
      </Space>
      {supplierId && materialError && <div role="alert">{materialError}</div>}

      <Table
        columns={materialColumns}
        dataSource={materials}
        size="small"
        rowKey="key"
        pagination={false}
        scroll={{ x: "max-content" }}
        className="small-table"
        style={{ fontSize: "11px" }}
      />
    </Modal>
  );
};

export default CreateIncomingModal;
