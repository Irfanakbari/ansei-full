/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
"use client";

import { App, Button, Input, Space, Table, Tag } from "antd";
import type { TableColumnsType, TableProps } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  fetchOrderCandidates,
  fetchOrderCandidateIds,
  type OrderCandidate,
  type OrderCandidateQuery,
} from "@/store/features/production/productionRelease/productionReleaseSlice";

interface Props {
  sourceType?: "PO" | "NON_PO";
  releaseId?: string;
  mode?: "tag" | "untag";
  selected: string[];
  onChange: (ids: string[]) => void;
  onBusyChange: (busy: boolean) => void;
}

/** Selection belongs to the modal, while paginated rows belong to this picker. */
export default function ProductionOrderPicker({
  sourceType = "PO",
  releaseId,
  mode,
  selected = [],
  onChange,
  onBusyChange,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [query, setQuery] = useState<OrderCandidateQuery>({
    page: 1,
    limit: 10,
  });
  const [rows, setRows] = useState<OrderCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string>();
  const selectionRequest = useRef(0);
  useEffect(
    () => () => {
      selectionRequest.current += 1;
    },
    [],
  );

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(undefined);
    void dispatch(
      fetchOrderCandidates({ ...query, sourceType, id: releaseId, mode }),
    )
      .unwrap()
      .then((result) => {
        if (current) {
          setRows(result.data);
          setTotal(result.meta.totalItems);
        }
      })
      .catch((reason: unknown) => {
        if (current) {
          setRows([]);
          setTotal(0);
          setError(String(reason));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [dispatch, mode, query, releaseId, sourceType]);

  const invalidateSelection = () => {
    selectionRequest.current += 1;
    setSelecting(false);
    onBusyChange(false);
    onChange([]);
  };

  const selectAll = async () => {
    const request = ++selectionRequest.current;
    setSelecting(true);
    onBusyChange(true);
    try {
      const result = await dispatch(
        fetchOrderCandidateIds({ ...query, sourceType, id: releaseId, mode }),
      ).unwrap();
      if (request === selectionRequest.current) onChange(result.demandIds);
    } catch (reason: unknown) {
      if (request === selectionRequest.current) message.error(String(reason));
    } finally {
      if (request === selectionRequest.current) {
        setSelecting(false);
        onBusyChange(false);
      }
    }
  };

  const searchColumn = (
    field: "poNumber" | "partNumber" | "deliveryDate",
    title: string,
  ): TableColumnsType<OrderCandidate>[number] => ({
    title,
    key: field,
    dataIndex:
      field === "poNumber"
        ? "PoId"
        : field === "partNumber"
          ? "FinishGoodId"
          : "DeliveryDate",
    filteredValue: query[field] ? [query[field]!] : null,
    render: (value: string) =>
      field === "deliveryDate" ? value?.slice(0, 10) : value,
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    filterDropdown: ({
      selectedKeys,
      setSelectedKeys,
      confirm,
      clearFilters,
    }) => (
      <div
        style={{ padding: 8 }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Input
          type={field === "deliveryDate" ? "date" : "text"}
          aria-label={`Filter ${title}`}
          value={String(selectedKeys[0] ?? "")}
          onChange={(event) =>
            setSelectedKeys(event.target.value ? [event.target.value] : [])
          }
          onPressEnter={() => confirm()}
        />
        <Space style={{ marginTop: 8 }}>
          <Button size="small" type="primary" onClick={() => confirm()}>
            Search
          </Button>
          <Button
            size="small"
            onClick={() => {
              clearFilters?.();
              confirm();
            }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
  });
  const columns: TableColumnsType<OrderCandidate> = [
    searchColumn("poNumber", "Order Reference"),
    searchColumn("partNumber", "Part Number"),
    searchColumn("deliveryDate", "Delivery Date"),
    { title: "Delivery Period", dataIndex: "DeliveryPeriod" },
    { title: "Qty", dataIndex: "Qty", align: "right" },
  ];
  const changeTable: NonNullable<TableProps<OrderCandidate>["onChange"]> = (
    pagination,
    filters,
  ) => {
    const next = {
      poNumber: filters.poNumber?.[0] as string | undefined,
      partNumber: filters.partNumber?.[0] as string | undefined,
      deliveryDate: filters.deliveryDate?.[0] as string | undefined,
    };
    const changed =
      next.poNumber !== query.poNumber ||
      next.partNumber !== query.partNumber ||
      next.deliveryDate !== query.deliveryDate;
    if (changed) invalidateSelection();
    setQuery({
      ...next,
      page: changed ? 1 : (pagination.current ?? 1),
      limit: pagination.pageSize ?? 10,
    });
  };
  return (
    <>
      <Space wrap style={{ marginBottom: 8 }}>
        <Button
          onClick={() => void selectAll()}
          loading={selecting}
          disabled={loading || !!error || total === 0}
        >
          Select all matching orders ({total})
        </Button>
        <Button
          onClick={invalidateSelection}
          disabled={!selected.length && !selecting}
        >
          Clear selection
        </Button>
        <Tag color="blue">{selected.length} selected</Tag>
      </Space>
      {error && <div role="alert">{error}</div>}
      <Table<OrderCandidate>
        rowKey="PoId"
        columns={columns}
        dataSource={rows}
        size="small"
        loading={loading}
        onChange={changeTable}
        scroll={{ x: "max-content", y: 300 }}
        rowSelection={{
          selectedRowKeys: selected,
          preserveSelectedRowKeys: true,
          onChange: (keys) => onChange(keys.map(String)),
          getCheckboxProps: () => ({ disabled: selecting || loading }),
        }}
        pagination={{
          current: query.page,
          pageSize: query.limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
        }}
      />
    </>
  );
}
