/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import { sapAttention } from "./sapAttention";
import type { TableProps } from "antd";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import {
  SearchOutlined,
  ReloadOutlined,
  RollbackOutlined,
  EyeOutlined,
  EditOutlined,
  SyncOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import type { AppDispatch } from "@/store";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import { formatDateTime } from "@/lib/utils/dateTime";
import {
  fetchSapExternal,
  type SapExternalRow,
  fetchSapMappings,
  fetchSapTransactions,
  fetchSapStock,
  fetchSapDetail,
  sapAction,
  type SapMappingRow,
  type SapTransactionRow,
  type SapStockRow,
  type SapQuery,
  type SapDetail,
} from "@/store/features/system-administration/sapConnectionSlice";
const number = (value: number | null) =>
  value === null ? "Not checked" : value.toLocaleString();
const statusTag = (value: string) => (
  <Tag
    color={
      ["SYNCED", "MATCHED"].includes(value)
        ? "success"
        : ["FAILED", "UNEXPLAINED", "BRIDGE_INVALID"].includes(value)
          ? "error"
          : "warning"
    }
  >
    {value.replaceAll("_", " ")}
  </Tag>
);
export default function SapTables({
  kind,
  refresh,
}: {
  kind: "transactions" | "stock" | "mappings";
  refresh: number;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { message } = App.useApp();
  const { can } = usePhasePermission();
  const [selectedKey, setSelectedKey] = useState<string>();
  const [reload, setReload] = useState(0);
  const refreshTables = () => {
    setSelectedKey(undefined);
    setReload((value) => value + 1);
  };
  const [query, setQuery] = useState<SapQuery>({
    page: 1,
    limit: kind === "mappings" ? 50 : 20,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [total, setTotal] = useState(0);
  const [external, setExternal] = useState<SapExternalRow[]>([]);
  const [externalPage, setExternalPage] = useState(1);
  const [externalTotal, setExternalTotal] = useState(0);
  const [transactions, setTransactions] = useState<SapTransactionRow[]>([]);
  const [stock, setStock] = useState<SapStockRow[]>([]);
  const [mappings, setMappings] = useState<SapMappingRow[]>([]);
  const [selected, setSelected] = useState<SapTransactionRow>();
  const [mapping, setMapping] = useState<SapMappingRow>();
  const [detail, setDetail] = useState<SapDetail>();
  const [saving, setSaving] = useState(false);
  const [automaticSales, setAutomaticSales] = useState(false);
  const [form] = Form.useForm<{
    cardCode: string;
    reason: string;
    salesOrderEntry: number;
    salesOrderLine: number;
  }>();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    const load = async () => {
      try {
        if (kind === "transactions") {
          const result = await dispatch(fetchSapTransactions(query)).unwrap();
          if (active) {
            setTransactions(result.data);
            setTotal(result.meta.totalItems);
          }
        } else if (kind === "stock") {
          const result = await dispatch(fetchSapStock(query)).unwrap();
          if (active) {
            setStock(result.data);
            setTotal(result.meta.totalItems);
          }
        } else {
          const result = await dispatch(fetchSapMappings(query)).unwrap();
          if (active) {
            setMappings(result.data);
            setTotal(result.meta.totalItems);
          }
        }
      } catch (failure) {
        if (active) setError(String(failure));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [dispatch, kind, query, refresh, reload]);
  useEffect(() => {
    let active = true;
    if (kind === "stock")
      void dispatch(fetchSapExternal({ page: externalPage, limit: 10 }))
        .unwrap()
        .then((result) => {
          if (active) {
            setExternal(result.data);
            setExternalTotal(result.meta.totalItems);
          }
        })
        .catch((failure) => {
          if (active) setError(String(failure));
        });
    return () => {
      active = false;
    };
  }, [dispatch, kind, externalPage, refresh, reload]);
  const search = {
    filterIcon: <SearchOutlined />,
    filteredValue: query.search ? [query.search] : null,
    filterDropdown: (
      <div className="p-3">
        <Input.Search
          placeholder="Search item / reference"
          defaultValue={query.search}
          allowClear
          onSearch={(value) =>
            setQuery({ ...query, search: value || undefined, page: 1 })
          }
        />
      </div>
    ),
  };
  const pagination = {
    size: "small" as const,
    showTotal: (total: number) => `Total ${total} records`,
    current: query.page,
    pageSize: query.limit,
    total,
    showSizeChanger: true,
    onChange: (page: number, limit: number) =>
      setQuery({ ...query, page, limit }),
  };
  async function runReconcile(row: SapTransactionRow) {
    setSaving(true);
    try {
      await dispatch(sapAction({ action: "reconcile", id: row.id })).unwrap();
      message.success("SAP document verified.");
      setQuery({ ...query });
    } catch (failure) {
      message.error(String(failure));
    } finally {
      setSaving(false);
    }
  }
  const [cancelCounting, setCancelCounting] = useState(false);
  async function submit() {
    if (saving) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await dispatch(
        sapAction(
          mapping
            ? {
                action: automaticSales ? "automatic-sales" : "mappings",
                body: {
                  reason: values.reason,
                  demandId: mapping.demandId,
                  ...(automaticSales
                    ? { cardCode: values.cardCode }
                    : {
                        salesOrderEntry: values.salesOrderEntry,
                        salesOrderLine: values.salesOrderLine,
                      }),
                },
              }
            : {
                action: cancelCounting ? "cancel-counting" : "retry",
                id: selected?.id,
                body: { reason: values.reason },
              },
        ),
      ).unwrap();
      message.success("Action recorded.");
      setSelected(undefined);
      setMapping(undefined);
      setQuery({ ...query });
    } catch (failure) {
      if (!(failure && typeof failure === "object" && "errorFields" in failure))
        message.error(String(failure));
    } finally {
      setSaving(false);
    }
  }
  const transactionRow = transactions.find((row) => row.id === selectedKey);
  const mappingRow = mappings.find((row) => row.demandId === selectedKey);
  const viewDetail = (row: SapTransactionRow) => {
    void dispatch(fetchSapDetail(row.id))
      .unwrap()
      .then(setDetail)
      .catch((failure) => message.error(String(failure)));
  };
  function openMapping(row: SapMappingRow, automatic: boolean) {
    setAutomaticSales(automatic);
    form.resetFields();
    form.setFieldsValue({
      cardCode: row.mapping?.CardCode,
      salesOrderEntry: row.mapping?.SalesOrderEntry ?? undefined,
      salesOrderLine: row.mapping?.SalesOrderLine ?? 0,
    });
    setMapping(row);
  }
  async function refreshStock() {
    setSaving(true);
    try {
      await dispatch(sapAction({ action: "refresh-stock" })).unwrap();
      message.success("SAP stock refreshed.");
      refreshTables();
    } catch (failure) {
      message.error(String(failure));
    } finally {
      setSaving(false);
    }
  }
  const transactionColumns: TableProps<SapTransactionRow>["columns"] = [
    {
      title: "Created",
      dataIndex: "createdAt",
      render: (value, row) => (
        <Space size={4}>
          <GoldenArrowAction
            tooltip="View transaction details"
            ariaLabel="View SAP transaction details"
            onClick={() => viewDetail(row)}
          />
          {formatDateTime(value)}
        </Space>
      ),
    },
    { title: "Transaction", dataIndex: "type" },
    {
      title: "SAP Item / Reference",
      ...search,
      render: (_, row) => (
        <>
          <div>{row.itemCode ?? "Master update"}</div>
          <Typography.Text type="secondary">
            {row.demandId ?? row.referenceId}
          </Typography.Text>
        </>
      ),
    },
    { title: "Qty", dataIndex: "quantity", render: number },
    {
      title: "Status",
      dataIndex: "status",
      render: statusTag,
      filteredValue: query.status ? [query.status] : null,
      filterMultiple: false,
      filters: [
        "PENDING",
        "PROCESSING",
        "SYNCED",
        "FAILED",
        "BLOCKED",
        "RECONCILE",
        "CANCELLED",
      ].map((value) => ({ text: value, value })),
    },
    {
      title: "SAP Document",
      dataIndex: "documentNumber",
      render: (value) => value ?? "—",
    },
    { title: "Attempts", dataIndex: "attempts" },
    {
      title: (
        <Tooltip title="Reason recorded on the last attempt. Refresh reloads the record; Retry checks SAP again.">
          Attention
        </Tooltip>
      ),
      dataIndex: "error",
      width: 340,
      render: (error: string | null, row) => {
        const attention = sapAttention(error, row.status);
        return attention ? (
          <Tooltip title={error}>
            <div style={{ whiteSpace: "normal" }}>
              <div>{attention.cause}</div>
              <Typography.Text type="secondary">
                {attention.action}
              </Typography.Text>
            </div>
          </Tooltip>
        ) : (
          "—"
        );
      },
    },
  ];
  const stockColumns: TableProps<SapStockRow>["columns"] = [
    { title: "SAP Item", dataIndex: "itemCode", ...search },
    { title: "MES Parts", render: (_, row) => row.partNumbers.join(", ") },
    { title: "Warehouse", dataIndex: "warehouse", render: number },
    { title: "Rack", dataIndex: "rack", render: number },
    { title: "MES Total", dataIndex: "mes", render: number },
    { title: "SAP Stock", dataIndex: "sap", render: number },
    {
      title: "Awaiting Backflush",
      dataIndex: "awaitingBackflush",
      render: number,
    },
    { title: "Pending Net Effect", dataIndex: "pendingEffect", render: number },
    { title: "Expected SAP", dataIndex: "expectedSap", render: number },
    { title: "Unexplained", dataIndex: "unexplained", render: number },
    { title: "Status", dataIndex: "status", render: statusTag },
    { title: "Last Checked", dataIndex: "observedAt", render: formatDateTime },
  ];
  const mappingColumns: TableProps<SapMappingRow>["columns"] = [
    { title: "Demand", dataIndex: "demandId", ...search },
    { title: "MES Part", dataIndex: "partNumber" },
    { title: "SAP Item", dataIndex: "itemCode" },
    { title: "Name", dataIndex: "name" },
    { title: "Warehouse", dataIndex: "warehouse" },
    {
      title: "Frozen Order",
      render: (_, row) => (row.captured ? "Captured" : "Not captured"),
    },
    {
      title: "Sales Order / Line",
      render: (_, row) =>
        row.mapping?.SalesOrderEntry
          ? `${row.mapping.SalesOrderEntry} / ${row.mapping.SalesOrderLine}`
          : row.mapping?.AutoCreate
            ? `Auto SO — ${row.mapping.CardCode}`
            : "Not mapped",
    },
  ];
  return (
    <>
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={refreshTables}
        />
        {kind === "transactions" && (
          <>
            <ButtonToolbar
              title="Detail"
              icon={<EyeOutlined />}
              enable={!!transactionRow}
              onClick={() => {
                if (transactionRow) viewDetail(transactionRow);
              }}
            />
            {can("IPCS.INTEGRATION_RECOVER") && (
              <>
                <ButtonToolbar
                  title="Retry"
                  icon={<ReloadOutlined />}
                  enable={
                    !!transactionRow &&
                    transactionRow.type !== "SAP_MATERIAL_UPDATE" &&
                    ["FAILED", "BLOCKED"].includes(transactionRow.status) &&
                    !saving
                  }
                  onClick={() => {
                    form.resetFields();
                    setCancelCounting(false);
                    setSelected(transactionRow);
                  }}
                />
                <ButtonToolbar
                  title="Cancel Rejected STO"
                  icon={<RollbackOutlined />}
                  enable={
                    transactionRow?.type === "INVENTORY_POSTING" &&
                    ["FAILED", "BLOCKED"].includes(transactionRow.status) &&
                    !saving
                  }
                  onClick={() => {
                    form.resetFields();
                    setCancelCounting(true);
                    setSelected(transactionRow);
                  }}
                />
                <ButtonToolbar
                  title="Check SAP Result"
                  icon={<SyncOutlined />}
                  enable={transactionRow?.status === "RECONCILE" && !saving}
                  onClick={() => {
                    if (transactionRow) void runReconcile(transactionRow);
                  }}
                />
              </>
            )}
          </>
        )}
        {kind === "mappings" && can("IPCS.SAP_MAPPING_UPDATE") && (
          <>
            <ButtonToolbar
              title="Map Sales Order"
              icon={<EditOutlined />}
              enable={!!mappingRow && !saving}
              onClick={() => {
                if (mappingRow) openMapping(mappingRow, false);
              }}
            />
            <ButtonToolbar
              title="Automatic SO"
              icon={<LinkOutlined />}
              enable={
                !!mappingRow && !mappingRow.mapping?.SalesOrderEntry && !saving
              }
              onClick={() => {
                if (mappingRow) openMapping(mappingRow, true);
              }}
            />
          </>
        )}
        {kind === "mappings" && (
          <>
            <ButtonToolbar
              title="Material"
              icon={<LinkOutlined />}
              onClick={() => router.push("/apps/master-data/material")}
            />
            <ButtonToolbar
              title="Finish Good"
              icon={<LinkOutlined />}
              onClick={() => router.push("/apps/master-data/finish-good")}
            />
            <ButtonToolbar
              title="Bill of Materials"
              icon={<LinkOutlined />}
              onClick={() => router.push("/apps/master-data/bill-of-materials")}
            />
          </>
        )}
        {kind === "stock" && can("IPCS.INTEGRATION_RECOVER") && (
          <ButtonToolbar
            title="Refresh SAP Stock"
            icon={<SyncOutlined />}
            loading={saving}
            onClick={() => {
              void refreshStock();
            }}
          />
        )}
      </ToolbarWrapper>
      {error && <Alert type="error" showIcon title={error} />}
      {kind === "stock" && (
        <Alert
          className="mb-3"
          type="info"
          showIcon
          title="MES Total = Warehouse + Rack"
          description="Expected SAP = MES Total + Awaiting Backflush − Pending Net Effect. Values use the snapshot cutoff. Unexplained differences require investigation; stock is never overwritten automatically."
        />
      )}
      {kind === "transactions" && (
        <Table<SapTransactionRow>
          size="small"
          className="small-table"
          style={{ fontSize: "11px" }}
          onRow={(row) => ({
            onClick: () => setSelectedKey(row.id),
            onDoubleClick: () => viewDetail(row),
          })}
          rowClassName={(row) =>
            row.id === selectedKey ? "ant-table-row-selected" : ""
          }
          rowKey="id"
          columns={transactionColumns}
          dataSource={transactions}
          loading={loading}
          pagination={pagination}
          scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
          onChange={(_, filters) => {
            const status = filters.status?.[0] as string | undefined;
            if (status !== query.status)
              setQuery({ ...query, status, page: 1 });
          }}
        />
      )}
      {kind === "stock" && (
        <Table<SapStockRow>
          size="small"
          className="small-table"
          style={{ fontSize: "11px" }}
          onRow={(row) => ({ onClick: () => setSelectedKey(row.itemCode) })}
          rowClassName={(row) =>
            row.itemCode === selectedKey ? "ant-table-row-selected" : ""
          }
          rowKey="itemCode"
          columns={stockColumns}
          dataSource={stock}
          loading={loading}
          pagination={pagination}
          scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
          expandable={{
            expandedRowRender: (row) => (
              <Space orientation="vertical">
                <span>{row.names.join(", ")}</span>
                <span>Snapshot cutoff: {formatDateTime(row.cutoff)}</span>
                <Button
                  onClick={() => {
                    setDetail({
                      id: row.itemCode,
                      status: row.status,
                      source: row.partNumbers.join(", "),
                      error: row.unexplained
                        ? "Investigate pending documents and SAP transactions outside MES."
                        : null,
                      effects: [],
                      audit: [],
                    });
                  }}
                >
                  Review difference
                </Button>
              </Space>
            ),
          }}
        />
      )}
      {kind === "stock" && (
        <>
          <Typography.Title level={5}>
            SAP documents outside MES
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Monitoring starts at the first stock refresh. New SAP documents
            without a recognized MES reference are listed here; balances are
            never overwritten.
          </Typography.Paragraph>
          <Table<SapExternalRow>
            size="small"
            className="small-table"
            style={{ fontSize: "11px" }}
            rowKey={(row) => row.Resource + "-" + row.DocumentEntry}
            dataSource={external}
            columns={[
              { title: "Document", dataIndex: "Resource" },
              { title: "SAP Number", dataIndex: "DocumentNumber" },
              { title: "Warehouse", dataIndex: "Warehouse" },
              {
                title: "Detected",
                dataIndex: "ObservedAt",
                render: formatDateTime,
              },
            ]}
            pagination={{
              size: "small",
              showTotal: (total) => `Total ${total} records`,
              current: externalPage,
              pageSize: 10,
              total: externalTotal,
              onChange: setExternalPage,
            }}
          />
        </>
      )}
      {kind === "mappings" && (
        <Table<SapMappingRow>
          size="small"
          className="small-table"
          style={{ fontSize: "11px" }}
          onRow={(row) => ({
            onClick: () => setSelectedKey(row.demandId),
            onDoubleClick: () => {
              if (can("IPCS.SAP_MAPPING_UPDATE")) openMapping(row, false);
            },
          })}
          rowClassName={(row) =>
            row.demandId === selectedKey ? "ant-table-row-selected" : ""
          }
          rowKey="demandId"
          columns={mappingColumns}
          dataSource={mappings}
          loading={loading}
          pagination={pagination}
          scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
        />
      )}
      <Modal
        centered
        forceRender
        open={!!selected || !!mapping}
        title={
          mapping
            ? automaticSales
              ? "Automatic Sales Order customer"
              : "Map Sales Order line"
            : cancelCounting
              ? "Cancel rejected STO"
              : "Retry SAP transaction"
        }
        onCancel={() => {
          if (!saving) {
            setSelected(undefined);
            setMapping(undefined);
          }
        }}
        onOk={() => {
          void submit();
        }}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          {selected && cancelCounting && (
            <Alert
              type="warning"
              showIcon
              title="Reverse local STO approval"
              description="This adds reversal ledger entries and cancels the rejected posting. Stock remains held until SAP counting is closed. Already posted or uncertain SAP results cannot be cancelled here."
              style={{ marginBottom: 16 }}
            />
          )}
          {mapping && (
            <>
              <Typography.Paragraph>
                {mapping.demandId} — {mapping.itemCode}
              </Typography.Paragraph>
              {automaticSales ? (
                <>
                  <Alert
                    type="info"
                    title="Created once per demand on release. SAP determines item pricing for this customer."
                  />
                  <Form.Item
                    name="cardCode"
                    label="SAP Customer CardCode"
                    rules={[{ required: true, whitespace: true }]}
                  >
                    <Input />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item
                    name="salesOrderEntry"
                    label="SAP Sales Order DocEntry"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} precision={0} />
                  </Form.Item>
                  <Form.Item
                    name="salesOrderLine"
                    label="SAP LineNum (starts at 0)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} precision={0} />
                  </Form.Item>
                </>
              )}
            </>
          )}
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, whitespace: true, max: 500 }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        centered
        open={!!detail}
        onCancel={() => setDetail(undefined)}
        footer={null}
        title="SAP transaction evidence"
        width={850}
      >
        {detail && (
          <Space orientation="vertical" className="w-full">
            <Typography.Text>{detail.source}</Typography.Text>
            {statusTag(detail.status)}
            <Typography.Text>
              SAP document: {detail.documentNumber ?? "Not verified"}
            </Typography.Text>
            {sapAttention(detail.error, detail.status) && (
              <>
                <Alert
                  type="warning"
                  showIcon
                  title={sapAttention(detail.error, detail.status)?.cause}
                  description={
                    sapAttention(detail.error, detail.status)?.action
                  }
                />
                <Typography.Text type="secondary">
                  Recorded on the last attempt. This message may remain after
                  the cause has been fixed, until the transaction is retried.
                </Typography.Text>
                <details>
                  <summary>Technical details</summary>
                  <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                    {detail.error}
                  </Typography.Paragraph>
                </details>
              </>
            )}
            <Table
              rowKey="Id"
              size="small"
              dataSource={detail.audit}
              columns={[
                { title: "Action", dataIndex: "Action" },
                {
                  title: "Time",
                  dataIndex: "CreatedAt",
                  render: formatDateTime,
                },
              ]}
              pagination={{ pageSize: 10 }}
            />
          </Space>
        )}
      </Modal>
    </>
  );
}
