/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
"use client";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Alert,
  App,
  Breadcrumb,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
} from "antd";
import { ReloadOutlined, ApiOutlined, SyncOutlined } from "@ant-design/icons";
import type { AppDispatch, RootState } from "@/store";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { formatDateTime } from "@/lib/utils/dateTime";
import {
  fetchSapOverview,
  sapAction,
} from "@/store/features/system-administration/sapConnectionSlice";
import SapTables from "./SapTables";
import SapSettingsForm from "./SapSettingsForm";
export type SapSection =
  | "overview"
  | "transactions"
  | "stock-reconciliation"
  | "mappings"
  | "connection-cache";
const titles: Record<SapSection, string> = {
  overview: "Overview",
  transactions: "Transactions",
  "stock-reconciliation": "Stock Reconciliation",
  mappings: "Mappings",
  "connection-cache": "Connection & Cache",
};
export default function SapSectionPage({ section }: { section: SapSection }) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const { can } = usePhasePermission();
  const { overview, loading, error } = useSelector(
    (state: RootState) => state.sapConnection,
  );
  const [refresh, setRefresh] = useState(0);
  const [working, setWorking] = useState(false);
  const allowed = can("IPCS.SYSTEM_LOG_READ");
  const isSummary = section === "overview" || section === "connection-cache";
  useEffect(() => {
    if (allowed && isSummary) void dispatch(fetchSapOverview());
  }, [dispatch, allowed, isSummary, refresh]);
  async function run(action: "check" | "refresh-stock") {
    setWorking(true);
    try {
      await dispatch(sapAction({ action })).unwrap();
      message.success("SAP check completed. Review the reported result.");
      setRefresh((v) => v + 1);
    } catch (failure) {
      message.error(String(failure));
    } finally {
      setWorking(false);
    }
  }
  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "SAP Connection" },
          { title: titles[section] },
        ]}
      />
      {!allowed ? (
        <Alert
          type="warning"
          title="SAP Connection read permission is required."
        />
      ) : (
        <>
          {isSummary ? (
            <>
              <ToolbarWrapper>
                <ButtonToolbar
                  title="Refresh"
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={() => setRefresh((v) => v + 1)}
                />
                {can("IPCS.INTEGRATION_RECOVER") && (
                  <>
                    <ButtonToolbar
                      title="Test Connection"
                      icon={<ApiOutlined />}
                      loading={working}
                      onClick={() => {
                        void run("check");
                      }}
                    />
                    <ButtonToolbar
                      title="Refresh SAP Stock"
                      icon={<SyncOutlined />}
                      enable={!working}
                      onClick={() => {
                        void run("refresh-stock");
                      }}
                    />
                  </>
                )}
              </ToolbarWrapper>
              {error && <Alert type="error" title={error} />}
              <Spin spinning={loading}>
                {section === "overview" && (
                  <Space orientation="vertical" className="w-full">
                    <Alert
                      type="info"
                      showIcon
                      title="MES is the source of operational stock transactions"
                      description="SAP is updated asynchronously. Pending transactions and backflush explain temporary stock differences. No automatic stock overwrite is performed."
                    />
                    {overview && (
                      <>
                        <Space wrap>
                          <Tag>{overview.company}</Tag>
                          <Tag>{overview.warehouse}</Tag>
                          <Tag
                            color={
                              overview.postingEnabled ? "success" : "warning"
                            }
                          >
                            Posting{" "}
                            {overview.postingEnabled ? "enabled" : "disabled"}
                          </Tag>
                          <Tag
                            color={
                              overview.connection?.Connected
                                ? "success"
                                : "default"
                            }
                          >
                            {overview.connection?.CheckedAt
                              ? overview.connection.Connected
                                ? "Last connection check passed"
                                : "Last connection check failed"
                              : "Connection not checked"}
                          </Tag>
                        </Space>
                        <Row gutter={[12, 12]} className="w-full">
                          {[
                            "PENDING",
                            "PROCESSING",
                            "SYNCED",
                            "FAILED",
                            "BLOCKED",
                            "RECONCILE",
                          ].map((status) => (
                            <Col xs={12} md={8} xl={4} key={status}>
                              <Card>
                                <Statistic
                                  title={
                                    status === "RECONCILE"
                                      ? "Needs reconciliation"
                                      : status
                                  }
                                  value={overview.counts[status] ?? 0}
                                />
                              </Card>
                            </Col>
                          ))}
                        </Row>
                        <Descriptions
                          bordered
                          column={1}
                          items={[
                            {
                              key: "oldest",
                              label: "Oldest outstanding transaction",
                              children: formatDateTime(
                                overview.oldestPendingAt,
                              ),
                            },
                            {
                              key: "last",
                              label: "Last verified stock posting",
                              children: formatDateTime(overview.lastPostedAt),
                            },
                            {
                              key: "stock",
                              label: "Stock snapshot",
                              children: formatDateTime(
                                overview.connection?.RefreshedAt,
                              ),
                            },
                            {
                              key: "worker",
                              label: "Worker heartbeat",
                              children: `${overview.workerHealthy ? "Healthy" : "Not verified / stale"} — ${formatDateTime(overview.connection?.WorkerAt)}`,
                            },
                            {
                              key: "redis",
                              label: "Redis",
                              children: overview.redis.available
                                ? `Connected; AOF ${overview.redis.aofEnabled ? "enabled" : "disabled"}; AOF writes ${overview.redis.aofWriteHealthy ? "healthy" : "not verified"}`
                                : "Unavailable; jobs remain in PostgreSQL",
                            },
                          ]}
                        />
                      </>
                    )}
                  </Space>
                )}
                {section === "connection-cache" && overview && (
                  <Space orientation="vertical" className="w-full">
                    <SapSettingsForm settings={overview.settings} />
                    <Descriptions
                      bordered
                      column={1}
                      items={[
                        {
                          key: "company",
                          label: "Company",
                          children: overview.company,
                        },
                        {
                          key: "warehouse",
                          label: "SAP warehouse",
                          children: overview.warehouse,
                        },
                        {
                          key: "capture",
                          label: "Transaction capture",
                          children: overview.captureEnabled
                            ? "Enabled"
                            : "Disabled",
                        },
                        {
                          key: "fg",
                          label: "FG pilot allowlist",
                          children:
                            overview.allowedFinishGoods.join(", ") || "None",
                        },
                        {
                          key: "material",
                          label: "Material pilot allowlist",
                          children:
                            overview.allowedMaterials.join(", ") || "None",
                        },
                        {
                          key: "tls",
                          label: "Certificate validation",
                          children: overview.tlsValidation
                            ? "Enabled"
                            : "Disabled for SAP",
                        },
                        {
                          key: "session",
                          label: "Local session",
                          children: overview.session.active
                            ? "Active; reused for requests"
                            : "Acquired on demand",
                        },
                        {
                          key: "checked",
                          label: "Last connection check",
                          children: formatDateTime(
                            overview.connection?.CheckedAt,
                          ),
                        },
                        {
                          key: "cache",
                          label: "Cache policy",
                          children:
                            "Shared Redis cache and encrypted session. Stock requests are coalesced for 60 seconds; expired snapshots remain visibly stale.",
                        },
                        {
                          key: "durable",
                          label: "Durable jobs",
                          children:
                            "PostgreSQL outbox; Redis queues are rebuilt from unfinished events.",
                        },
                      ]}
                    />
                    <Alert
                      type="info"
                      title="Credentials are managed on the API server and are never exposed in this page."
                    />
                  </Space>
                )}
              </Spin>
            </>
          ) : (
            <SapTables
              kind={section === "stock-reconciliation" ? "stock" : section}
              refresh={refresh}
            />
          )}
        </>
      )}
    </Card>
  );
}
