/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Descriptions,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import type { FilterDropdownProps } from "antd/es/table/interface";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import ProductionFindingModal from "@/app/display/_components/ProductionFindingModal";
import {
  allocateFinding,
  pickFindingReplacement,
  approveFinding,
  completeFinding,
  deleteFinding,
  fetchFinding,
  fetchFindings,
  rejectFinding,
  type FindingCategory,
  type FindingComponent,
  type FindingPage,
  type FindingStatus,
  type ProductionFinding,
} from "@/store/features/production/productionFinding/productionFindingSlice";

const statuses: FindingStatus[] = [
  "PENDING",
  "WAITING_PART_CHANGE",
  "COMPLETED",
  "REJECTED",
];
const categoryFilters = [
  { text: "Material", value: "MATERIAL" },
  { text: "Finish Good", value: "FINISH_GOOD" },
];
const statusColors: Record<FindingStatus, string> = {
  PENDING: "gold",
  WAITING_PART_CHANGE: "blue",
  COMPLETED: "green",
  REJECTED: "red",
};

const formatStatus = (value: string) => value.replaceAll("_", " ");
const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("id-ID") : "-";
const getReference = (finding: ProductionFinding) =>
  finding.MaterialId ??
  finding.Label?.LabelNumber ??
  finding.Forecast?.PoId ??
  "-";

const searchDropdown = ({
  selectedKeys,
  setSelectedKeys,
  confirm,
  clearFilters,
}: FilterDropdownProps) => (
  <div style={{ padding: 8 }} onKeyDown={(event) => event.stopPropagation()}>
    <Input
      autoFocus
      placeholder="Finding, material, PO, or label"
      value={selectedKeys[0]?.toString() ?? ""}
      onChange={(event) =>
        setSelectedKeys(event.target.value ? [event.target.value] : [])
      }
      onPressEnter={() => confirm()}
      style={{ width: 260, marginBottom: 8, display: "block" }}
    />
    <Space>
      <Button
        size="small"
        type="primary"
        icon={<SearchOutlined />}
        onClick={() => confirm()}
      >
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
);

export default function ProductionFindingQueue() {
  const dispatch = useDispatch<AppDispatch>();
  const { message, modal } = App.useApp();
  const reporter = useSelector(
    (state: RootState) =>
      state.auth.user?.Name ?? state.auth.user?.UserId ?? null,
  );
  const [result, setResult] = useState<FindingPage | null>(null);
  const [query, setQuery] = useState<{
    page: number;
    search?: string;
    category?: FindingCategory;
    status?: FindingStatus;
  }>({ page: 1 });
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ProductionFinding | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [disposition, setDisposition] = useState<"REWORK" | "SCRAP">("REWORK");
  const [allocation, setAllocation] = useState<{
    componentId?: string;
    shoppingId?: string;
    qty?: number;
  }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(
        await dispatch(fetchFindings({ ...query, limit: 20 })).unwrap(),
      );
    } catch (error) {
      message.error(String(error));
    } finally {
      setLoading(false);
    }
  }, [dispatch, message, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (record: ProductionFinding) => {
    setSelectedRowId(record.Id);
    try {
      setSelected(await dispatch(fetchFinding(record.Id)).unwrap());
      setNote("");
      setDisposition("REWORK");
      setAllocation({});
    } catch (error) {
      message.error(String(error));
    }
  };

  const run = async (action: "approve" | "reject" | "complete") => {
    if (!selected) return;
    if (action === "reject" && !note.trim()) {
      message.error("Rejection note is required");
      return;
    }
    setSaving(true);
    try {
      const thunk =
        action === "approve"
          ? approveFinding
          : action === "reject"
            ? rejectFinding
            : completeFinding;
      const updated = await dispatch(
        thunk({
          id: selected.Id,
          requestId: crypto.randomUUID(),
          note: note.trim() || undefined,
          disposition: action === "approve" ? disposition : undefined,
        }),
      ).unwrap();
      setSelected(updated);
      message.success(`Finding ${action} succeeded`);
      await load();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !note.trim()) return;
    setSaving(true);
    try {
      await dispatch(
        deleteFinding({
          id: selected.Id,
          requestId: crypto.randomUUID(),
          note: note.trim(),
        }),
      ).unwrap();
      setSelected(null);
      setSelectedRowId(null);
      message.success("Finding deleted");
      await load();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  const allocate = async () => {
    if (
      !selected ||
      !allocation.componentId ||
      (!selected.Disposition?.startsWith("SCRAP_") && !allocation.shoppingId) ||
      !allocation.qty
    )
      return;
    setSaving(true);
    try {
      const updated = selected.Disposition?.startsWith("SCRAP_")
        ? await dispatch(
            pickFindingReplacement({
              id: selected.Id,
              requestId: crypto.randomUUID(),
              componentId: allocation.componentId,
              qty: allocation.qty,
            }),
          ).unwrap()
        : await dispatch(
            allocateFinding({
              id: selected.Id,
              requestId: crypto.randomUUID(),
              componentId: allocation.componentId,
              shoppingId: allocation.shoppingId?.trim() ?? "",
              qty: allocation.qty,
            }),
          ).unwrap();
      setSelected(updated);
      setAllocation({});
      message.success("Shopping allocation saved");
      await load();
    } catch (error) {
      message.error(String(error));
    } finally {
      setSaving(false);
    }
  };

  const componentColumns: TableProps<FindingComponent>["columns"] = [
    {
      title: "Component",
      key: "component",
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text code>{row.MaterialId}</Typography.Text>
          <Typography.Text type="secondary">
            {row.SnapshotLine.PartName}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Unit",
      dataIndex: ["SnapshotLine", "UnitName"],
      render: (value: string | null) => value ?? "-",
    },
    { title: "Required", dataIndex: "Qty", align: "right" },
    {
      title: "Allocated",
      key: "allocated",
      align: "right",
      render: (_, row) =>
        row.Allocations.reduce((sum, item) => sum + item.Qty, 0),
    },
    {
      title: "Shopping Allocations",
      key: "allocations",
      render: (_, row) =>
        row.Allocations.length ? (
          <Space wrap>
            {row.Allocations.map((item) => (
              <Tag key={item.Id}>
                {item.ShoppingId}: {item.Qty}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">None</Typography.Text>
        ),
    },
  ];

  const columns: TableProps<ProductionFinding>["columns"] = [
    {
      title: "Finding",
      dataIndex: "RecordNumber",
      key: "RecordNumber",
      filterDropdown: searchDropdown,
      filterIcon: (filtered) => (
        <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
      ),
      filteredValue: query.search ? [query.search] : null,
      render: (value: string, row) => (
        <Space size={4}>
          <GoldenArrowAction
            tooltip="View production finding details"
            ariaLabel={`View production finding ${value}`}
            onClick={() => void openDetail(row)}
          />
          <Typography.Text code>{value}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "Category",
      dataIndex: "Category",
      key: "Category",
      filters: categoryFilters,
      filteredValue: query.category ? [query.category] : null,
      filterMultiple: false,
      render: (value: FindingCategory) => <Tag>{formatStatus(value)}</Tag>,
    },
    {
      title: "Reference",
      key: "reference",
      render: (_, row) => getReference(row),
    },
    { title: "Qty", dataIndex: "Qty", key: "Qty", align: "right" },
    { title: "Reporter", dataIndex: "Reporter", key: "Reporter" },
    {
      title: "Status",
      dataIndex: "Status",
      key: "Status",
      filters: statuses.map((value) => ({ text: formatStatus(value), value })),
      filteredValue: query.status ? [query.status] : null,
      filterMultiple: false,
      render: (value: FindingStatus) => (
        <Tag color={statusColors[value]}>{formatStatus(value)}</Tag>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "SubmittedAt",
      key: "SubmittedAt",
      render: formatDateTime,
    },
  ];

  const handleTableChange: TableProps<ProductionFinding>["onChange"] = (
    pagination,
    filters,
  ) => {
    setQuery({
      page: pagination.current ?? 1,
      search: filters.RecordNumber?.[0]?.toString(),
      category: filters.Category?.[0] as FindingCategory | undefined,
      status: filters.Status?.[0] as FindingStatus | undefined,
    });
  };

  return (
    <>
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => void load()}
        />
        <ButtonToolbar
          title="Create NG Report"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateOpen(true)}
        />
      </ToolbarWrapper>
      <Table<ProductionFinding>
        rowKey="Id"
        loading={loading}
        dataSource={result?.data ?? []}
        columns={columns}
        size="small"
        className="small-table"
        style={{ fontSize: "11px" }}
        scroll={{ x: "max-content", y: "calc(100vh - 430px)" }}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: () => setSelectedRowId(record.Id),
          onDoubleClick: () => void openDetail(record),
        })}
        rowClassName={(record) =>
          record.Id === selectedRowId ? "ant-table-row-selected" : ""
        }
        pagination={{
          size: "small",
          current: query.page,
          pageSize: 20,
          total: result?.meta.totalItems,
          showSizeChanger: false,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
        }}
      />
      <ProductionFindingModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => void load()}
        reporter={reporter}
        getContainer={() => document.body}
      />
      <Modal
        centered
        width={1000}
        open={Boolean(selected)}
        onCancel={() => setSelected(null)}
        footer={null}
        title={
          <Space>
            <span>NG Report</span>
            {selected && (
              <Typography.Text code>{selected.RecordNumber}</Typography.Text>
            )}
          </Space>
        }
        destroyOnHidden
        styles={{ body: { maxHeight: "75vh", overflowY: "auto" } }}
      >
        {selected && (
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <Alert
              showIcon
              type={
                selected.Status === "REJECTED"
                  ? "error"
                  : selected.Status === "COMPLETED"
                    ? "success"
                    : "info"
              }
              title={
                <Space wrap>
                  <span>Current status</span>
                  <Tag color={statusColors[selected.Status]}>
                    {formatStatus(selected.Status)}
                  </Tag>
                </Space>
              }
              description={
                selected.Status === "PENDING"
                  ? "Review the finding details, then approve it for part replacement or reject it with a reason."
                  : selected.Status === "WAITING_PART_CHANGE"
                    ? "Allocate existing shopping records to the affected components, then complete the finding when replacement is finished."
                    : (selected.ReviewNote ?? undefined)
              }
            />
            <Descriptions
              bordered
              size="small"
              column={2}
              items={[
                {
                  key: "category",
                  label: "Category",
                  children: <Tag>{formatStatus(selected.Category)}</Tag>,
                },
                {
                  key: "reference",
                  label: "Reference",
                  children: getReference(selected),
                },
                { key: "quantity", label: "Quantity", children: selected.Qty },
                {
                  key: "location",
                  label: "Location",
                  children: selected.Location
                    ? formatStatus(selected.Location)
                    : "-",
                },
                {
                  key: "reporter",
                  label: "Reporter",
                  children: selected.Reporter,
                },
                {
                  key: "submitted",
                  label: "Submitted",
                  children: formatDateTime(selected.SubmittedAt),
                },
                {
                  key: "reviewer",
                  label: "Reviewed By",
                  children: selected.ReviewedBy ?? "-",
                },
                {
                  key: "reviewed",
                  label: "Reviewed",
                  children: formatDateTime(selected.ReviewedAt),
                },
                {
                  key: "reason",
                  label: "Reason",
                  children: selected.Reason,
                  span: 2,
                },
                {
                  key: "note",
                  label: "Review Note",
                  children: selected.ReviewNote ?? "-",
                  span: 2,
                },
              ]}
            />
            {(selected.Category === "FINISH_GOOD" ||
              selected.Location === "ASSY") && (
              <>
                <Divider plain>Affected Components and Allocations</Divider>
                <Table<FindingComponent>
                  rowKey="Id"
                  size="small"
                  pagination={false}
                  dataSource={selected.Components}
                  columns={componentColumns}
                  scroll={{ x: "max-content" }}
                />
              </>
            )}
            {selected.Status === "PENDING" && (
              <>
                <Divider plain>Leader Review</Divider>
                {selected.Category === "FINISH_GOOD" && (
                  <Select
                    aria-label="FG disposition"
                    value={disposition}
                    onChange={setDisposition}
                    options={[
                      { value: "REWORK", label: "Rework / replace components" },
                      {
                        value: "SCRAP",
                        label: "Scrap FG and create replacement label",
                      },
                    ]}
                  />
                )}
                <Alert
                  type="warning"
                  showIcon
                  title="A review note is required when rejecting or deleting this finding."
                  description={
                    selected.Location === "ASSY"
                      ? "Approving confirms the material component allocation and moves the finding to Non Production additional picking. ASSY does not deduct stock."
                      : undefined
                  }
                />
                <Input.TextArea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Enter review note"
                  rows={3}
                  maxLength={1000}
                  showCount
                />
                <Flex justify="end" gap="small" wrap>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={saving}
                    disabled={!note.trim()}
                    onClick={() =>
                      modal.confirm({
                        centered: true,
                        title: "Delete this pending finding?",
                        content: note.trim(),
                        okText: "Delete",
                        okType: "danger",
                        onOk: remove,
                      })
                    }
                  >
                    Delete
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={saving}
                    disabled={!note.trim()}
                    onClick={() =>
                      modal.confirm({
                        centered: true,
                        title: "Reject this finding?",
                        content: note.trim(),
                        okText: "Reject",
                        okType: "danger",
                        onOk: () => run("reject"),
                      })
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={saving}
                    onClick={() => void run("approve")}
                  >
                    {selected.Location === "ASSY"
                      ? "Approve Additional Picking"
                      : "Approve Part Change"}
                  </Button>
                </Flex>
              </>
            )}
            {selected.Status === "WAITING_PART_CHANGE" && (
              <>
                <Divider plain>Part Change Allocation</Divider>
                {selected.Disposition?.startsWith("SCRAP_") && (
                  <Alert
                    type="warning"
                    title="FG scrap replacement"
                    description="Pick replacement components from Rack here. They will be consumed in SAP by backflush when the replacement label completes assembly. The old label cannot be shipped."
                  />
                )}
                <Form layout="vertical">
                  <Flex gap="middle" wrap align="end">
                    <Form.Item
                      label="Component"
                      style={{ flex: "1 1 260px", marginBottom: 0 }}
                      required
                    >
                      <Select
                        value={allocation.componentId}
                        onChange={(componentId) =>
                          setAllocation((value) => ({ ...value, componentId }))
                        }
                        options={selected.Components.map((item) => ({
                          value: item.Id,
                          label: `${item.MaterialId} - ${item.SnapshotLine.PartName} (${item.Qty})`,
                        }))}
                        placeholder="Select affected component"
                      />
                    </Form.Item>
                    {!selected.Disposition?.startsWith("SCRAP_") && (
                      <Form.Item
                        label="Existing Shopping ID"
                        style={{ flex: "1 1 220px", marginBottom: 0 }}
                        required
                      >
                        <Input
                          value={allocation.shoppingId}
                          onChange={(event) =>
                            setAllocation((value) => ({
                              ...value,
                              shoppingId: event.target.value,
                            }))
                          }
                          placeholder="Enter shopping ID"
                        />
                      </Form.Item>
                    )}
                    <Form.Item
                      label="Quantity"
                      style={{ flex: "0 1 140px", marginBottom: 0 }}
                      required
                    >
                      <InputNumber
                        min={1}
                        precision={0}
                        value={allocation.qty}
                        onChange={(qty) =>
                          setAllocation((value) => ({
                            ...value,
                            qty: qty ?? undefined,
                          }))
                        }
                        style={{ width: "100%" }}
                      />
                    </Form.Item>
                    <Button
                      type="primary"
                      loading={saving}
                      disabled={
                        !allocation.componentId ||
                        (!selected.Disposition?.startsWith("SCRAP_") &&
                          !allocation.shoppingId?.trim()) ||
                        !allocation.qty
                      }
                      onClick={() => void allocate()}
                    >
                      {selected.Disposition?.startsWith("SCRAP_")
                        ? "Pick Replacement From Rack"
                        : "Save Allocation"}
                    </Button>
                  </Flex>
                </Form>
                <Divider />
                <Flex justify="space-between" align="center" gap="middle" wrap>
                  <Typography.Text type="secondary">
                    Complete only after all required part changes and
                    allocations are confirmed.
                  </Typography.Text>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={saving}
                    onClick={() =>
                      modal.confirm({
                        centered: true,
                        title: "Complete this finding?",
                        content:
                          "Confirm that the replacement process is complete.",
                        okText: "Complete",
                        onOk: () => run("complete"),
                      })
                    }
                  >
                    Complete Finding
                  </Button>
                </Flex>
              </>
            )}
          </Space>
        )}
      </Modal>
    </>
  );
}
