/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Input,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import type { FilterDropdownProps } from "antd/es/table/interface";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import SnapshotTable from "@/components/traceability/SnapshotTable";
import MaterialUsageTable from "@/components/traceability/MaterialUsageTable";
import {
  searchTrace,
  fetchTrace,
  fetchTraceEvents,
  setTraceQuery,
} from "@/store/features/traceability/traceabilitySlice";
import type {
  Page,
  TraceSearchRow,
  TraceData,
  TraceEvent,
} from "@/store/features/traceability/types";

const renderTraceSearch = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
}: FilterDropdownProps) => (
  <div style={{ padding: 8 }} onKeyDown={(event) => event.stopPropagation()}>
    <Input
      autoFocus
      aria-label="Search traceability references"
      placeholder="Search PO / Release / Label / Shopping / NG Case"
      value={selectedKeys[0]?.toString() ?? ""}
      onChange={(event) =>
        setSelectedKeys(event.target.value ? [event.target.value] : [])
      }
      onPressEnter={() => confirm()}
      style={{ marginBottom: 8, display: "block", width: 320 }}
    />
    <Space>
      <Button
        type="primary"
        size="small"
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

export default function TraceabilityView() {
  const dispatch = useDispatch<AppDispatch>();
  const params = useSearchParams();
  const poId = params.get("poId");
  const label = params.get("label");
  const query = useSelector((s: RootState) => s.phaseOne.traceQuery);
  const [results, setResults] = useState<Page<TraceSearchRow> | null>(null);
  const [data, setData] = useState<TraceData | null>(null);
  const [events, setEvents] = useState<Page<TraceEvent> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        if (poId) {
          const [d, e] = await Promise.all([
            dispatch(fetchTrace(poId)).unwrap(),
            dispatch(fetchTraceEvents({ poId, page })).unwrap(),
          ]);
          if (live) {
            setData(d);
            setEvents(e);
          }
        } else {
          const r = await dispatch(searchTrace(query)).unwrap();
          if (live) {
            setResults(r);
            setData(null);
          }
        }
      } catch (e) {
        if (live) {
          setData(null);
          setError(String(e));
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [dispatch, poId, query, page, refresh]);
  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: <Link href="/apps/traceability">Traceability</Link> },
          ...(poId ? [{ title: poId }] : []),
        ]}
      />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => setRefresh((n) => n + 1)}
        />
      </ToolbarWrapper>
      {error && <Alert type="error" title={error} showIcon />}
      {!poId && (
        <Table<TraceSearchRow>
          loading={loading}
          size="small"
          className="small-table"
          rowKey="PoId"
          dataSource={results?.data ?? []}
          columns={[
            {
              title: "PO",
              key: "search",
              filteredValue: query.search ? [query.search] : null,
              filterDropdown: renderTraceSearch,
              filterIcon: (filtered) => (
                <SearchOutlined
                  style={{ color: filtered ? "#1677ff" : undefined }}
                />
              ),
              render: (_, r) => (
                <Link
                  href={`/apps/traceability?poId=${encodeURIComponent(r.PoId)}`}
                >
                  {r.PoId}
                </Link>
              ),
            },
            { title: "Finish Good", dataIndex: "FinishGoodId" },
            { title: "Name", render: (_, r) => r.PartData.PartName },
            { title: "Target", dataIndex: "Qty" },
            {
              title: "Release",
              render: (_, r) => r.ProductionRelease?.ReleaseNumber ?? "-",
            },
            {
              title: "Status",
              render: (_, r) => r.ProductionRelease?.Status ?? "UNASSIGNED",
            },
          ]}
          pagination={{
            current: query.page,
            pageSize: query.limit,
            total: results?.meta.totalItems,
          }}
          onChange={(pagination, filters) => {
            const search = filters.search?.[0]?.toString() ?? "";
            dispatch(
              setTraceQuery({
                ...query,
                search,
                page: search === (query.search ?? "")
                  ? (pagination.current ?? 1)
                  : 1,
                limit: pagination.pageSize ?? query.limit,
              }),
            );
            setPage(1);
          }}
        />
      )}
      {poId && data && (
        <>
          <Alert
            type={data.completeness === "LEGACY" ? "warning" : "info"}
            showIcon
            title={
              data.completeness === "LEGACY"
                ? "Legacy — historical BOM unavailable"
                : "Document-level traceability — material lot not tracked"
            }
            description="Materials and labels are related through the PO. This does not prove material consumption by individual box."
          />
          <Descriptions
            bordered
            size="small"
            column={3}
            style={{ margin: "12px 0" }}
            items={[
              { key: "po", label: "PO", children: data.forecast.PoId },
              {
                key: "fg",
                label: "Finish Good",
                children: data.forecast.FinishGoodId,
              },
              {
                key: "release",
                label: "Release",
                children: data.forecast.ProductionRelease?.ReleaseNumber ?? "-",
              },
              {
                key: "bom",
                label: "BOM Revision",
                children: data.snapshot?.Revision.Revision ?? "Unknown",
              },
              {
                key: "status",
                label: "Status",
                children: (
                  <Tag>
                    {data.forecast.ProductionRelease?.Status ?? "UNASSIGNED"}
                  </Tag>
                ),
              },
              { key: "target", label: "Target", children: data.forecast.Qty },
            ]}
          />
          <Tabs
            items={[
              {
                key: "timeline",
                label: "Timeline",
                children: (
                  <Table<TraceEvent>
                    size="small"
                    loading={loading}
                    rowKey="Id"
                    dataSource={events?.data ?? []}
                    scroll={{ x: "max-content" }}
                    columns={[
                      {
                        title: "Time",
                        render: (_, r) =>
                          new Date(r.CreatedAt).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          }),
                      },
                      { title: "Activity", dataIndex: "Type" },
                      { title: "Document", dataIndex: "SourceId" },
                      { title: "Actor", dataIndex: "Actor" },
                      { title: "Correlation", dataIndex: "CorrelationId" },
                    ]}
                    pagination={{
                      current: page,
                      pageSize: 20,
                      total: events?.meta.totalItems,
                      onChange: setPage,
                    }}
                  />
                ),
              },
              {
                key: "bom",
                label: "BOM Snapshot",
                children: <SnapshotTable snapshot={data.snapshot} />,
              },
              {
                key: "materials",
                label: "Material Usage",
                children: (
                  <>
                    <MaterialUsageTable data={data.materials} />
                    <Table
                      size="small"
                      rowKey="Id"
                      dataSource={data.shopping}
                      columns={[
                        { title: "Material", dataIndex: "MaterialId" },
                        { title: "Purpose", dataIndex: "Purpose" },
                        { title: "Qty", dataIndex: "QtyPick" },
                        { title: "Actor", dataIndex: "CreatedBy" },
                      ]}
                      scroll={{ x: "max-content" }}
                    />
                  </>
                ),
              },
              {
                key: "ng",
                label: "NG & Replacement",
                children: (
                  <Table
                    size="small"
                    rowKey="Id"
                    dataSource={data.cases}
                    columns={[
                      {
                        title: "Case",
                        render: (_, r) => (
                          <Link
                            href={`/apps/production/material-ng?ngCaseId=${r.Id}`}
                          >
                            {r.CaseNumber}
                          </Link>
                        ),
                      },
                      { title: "Stage", dataIndex: "Stage" },
                      { title: "Reason", dataIndex: "Reason" },
                      { title: "Status", dataIndex: "Status" },
                      { title: "Actor", dataIndex: "CreatedBy" },
                    ]}
                    scroll={{ x: "max-content" }}
                  />
                ),
              },
              {
                key: "labels",
                label: "Labels & Delivery",
                children: (
                  <Table
                    size="small"
                    rowKey="Id"
                    dataSource={data.labels}
                    rowClassName={(r) =>
                      r.LabelNumber === label || String(r.Id) === label
                        ? "ant-table-row-selected"
                        : ""
                    }
                    columns={[
                      { title: "Label", dataIndex: "LabelNumber" },
                      { title: "Box Qty", dataIndex: "QtyThisBox" },
                      {
                        title: "Poka-Yoke",
                        render: (_, r) => (r.Scanned ? "Passed" : "Pending"),
                      },
                      {
                        title: "Assembly",
                        render: (_, r) =>
                          r.AssemblySessions.map((s) => s.Status).join(", ") ||
                          "-",
                      },
                      {
                        title: "Delivered Qty",
                        render: (_, r) => r.DeliveryHistory?.Qty ?? 0,
                      },
                      {
                        title: "Delivered At",
                        render: (_, r) =>
                          r.DeliveryHistory
                            ? new Date(
                                r.DeliveryHistory.CreatedAt,
                              ).toLocaleString("id-ID", {
                                timeZone: "Asia/Jakarta",
                              })
                            : "-",
                      },
                    ]}
                    scroll={{ x: "max-content" }}
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </Card>
  );
}
