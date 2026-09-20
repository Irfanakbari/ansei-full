/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {ReloadOutlined, SearchOutlined} from "@ant-design/icons";
import {Alert, Breadcrumb, Button, Card, Input, Space, Table} from "antd";
import type {FilterDropdownProps} from "antd/es/table/interface";
import {useDispatch, useSelector} from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import FinishGoodLinkedModal from "@/components/production/FinishGoodLinkedModal";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import type {AppDispatch, RootState} from "@/store";
import {
    fetchTrace,
    fetchTraceEvents,
    searchTrace,
    setTraceQuery,
} from "@/store/features/traceability/traceabilitySlice";
import type {
    Page,
    TraceData,
    TraceEvent,
    TraceSearchRow,
} from "@/store/features/traceability/types";
import TraceabilityDetail from "./TraceabilityDetail";
import TraceabilityDetailModal from "./TraceabilityDetailModal";

const renderTraceSearch = ({
                               setSelectedKeys,
                               selectedKeys,
                               confirm,
                               clearFilters,
                           }: FilterDropdownProps) => (
    <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
        <Input
            autoFocus
            aria-label="Search traceability references"
            placeholder="Search PO / Release / Label / Shopping / NG Case"
            value={selectedKeys[0]?.toString() ?? ""}
            onChange={(event) =>
                setSelectedKeys(event.target.value ? [event.target.value] : [])
            }
            onPressEnter={() => confirm()}
            style={{marginBottom: 8, display: "block", width: 320}}
        />
        <Space>
            <Button
                type="primary"
                size="small"
                icon={<SearchOutlined/>}
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
    const query = useSelector((state: RootState) => state.phaseOne.traceQuery);
    const [results, setResults] = useState<Page<TraceSearchRow> | null>(null);
    const [data, setData] = useState<TraceData | null>(null);
    const [events, setEvents] = useState<Page<TraceEvent> | null>(null);
    const [modalPoId, setModalPoId] = useState<string | null>(null);
    const [finishGoodPartNumber, setFinishGoodPartNumber] = useState<string | null>(null);
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
                    const [nextData, nextEvents] = await Promise.all([
                        dispatch(fetchTrace(poId)).unwrap(),
                        dispatch(fetchTraceEvents({poId, page})).unwrap(),
                    ]);
                    if (live) {
                        setData(nextData);
                        setEvents(nextEvents);
                    }
                } else {
                    const nextResults = await dispatch(searchTrace(query)).unwrap();
                    if (live) {
                        setResults(nextResults);
                        setData(null);
                    }
                }
            } catch (reason) {
                if (live) {
                    setData(null);
                    setError(String(reason));
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
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb
                style={{marginBottom: 16}}
                items={[
                    {title: "Home"},
                    {title: <Link href="/apps/traceability">Traceability</Link>},
                    ...(poId ? [{title: poId}] : []),
                ]}
            />
            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined/>}
                    onClick={() => setRefresh((value) => value + 1)}
                />
            </ToolbarWrapper>
            {error && <Alert type="error" title={error} showIcon/>}
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
                                    style={{color: filtered ? "#1677ff" : undefined}}
                                />
                            ),
                            render: (_, record) => (
                                <Space size={4}>
                                    <Link
                                        href={`/apps/traceability?poId=${encodeURIComponent(record.PoId)}`}
                                    >
                                        {record.PoId}
                                    </Link>
                                    <GoldenArrowAction
                                        ariaLabel={`Open traceability detail for PO ${record.PoId}`}
                                        tooltip="Open traceability detail"
                                        onClick={() => setModalPoId(record.PoId)}
                                    />
                                </Space>
                            ),
                        },
                        {
                            title: "Finish Good",
                            dataIndex: "FinishGoodId",
                            render: (partNumber: string) => (
                                <Space size={4}>
                                    <GoldenArrowAction
                                        ariaLabel={`Open Finish Good detail for ${partNumber}`}
                                        tooltip="Open Finish Good detail"
                                        onClick={() => setFinishGoodPartNumber(partNumber)}
                                    />
                                    <span>{partNumber}</span>
                                </Space>
                            ),
                        },
                        {title: "Name", render: (_, record) => record.PartData.PartName},
                        {title: "Target", dataIndex: "Qty"},
                        {
                            title: "Release",
                            render: (_, record) =>
                                record.ProductionRelease?.ReleaseNumber ?? "-",
                        },
                        {
                            title: "Status",
                            render: (_, record) =>
                                record.ProductionRelease?.Status ?? "UNASSIGNED",
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
                                page:
                                    search === (query.search ?? "")
                                        ? (pagination.current ?? 1)
                                        : 1,
                                limit: pagination.pageSize ?? query.limit,
                            }),
                        );
                        setPage(1);
                    }}
                    onRow={(record) => ({
                        onDoubleClick: () => setModalPoId(record.PoId),
                    })}
                    scroll={{x: "max-content", y: "calc(100vh - 380px)"}}
                    style={{fontSize: 11}}
                />
            )}
            {poId && data && (
                <TraceabilityDetail
                    data={data}
                    events={events}
                    loading={loading}
                    page={page}
                    onPageChange={setPage}
                    label={label}
                />
            )}
            <TraceabilityDetailModal
                open={modalPoId !== null}
                poId={modalPoId}
                onClose={() => setModalPoId(null)}
            />
            <FinishGoodLinkedModal
                open={finishGoodPartNumber !== null}
                partNumber={finishGoodPartNumber}
                onClose={() => setFinishGoodPartNumber(null)}
            />
        </Card>
    );
}
