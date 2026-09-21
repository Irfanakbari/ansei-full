/*By Irfan Akbari Vuteq Indonesia - 2026-06-10*/
"use client";

import Link from "next/link";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import React, { useEffect, useRef, useState } from "react";
import { Table, Card, Breadcrumb, Input, Button, Space, Tag } from "antd";
import type { InputRef } from "antd";
import {
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import {
  fetchDelivery,
  setFilters,
} from "@/store/features/production/delivery/deliverySlice";
import { fetchPreDelivery } from "@/store/features/production/preDelivery/preDeliverySlice";
import CreateDeliveryModal from "./_components/CreateDeliveryModal";

const formatDateTime = (val: string | null | undefined) => {
  if (!val) return "-";
  return new Date(val).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function DeliveryPage() {
  const { can } = usePhasePermission();
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, pagination, filters } = useSelector(
    (state: RootState) => state.delivery,
  );
  const searchInput = useRef<InputRef>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchDelivery(filters));
  }, [dispatch, filters]);

  const handleOpenCreateModal = () => {
    // Fetch preDelivery data for the label dropdown
    dispatch(fetchPreDelivery({ page: 1, limit: 500, scanned: true }));
    // Also fetch fresh delivery data to get updated list of delivered labels
    dispatch(fetchDelivery({ ...filters, page: 1, limit: 500 }));
    setIsCreateModalVisible(true);
  };

  const handleTableChange = (pag: any) => {
    dispatch(setFilters({ page: pag.current, limit: pag.pageSize }));
  };

  const handleCreateSuccess = () => {
    dispatch(fetchDelivery(filters));
  };

  // Column search filter
  const getColumnSearchProps = (dataIndex: string) => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: any) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput as any}
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
            style={{ width: 80 }}
          >
            Search
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
      return record[dataIndex]
        ?.toString()
        .toLowerCase()
        .includes((value as string).toLowerCase());
    },
  });

  const columns = [
    {
      title: "Traceability",
      key: "traceability",
      render: (_: unknown, row: { forecastId: string; labelDataId: string }) =>
        can("IPCS.TRACEABILITY_READ") ? (
          <Link
            href={`/apps/traceability?poId=${encodeURIComponent(row.forecastId)}&label=${encodeURIComponent(row.labelDataId)} `.trim()}
          >
            View Traceability
          </Link>
        ) : null,
    },
    // {
    //     title: 'ID',
    //     dataIndex: 'id',
    //     key: 'id',
    //     width: 80,
    //     render: (val: number) => <code style={{ fontSize: 11 }}>{val}</code>,
    // },
    {
      title: "Release Number",
      dataIndex: "releaseNumber",
      key: "releaseNumber",
      render: (val: string | null) => val || "-",
    },
    {
      title: "PO Number",
      dataIndex: "forecastId",
      key: "forecastId",
      ...getColumnSearchProps("forecastId"),
      render: (val: string) => val,
    },
    {
      title: "Label Number",
      dataIndex: "labelNumber",
      key: "labelNumber",
      ...getColumnSearchProps("labelNumber"),
    },
    {
      title: "Qty",
      dataIndex: "qty",
      key: "qty",
      align: "right" as const,
      render: (val: number) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: "Created By",
      dataIndex: "createdBy",
      key: "createdBy",
      render: (_: any, record: any) =>
        record.createdByName || record.CreatedByName || "-",
      ...getColumnSearchProps("createdBy"),
    },
    {
      title: "Delivered At",
      dataIndex: "createdAt",
      key: "createdAt",
      render: formatDateTime,
    },
  ];

  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "Production" },
          { title: "Process" },
          { title: "Delivery" },
        ]}
      />

      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => dispatch(fetchDelivery(filters))}
        />
        <ButtonToolbar
          title="Create"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateModal}
        />
      </ToolbarWrapper>

      <Table
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
          showTotal: (total: number, range: number[]) =>
            `${range[0]}-${range[1]} of ${total}`,
        }}
        rowKey="id"
        scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
        className="small-table"
      />

      <CreateDeliveryModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />
    </Card>
  );
}
