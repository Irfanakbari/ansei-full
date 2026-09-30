/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import {Descriptions, Table, Tabs, Tag, Tooltip, Typography} from "antd";
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
            <Descriptions
                bordered
                size="small"
                column={{xs: 1, sm: 2, lg: 3}}
                style={{marginBottom: 12}}
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
                                scroll={{x: "max-content", y: "calc(100vh - 490px)"}}
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
                                        {
                                            title: "Actor",
                                            render: (_, record) =>
                                                rawValueTooltip(
                                                    record.CreatedByName || record.CreatedBy || "-",
                                                    record.CreatedBy,
                                                ),
                                        },
                                    ]}
                                    scroll={{x: "max-content"}}
                                />
                            </>
                        ),
                    },
                    ...(data.findings ? [{
                        key: "findings",
                        label: "NG Report",
                        children: (
                            <Table
                                size="small"
                                rowKey="Id"
                                dataSource={data.findings}
                                columns={[
                                    {title: "Finding", dataIndex: "RecordNumber"},
                                    {title: "Category", dataIndex: "Category"},
                                    {title: "Label", render: (_: unknown, record: NonNullable<TraceData["findings"]>[number]) => record.Label?.LabelNumber ?? "-"},
                                    {title: "FG NG Qty", dataIndex: "Qty"},
                                    {title: "Reason", dataIndex: "Reason"},
                                    {title: "Reporter", dataIndex: "Reporter"},
                                    {title: "Status", dataIndex: "Status", render: (status: string) => <Tag color={status === "COMPLETED" ? "green" : status === "REJECTED" ? "red" : status === "WAITING_PART_CHANGE" ? "gold" : "blue"}>{status.replaceAll("_", " ")}</Tag>},
                                ]}
                                expandable={{
                                    expandedRowRender: (record) => (
                                        <Table
                                            size="small"
                                            rowKey="Id"
                                            pagination={false}
                                            dataSource={record.Components}
                                            scroll={{x: "max-content"}}
                                            columns={[
                                                {title: "BOM Component", render: (_: unknown, component) => `${component.SnapshotLine.PartNumber} - ${component.SnapshotLine.PartName}`},
                                                {title: "Qty / FG", render: (_: unknown, component) => `${component.SnapshotLine.QtyPerUnit} ${component.SnapshotLine.UnitName ?? ""}`.trim()},
                                                {title: "Required / Replace", dataIndex: "Qty"},
                                                {title: "Allocated", render: (_: unknown, component) => component.Allocations.reduce((total, allocation) => total + allocation.Qty, 0)},
                                                {title: "Remaining", render: (_: unknown, component) => component.Qty - component.Allocations.reduce((total, allocation) => total + allocation.Qty, 0)},
                                                {title: "Non-production Shopping", render: (_: unknown, component) => component.Allocations.length ? component.Allocations.map((allocation) => `${allocation.Shopping.Id} (${allocation.Qty}/${allocation.Shopping.QtyPick})`).join(", ") : "-"},
                                            ]}
                                        />
                                    ),
                                    rowExpandable: (record) => record.Components.length > 0,
                                }}
                                scroll={{x: "max-content"}}
                                pagination={false}
                            />
                        ),
                    }] : []),
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
