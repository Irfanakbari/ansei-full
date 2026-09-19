/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
"use client";
import Link from "next/link";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Breadcrumb,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
} from "antd";
import type { TableProps } from "antd";
import type { ColumnType } from "antd/es/table";
import {
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
  ArrowRightOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import EndAssemblyModal from "./_components/EndAssemblyModal";
import CreateAssemblyModal from "./_components/CreateAssemblyModal";
import AssemblyDetailModal from "./_components/AssemblyDetailModal";
import FinishGoodLinkedModal from "@/components/production/FinishGoodLinkedModal";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchAssemblySessions,
  cancelAssembly,
  type AssemblySession,
  type AssemblyQuery,
} from "@/store/features/production/assembly/assemblySlice";
export default function AssemblyPage() {
  const { can } = usePhasePermission();
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const user = useSelector((state: RootState) => state.auth.user);
  const [ending, setEnding] = useState<AssemblySession | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<AssemblySession | null>(null);
  const [linkedFinishGood, setLinkedFinishGood] = useState<string | null>(null);
  const canCreate =
    user?.RoleName === "SUPER" ||
    user?.GlobalRoles?.includes("SUPER_ADMINISTRATOR") ||
    user?.Permission.some((p) =>
      ["SUPER", "*", "IPCS.ASSEMBLY_CREATE"].includes(p),
    );
  const canCancel =
    user?.RoleName === "SUPER" ||
    user?.GlobalRoles?.includes("SUPER_ADMINISTRATOR") ||
    user?.Permission.some((p) =>
      ["SUPER", "*", "IPCS.ASSEMBLY_CANCEL"].includes(p),
    );
  const { sessions, total, loading, error } = useSelector(
    (state: RootState) => state.assembly,
  );
  const [query, setQuery] = useState<AssemblyQuery>({ page: 1, limit: 50 });
  const [selected, setSelected] = useState<AssemblySession | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ reason: string }>();
  useEffect(() => {
    void dispatch(fetchAssemblySessions(query));
  }, [dispatch, query]);
  const searchFilter = (
    key: "labelNumber" | "productionReleaseId" | "manPowerNik",
    placeholder: string,
  ): ColumnType<AssemblySession> => ({
    filteredValue: query[key] ? [query[key]!] : null,
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
          placeholder={placeholder}
          value={String(selectedKeys[0] ?? "")}
          onChange={(event) =>
            setSelectedKeys(event.target.value ? [event.target.value] : [])
          }
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<SearchOutlined />}
            style={{ width: 80 }}
            onClick={() => confirm()}
          >
            Search
          </Button>
          <Button
            size="small"
            style={{ width: 80 }}
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
  const columns: TableProps<AssemblySession>["columns"] = [
    {
      title: "Release Number",
      key: "productionReleaseId",
      render: (_, row) => row.LabelData.ProductionRelease?.ReleaseNumber ?? "-",
    },
    {
      title: "Label Number",
      key: "labelNumber",
      ...searchFilter("labelNumber", "Search label number"),
      render: (_, row) => (
        <code style={{ fontSize: 11 }}>{row.LabelData.LabelNumber}</code>
      ),
    },
    {
      title: "Finish Good",
      key: "part",
      render: (_, row) => (
        <Space size={4}>
          <Button type="text" size="small" aria-label={`View Finish Good ${row.LabelData.FinishGoodId}`} icon={<ArrowRightOutlined style={{ color: "#d4a106", fontSize: 12 }} />} onClick={() => setLinkedFinishGood(row.LabelData.FinishGoodId)} style={{ width: 20, minWidth: 20, height: 20, padding: 0 }} />
          <span>{row.LabelData.FinishGoodId}</span>
        </Space>
      ),
    },
    {
      title: "PO",
      key: "po",
      render: (_, row) => row.LabelData.ForecastId,
    },
    {
      title: "Manpower",
      dataIndex: "ManPowerName",
      key: "manPowerNik",
      ...searchFilter("manPowerNik", "Search manpower NIK"),
    },
    {
      title: "Status",
      dataIndex: "Status",
      key: "status",
      filterMultiple: false,
      filteredValue: query.status ? [query.status] : null,
      filters: [
        { text: "In progress", value: "IN_PROGRESS" },
        { text: "Completed", value: "COMPLETED" },
        { text: "Cancelled", value: "CANCELLED" },
      ],
      render: (value: AssemblySession["Status"]) => (
        <Tag
          color={
            value === "COMPLETED"
              ? "success"
              : value === "IN_PROGRESS"
                ? "processing"
                : "default"
          }
        >
          {value === "IN_PROGRESS"
            ? "In progress"
            : value === "COMPLETED"
              ? "Completed"
              : "Cancelled"}
        </Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, row) => (
          <Space>
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailSession(row)}>Detail</Button>
            {row.Status === "IN_PROGRESS" && canCreate && (
              <Button
                type="primary"
                size="small"
                onClick={() => setEnding(row)}
              >
                End Assembly
              </Button>
            )}
            {row.Status === "IN_PROGRESS" && canCancel && (
              <Button
                danger
                size="small"
                onClick={() => {
                  form.resetFields();
                  setSelected(row);
                }}
              >
                Cancel
              </Button>
            )}
          </Space>
        ),
    },
  ];
  const cancel = async () => {
    if (!selected || saving) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await dispatch(
        cancelAssembly({
          id: selected.Id,
          reason: values.reason.trim(),
        }),
      ).unwrap();
      setSelected(null);
      message.success("Assembly cancelled");
      void dispatch(fetchAssemblySessions(query));
    } catch (err) {
      if (typeof err === "string" || err instanceof Error)
        message.error(String(err));
    } finally {
      setSaving(false);
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
          { title: "Assembly" },
        ]}
      />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => {
            void dispatch(fetchAssemblySessions(query));
          }}
        />
        {canCreate && (
          <ButtonToolbar
            title="Create Assembly"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          />
        )}
      </ToolbarWrapper>
      {detailSession && (
        <Space style={{ margin: "8px 0" }}>
          {can("IPCS.MATERIAL_NG_CREATE") && (
            <Link
              href={`/apps/production/material-ng?poId=${encodeURIComponent(detailSession.LabelData.ForecastId)}&assemblySessionId=${detailSession.Id}`}
            >
              Report Material NG
            </Link>
          )}
          {can("IPCS.TRACEABILITY_READ") && (
            <Link
              href={`/apps/traceability?poId=${encodeURIComponent(detailSession.LabelData.ForecastId)}&label=${encodeURIComponent(detailSession.LabelData.LabelNumber)}`}
            >
              View Traceability
            </Link>
          )}
        </Space>
      )}
      {error && <Alert type="error" title={error} showIcon />}
      <Table<AssemblySession>
        rowKey="Id"
        columns={columns}
        dataSource={sessions}
        loading={loading}
        size="small"
        className="small-table"
        scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
        onChange={(pagination, filters, _sorter, extra) =>
          setQuery({
            page: extra.action === "filter" ? 1 : pagination.current,
            limit: pagination.pageSize,
            labelNumber: filters.labelNumber?.[0]?.toString(),
            productionReleaseId: filters.productionReleaseId?.[0]?.toString(),
            manPowerNik: filters.manPowerNik?.[0]?.toString(),
            status: filters.status?.[0]?.toString(),
          })
        }
        pagination={{
          size: "small",
          current: query.page,
          pageSize: query.limit,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ["20", "50", "100"],
          showTotal: (count, range) => `${range[0]}-${range[1]} of ${count}`,
        }}
      />
      {ending && (
        <EndAssemblyModal
          key={ending.Id}
          session={ending}
          onClose={() => setEnding(null)}
          onCompleted={() => {
            setEnding(null);
            void dispatch(fetchAssemblySessions(query));
          }}
        />
      )}
      {createOpen && (
        <CreateAssemblyModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void dispatch(fetchAssemblySessions(query));
          }}
        />
      )}
      <Modal
        title="Cancel active assembly"
        open={Boolean(selected)}
        centered
        confirmLoading={saving}
        onOk={() => void cancel()}
        onCancel={() => {
          if (!saving) setSelected(null);
        }}
      >
        <p>
          {selected?.LabelData.LabelNumber} · {selected?.ManPowerName}
        </p>
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, whitespace: true, max: 500 }]}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
      <AssemblyDetailModal session={detailSession} onClose={() => setDetailSession(null)} />
      <FinishGoodLinkedModal open={linkedFinishGood !== null} partNumber={linkedFinishGood} onClose={() => setLinkedFinishGood(null)} />
    </Card>
  );
}
