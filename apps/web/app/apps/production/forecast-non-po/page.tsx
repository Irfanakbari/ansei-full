/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Input,
  Space,
  Table,
  Breadcrumb,
  Tag,
  Tooltip,
} from "antd";
import type { TableColumnsType, TableProps } from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  FileExcelOutlined,
  PrinterOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import FinishGoodLinkedModal from "@/components/production/FinishGoodLinkedModal";
import { formatDateTime } from "@/lib/utils/dateTime";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {
  fetchNonPo,
  deleteNonPo,
  downloadNonPo,
  printNonPo,
  type NonPoQuery,
  type NonPoRecord,
} from "@/store/features/production/forecastNonPo/forecastNonPoSlice";
import NonPoModal from "./_components/NonPoModal";
import ImportNonPoModal from "./_components/ImportNonPoModal";

export default function ForecastNonPoPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { message, modal } = App.useApp();
  const { data, meta, loading, error } = useSelector(
    (state: RootState) => state.forecastNonPo,
  );
  const [query, setQuery] = useState<NonPoQuery>({ page: 1, limit: 10 });
  const [selected, setSelected] = useState<number>();
  const [editor, setEditor] = useState<"create" | "edit" | "detail">();
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkedPart, setLinkedPart] = useState<string | null>(null);
  const record = data.find((row) => row.Id === selected);
  useEffect(() => {
    void dispatch(fetchNonPo(query));
    setSelected(undefined);
  }, [dispatch, query]);
  const refresh = () => {
    void dispatch(fetchNonPo(query));
  };
  const act = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (reason) {
      message.error(String(reason));
    } finally {
      setBusy(false);
    }
  };
  const search = (
    title: string,
    key: keyof NonPoQuery,
    dataIndex: string,
  ): TableColumnsType<NonPoRecord>[number] => ({
    title,
    key,
    dataIndex,
    filteredValue: query[key] ? [String(query[key])] : null,
    ellipsis: true,
    render: (value) =>
      key === "deliveryDate" ? formatDateTime(value) : value || "—",
    filterIcon: (filtered) => (
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
          placeholder={`Search ${title}`}
          style={{ marginBottom: 8, display: "block" }}
          type={key === "deliveryDate" ? "date" : "text"}
          value={String(selectedKeys[0] ?? "")}
          onChange={(event) =>
            setSelectedKeys(event.target.value ? [event.target.value] : [])
          }
          onPressEnter={() => confirm()}
        />
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<SearchOutlined />}
            style={{ width: 90 }}
            onClick={() => confirm()}
          >
            Search
          </Button>
          <Button
            size="small"
            style={{ width: 90 }}
            onClick={() => {
              clearFilters?.({ confirm: false });
              confirm({ closeDropdown: true });
            }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
  });
  const columns: TableColumnsType<NonPoRecord> = [
    {
      ...search("Reference", "referenceNumber", "ReferenceNumber"),
      render: (value: string, row) => (
        <Space size={4}>
          <GoldenArrowAction
            tooltip="View forecast details"
            ariaLabel={`View forecast details for ${row.ReferenceNumber}`}
            onClick={() => {
              setSelected(row.Id);
              setEditor("detail");
            }}
          />
          <Tooltip title={value}>
            <code style={{ fontSize: 11 }}>{value}</code>
          </Tooltip>
        </Space>
      ),
    },
    {
      ...search("Finish Good", "partNumber", "PartNumber"),
      render: (value: string, row) => (
        <Space size={4}>
          <GoldenArrowAction
            tooltip="View Finish Good details"
            ariaLabel={`View Finish Good details for ${value}`}
            onClick={() => setLinkedPart(value)}
          />
          <Tooltip title={`${value} - ${row.PartData?.PartName ?? ""}`}>
            <span>{value}</span>
          </Tooltip>
        </Space>
      ),
    },
    search("Delivery Date", "deliveryDate", "DeliveryDate"),
    search("Receiving Area", "receivingArea", "ReceivingArea"),
    {
      title: "Delivery Period",
      dataIndex: "DeliveryPeriod",
      align: "right",
      sorter: (a, b) => a.DeliveryPeriod - b.DeliveryPeriod,
    },
    {
      title: "Qty",
      dataIndex: "Qty",
      align: "right",
      sorter: (a, b) => a.Qty - b.Qty,
    },
    search("PO Number", "poNumber", "PoNumber"),
    {
      title: "Notes",
      dataIndex: "Notes",
      ellipsis: true,
      render: (value: string | null) => value || "—",
    },
    {
      title: "Status",
      render: (_, row) => (
        <Tooltip title={row.Demand?.ProductionRelease?.ReleaseNumber}>
          <Tag
            color={row.Demand?.ProductionReleaseId ? "processing" : "default"}
          >
            {row.Demand?.ProductionReleaseId ? "RELEASED" : "DRAFT"}
          </Tag>
        </Tooltip>
      ),
    },
  ];
  const change: NonNullable<TableProps<NonPoRecord>["onChange"]> = (
    pagination,
    filters,
    _sort,
    extra,
  ) =>
    setQuery({
      page: extra.action === "filter" ? 1 : (pagination.current ?? 1),
      limit: pagination.pageSize ?? 10,
      referenceNumber: filters.referenceNumber?.[0] as string | undefined,
      partNumber: filters.partNumber?.[0] as string | undefined,
      receivingArea: filters.receivingArea?.[0] as string | undefined,
      poNumber: filters.poNumber?.[0] as string | undefined,
      deliveryDate: filters.deliveryDate?.[0] as string | undefined,
    });
  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "Production" },
          { title: "Forecast (Non PO)" },
        ]}
      />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={refresh}
        />
        <ButtonToolbar
          title="Create"
          icon={<PlusOutlined />}
          onClick={() => setEditor("create")}
        />
        <ButtonToolbar
          title="Edit"
          icon={<EditOutlined />}
          enable={!!record}
          onClick={() => setEditor("edit")}
        />
        <ButtonToolbar
          title="Delete"
          icon={<DeleteOutlined />}
          enable={!!record && !busy}
          onClick={() =>
            modal.confirm({
              centered: true,
              title: "Delete this Non PO forecast?",
              content: record?.ReferenceNumber,
              onOk: () =>
                dispatch(deleteNonPo(record!.Id))
                  .unwrap()
                  .then(() => {
                    setSelected(undefined);
                    refresh();
                  })
                  .catch((reason) => {
                    message.error(String(reason));
                    throw reason;
                  }),
            })
          }
        />
        <ButtonToolbar
          title="Import"
          icon={<UploadOutlined />}
          onClick={() => setImporting(true)}
        />
        <ButtonToolbar
          title="Template"
          icon={<FileExcelOutlined />}
          enable={!busy}
          onClick={() =>
            void act(() =>
              dispatch(downloadNonPo({ kind: "template" })).unwrap(),
            )
          }
        />
        <ButtonToolbar
          title="Print Label"
          icon={<PrinterOutlined />}
          enable={!!record && !busy}
          onClick={() =>
            void act(async () => {
              await dispatch(printNonPo(record!.Id)).unwrap();
              message.success("Print request recorded");
            })
          }
        />
        <ButtonToolbar
          title="Download Label"
          icon={<DownloadOutlined />}
          enable={!!record && !busy}
          onClick={() =>
            void act(() =>
              dispatch(
                downloadNonPo({ kind: "label", id: record!.Id }),
              ).unwrap(),
            )
          }
        />
      </ToolbarWrapper>
      {error && (
        <Alert type="error" title={error} style={{ marginBottom: 8 }} />
      )}
      <Table
        rowKey="Id"
        columns={columns}
        dataSource={data}
        size="small"
        loading={loading}
        onChange={change}
        scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
        className="small-table"
        style={{ fontSize: "11px" }}
        onRow={(row) => ({
          onClick: () => setSelected(row.Id),
          onDoubleClick: () => {
            setSelected(row.Id);
            setEditor("detail");
          },
        })}
        rowClassName={(row) =>
          row.Id === selected ? "ant-table-row-selected" : ""
        }
        pagination={{
          size: "small",
          current: meta.page,
          pageSize: meta.limit,
          total: meta.totalItems,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} records`,
        }}
      />
      <FinishGoodLinkedModal
        open={linkedPart !== null}
        partNumber={linkedPart}
        onClose={() => setLinkedPart(null)}
      />
      <NonPoModal
        open={!!editor}
        record={editor === "create" ? undefined : record}
        detail={editor === "detail"}
        onClose={() => setEditor(undefined)}
        onSaved={refresh}
      />
      <ImportNonPoModal
        open={importing}
        onClose={() => setImporting(false)}
        onSaved={refresh}
      />
    </Card>
  );
}
