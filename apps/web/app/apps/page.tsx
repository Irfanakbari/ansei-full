"use client";

import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  ImportOutlined,
  InboxOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Flex,
  Progress,
  Result,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchDashboard,
  type DashboardExceptionItem,
  type DashboardInventoryRiskItem,
  type DashboardReleasePipelineItem,
  type DashboardTopSupplierItem,
  type DashboardTopIncomingMaterialItem,
  type DashboardRecentIncomingItem,
} from "@/store/features/dashboard/dashboardSlice";

const { Text, Title } = Typography;
const sectionCardStyle = { borderRadius: 10 };
const equalSectionCardStyle = { borderRadius: 10, height: "100%" };
const fixedSectionBodyStyle = { body: { height: 360, overflow: "hidden" } };
const compactCardBodyStyle = { body: { padding: 14 } };
const visuallyHiddenStyle = {
  position: "absolute" as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap" as const,
  border: 0,
};
const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const monthDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatNumber = (value?: number | null) =>
  value === null || value === undefined ? "—" : numberFormatter.format(value);
const formatPercent = (value?: number | null) =>
  value === null || value === undefined
    ? "—"
    : `${numberFormatter.format(value)}%`;
const clampPercent = (value?: number | null) =>
  value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value));
const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : dateFormatter.format(date);
};
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : monthDateFormatter.format(date);
};
const severityColor = (severity?: string) => {
  if (severity === "HIGH" || severity === "OUT" || severity === "NEGATIVE")
    return "red";
  if (severity === "MEDIUM" || severity === "LOW") return "orange";
  return "blue";
};
const releaseStatusColor = (status: string) => {
  const normalized = status.toUpperCase();
  if (
    normalized.includes("COMPLETE") ||
    normalized.includes("CLOSE") ||
    normalized.includes("DELIVER")
  )
    return "green";
  if (
    normalized.includes("CANCEL") ||
    normalized.includes("REJECT") ||
    normalized.includes("FAIL")
  )
    return "red";
  if (
    normalized.includes("PROGRESS") ||
    normalized.includes("RELEASE") ||
    normalized.includes("ACTIVE")
  )
    return "blue";
  if (
    normalized.includes("PENDING") ||
    normalized.includes("PLAN") ||
    normalized.includes("DRAFT")
  )
    return "gold";
  return "default";
};
const truncateLabel = (value: string, length = 16) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

function DashboardSkeleton() {
  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Skeleton.Input active block style={{ height: 54 }} />
      <Row gutter={[12, 12]}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Col xs={24} sm={12} md={8} xl={4} key={index}>
            <Card style={equalSectionCardStyle}>
              <Skeleton active paragraph={false} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card style={sectionCardStyle}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={sectionCardStyle}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

export default function DashboardPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error, errorStatus } = useSelector(
    (state: RootState) => state.dashboard,
  );
  const [selectedPeriod, setSelectedPeriod] = useState<Dayjs>(dayjs());
  const loadDashboard = useCallback(
    () =>
      dispatch(
        fetchDashboard({
          month: selectedPeriod.month() + 1,
          year: selectedPeriod.year(),
        }),
      ),
    [dispatch, selectedPeriod],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const snapshot = data?.currentSnapshot;
  const monthly = data?.monthly;
  const daily = useMemo(() => {
    if (data?.daily) return data.daily;
    return (data?.forecastDailyStats ?? []).map((item) => ({
      date: item.date,
      demandQty: item.totalQty,
      approvedIncomingMaterialQty:
        data?.incomingDailyStats?.find((entry) => entry.date === item.date)
          ?.totalQty ?? 0,
      approvedIncomingDocumentCount:
        data?.incomingDailyStats?.find((entry) => entry.date === item.date)
          ?.count ?? 0,
      reportedGoodQty: 0,
      deliveredQty:
        data?.deliveryDailyStats?.find((entry) => entry.date === item.date)
          ?.totalQty ?? 0,
      reportedNgQty: 0,
    }));
  }, [data]);
  const coverage =
    snapshot?.masterData ??
    data?.systemCoverage ??
    (data?.summary
      ? {
          materials: data.summary.totalMaterials,
          suppliers: data.summary.totalSuppliers,
          finishGoods: data.summary.totalFinishGoods,
          manpower: data.summary.totalManPower,
        }
      : undefined);
  const coverageMaterials =
    coverage && "activeMaterials" in coverage
      ? coverage.activeMaterials
      : coverage?.materials;
  const coverageManpower =
    coverage && "activeManpower" in coverage
      ? coverage.activeManpower
      : coverage?.manpower;
  const asOf = data?.meta?.asOf ?? data?.meta?.generatedAt;
  const chartSummary = daily.length
    ? `Daily totals: demand ${formatNumber(daily.reduce((sum, item) => sum + item.demandQty, 0))}, good output ${formatNumber(daily.reduce((sum, item) => sum + item.reportedGoodQty, 0))}, and delivered quantity ${formatNumber(daily.reduce((sum, item) => sum + item.deliveredQty, 0))}.`
    : "No daily data is available for this period.";

  const releaseColumns: TableProps<DashboardReleasePipelineItem>["columns"] = [
    {
      title: "Release",
      dataIndex: "releaseNumber",
      width: 170,
      render: (value: string, record) => (
        <Link href={record.href ?? "/apps/production/production-release"}>
          {value}
        </Link>
      ),
    },
    {
      title: "Plan date",
      dataIndex: "planDate",
      width: 130,
      render: formatDate,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (value: string) => (
        <Tag color={releaseStatusColor(value)}>{value}</Tag>
      ),
    },
    {
      title: "Target",
      dataIndex: "targetQty",
      width: 100,
      align: "right",
      render: formatNumber,
    },
    {
      title: "Shopping",
      dataIndex: "shoppingPct",
      width: 160,
      render: renderProgress,
    },
    {
      title: "Assembly",
      dataIndex: "assemblyPct",
      width: 160,
      render: renderProgress,
    },
    {
      title: "Poka-Yoke",
      dataIndex: "pokayokePct",
      width: 160,
      render: renderProgress,
    },
    {
      title: "Delivery",
      dataIndex: "deliveryPct",
      width: 160,
      render: renderProgress,
    },
  ];
  const inventoryColumns: TableProps<DashboardInventoryRiskItem>["columns"] = [
    {
      title: "Part",
      dataIndex: "partNumber",
      width: 170,
      ellipsis: { showTitle: false },
      render: (value: string, record) => (
        <Tooltip
          title={record.partName ? `${value} — ${record.partName}` : value}
        >
          <Link href={record.href ?? "/apps/warehouse/mrp"}>{value}</Link>
        </Tooltip>
      ),
    },
    {
      title: "Total stock",
      dataIndex: "totalStock",
      align: "right",
      width: 110,
      render: formatNumber,
    },
    {
      title: "Minimum",
      dataIndex: "minimumStock",
      align: "right",
      width: 105,
      render: formatNumber,
    },
    {
      title: "Shortage",
      dataIndex: "shortageQty",
      align: "right",
      width: 100,
      render: (value: number) => (
        <Text type="danger" strong>
          {formatNumber(value)}
        </Text>
      ),
    },
    {
      title: "Risk",
      dataIndex: "status",
      width: 100,
      render: (value: string) => (
        <Tag color={severityColor(value)}>{value || "WARNING"}</Tag>
      ),
    },
  ];

  const supplierColumns: TableProps<DashboardTopSupplierItem>["columns"] = [
    {
      title: "Supplier",
      dataIndex: "supplierName",
      ellipsis: { showTitle: false },
      render: (value: string) => (
        <Tooltip title={value}>
          <Text strong>{value}</Text>
        </Tooltip>
      ),
    },
    {
      title: "Shipments",
      dataIndex: "documentCount",
      align: "right",
      width: 90,
      render: (val: number) => `${formatNumber(val)} DN`,
    },
    {
      title: "Total Qty",
      dataIndex: "totalQty",
      align: "right",
      width: 110,
      render: (val: number) => (
        <Text strong style={{ color: "#13c2c2" }}>
          {formatNumber(val)}
        </Text>
      ),
    },
  ];

  const incomingMaterialColumns: TableProps<DashboardTopIncomingMaterialItem>["columns"] = [
    {
      title: "Material",
      dataIndex: "partNumber",
      width: 150,
      ellipsis: { showTitle: false },
      render: (value: string, record) => (
        <Tooltip title={record.partName ? `${value} — ${record.partName}` : value}>
          <Link href="/apps/master-data/material">{value}</Link>
        </Tooltip>
      ),
    },
    {
      title: "Name",
      dataIndex: "partName",
      ellipsis: { showTitle: true },
      render: (value: string) => value || "—",
    },
    {
      title: "Total Inflow",
      dataIndex: "totalQty",
      align: "right",
      width: 110,
      render: (val: number) => (
        <Text strong style={{ color: "#1677ff" }}>
          {formatNumber(val)}
        </Text>
      ),
    },
  ];

  const recentIncomingColumns: TableProps<DashboardRecentIncomingItem>["columns"] = [
    {
      title: "DN / PO",
      dataIndex: "poId",
      width: 140,
      render: (value: string) => (
        <Link href="/apps/warehouse/incoming">
          <Text strong>{value}</Text>
        </Link>
      ),
    },
    {
      title: "Supplier",
      dataIndex: "supplierName",
      ellipsis: { showTitle: true },
    },
    {
      title: "Items",
      dataIndex: "materialCount",
      align: "right",
      width: 80,
      render: (val: number) => `${val} parts`,
    },
    {
      title: "Total Qty",
      dataIndex: "totalQty",
      align: "right",
      width: 100,
      render: formatNumber,
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      width: 110,
      render: formatDate,
    },
    {
      title: "Status",
      dataIndex: "closed",
      width: 95,
      align: "center",
      render: (closed: boolean) =>
        closed ? (
          <Tag color="green">Approved</Tag>
        ) : (
          <Tag color="orange">Pending</Tag>
        ),
    },
  ];

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    const denied = errorStatus === 401 || errorStatus === 403;
    return (
      <Result
        status={denied ? "403" : "error"}
        title={
          denied ? "Dashboard access denied" : "Unable to load the dashboard"
        }
        subTitle={
          denied
            ? "You do not have the DASHBOARD_VIEW permission."
            : "The dashboard service could not be reached. Please try again."
        }
        extra={
          !denied ? (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void loadDashboard()}
            >
              Try again
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (!data) return <Empty description="No dashboard data is available" />;

  const kpis = [
    {
      title: "Demand",
      value: monthly?.demand.forecastQty,
      color: "#1677ff",
      icon: <InboxOutlined />,
      context: `${formatNumber(monthly?.demand.unscheduledQty)} unscheduled · ${formatNumber(monthly?.demand.unscheduledCount)} orders`,
    },
    {
      title: "Good output",
      value: monthly
        ? monthly.production.reportedQty - monthly.production.reportedNgQty
        : undefined,
      color: "#389e0d",
      icon: <CheckCircleOutlined />,
      context: `${formatNumber(monthly?.production.scannedGoodQty)} scanned / ${formatNumber(monthly?.production.targetQty)} target`,
    },
    {
      title: "Delivered",
      value: monthly?.delivery.deliveredQty,
      color: "#13a8a8",
      icon: <CheckCircleOutlined />,
      context: `${formatNumber(monthly?.delivery.overdueOpenQty)} open overdue · ${formatNumber(monthly?.delivery.overdueForecastCount)} orders`,
    },
    {
      title: "Delivery attainment",
      value: monthly?.delivery.attainmentPct,
      percent: true,
      color: "#722ed1",
      icon: <SafetyCertificateOutlined />,
      context: "Delivered against released demand",
    },
    {
      title: "NG rate",
      value: monthly?.production.ngRatePct,
      percent: true,
      color: "#cf1322",
      icon: <ExperimentOutlined />,
      context: `${formatNumber(monthly?.materialNg.openCaseCount)} open cases · ${formatNumber(monthly?.materialNg.outstandingReplacementQty)} outstanding`,
    },
    {
      title: "Inventory risk",
      value: snapshot
        ? snapshot.inventory.outOfStockPartCount +
          snapshot.inventory.lowStockPartCount +
          snapshot.inventory.negativeBalancePartCount
        : undefined,
      color: "#d46b08",
      icon: <WarningOutlined />,
      context: `${formatNumber(snapshot?.inventory.outOfStockPartCount)} out · ${formatNumber(snapshot?.inventory.lowStockPartCount)} low`,
    },
  ];
  const operations = [
    {
      label: "Incoming approved",
      value: monthly?.incoming.approvedDocumentCount,
      detail: `${formatNumber(monthly?.incoming.approvedMaterialQty)} material quantity`,
      icon: <CheckCircleOutlined />,
      color: "#389e0d",
      href: "/apps/warehouse/incoming",
    },
    {
      label: "Incoming open",
      value: monthly?.incoming.openDocumentCount,
      detail: "Documents awaiting completion",
      icon: <InboxOutlined />,
      color: "#d46b08",
      href: "/apps/warehouse/incoming",
    },
    {
      label: "Assembly in progress",
      value: monthly?.assembly.inProgress,
      detail: `${formatNumber(monthly?.assembly.completed)} completed`,
      icon: <ClockCircleOutlined />,
      color: "#1677ff",
      href: "/apps/production/assembly",
    },
    {
      label: "Poka-Yoke pending",
      value: monthly?.pokayoke.pendingLabels,
      detail: `${formatNumber(monthly?.pokayoke.scannedLabels)} labels scanned`,
      icon: <SafetyCertificateOutlined />,
      color: "#d46b08",
      href: "/apps/production/pokayoke",
    },
    {
      label: "Poka-Yoke failures",
      value: monthly?.pokayoke.failedAttempts,
      detail: "Failed verification attempts",
      icon: <WarningOutlined />,
      color: "#cf1322",
      href: "/apps/production/pokayoke",
    },
    {
      label: "Unvalidated reports",
      value: snapshot?.openExceptions.unvalidatedReportCount,
      detail: `${formatNumber(monthly?.production.reportedQty)} reported quantity`,
      icon: <ExperimentOutlined />,
      color: "#722ed1",
      href: "/apps/production/production-report",
    },
    {
      label: "Stock count freezes",
      value: snapshot
        ? snapshot.freezes.activeMaterial.length +
          snapshot.freezes.activeFinishGood.length
        : undefined,
      detail: "Active material and finish-good freezes",
      icon: <AlertOutlined />,
      color: "#cf1322",
      href: "/apps/warehouse/inventory-counting",
    },
    {
      label: "Material NG open",
      value: monthly?.materialNg.openCaseCount,
      detail: `${formatNumber(monthly?.materialNg.outstandingReplacementQty)} replacement quantity`,
      icon: <ExperimentOutlined />,
      color: "#d46b08",
      href: "/apps/production/material-ng",
    },
  ];
  const topPartHeight = Math.max(
    210,
    Math.min(286, (data.topParts?.length ?? 0) * 34 + 56),
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[12, 12]} align="middle" justify="space-between">
        <Col xs={24} md={12}>
          <Title
            level={3}
            style={{ margin: 0, fontSize: "clamp(20px, 3vw, 24px)" }}
          >
            Executive Dashboard
          </Title>
          <Text type="secondary">
            Supply, production, quality, and delivery performance
          </Text>
        </Col>
        <Col xs={24} md={12}>
          <Flex
            justify="flex-end"
            align="center"
            wrap
            gap={8}
            style={{ width: "100%" }}
          >
            <DatePicker
              aria-label="Dashboard month"
              picker="month"
              value={selectedPeriod}
              allowClear={false}
              format="MMMM YYYY"
              onChange={(value) => value && setSelectedPeriod(value)}
              style={{ flex: "1 1 170px", maxWidth: 220 }}
            />
            <Button
              aria-label="Refresh dashboard"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void loadDashboard()}
              style={{ flex: "0 0 auto" }}
            >
              Refresh
            </Button>
            <Text
              type="secondary"
              style={{ fontSize: 12, flex: "1 1 100%", textAlign: "right" }}
            >
              As of {formatDateTime(asOf)}
            </Text>
          </Flex>
        </Col>
      </Row>
      {error ? (
        <Alert
          type="warning"
          showIcon
          title="Showing the latest available data"
          description="The refresh request failed. Try again when the service is available."
          action={
            <Button size="small" onClick={() => void loadDashboard()}>
              Retry
            </Button>
          }
        />
      ) : null}

      <Row gutter={[12, 12]} align="stretch">
        {kpis.map((item) => (
          <Col
            xs={24}
            sm={12}
            md={8}
            xl={4}
            key={item.title}
            style={{ display: "flex" }}
          >
            <Card
              size="small"
              styles={compactCardBodyStyle}
              style={{
                ...equalSectionCardStyle,
                width: "100%",
                borderTop: `3px solid ${item.color}`,
              }}
            >
              <Flex justify="space-between" align="start" gap={8}>
                <Statistic
                  title={item.title}
                  value={
                    item.percent
                      ? formatPercent(item.value)
                      : formatNumber(item.value)
                  }
                />
                <span aria-hidden style={{ color: item.color, fontSize: 20 }}>
                  {item.icon}
                </span>
              </Flex>
              <Text
                type="secondary"
                ellipsis={{ tooltip: item.context }}
                style={{ display: "block", fontSize: 12, marginTop: 4 }}
              >
                {item.context}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={16} style={{ display: "flex" }}>
          <Card
            title="Daily performance"
            extra={<Text type="secondary">Demand vs. actuals</Text>}
            styles={fixedSectionBodyStyle}
            style={{ ...equalSectionCardStyle, width: "100%" }}
          >
            {daily.length ? (
              <div style={{ overflowX: "auto", height: "100%" }}>
                <span style={visuallyHiddenStyle}>{chartSummary}</span>
                <div aria-hidden style={{ minWidth: 680, height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={daily}
                      margin={{ left: 0, right: 12, top: 8, bottom: 4 }}
                    >
                      <CartesianGrid stroke="#edf0f3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) =>
                          dayjs(value).format("D")
                        }
                        minTickGap={12}
                      />
                      <YAxis
                        tickFormatter={(value: number) =>
                          numberFormatter.format(value)
                        }
                        width={64}
                      />
                      <ChartTooltip
                        labelFormatter={(value) => formatDate(String(value))}
                        formatter={(value) => formatNumber(Number(value))}
                      />
                      <Legend />
                      <Bar
                        name="Demand"
                        dataKey="demandQty"
                        fill="#91caff"
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        name="Good output"
                        type="monotone"
                        dataKey="reportedGoodQty"
                        stroke="#389e0d"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        name="Delivered"
                        type="monotone"
                        dataKey="deliveredQty"
                        stroke="#722ed1"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No daily data is available"
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8} style={{ display: "flex" }}>
          <Card
            title="Operational alerts"
            extra={<Tag color="red">{data.exceptions?.length ?? 0}</Tag>}
            styles={fixedSectionBodyStyle}
            style={{ ...equalSectionCardStyle, width: "100%" }}
          >
            {data.exceptions?.length ? (
              <Space
                orientation="vertical"
                size={8}
                style={{
                  width: "100%",
                  maxHeight: 320,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {data.exceptions
                  .slice(0, 6)
                  .map((item: DashboardExceptionItem) => (
                    <Link
                      key={`${item.type}:${item.title}:${item.occurredAt}`}
                      href={item.route}
                      style={{ display: "block" }}
                    >
                      <div
                        style={{
                          border: "1px solid #f0f0f0",
                          borderLeft: `3px solid ${item.severity === "HIGH" ? "#cf1322" : "#d46b08"}`,
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        <Flex justify="space-between" align="center" gap={8}>
                          <Tooltip title={item.title}>
                            <Text strong ellipsis style={{ minWidth: 0 }}>
                              {item.title}
                            </Text>
                          </Tooltip>
                          <Tag
                            color={severityColor(item.severity)}
                            style={{ marginInlineEnd: 0 }}
                          >
                            {item.severity}
                          </Tag>
                        </Flex>
                        {item.description ? (
                          <Tooltip title={item.description}>
                            <Text
                              type="secondary"
                              ellipsis
                              style={{
                                display: "block",
                                fontSize: 12,
                              }}
                            >
                              {item.description}
                            </Text>
                          </Tooltip>
                        ) : null}
                      </div>
                    </Link>
                  ))}
              </Space>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No active alerts"
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* INCOMING SUPPLY & MATERIAL INFLOW SECTION */}
      <Card
        title={
          <Space size={8}>
            <ImportOutlined style={{ color: "#13c2c2" }} />
            <span>Incoming Supply & Material Inflow Trend</span>
          </Space>
        }
        extra={
          <Link href="/apps/warehouse/incoming">
            View Incoming Delivery Notes
          </Link>
        }
        style={sectionCardStyle}
      >
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small" styles={compactCardBodyStyle} style={{ background: "#f6ffed", border: "1px solid #b7eb8f" }}>
              <Statistic
                title="Approved Material Inflow"
                value={formatNumber(monthly?.incoming.approvedMaterialQty)}
                suffix="pcs"
                styles={{ content: { color: "#389e0d", fontWeight: 600 } }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={compactCardBodyStyle} style={{ background: "#e6f4ff", border: "1px solid #91caff" }}>
              <Statistic
                title="Approved Delivery Notes"
                value={formatNumber(monthly?.incoming.approvedDocumentCount)}
                suffix="DNs"
                styles={{ content: { color: "#1677ff", fontWeight: 600 } }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={compactCardBodyStyle} style={{ background: "#fff7e6", border: "1px solid #ffd591" }}>
              <Statistic
                title="Open / Pending Notes"
                value={formatNumber(monthly?.incoming.openDocumentCount)}
                suffix="DNs"
                styles={{ content: { color: "#d46b08", fontWeight: 600 } }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={compactCardBodyStyle} style={{ background: "#f9f0ff", border: "1px solid #d3adf7" }}>
              <Statistic
                title="Active Delivering Suppliers"
                value={formatNumber(monthly?.incoming.activeSupplierCount ?? data.topSuppliers?.length ?? 0)}
                suffix="Suppliers"
                styles={{ content: { color: "#722ed1", fontWeight: 600 } }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} lg={15} style={{ display: "flex" }}>
            <Card
              size="small"
              title="Daily Inflow Trend (Material Quantity & Delivery Notes)"
              styles={{ body: { height: 280 } }}
              style={{ ...equalSectionCardStyle, width: "100%", background: "#fafafa" }}
            >
              {daily.some((d) => d.approvedIncomingMaterialQty > 0 || (d.approvedIncomingDocumentCount ?? 0) > 0) ? (
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={daily}
                      margin={{ left: 0, right: 16, top: 10, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#edf0f3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => dayjs(value).format("D")}
                        minTickGap={10}
                      />
                      <YAxis
                        yAxisId="qty"
                        tickFormatter={(value: number) => numberFormatter.format(value)}
                        width={64}
                      />
                      <YAxis
                        yAxisId="count"
                        orientation="right"
                        allowDecimals={false}
                        width={36}
                      />
                      <ChartTooltip
                        labelFormatter={(value) => formatDate(String(value))}
                        formatter={(value, name) => [
                          formatNumber(Number(value)),
                          name === "approvedIncomingMaterialQty" ? "Material Quantity (pcs)" : "Approved DNs",
                        ]}
                      />
                      <Legend
                        formatter={(value) =>
                          value === "approvedIncomingMaterialQty"
                            ? "Material Inflow Quantity (pcs)"
                            : "Approved Delivery Notes (DNs)"
                        }
                      />
                      <Bar
                        yAxisId="qty"
                        name="approvedIncomingMaterialQty"
                        dataKey="approvedIncomingMaterialQty"
                        fill="#13c2c2"
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        yAxisId="count"
                        name="approvedIncomingDocumentCount"
                        type="monotone"
                        dataKey="approvedIncomingDocumentCount"
                        stroke="#fa8c16"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No material inflow recorded in this period"
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={9} style={{ display: "flex" }}>
            <Card
              size="small"
              title="Top Delivering Suppliers"
              extra={<ShopOutlined style={{ color: "#13c2c2" }} />}
              styles={{ body: { height: 280, overflowY: "auto" } }}
              style={{ ...equalSectionCardStyle, width: "100%" }}
            >
              <Table<DashboardTopSupplierItem>
                size="small"
                rowKey="supplierId"
                columns={supplierColumns}
                dataSource={data.topSuppliers ?? []}
                pagination={false}
                locale={{ emptyText: "No supplier inflow data" }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
          <Col xs={24} lg={12} style={{ display: "flex" }}>
            <Card
              size="small"
              title="Top Received Raw Materials"
              styles={{ body: { height: 260, overflowY: "auto" } }}
              style={{ ...equalSectionCardStyle, width: "100%" }}
            >
              <Table<DashboardTopIncomingMaterialItem>
                size="small"
                rowKey="partNumber"
                columns={incomingMaterialColumns}
                dataSource={data.topIncomingMaterials ?? []}
                pagination={false}
                locale={{ emptyText: "No material inflow data" }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12} style={{ display: "flex" }}>
            <Card
              size="small"
              title="Recent Incoming Shipments"
              extra={<Link href="/apps/warehouse/incoming">All</Link>}
              styles={{ body: { height: 260, overflowY: "auto" } }}
              style={{ ...equalSectionCardStyle, width: "100%" }}
            >
              <Table<DashboardRecentIncomingItem>
                size="small"
                rowKey="id"
                columns={recentIncomingColumns}
                dataSource={data.recentIncoming ?? []}
                pagination={false}
                locale={{ emptyText: "No recent incoming shipments" }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card
        title="Production release pipeline"
        extra={<Link href="/apps/production/production-release">View all</Link>}
        style={sectionCardStyle}
      >
        <Flex wrap gap={6} style={{ marginBottom: 12 }}>
          {Object.entries(data.monthly.production.releaseCountsByStatus).map(
            ([status, count]) => (
              <Tag color={releaseStatusColor(status)} key={status}>
                {status}: {formatNumber(count)}
              </Tag>
            ),
          )}
        </Flex>
        <Table<DashboardReleasePipelineItem>
          size="small"
          rowKey="releaseId"
          columns={releaseColumns}
          dataSource={data.releasePipeline ?? []}
          pagination={false}
          scroll={{ x: "max-content", y: 260 }}
          locale={{ emptyText: "No releases are available for this period" }}
        />
      </Card>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={14} style={{ display: "flex" }}>
          <Card
            title="Inventory risk"
            extra={<Link href="/apps/warehouse/mrp">Open MRP</Link>}
            styles={{ body: { height: 320, overflow: "hidden" } }}
            style={{ ...equalSectionCardStyle, width: "100%" }}
          >
            <Table<DashboardInventoryRiskItem>
              size="small"
              rowKey={(record) => record.id ?? record.partNumber}
              columns={inventoryColumns}
              dataSource={data.inventoryRisk ?? []}
              pagination={false}
              scroll={{ x: "max-content", y: 236 }}
              locale={{ emptyText: "No inventory risks were found" }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10} style={{ display: "flex" }}>
          <Card
            title="Top finish goods"
            styles={{ body: { height: 320, overflow: "hidden" } }}
            style={{ ...equalSectionCardStyle, width: "100%" }}
          >
            {data.topParts?.length ? (
              <div style={{ height: topPartHeight }}>
                <span
                  style={visuallyHiddenStyle}
                >{`Top finish goods by demand. The highest is ${data.topParts[0]?.partNumber} at ${formatNumber(data.topParts[0]?.demandQty)}.`}</span>
                <div aria-hidden style={{ height: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.topParts}
                      layout="vertical"
                      margin={{ left: 4, right: 18, top: 0, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#edf0f3" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(value: number) =>
                          numberFormatter.format(value)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="partNumber"
                        width={118}
                        tickFormatter={(value: string) => truncateLabel(value)}
                      />
                      <ChartTooltip
                        labelFormatter={(value) => String(value)}
                        formatter={(value, name) => [
                          formatNumber(Number(value)),
                          String(name),
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="demandQty"
                        name="Demand"
                        fill="#1677ff"
                        radius={[0, 3, 3, 0]}
                      />
                      <Bar
                        dataKey="deliveredQty"
                        name="Delivered"
                        fill="#13a8a8"
                        radius={[0, 3, 3, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No finish-good data is available"
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Quality and operations" style={sectionCardStyle}>
        <Row gutter={[12, 12]} align="stretch">
          {operations.map((item) => (
            <Col
              xs={24}
              sm={12}
              md={8}
              xl={6}
              key={item.label}
              style={{ display: "flex" }}
            >
              <Link
                href={item.href}
                aria-label={`${item.label}: ${formatNumber(item.value)}`}
                style={{ display: "flex", width: "100%", height: "100%" }}
              >
                <Flex
                  align="center"
                  gap={10}
                  style={{
                    width: "100%",
                    minHeight: 88,
                    height: "100%",
                    border: "1px solid #f0f0f0",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <span aria-hidden style={{ color: item.color, fontSize: 20 }}>
                    {item.icon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.label}
                    </Text>
                    <div>
                      <Text strong style={{ fontSize: 20 }}>
                        {formatNumber(item.value)}
                      </Text>
                    </div>
                    <Text
                      type="secondary"
                      ellipsis={{ tooltip: item.detail }}
                      style={{ display: "block", fontSize: 11 }}
                    >
                      {item.detail}
                    </Text>
                  </div>
                </Flex>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        size="small"
        title="System coverage"
        styles={compactCardBodyStyle}
        style={sectionCardStyle}
      >
        <Flex wrap gap="8px 24px">
          <Text type="secondary">
            Materials <Text strong>{formatNumber(coverageMaterials)}</Text>
          </Text>
          <Text type="secondary">
            Suppliers <Text strong>{formatNumber(coverage?.suppliers)}</Text>
          </Text>
          <Text type="secondary">
            Finish goods{" "}
            <Text strong>{formatNumber(coverage?.finishGoods)}</Text>
          </Text>
          <Text type="secondary">
            Manpower <Text strong>{formatNumber(coverageManpower)}</Text>
          </Text>
        </Flex>
      </Card>
    </Space>
  );
}

function renderProgress(value?: number | null) {
  if (value === null || value === undefined)
    return <Text type="secondary">—</Text>;
  return (
    <Progress
      percent={clampPercent(value)}
      size="small"
      status={value >= 100 ? "success" : "normal"}
    />
  );
}
