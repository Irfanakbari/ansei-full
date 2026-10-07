/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Breadcrumb,
  Input,
  Segmented,
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
} from "@ant-design/icons";
import CreateAssemblyModal from "./_components/CreateAssemblyModal";
import AssemblyDetailModal from "./_components/AssemblyDetailModal";
import FinishGoodLinkedModal from "@/components/production/FinishGoodLinkedModal";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchAssemblySessions,
  type AssemblySession,
  type AssemblyQuery,
} from "@/store/features/production/assembly/assemblySlice";

export default function AssemblyPage() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSession, setDetailSession] = useState<AssemblySession | null>(
    null,
  );
  const [linkedFinishGood, setLinkedFinishGood] = useState<string | null>(null);
  const canCreate =
    user?.RoleName === "SUPER" ||
    user?.GlobalRoles?.includes("SUPER_ADMINISTRATOR") ||
    user?.Permission.some((p) =>
      ["SUPER", "*", "IPCS.ASSEMBLY_CREATE"].includes(p),
    );
  const { sessions, total, loading, error } = useSelector(
    (state: RootState) => state.assembly,
  );
  const [query, setQuery] = useState<AssemblyQuery>({
    page: 1,
    limit: 50,
    activeReleaseOnly: true,
  });
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
      render: (_, row) => (
        <Space size={4}>
          <GoldenArrowAction
            tooltip="View assembly detail"
            ariaLabel={`View assembly detail for ${row.LabelData.ProductionRelease?.ReleaseNumber ?? row.Id}`}
            onClick={() => setDetailSession(row)}
          />
          <span>{row.LabelData.ProductionRelease?.ReleaseNumber ?? "-"}</span>
        </Space>
      ),
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
          <GoldenArrowAction
            tooltip="View Finish Good details"
            ariaLabel={`View Finish Good ${row.LabelData.FinishGoodId}`}
            onClick={() => setLinkedFinishGood(row.LabelData.FinishGoodId)}
          />
          <span>{row.LabelData.FinishGoodId}</span>
        </Space>
      ),
    },
    {
      title: "PO",
      key: "po",
      render: (_, row) => row.LabelData.ProductionDemandId,
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
  ];
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
        <div
          style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}
        >
          <Segmented
            size="small"
            value={query.activeReleaseOnly !== false ? "ACTIVE" : "ALL"}
            onChange={(val) =>
              setQuery((prev) => ({
                ...prev,
                page: 1,
                activeReleaseOnly: val === "ACTIVE",
              }))
            }
            options={[
              { label: "Active Release", value: "ACTIVE" },
              { label: "All History", value: "ALL" },
            ]}
          />
        </div>
      </ToolbarWrapper>
      {error && <Alert type="error" title={error} showIcon />}
      <Table<AssemblySession>
        rowKey="Id"
        columns={columns}
        dataSource={sessions}
        loading={loading}
        size="small"
        className="small-table"
        scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
        onRow={(row) => ({
          onDoubleClick: () => setDetailSession(row),
        })}
        onChange={(pagination, filters, _sorter, extra) =>
          setQuery((prev) => ({
            ...prev,
            page: extra.action === "filter" ? 1 : pagination.current,
            limit: pagination.pageSize,
            labelNumber: filters.labelNumber?.[0]?.toString(),
            productionReleaseId: filters.productionReleaseId?.[0]?.toString(),
            manPowerNik: filters.manPowerNik?.[0]?.toString(),
            status: filters.status?.[0]?.toString(),
          }))
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
      {createOpen && (
        <CreateAssemblyModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void dispatch(fetchAssemblySessions(query));
          }}
        />
      )}
      <AssemblyDetailModal
        session={detailSession}
        onClose={() => setDetailSession(null)}
      />
      <FinishGoodLinkedModal
        open={linkedFinishGood !== null}
        partNumber={linkedFinishGood}
        onClose={() => setLinkedFinishGood(null)}
      />
    </Card>
  );
}
