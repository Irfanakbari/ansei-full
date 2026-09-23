/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import Link from "next/link";
import {Alert, Descriptions, Table, Tabs, Tag, Tooltip, Typography} from "antd";
import SnapshotTable from "@/components/traceability/SnapshotTable";
import MaterialUsageTable from "@/components/traceability/MaterialUsageTable";
import type {
    Page,
    TraceData,
    TraceEvent,
} from "@/store/features/traceability/types";

type TraceabilityDetailProps = {
    data: TraceData;
    events: Page<TraceEvent> | null;
    loading: boolean;
    page: number;
    onPageChange: (page: number) => void;
    label?: string | null;
};

const formatActivity = (activity: string) =>
    activity
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const rawValueTooltip = (display: string, raw: string, correlation?: string) => (
    <Tooltip
        title={
            <div>
                <div>Raw ID: <Typography.Text copyable={{text: raw}}>{raw}</Typography.Text></div>
                {correlation &&
                    <div>Correlation: <Typography.Text copyable={{text: correlation}}>{correlation}</Typography.Text>
                    </div>}
            </div>
        }
    >
        <span>{display}</span>
    </Tooltip>
);

export default function TraceabilityDetail({
                                               data,
                                               events,
                                               loading,
                                               page,
                                               onPageChange,
                                               label,
                                           }: TraceabilityDetailProps) {
    return (
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
                column={{xs: 1, sm: 2, lg: 3}}
                style={{margin: "12px 0"}}
                items={[
                    {key: "po", label: "PO", children: data.forecast.PoId},
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
                            <Tag>{data.forecast.ProductionRelease?.Status ?? "UNASSIGNED"}</Tag>
                        ),
                    },
                    {key: "target", label: "Target", children: data.forecast.Qty},
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
                                className="small-table"
                                loading={loading}
                                rowKey="Id"
                                dataSource={events?.data ?? []}
                                scroll={{x: "max-content", y: "calc(100vh - 440px)"}}
                                columns={[
                                    {
                                        title: "Time",
                                        render: (_, record) =>
                                            new Date(record.CreatedAt).toLocaleString("id-ID", {
                                                timeZone: "Asia/Jakarta",
                                            }),
                                    },
                                    {
                                        title: "Activity",
                                        render: (_, record) => formatActivity(record.Type),
                                    },
                                    {
                                        title: "Document",
                                        render: (_, record) => rawValueTooltip(
                                            record.documentReference,
                                            record.SourceId,
                                            record.CorrelationId,
                                        ),
                                    },
                                    {
                                        title: "Actor",
                                        render: (_, record) => rawValueTooltip(record.actorName, record.Actor),
                                    },
                                ]}
                                pagination={{
                                    current: page,
                                    pageSize: 100,
                                    showSizeChanger: false,
                                    total: events?.meta.totalItems,
                                    onChange: onPageChange,
                                }}
                            />
                        ),
                    },
                    {
                        key: "bom",
                        label: "BOM Snapshot",
                        children: <SnapshotTable snapshot={data.snapshot}/>,
                    },
                    {
                        key: "materials",
                        label: "Material Usage",
                        children: (
                            <>
                                <MaterialUsageTable data={data.materials}/>
                                <Table
                                    size="small"
                                    rowKey="Id"
                                    dataSource={data.shopping}
                                    columns={[
                                        {title: "Material", dataIndex: "MaterialId"},
                                        {title: "Purpose", dataIndex: "Purpose"},
                                        {title: "Qty", dataIndex: "QtyPick"},
                                        {title: "Actor", dataIndex: "CreatedBy"},
                                    ]}
                                    scroll={{x: "max-content"}}
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
                                        render: (_, record) => (
                                            <Link
                                                href={`/apps/production/material-ng?ngCaseId=${record.Id}`}
                                            >
                                                {record.CaseNumber}
                                            </Link>
                                        ),
                                    },
                                    {title: "Stage", dataIndex: "Stage"},
                                    {title: "Reason", dataIndex: "Reason"},
                                    {title: "Status", dataIndex: "Status"},
                                    {title: "Actor", dataIndex: "CreatedBy"},
                                ]}
                                scroll={{x: "max-content"}}
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
                                rowClassName={(record) =>
                                    record.LabelNumber === label || String(record.Id) === label
                                        ? "ant-table-row-selected"
                                        : ""
                                }
                                columns={[
                                    {title: "Label", dataIndex: "LabelNumber"},
                                    {title: "Box Qty", dataIndex: "QtyThisBox"},
                                    {
                                        title: "Poka-Yoke",
                                        render: (_, record) =>
                                            record.Scanned ? "Passed" : "Pending",
                                    },
                                    {
                                        title: "Assembly",
                                        render: (_, record) =>
                                            record.AssemblySessions.map((session) => session.Status).join(", ") ||
                                            "-",
                                    },
                                    {
                                        title: "Pallet ID",
                                        render: (_, record) =>
                                            record.DeliveryHistory?.PalletNumber ? (
                                                <Tag color="purple">{record.DeliveryHistory.PalletNumber}</Tag>
                                            ) : (
                                                "-"
                                            ),
                                    },
                                    {
                                        title: "Delivered Qty",
                                        render: (_, record) => record.DeliveryHistory?.Qty ?? 0,
                                    },
                                    {
                                        title: "Delivered At",
                                        render: (_, record) =>
                                            record.DeliveryHistory
                                                ? new Date(record.DeliveryHistory.CreatedAt).toLocaleString(
                                                    "id-ID",
                                                    {timeZone: "Asia/Jakarta"},
                                                )
                                                : "-",
                                    },
                                ]}
                                scroll={{x: "max-content"}}
                            />
                        ),
                    },
                ]}
            />
        </>
    );
}
