/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import Link from "next/link";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  Card,
  Breadcrumb,
  App,
  Input,
  Button,
  Space,
  Select,
  Tag,
  Tooltip,
} from "antd";
import type { InputRef } from "antd";
import {
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import {
  ProductionReportEntity,
  fetchProductionReport,
  validateProductionReport,
  unvalidateProductionReport,
  deleteProductionReport,
  PartType,
  setFilters,
} from "@/store/features/production/productionReport/productionReportSlice";
import CreateProductionReportModal from "./_components/CreateProductionReportModal";

const formatDate = (val: string | null | undefined) => {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("id-ID");
};

const RECORD_TYPE_COLORS: Record<string, string> = {
  ONE: "blue",
  TWO: "green",
  THREE: "orange",
  FOUR: "purple",
};

export default function ProductionReportPage() {
  const { message, modal } = App.useApp();
  const { can } = usePhasePermission();
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, pagination, filters } = useSelector(
    (state: RootState) => state.productionReport,
  );

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  const searchInput = useRef<InputRef>(null);

  useEffect(() => {
    dispatch(fetchProductionReport(filters));
  }, [dispatch, filters]);

  const selectedRow = data.find((item) => item.id === selectedRowKeys[0]);

  const getColumnSearchProps = (dataIndex: string): any => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: any) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => confirm()}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => {
              if (clearFilters) clearFilters();
              confirm();
            }}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    onFilter: (value: any, record: any) => {
      const fieldValue = dataIndex.includes(".")
        ? dataIndex.split(".").reduce((obj, key) => obj?.[key], record)
        : record[dataIndex];
      return fieldValue
        ?.toString()
        .toLowerCase()
        .includes((value as string).toLowerCase());
    },
  });

  const getValidatedFilterProps = () => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: any) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Select
          placeholder="Select status"
          value={selectedKeys[0]}
          onChange={(val) => setSelectedKeys(val ? [val] : [])}
          style={{ width: "100%", marginBottom: 8 }}
          allowClear
        >
          <Select.Option value="validated">Validated</Select.Option>
          <Select.Option value="pending">Pending</Select.Option>
        </Select>
        <Space>
          <Button
            type="primary"
            onClick={() => confirm()}
            size="small"
            style={{ width: 80 }}
          >
            OK
          </Button>
          <Button
            onClick={() => {
              if (clearFilters) clearFilters();
              confirm();
            }}
            size="small"
            style={{ width: 80 }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    onFilter: (value: any, record: any) => {
      if (value === "validated") return !!record.validatedAt;
      if (value === "pending") return !record.validatedAt;
      return true;
    },
  });

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: formatDate,
      sorter: (a: ProductionReportEntity, b: ProductionReportEntity) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    },
    {
      title: "Time",
      dataIndex: "time",
      key: "time",
      render: (val: string | null) => val || "-",
    },
    {
      title: "Part Type",
      dataIndex: "recordType",
      key: "recordType",
      render: (val: PartType) => (
        <Tag color={RECORD_TYPE_COLORS[val] || "default"}>{val}</Tag>
      ),
    },
    {
      title: "Finish Good",
      dataIndex: "finishGoodId",
      key: "finishGoodId",
      ...getColumnSearchProps("fgData.PartNumber"),
      render: (_: any, record: ProductionReportEntity) => (
        <Tooltip
          title={`${record.fgData?.PartNumber} - ${record.fgData?.PartName}`}
        >
          <code style={{ fontSize: 10 }}>
            {record.fgData?.PartNumber || record.finishGoodId}
          </code>
        </Tooltip>
      ),
    },
    {
      title: "Man Power",
      dataIndex: "manPowerUid",
      key: "manPowerUid",
      ...getColumnSearchProps("manPowerData.Name"),
      render: (_: any, record: ProductionReportEntity) => (
        <span>{record.manPowerData?.Name || record.manPowerUid}</span>
      ),
    },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      align: "right" as const,
      render: (val: number) => <strong>{val}</strong>,
    },
    {
      title: "NG Qty",
      dataIndex: "ngQty",
      key: "ngQty",
      align: "right" as const,
      render: (val: number) =>
        val > 0 ? <span style={{ color: "#ff4d4f" }}>{val}</span> : "-",
    },
    {
      title: "Stop (min)",
      dataIndex: "stopMinute",
      key: "stopMinute",
      align: "right" as const,
      render: (val: number) =>
        val > 0 ? <span style={{ color: "#faad14" }}>{val}</span> : "-",
    },
    {
      title: "Validated",
      dataIndex: "validatedAt",
      key: "validatedAt",
      ...getValidatedFilterProps(),
      render: (val: string | null) =>
        val ? (
          <Tag color="success">Validated</Tag>
        ) : (
          <Tag color="warning">Pending</Tag>
        ),
    },
    {
      title: "Validated By",
      dataIndex: "validatedBy",
      key: "validatedBy",
      render: (val: string | null) => val || "-",
    },
  ];

  const handleTableChange = (pagination: any) => {
    dispatch(
      setFilters({ page: pagination.current, limit: pagination.pageSize }),
    );
  };

  const handleValidate = () => {
    if (selectedRow && !selectedRow.validatedAt) {
      modal.confirm({
        title: "Validate Production Report?",
        icon: <CheckCircleOutlined />,
        content: `Validate report for ${selectedRow.fgData?.PartNumber} by ${selectedRow.manPowerData?.Name}?`,
        okText: "Validate",
        cancelText: "Cancel",
        centered: true,
        onOk: async () => {
          try {
            const result = await dispatch(
              validateProductionReport(selectedRow.id),
            );

            if (validateProductionReport.rejected.match(result)) {
              throw new Error(
                (result.payload as string) ||
                  "Failed to validate production report",
              );
            }
            message.success("Production report validated");
            setSelectedRowKeys([]);
            dispatch(
              fetchProductionReport({
                page: pagination.page,
                limit: pagination.limit,
              }),
            );
          } catch (error: unknown) {
            const err = error as Error;
            message.error(
              err?.message || String(error) || "Failed to validate",
            );
          }
        },
      });
    }
  };

  const handleUnvalidate = () => {
    if (selectedRow && selectedRow.validatedAt) {
      modal.confirm({
        title: "Unvalidate Production Report?",
        icon: <CloseCircleOutlined />,
        content: `Unvalidate report for ${selectedRow.fgData?.PartNumber}?`,
        okText: "Unvalidate",
        cancelText: "Cancel",
        centered: true,
        onOk: async () => {
          try {
            const result = await dispatch(
              unvalidateProductionReport(selectedRow.id),
            );

            if (unvalidateProductionReport.rejected.match(result)) {
              throw new Error(
                (result.payload as string) ||
                  "Failed to unvalidate production report",
              );
            }
            message.success("Production report unvalidated");
            setSelectedRowKeys([]);
            dispatch(
              fetchProductionReport({
                page: pagination.page,
                limit: pagination.limit,
              }),
            );
          } catch (error: unknown) {
            const err = error as Error;
            message.error(
              err?.message || String(error) || "Failed to unvalidate",
            );
          }
        },
      });
    }
  };

  const handleDelete = () => {
    if (selectedRow) {
      modal.confirm({
        title: "Delete Production Report?",
        icon: <DeleteOutlined />,
        content: `Delete report for ${selectedRow.fgData?.PartNumber}?`,
        okText: "Delete",
        okType: "danger",
        cancelText: "Cancel",
        centered: true,
        onOk: async () => {
          try {
            const result = await dispatch(
              deleteProductionReport(selectedRow.id),
            );

            if (deleteProductionReport.rejected.match(result)) {
              throw new Error(
                (result.payload as string) ||
                  "Failed to delete production report",
              );
            }
            message.success("Production report deleted");
            setSelectedRowKeys([]);
            dispatch(
              fetchProductionReport({
                page: pagination.page,
                limit: pagination.limit,
              }),
            );
          } catch (error: unknown) {
            const err = error as Error;
            message.error(err?.message || String(error) || "Failed to delete");
          }
        },
      });
    }
  };

  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "Production" },
          { title: "Process" },
          { title: "Production Report" },
        ]}
      />

      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() =>
            dispatch(
              fetchProductionReport({
                page: pagination.page,
                limit: pagination.limit,
              }),
            )
          }
        />
        <ButtonToolbar
          title="Create"
          enable={can("IPCS.PRODUCTION_REPORT_CREATE")}
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalVisible(true)}
        />
        <ButtonToolbar
          title="Validate"
          icon={<CheckCircleOutlined />}
          onClick={handleValidate}
          enable={selectedRowKeys.length === 1 && !selectedRow?.validatedAt}
        />
        <ButtonToolbar
          title="Unvalidate"
          icon={<CloseCircleOutlined />}
          onClick={handleUnvalidate}
          enable={selectedRowKeys.length === 1 && !!selectedRow?.validatedAt}
        />
        <ButtonToolbar
          title="Delete"
          icon={<DeleteOutlined />}
          onClick={handleDelete}
          enable={selectedRowKeys.length === 1}
        />
      </ToolbarWrapper>
      {can("IPCS.MATERIAL_NG_CREATE") && (
        <Link
          href={
            selectedRow?.forecastId
              ? `/apps/production/shopping/material-ng?poId=${encodeURIComponent(selectedRow.forecastId)}&productionReportId=${selectedRow.id}`
              : "/apps/production/shopping/material-ng"
          }
        >
          Report Material NG
        </Link>
      )}

      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
          checkStrictly: true,
          type: "radio",
        }}
        columns={columns}
        dataSource={data}
        size="small"
        loading={loading}
        onChange={handleTableChange}
        pagination={{
          size: "small",
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ["20", "50", "100"],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
        }}
        rowKey="id"
        scroll={{ x: "max-content", y: "calc(100vh - 400px)" }}
        className="small-table"
        style={{ fontSize: "11px" }}
      />

      <CreateProductionReportModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSuccess={() => {
          dispatch(
            fetchProductionReport({
              page: pagination.page,
              limit: pagination.limit,
            }),
          );
        }}
      />
    </Card>
  );
}
