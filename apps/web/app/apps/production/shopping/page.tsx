/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  Card,
  Breadcrumb,
  App,
  Input,
  Button,
  Space,
  Tag,
  Tooltip,
} from "antd";
import type { InputRef } from "antd";
import {
  ReloadOutlined,
  EyeOutlined,
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import {
  ShoppingEntity,
  fetchShopping,
  deleteShopping,
  clearDetail,
  setShoppingQuery,
} from "@/store/features/production/shopping/shoppingSlice";
import DetailShoppingModal from "./_components/DetailShoppingModal";
import CreateShoppingModal from "./_components/CreateShoppingModal";
import { formatDateTime } from "@/lib/utils/dateTime";

export default function ShoppingPage() {
  const { message, modal } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, query, pagination } = useSelector(
    (state: RootState) => state.shopping,
  );

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [detailData, setDetailData] = useState<ShoppingEntity | null>(null);
  const [sortedInfo, setSortedInfo] = useState<any>({});

  const searchInput = useRef<InputRef>(null);

  useEffect(() => {
    dispatch(fetchShopping(query));
  }, [dispatch, query]);

  const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);

  const handleViewDetail = () => {
    if (selectedRecord) {
      setDetailData(selectedRecord);
      setIsDetailModalVisible(true);
    }
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalVisible(false);
    setDetailData(null);
    dispatch(clearDetail());
  };

  const handleDelete = () => {
    if (selectedRecord) {
      modal.confirm({
        title: "Delete Shopping?",
        icon: <DeleteOutlined />,
        content: `Delete shopping ${selectedRecord.Id}?`,
        okText: "Delete",
        okType: "danger",
        cancelText: "Cancel",
        centered: true,
        onOk: async () => {
          try {
            const result = await dispatch(deleteShopping(selectedRecord.Id));

            if (deleteShopping.rejected.match(result)) {
              throw new Error(
                (result.payload as string) || "Failed to delete shopping",
              );
            }
            message.success("Shopping deleted successfully");
            setSelectedRowKeys([]);
            dispatch(fetchShopping(query));
          } catch (error: unknown) {
            const err = error as Error;
            message.error(
              err?.message || String(error) || "Failed to delete shopping",
            );
          }
        },
      });
    }
  };

  const handleTableChange = (
    tablePagination: any,
    filters: any,
    sorter: any,
  ) => {
    setSortedInfo(sorter);
    const search = Object.entries(filters)
      .filter(([key]) => key !== "Type")
      .flatMap(([, values]) => values ?? [])
      .find((value) => typeof value === "string") as string | undefined;
    const purpose = filters.Type?.[0]?.toString();
    dispatch(
      setShoppingQuery({
        page: tablePagination.current,
        limit: tablePagination.pageSize,
        search,
        purpose,
      }),
    );
  };

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
      return record[dataIndex]
        ?.toString()
        .toLowerCase()
        .includes((value as string).toLowerCase());
    },
  });

  const columns = [
    {
      title: "Material",
      dataIndex: ["MaterialData", "PartNumber"],
      key: "MaterialData",
      render: (_: any, record: ShoppingEntity) => (
        <Tooltip
          title={`${record.MaterialData?.PartNumber} - ${record.MaterialData?.PartName}`}
        >
          <span>{record.MaterialData?.PartNumber}</span>
        </Tooltip>
      ),
      ...getColumnSearchProps("MaterialData.PartNumber"),
    },
    {
      title: "PO Number",
      dataIndex: "ForecastId",
      key: "ForecastId",
      ellipsis: true,
      render: (val: string) => <code style={{ fontSize: 11 }}>{val}</code>,
      ...getColumnSearchProps("ForecastId"),
    },
    {
      title: "Qty Pick",
      dataIndex: "QtyPick",
      key: "QtyPick",
      align: "right" as const,
      render: (val: number) => <Tag color="green">{val}</Tag>,
      sorter: (a: ShoppingEntity, b: ShoppingEntity) => a.QtyPick - b.QtyPick,
      sortOrder: sortedInfo.columnKey === "QtyPick" ? sortedInfo.order : null,
    },
    {
      title: "Type",
      dataIndex: "Purpose",
      key: "Type",
      filters: [
        { text: "Regular", value: "STANDARD" },
        { text: "Non-production", value: "NON_PRODUCTION" },
      ],
      filterMultiple: false,
      filteredValue: query.purpose ? [query.purpose] : null,
      render: (val: string) => (
        <Tag color={val === "STANDARD" ? "blue" : "orange"}>
          {val === "STANDARD" ? "REGULAR" : "NON-PRODUCTION"}
        </Tag>
      ),
    },
    {
      title: "Description",
      dataIndex: "Description",
      key: "Description",
      ellipsis: true,
      render: (val: string | null) => val || "-",
    },
    {
      title: "Created At",
      dataIndex: "CreatedAt",
      key: "CreatedAt",
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
          { title: "Shopping" },
        ]}
      />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => dispatch(fetchShopping(query))}
        />
        <ButtonToolbar
          title="Create"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalVisible(true)}
        />
        <ButtonToolbar
          title="Delete"
          icon={<DeleteOutlined />}
          onClick={handleDelete}
          enable={selectedRowKeys.length === 1}
        />
        <ButtonToolbar
          title="Detail"
          icon={<EyeOutlined />}
          onClick={handleViewDetail}
          enable={selectedRowKeys.length === 1}
        />
      </ToolbarWrapper>

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
          total: pagination.totalItems,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} records`,
        }}
        rowKey="Id"
        scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
        className="small-table"
        style={{ fontSize: "11px" }}
      />

      {detailData && (
        <DetailShoppingModal
          visible={isDetailModalVisible}
          onClose={handleCloseDetailModal}
          data={detailData}
        />
      )}

      <CreateShoppingModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSuccess={() => dispatch(fetchShopping(query))}
      />
    </Card>
  );
}
