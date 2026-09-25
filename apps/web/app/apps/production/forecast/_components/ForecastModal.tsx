/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  App,
  Button,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import {
  deleteForecast,
  ForecastEntity,
  updateForecast,
} from "@/store/features/production/forecast/forecastSlice";
import { fetchFinishGood } from "@/store/features/master/finishGoodSlice";
import { fetchSupplier } from "@/store/features/master/supplierSlice";
import {
  fetchShoppingStatus,
  ShoppingStatusResponse,
} from "@/store/features/production/shopping/shoppingSlice";
import { formatDateTime } from "@/lib/utils/dateTime";

const { Text, Title } = Typography;

type ForecastUpdatePayload = Parameters<typeof updateForecast>[0]["data"];

type ForecastFormValues = {
  finishGoodId?: string;
  qty?: number;
  vendorCode?: string;
  vendorName?: string;
  receivingArea?: string;
  classification?: string;
  poNumber?: string;
  item?: number;
  deliveryPeriod?: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  data: ForecastEntity | null;
  onUpdated?: (forecast: ForecastEntity) => void;
  onDeleted?: (id: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "warning",
  RELEASED: "processing",
  COMPLETED: "success",
  CANCELLED: "error",
  DRAFT: "default",
};

const ForecastModal: React.FC<Props> = ({
  visible,
  onClose,
  data,
  onUpdated,
  onDeleted,
}) => {
  const { message, modal } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm<ForecastFormValues>();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shoppingStatus, setShoppingStatus] =
    useState<ShoppingStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const saveInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const { data: finishGoods, loading: finishGoodLoading } = useSelector(
    (state: RootState) => state.finishGood,
  );
  const { data: suppliers, loading: supplierLoading } = useSelector(
    (state: RootState) => state.supplier,
  );

  useEffect(() => {
    if (!visible) {
      setIsEditing(false);
      setShoppingStatus(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !data?.ProductionReleaseId || !data.PoId) {
      setShoppingStatus(null);
      setLoadingStatus(false);
      return;
    }

    let active = true;
    setLoadingStatus(true);
    dispatch(fetchShoppingStatus(data.PoId))
      .unwrap()
      .then((status) => {
        if (active) setShoppingStatus(status);
      })
      .catch(() => {
        if (active) setShoppingStatus(null);
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [data?.PoId, data?.ProductionReleaseId, dispatch, visible]);

  useEffect(() => {
    if (!visible || !isEditing || !data) return;

    form.setFieldsValue({
      finishGoodId: data.FinishGoodId,
      qty: data.Qty,
      vendorCode: data.VendorCode,
      vendorName: data.VendorName,
      receivingArea: data.ReceivingArea,
      classification: data.Classification,
      poNumber: data.PoNumber,
      item: data.Item,
      deliveryPeriod: data.DeliveryPeriod,
    });
    void dispatch(fetchFinishGood());
    void dispatch(fetchSupplier({ page: 1, limit: 100 }));
  }, [data, dispatch, form, isEditing, visible]);

  if (!data) return null;

  const derivedStatus = data.ProductionReleaseId ? "RELEASED" : "DRAFT";

  const bomColumns: TableProps<
    ShoppingStatusResponse["bomSummary"][number]
  >["columns"] = [
    {
      title: "Material",
      key: "material",
      render: (_, record) => (
        <span>
          <code style={{ fontSize: 10 }}>{record.materialId || "-"}</code> -{" "}
          {record.materialName || "-"}
        </span>
      ),
    },
    {
      title: "BOM Qty/Unit",
      dataIndex: "bomQtyPerUnit",
      key: "bomQtyPerUnit",
      align: "right",
    },
    {
      title: "Required",
      dataIndex: "totalRequired",
      key: "totalRequired",
      align: "right",
    },
    {
      title: "Picked",
      dataIndex: "alreadyPicked",
      key: "alreadyPicked",
      align: "right",
    },
    {
      title: "Remaining",
      dataIndex: "remainingToPick",
      key: "remainingToPick",
      align: "right",
      render: (value: number, record) => (
        <Text
          type={record.isCompleted ? "success" : "warning"}
          strong={!record.isCompleted}
        >
          {value ?? 0}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "isCompleted",
      key: "isCompleted",
      align: "center",
      render: (value: boolean) => (
        <Tag color={value ? "success" : "warning"}>
          {value ? "Done" : "Pending"}
        </Tag>
      ),
    },
  ];

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    form.resetFields();
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (saveInFlight.current) return;

    try {
      const values = await form.validateFields();
      saveInFlight.current = true;
      setIsSaving(true);
      const payload: ForecastUpdatePayload = {
        finishGoodId: values.finishGoodId,
        qty: values.qty,
        vendorCode: values.vendorCode,
        vendorName: values.vendorName,
        receivingArea: values.receivingArea,
        classification: values.classification,
        poNumber: values.poNumber,
        item: values.item,
        deliveryPeriod: values.deliveryPeriod,
      };
      const response = await dispatch(
        updateForecast({ id: data.Id, data: payload }),
      ).unwrap();

      message.success("Forecast updated successfully");
      form.resetFields();
      setIsEditing(false);
      onUpdated?.(response.data);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "errorFields" in error
      ) {
        return;
      }
      message.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Failed to update forecast",
      );
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (deleteInFlight.current) return;

    modal.confirm({
      title: "Delete Forecast?",
      icon: <DeleteOutlined />,
      content: `Delete forecast ${data.PoId}?`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      centered: true,
      onOk: async () => {
        if (deleteInFlight.current) return;

        deleteInFlight.current = true;
        setIsDeleting(true);
        try {
          const deletedId = await dispatch(deleteForecast(data.Id)).unwrap();
          message.success("Forecast deleted successfully");
          onDeleted?.(deletedId);
          onClose();
        } catch (error: unknown) {
          message.error(
            typeof error === "string"
              ? error
              : error instanceof Error
                ? error.message
                : "Failed to delete forecast",
          );
          throw error;
        } finally {
          deleteInFlight.current = false;
          setIsDeleting(false);
        }
      },
    });
  };

  const handleClose = () => {
    if (isSaving || isDeleting) return;
    if (isEditing) {
      form.resetFields();
      setIsEditing(false);
    }
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          {isEditing ? <EditOutlined /> : <EyeOutlined />}
          <span>
            {isEditing ? "Edit" : "Detail"} Forecast - {data.PoId}
          </span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      centered
      width={900}
      destroyOnHidden
      zIndex={1050}
      mask={{ closable: !isSaving && !isDeleting }}
      closable={!isSaving && !isDeleting}
      footer={
        isEditing
          ? [
              <Button
                key="cancel"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>,
              <Button
                key="save"
                type="primary"
                onClick={handleSave}
                loading={isSaving}
                disabled={isDeleting}
              >
                Save
              </Button>,
            ]
          : [
              !data.ProductionReleaseId && (
                <Button
                  key="delete"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDelete}
                  loading={isDeleting}
                >
                  Delete
                </Button>
              ),
              <Button
                key="edit"
                type="primary"
                icon={<EditOutlined />}
                onClick={handleEdit}
                disabled={isDeleting}
              >
                Edit
              </Button>,
            ]
      }
    >
      {isEditing ? (
        <Form
          form={form}
          layout="vertical"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 16px",
          }}
        >
          <Divider titlePlacement="start" style={{ gridColumn: "1 / -1" }}>
            Order
          </Divider>
          <Form.Item name="finishGoodId" label="Finish Good">
            <Select
              placeholder="Select finish good"
              loading={finishGoodLoading}
              showSearch={{ optionFilterProp: "label" }}
              options={finishGoods.map((finishGood) => ({
                value: finishGood.PartNumber,
                label: `${finishGood.PartNumber} - ${finishGood.PartName}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="qty" label="Qty">
            <InputNumber placeholder="100" min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="vendorCode" label="Vendor Code">
            <Input placeholder="VC001" />
          </Form.Item>
          <Form.Item name="vendorName" label="Vendor">
            <Select
              placeholder="Select vendor"
              loading={supplierLoading}
              showSearch={{ optionFilterProp: "label" }}
              options={suppliers.map((supplier) => ({
                value: supplier.Name,
                label: supplier.Name,
              }))}
            />
          </Form.Item>
          <Form.Item name="receivingArea" label="Receiving Area">
            <Input placeholder="WAREHOUSE-A" />
          </Form.Item>
          <Form.Item name="classification" label="Classification">
            <Input placeholder="REGULAR" />
          </Form.Item>
          <Form.Item name="poNumber" label="PO Number">
            <Input placeholder="PO-2024-001" />
          </Form.Item>
          <Divider titlePlacement="start" style={{ gridColumn: "1 / -1" }}>
            Quantity and schedule
          </Divider>
          <Form.Item name="item" label="Item">
            <InputNumber placeholder="1" min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="deliveryPeriod"
            label="Delivery Cycle / Ritase"
            extra="Enter the number of delivery cycles/trips."
            rules={[
              {
                required: true,
                message: "Please enter the delivery cycle / ritase",
              },
            ]}
          >
            <InputNumber
              placeholder="5"
              min={1}
              precision={0}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      ) : (
        <>
          <Descriptions
            bordered
            size="small"
            column={2}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="PO ID">
              <code style={{ fontSize: 11 }}>{data.PoId}</code>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLORS[derivedStatus] || "default"}>
                {derivedStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Finish Good">
              {data.PartData?.PartNumber || "-"} -{" "}
              {data.PartData?.PartName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Qty">
              <strong>{data.Qty}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Vendor Code">
              {data.VendorCode || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Vendor Name">
              {data.VendorName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Receiving Area">
              {data.ReceivingArea || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Classification">
              {data.Classification || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="PO Item">
              {data.PoNumber || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Item No.">{data.Item}</Descriptions.Item>
            <Descriptions.Item label="Date">
              {formatDateTime(data.Date)}
            </Descriptions.Item>
            <Descriptions.Item label="Delivery Date">
              {formatDateTime(data.DeliveryDate)}
            </Descriptions.Item>
            <Descriptions.Item label="Delivery Cycle / Ritase">
              {data.DeliveryPeriod}
            </Descriptions.Item>
            <Descriptions.Item label="Production Release">
              {data.ProductionRelease?.ReleaseNumber || "-"}
            </Descriptions.Item>
          </Descriptions>

          {data.ProductionReleaseId && shoppingStatus && (
            <>
              <Title level={5} style={{ marginBottom: 8 }}>
                Shopping Status
              </Title>
              <Descriptions
                bordered
                size="small"
                column={3}
                style={{ marginBottom: 16 }}
              >
                <Descriptions.Item label="Status" span={2}>
                  <Tag
                    color={STATUS_COLORS[shoppingStatus.status] || "default"}
                  >
                    {shoppingStatus.status || "-"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Forecast Qty">
                  {shoppingStatus.forecastQty ?? "-"}
                </Descriptions.Item>
              </Descriptions>
              {shoppingStatus.progress && (
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Progress: </Text>
                  <Text>
                    {shoppingStatus.progress.completedMaterials ?? 0}/
                    {shoppingStatus.progress.totalMaterials ?? 0} materials
                    completed
                  </Text>
                  <Progress
                    percent={shoppingStatus.progress.totalPickedPercent ?? 0}
                    size="small"
                    status={
                      shoppingStatus.progress.completedMaterials ===
                      shoppingStatus.progress.totalMaterials
                        ? "success"
                        : "active"
                    }
                    style={{ marginTop: 4 }}
                  />
                </div>
              )}
              <Table
                title={() => (
                  <strong>
                    BOM Summary ({shoppingStatus.bomSummary?.length ?? 0})
                  </strong>
                )}
                columns={bomColumns}
                dataSource={shoppingStatus.bomSummary ?? []}
                size="small"
                rowKey="materialId"
                pagination={false}
                loading={loadingStatus}
                scroll={{ x: "max-content" }}
                className="small-table"
                style={{ fontSize: "11px" }}
              />
            </>
          )}

          {data.ProductionReleaseId && loadingStatus && (
            <div style={{ textAlign: "center", padding: 20 }}>
              Loading shopping status...
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default ForecastModal;
