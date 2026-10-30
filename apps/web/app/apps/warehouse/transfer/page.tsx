/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-10-29 */
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Table, Card, Breadcrumb, Input, Button, Space, Tag } from "antd";
import type { InputRef, TableProps } from "antd";
import {
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchTransferHistory,
  setTransferQuery,
  type TransferHistoryItem,
} from "@/store/features/warehouse/transfer/transferSlice";
import CreateTransferModal from "./_components/CreateTransferModal";
import RevertTransferModal from "./_components/RevertTransferModal";
import DetailTransferModal from "./_components/DetailTransferModal";
import { formatDateTime } from "@/lib/utils/dateTime";
import { useSingleRowSelection } from "@/hooks/useSingleRowSelection";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";

export default function TransferPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { can } = usePhasePermission();
  const { history, loading, pagination, query } = useSelector(
    (state: RootState) => state.transfer,
  );

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isRevertModalVisible, setIsRevertModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<TransferHistoryItem | null>(
    null,
  );

  const searchInput = useRef<InputRef>(null);
  const getTransferKey = useCallback(
    (record: TransferHistoryItem) => record.referenceDoc,
    [],
  );
  const { selectedRecord, selectRecord, clearSelection, isSelected } =
    useSingleRowSelection(history, getTransferKey);

  const canCreate = can("IPCS.TRANSFER_CREATE");
  const canRevert = can("IPCS.TRANSFER_REVERT");

  useEffect(() => {
    dispatch(fetchTransferHistory(query));
  }, [dispatch, query]);

  const handleOpenDetail = (record: TransferHistoryItem) => {
    selectRecord(record);
    setDetailRecord(record);
    setIsDetailModalVisible(true);
  };

  const handleOpenRevert = (record?: TransferHistoryItem) => {
    const target = record ?? selectedRecord;
    if (target && target.status === "COMPLETED") {
      setDetailRecord(target);
      setIsRevertModalVisible(true);
    }
  };

  const handleRefresh = () => {
    dispatch(fetchTransferHistory(query));
  };

  const handleTableChange: TableProps<TransferHistoryItem>["onChange"] = (
    paginationConfig,
    filters,
  ) => {
    const searchVal = String(
      filters.materialId?.[0] ?? filters.referenceDoc?.[0] ?? "",
    ).trim();
    const statusVal = filters.status?.[0]
      ? String(filters.status[0])
      : undefined;

    clearSelection();
    dispatch(
      setTransferQuery({
        page: paginationConfig.current ?? 1,
        limit: paginationConfig.pageSize ?? 50,
        search: searchVal || undefined,
        status: statusVal,
      }),
    );
  };

  const getColumnSearchProps = (dataIndex: keyof TransferHistoryItem) => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: any) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput as any}
          placeholder={`Search ${String(dataIndex)}`}
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
  });

  const columns: TableProps<TransferHistoryItem>["columns"] = [
    {
      title: "Reference Doc",
      dataIndex: "referenceDoc",
      key: "referenceDoc",
      render: (val: string, record: TransferHistoryItem) => (
        <Space size={4}>
          <GoldenArrowAction
            tooltip="View transfer detail"
            ariaLabel={`View transfer detail ${val}`}
            onClick={() => handleOpenDetail(record)}
          />
          <code style={{ fontSize: 11 }}>{val}</code>
        </Space>
      ),
      ...getColumnSearchProps("referenceDoc"),
    },
    {
      title: "Part Number",
      dataIndex: "materialId",
      key: "materialId",
      render: (val: string) => <b>{val}</b>,
      ...getColumnSearchProps("materialId"),
    },
    {
      title: "Part Name",
      dataIndex: "partName",
      key: "partName",
    },
    {
      title: "Rack Location",
      dataIndex: "rackLocation",
      key: "rackLocation",
      render: (val: string | null) => val || "-",
    },
    {
      title: "Transfer Qty",
      dataIndex: "qty",
      key: "qty",
      align: "right",
      render: (val: number) => (
        <Tag color="blue" style={{ fontWeight: 600 }}>
          {val}
        </Tag>
      ),
    },
    {
      title: "Warehouse",
      key: "warehouseStock",
      align: "center",
      render: (_, r) => (
        <span style={{ fontSize: 12 }}>
          {r.warehouseBefore} &rarr; <b>{r.warehouseAfter}</b>
        </span>
      ),
    },
    {
      title: "Rack",
      key: "rackStock",
      align: "center",
      render: (_, r) => (
        <span style={{ fontSize: 12 }}>
          {r.rackBefore} &rarr; <b>{r.rackAfter}</b>
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      filters: [
        { text: "COMPLETED", value: "COMPLETED" },
        { text: "REVERTED", value: "REVERTED" },
      ],
      filterMultiple: false,
      render: (status: "COMPLETED" | "REVERTED") => (
        <Tag color={status === "COMPLETED" ? "green" : "red"}>{status}</Tag>
      ),
    },
    {
      title: "Transfer Date",
      dataIndex: "transactionDate",
      key: "transactionDate",
      render: formatDateTime,
    },
    {
      title: "Transferred By",
      key: "createdBy",
      render: (_, r) => r.createdByName || r.createdBy || "-",
    },
    {
      title: "Reverted Date",
      dataIndex: "revertedAt",
      key: "revertedAt",
      render: (val: string | null) => (val ? formatDateTime(val) : "-"),
    },
    {
      title: "Reverted By",
      key: "revertedBy",
      render: (_, r) => r.revertedByName || r.revertedBy || "-",
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      ellipsis: true,
      render: (val: string | null) => val || "-",
    },
  ];

  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "Warehouse" },
          { title: "Transfer to Rack" },
        ]}
      />

      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
        />
        <ButtonToolbar
          title="Transfer to Rack"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalVisible(true)}
          enable={canCreate}
        />
        <ButtonToolbar
          title="Revert"
          icon={<RollbackOutlined />}
          onClick={() => handleOpenRevert()}
          enable={
            Boolean(
              selectedRecord &&
                selectedRecord.status === "COMPLETED" &&
                canRevert,
            )
          }
        />
      </ToolbarWrapper>

      <Table
        columns={columns}
        dataSource={history}
        rowKey="referenceDoc"
        loading={loading}
        size="small"
        className="small-table"
        style={{ fontSize: "11px" }}
        scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: () => selectRecord(record),
          onDoubleClick: () => handleOpenDetail(record),
        })}
        rowClassName={(record) =>
          isSelected(record) ? "ant-table-row-selected" : ""
        }
        pagination={{
          size: "small",
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.totalItems,
          showSizeChanger: true,
          pageSizeOptions: [30, 50, 100],
          showTotal: (total) => `Total ${total} records`,
        }}
      />

      <CreateTransferModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSuccess={handleRefresh}
      />

      <RevertTransferModal
        visible={isRevertModalVisible}
        onClose={() => {
          setIsRevertModalVisible(false);
          setDetailRecord(null);
        }}
        record={detailRecord}
        onSuccess={() => {
          clearSelection();
          handleRefresh();
        }}
      />

      <DetailTransferModal
        visible={isDetailModalVisible}
        onClose={() => {
          setIsDetailModalVisible(false);
          setDetailRecord(null);
        }}
        record={detailRecord}
        onRevertClick={(r) => handleOpenRevert(r)}
        canRevert={canRevert}
      />
    </Card>
  );
}
