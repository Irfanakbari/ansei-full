/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  Table,
  Card,
  Breadcrumb,
  App,
  Input,
  Button,
  DatePicker,
  Space,
  Tag,
  Tooltip,
} from "antd";
import type { InputRef, TableProps } from "antd";
import type {
  ColumnType,
  FilterDropdownProps,
  FilterValue,
} from "antd/es/table/interface";
import dayjs, { type Dayjs } from "dayjs";
import {
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
  UploadOutlined,
  PrinterOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import {
  ForecastEntity,
  fetchForecast,
  downloadForecastLabel,
  printForecastTag,
  setForecastQuery,
} from "@/store/features/production/forecast/forecastSlice";
import CreateForecastModal from "./_components/CreateForecastModal";
import ImportForecastModal from "./_components/ImportForecastModal";
import ForecastModal from "./_components/ForecastModal";
import FinishGoodLinkedModal from "@/components/production/FinishGoodLinkedModal";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import SapDocumentNumbers, {
  type SapDocumentSummary,
} from "@/components/SapDocumentNumbers";
import { useSingleRowSelection } from "@/hooks/useSingleRowSelection";
import { formatDateTime } from "@/lib/utils/dateTime";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "warning",
  RELEASED: "processing",
  COMPLETED: "success",
  CANCELLED: "error",
};

export default function ForecastPage() {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, query, pagination } = useSelector(
    (state: RootState) => state.forecast,
  );

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [linkedFinishGood, setLinkedFinishGood] = useState<
    ForecastEntity["PartData"] | null
  >(null);
  const [modalData, setModalData] = useState<ForecastEntity | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const printInFlight = useRef(false);
  const [sortedInfo, setSortedInfo] = useState<any>({});

  const searchInput = useRef<InputRef>(null);
  const getForecastKey = useCallback((record: ForecastEntity) => record.Id, []);
  const { selectedRecord, selectRecord, clearSelection, isSelected } =
    useSingleRowSelection(data, getForecastKey);

  useEffect(() => {
    dispatch(fetchForecast(query));
  }, [dispatch, query]);

  const handlePrintTag = async () => {
    if (selectedRecord && !printInFlight.current) {
      printInFlight.current = true;
      try {
        setIsPrinting(true);
        const result = await dispatch(printForecastTag(selectedRecord.PoId));

        if (printForecastTag.rejected.match(result)) {
          throw new Error((result.payload as string) || "Failed to print tag");
        }

        message.success(
          result.payload.message || "Print job emitted successfully",
        );
      } catch (error: unknown) {
        const err = error as Error;
        message.error(err?.message || String(error) || "Failed to print tag");
      } finally {
        printInFlight.current = false;
        setIsPrinting(false);
      }
    }
  };

  const handleDownloadLabel = async () => {
    if (!selectedRecord) return;
    try {
      setIsDownloading(true);
      await dispatch(downloadForecastLabel(selectedRecord.PoId)).unwrap();
      message.success("Label downloaded successfully");
    } catch (error: unknown) {
      message.error(
        typeof error === "string" ? error : "Failed to download label",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const getFilterText = (
    value: FilterValue | null | undefined,
  ): string | undefined => {
    const filterValue = value?.[0];
    return typeof filterValue === "string" && filterValue.trim()
      ? filterValue.trim()
      : undefined;
  };

  const handleTableChange: TableProps<ForecastEntity>["onChange"] = (
    tablePagination,
    filters,
    sorter,
    extra,
  ) => {
    setSortedInfo(Array.isArray(sorter) ? (sorter[0] ?? {}) : sorter);
    const deliveryDateRange = filters.DeliveryDate as string[] | null;

    dispatch(
      setForecastQuery({
        page: extra.action === "filter" ? 1 : tablePagination.current,
        limit: tablePagination.pageSize,
        poNumber: getFilterText(filters.PoId),
        partNumber: getFilterText(filters.PartNumber),
        search: getFilterText(filters.VendorName),
        deliveryDateFrom: deliveryDateRange?.[0],
        deliveryDateTo: deliveryDateRange?.[1],
      }),
    );
  };

  const resetColumnFilter = (
    clearFilters: FilterDropdownProps["clearFilters"],
    confirm: FilterDropdownProps["confirm"],
  ) => {
    clearFilters?.({ confirm: false });
    confirm({ closeDropdown: true });
  };

  const getColumnSearchProps = (
    label: string,
    filteredValue?: string,
  ): Pick<
    ColumnType<ForecastEntity>,
    "filterDropdown" | "filterIcon" | "filteredValue"
  > => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: FilterDropdownProps) => (
      <div
        style={{ padding: 8 }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <Input
          ref={searchInput}
          placeholder={`Search ${label}`}
          value={selectedKeys[0] as string | undefined}
          onChange={(event) =>
            setSelectedKeys(event.target.value ? [event.target.value] : [])
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
            onClick={() => resetColumnFilter(clearFilters, confirm)}
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
    filteredValue: filteredValue ? [filteredValue] : null,
  });

  const columns = [
    {
      title: "PO Number",
      dataIndex: "PoId",
      key: "PoId",
      ellipsis: true,
      render: (val: string, record: ForecastEntity) => (
        <Space size={4}>
          <GoldenArrowAction
            tooltip="View forecast details"
            ariaLabel={`View forecast details for ${record.PoId}`}
            onClick={() => {
              selectRecord(record);
              setModalData(record);
            }}
          />
          <Tooltip title={val}>
            <code style={{ fontSize: 11 }}>{val}</code>
          </Tooltip>
        </Space>
      ),
      ...getColumnSearchProps("PO Number", query.poNumber),
    },
    {
      title: "Finish Good",
      dataIndex: ["PartData", "PartNumber"],
      key: "PartNumber",
      render: (_: any, record: ForecastEntity) => (
        <Space size={4}>
          <GoldenArrowAction
            tooltip="View Finish Good details"
            ariaLabel={`View Finish Good details for ${record.PartData?.PartNumber || "unknown part"}`}
            onClick={() => setLinkedFinishGood(record.PartData ?? null)}
          />
          <Tooltip
            title={`${record.PartData?.PartNumber} - ${record.PartData?.PartName}`}
          >
            <span>{record.PartData?.PartNumber || "-"}</span>
          </Tooltip>
        </Space>
      ),
      ...getColumnSearchProps("Finish Good", query.partNumber),
    },
    {
      title: "Vendor",
      dataIndex: "VendorName",
      key: "VendorName",
      ellipsis: true,
      ...getColumnSearchProps("Vendor", query.search),
    },
    {
      title: "Qty",
      dataIndex: "Qty",
      key: "Qty",
      align: "right" as const,
      sorter: (a: ForecastEntity, b: ForecastEntity) => a.Qty - b.Qty,
      sortOrder: sortedInfo.columnKey === "Qty" ? sortedInfo.order : null,
    },
    {
      title: "Delivery Period",
      dataIndex: "DeliveryPeriod",
      key: "DeliveryPeriod",
      align: "right" as const,
      sorter: (a: ForecastEntity, b: ForecastEntity) =>
        a.DeliveryPeriod - b.DeliveryPeriod,
      sortOrder:
        sortedInfo.columnKey === "DeliveryPeriod" ? sortedInfo.order : null,
    },
    {
      title: "Delivery Date",
      dataIndex: "DeliveryDate",
      key: "DeliveryDate",
      render: formatDateTime,
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
      }: FilterDropdownProps) => {
        const currentRange = selectedKeys as string[];
        const pickerValue: [Dayjs, Dayjs] | null =
          currentRange.length === 2
            ? [dayjs(currentRange[0]), dayjs(currentRange[1])]
            : null;

        return (
          <div
            style={{ padding: 8 }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <DatePicker.RangePicker
              value={pickerValue}
              format="DD/MM/YYYY"
              allowClear
              onChange={(dates) => {
                const [from, to] = dates ?? [];
                setSelectedKeys(
                  from && to
                    ? [from.format("YYYY-MM-DD"), to.format("YYYY-MM-DD")]
                    : [],
                );
              }}
              style={{ marginBottom: 8 }}
            />
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={() => confirm()}
                style={{ width: 90 }}
              >
                Filter
              </Button>
              <Button
                size="small"
                onClick={() => resetColumnFilter(clearFilters, confirm)}
                style={{ width: 90 }}
              >
                Reset
              </Button>
            </Space>
          </div>
        );
      },
      filteredValue:
        query.deliveryDateFrom && query.deliveryDateTo
          ? [query.deliveryDateFrom, query.deliveryDateTo]
          : null,
      sorter: (a: ForecastEntity, b: ForecastEntity) =>
        new Date(a.DeliveryDate).getTime() - new Date(b.DeliveryDate).getTime(),
      sortOrder:
        sortedInfo.columnKey === "DeliveryDate" ? sortedInfo.order : null,
    },
    {
      title: "Status",
      key: "Status",
      render: (_: any, record: ForecastEntity) => {
        const status = record.ProductionReleaseId ? "RELEASED" : "DRAFT";
        return <Tag color={STATUS_COLORS[status] || "default"}>{status}</Tag>;
      },
    },
    {
      title: "SAP Doc Number",
      dataIndex: "SAPDocuments",
      key: "SAPDocuments",
      render: (value: SapDocumentSummary[] | undefined) => (
        <SapDocumentNumbers value={value} />
      ),
    },
  ];

  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "Production" },
          { title: "Forecast" },
        ]}
      />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => dispatch(fetchForecast(query))}
        />
        <ButtonToolbar
          title="Create"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalVisible(true)}
        />
        <ButtonToolbar
          title="Import"
          icon={<UploadOutlined />}
          onClick={() => setIsImportModalVisible(true)}
        />
        <ButtonToolbar
          title="Print Label"
          icon={<PrinterOutlined />}
          onClick={handlePrintTag}
          loading={isPrinting}
          enable={Boolean(selectedRecord)}
        />
        <ButtonToolbar
          title="Download Label"
          icon={<DownloadOutlined />}
          onClick={handleDownloadLabel}
          loading={isDownloading}
          enable={Boolean(selectedRecord)}
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
          total: pagination.totalItems,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} records`,
        }}
        rowKey="Id"
        onRow={(record) => ({
          onClick: () => selectRecord(record),
          onDoubleClick: () => {
            selectRecord(record);
            setModalData(record);
          },
        })}
        rowClassName={(record) =>
          isSelected(record) ? "ant-table-row-selected" : ""
        }
        scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
        className="small-table"
        style={{ fontSize: "11px" }}
      />

      <ForecastModal
        visible={modalData !== null}
        onClose={() => setModalData(null)}
        data={modalData}
        onUpdated={(forecast) => {
          setModalData(forecast);
          void dispatch(fetchForecast(query));
        }}
        onDeleted={() => {
          clearSelection();
          setModalData(null);
          void dispatch(fetchForecast(query));
        }}
      />

      <FinishGoodLinkedModal
        open={linkedFinishGood !== null}
        partNumber={linkedFinishGood?.PartNumber ?? null}
        onClose={() => setLinkedFinishGood(null)}
      />

      <CreateForecastModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSuccess={() => dispatch(fetchForecast(query))}
      />

      <ImportForecastModal
        visible={isImportModalVisible}
        onClose={() => setIsImportModalVisible(false)}
        onSuccess={() => dispatch(fetchForecast(query))}
      />
    </Card>
  );
}
