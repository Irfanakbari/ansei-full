/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import {useEffect, useRef, useState} from "react";
import {useSearchParams} from "next/navigation";
import {
    Alert,
    App,
    Breadcrumb,
    Button,
    Card,
    Form,
    Input,
    InputNumber,
    Modal,
    Radio,
    Select,
    Space,
    Table,
    Tag,
} from "antd";
import type {FilterDropdownProps} from "antd/es/table/interface";
import {
    PlusOutlined,
    ReloadOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import {useDispatch} from "react-redux";
import type {AppDispatch} from "@/store";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import {usePhasePermission} from "@/components/traceability/usePhasePermission";
import TraceabilityDetailModal from "@/app/apps/traceability/_components/TraceabilityDetailModal";
import MaterialNgDetailModal from "./MaterialNgDetailModal";
import {
    closeNg,
    createNgCase,
    fetchBomSnapshots,
    fetchNgCase,
    fetchNgCases,
    issueNg,
    searchNgOrders,
} from "@/store/features/traceability/traceabilitySlice";
import type {
    BomSnapshot,
    NgCase,
    Page,
    TraceSearchRow,
} from "@/store/features/traceability/types";

type DraftLine = {
    materialId: string;
    name: string;
    perUnit: number;
    qtyNg: number;
    qtyReplacement: number;
};

const renderCaseSearch = ({
                              setSelectedKeys,
                              selectedKeys,
                              confirm,
                              clearFilters,
                          }: FilterDropdownProps) => (
    <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
        <Input
            autoFocus
            aria-label="Search material NG case or PO"
            placeholder="Search case or PO"
            value={selectedKeys[0]?.toString() ?? ""}
            onChange={(event) =>
                setSelectedKeys(event.target.value ? [event.target.value] : [])
            }
            onPressEnter={() => confirm()}
            style={{marginBottom: 8, display: "block", width: 240}}
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

export default function MaterialNgWorkspace() {
    const dispatch = useDispatch<AppDispatch>();
    const params = useSearchParams();
    const {message} = App.useApp();
    const {can} = usePhasePermission();
    const [result, setResult] = useState<Page<NgCase> | null>(null);
    const [selected, setSelected] = useState<NgCase | null>(null);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [open, setOpen] = useState(false);
    const [orders, setOrders] = useState<TraceSearchRow[]>([]);
    const [snapshot, setSnapshot] = useState<BomSnapshot | null>(null);
    const [lines, setLines] = useState<DraftLine[]>([]);
    const [mode, setMode] = useState("MATERIAL");
    const [sets, setSets] = useState(1);
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [detailOpen, setDetailOpen] = useState(false);
    const [tracePoId, setTracePoId] = useState<string | null>(null);
    const [form] = Form.useForm<{
        poId: string;
        stage: string;
        reason: string;
    }>();
    const requestIds = useRef(new Map<string, string>());
    const commandId = (payload: unknown) => {
        const key = JSON.stringify(payload);
        let id = requestIds.current.get(key);
        if (!id) {
            id = crypto.randomUUID();
            requestIds.current.set(key, id);
        }
        return id;
    };
    useEffect(() => {
        let live = true;
        void (async () => {
            setLoading(true);
            setError("");
            try {
                const r = await dispatch(fetchNgCases({page, search})).unwrap();
                if (live) setResult(r);
                const id = params.get("ngCaseId");
                if (id) {
                    const c = await dispatch(fetchNgCase(id)).unwrap();
                    if (live) {
                        setSelected(c);
                        setQuantities({});
                        setDetailOpen(true);
                    }
                }
            } catch (e) {
                if (live) setError(String(e));
            } finally {
                if (live) setLoading(false);
            }
        })();
        return () => {
            live = false;
        };
    }, [dispatch, page, search, refresh, params]);
    const openCase = async (record: NgCase) => {
        setSelected(record);
        setQuantities({});
        try {
            const freshest = await dispatch(fetchNgCase(record.Id)).unwrap();
            setSelected(freshest);
            setDetailOpen(true);
        } catch (e) {
            message.error(String(e));
        }
    };
    const findOrders = async (value: string) => {
        try {
            setOrders(
                (await dispatch(searchNgOrders({search: value, limit: 50})).unwrap())
                    .data,
            );
        } catch (e) {
            message.error(String(e));
        }
    };
    const selectPo = async (poId: string, options = orders) => {
        const order = options.find((o) => o.PoId === poId);
        setSnapshot(null);
        setLines([]);
        if (!order?.ProductionRelease) return;
        try {
            const list = await dispatch(
                fetchBomSnapshots(order.ProductionRelease.Id),
            ).unwrap();
            const s = list.find((s) => s.ForecastId === poId) ?? null;
            setSnapshot(s);
            setLines(
                s?.Lines.map((l) => ({
                    materialId: l.PartNumber,
                    name: l.PartName,
                    perUnit: l.QtyPerUnit,
                    qtyNg: 0,
                    qtyReplacement: 0,
                })) ?? [],
            );
        } catch (e) {
            message.error(String(e));
        }
    };
    const begin = async () => {
        requestIds.current.clear();
        form.resetFields();
        setSnapshot(null);
        setLines([]);
        setMode("MATERIAL");
        setOpen(true);
        try {
            const list = (
                await dispatch(
                    searchNgOrders({search: params.get("poId") ?? "", limit: 50}),
                ).unwrap()
            ).data;
            setOrders(list);
            const po = params.get("poId");
            if (po && list.some((o) => o.PoId === po)) {
                form.setFieldsValue({poId: po});
                await selectPo(po, list);
            }
        } catch (e) {
            message.error(String(e));
        }
    };
    const save = async () => {
        try {
            const values = await form.validateFields();
            if (!snapshot) throw "Historical BOM snapshot is unavailable.";
            const picked = lines.filter((l) => l.qtyNg > 0);
            if (!picked.length) throw "Enter NG quantity for at least one material.";
            const body = {
                forecastId: values.poId,
                snapshotId: snapshot.Id,
                stage: values.stage,
                reason: values.reason,
                lines: picked.map((l) => ({
                    materialId: l.materialId,
                    qtyNg: l.qtyNg,
                    qtyReplacement: l.qtyReplacement,
                })),
                ...(params.get("labelId")
                    ? {labelId: Number(params.get("labelId"))}
                    : {}),
                ...(params.get("assemblySessionId")
                    ? {assemblySessionId: params.get("assemblySessionId")!}
                    : {}),
                ...(params.get("productionReportId")
                    ? {productionReportId: Number(params.get("productionReportId"))}
                    : {}),
            };
            setSaving(true);
            const c = await dispatch(
                createNgCase({...body, requestId: commandId(body)}),
            ).unwrap();
            setSelected(c);
            setOpen(false);
            setQuantities({});
            setDetailOpen(true);
            setRefresh((v) => v + 1);
            message.success(
                "Material NG recorded. Rack stock has not been deducted again.",
            );
        } catch (e) {
            if (typeof e === "string") message.error(e);
        } finally {
            setSaving(false);
        }
    };
    const issue = async () => {
        if (!selected) return;
        const body = {
            id: selected.Id,
            lines: selected.Details.map((d) => ({
                detailId: d.Id,
                qty: quantities[d.Id] ?? 0,
            })).filter((l) => l.qty > 0),
        };
        if (!body.lines.length) {
            message.warning("Enter replacement quantity.");
            return;
        }
        setSaving(true);
        try {
            setSelected(
                await dispatch(
                    issueNg({...body, requestId: commandId(body)}),
                ).unwrap(),
            );
            setQuantities({});
            setRefresh((v) => v + 1);
            message.success("Replacement issued.");
        } catch (e) {
            message.error(String(e));
        } finally {
            setSaving(false);
        }
    };
    const close = async (action: "CLOSE" | "CANCEL", reason: string) => {
        if (!selected || !reason.trim()) return false;
        const body = {id: selected.Id, reason, action};
        setSaving(true);
        try {
            setSelected(
                await dispatch(
                    closeNg({...body, requestId: commandId(body)}),
                ).unwrap(),
            );
            setRefresh((v) => v + 1);
            return true;
        } catch (e) {
            message.error(String(e));
            return false;
        } finally {
            setSaving(false);
        }
    };
    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb
                style={{marginBottom: 16}}
                items={[
                    {title: "Home"},
                    {title: "Production"},
                    {title: "Material NG"},
                ]}
            />
            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined/>}
                    onClick={() => setRefresh((v) => v + 1)}
                />
                <ButtonToolbar
                    title="Report Material NG"
                    icon={<PlusOutlined/>}
                    enable={can("IPCS.MATERIAL_NG_CREATE")}
                    onClick={() => void begin()}
                />
            </ToolbarWrapper>
            {error && <Alert type="error" title={error}/>}
            <Table<NgCase>
                size="small"
                className="small-table"
                loading={loading}
                rowKey="Id"
                dataSource={result?.data ?? []}
                onRow={(record) => ({
                    onClick: () => {
                        setSelected(record);
                        setQuantities({});
                    },
                    onDoubleClick: () => void openCase(record),
                })}
                rowClassName={(record) =>
                    selected?.Id === record.Id ? "ant-table-row-selected" : ""
                }
                columns={[
                    {
                        title: "Case",
                        dataIndex: "CaseNumber",
                        key: "search",
                        filteredValue: search ? [search] : null,
                        filterDropdown: renderCaseSearch,
                        filterIcon: (filtered) => (
                            <SearchOutlined
                                style={{color: filtered ? "#1677ff" : undefined}}
                            />
                        ),
                        render: (_, record) => (
                            <Space size={4}>
                                <GoldenArrowAction
                                    tooltip="View Material NG case"
                                    ariaLabel={`View Material NG case ${record.CaseNumber}`}
                                    onClick={() => void openCase(record)}
                                />
                                <span>{record.CaseNumber}</span>
                            </Space>
                        ),
                    },
                    {
                        title: "PO",
                        dataIndex: "ForecastId",
                        render: (forecastId: string) => (
                            <Space size={4}>
                                <GoldenArrowAction
                                    tooltip="View PO traceability"
                                    ariaLabel={`View traceability for PO ${forecastId}`}
                                    onClick={() => setTracePoId(forecastId)}
                                />
                                <span>{forecastId}</span>
                            </Space>
                        ),
                    },
                    {title: "Stage", dataIndex: "Stage"},
                    {title: "Status", render: (_, r) => <Tag>{r.Status}</Tag>},
                    {title: "Reason", dataIndex: "Reason"},
                    {title: "Actor", dataIndex: "CreatedBy"},
                ]}
                pagination={{
                    current: page,
                    pageSize: 20,
                    total: result?.meta.totalItems,
                }}
                onChange={(pagination, filters) => {
                    const nextSearch = filters.search?.[0]?.toString() ?? "";
                    setPage(nextSearch === search ? (pagination.current ?? 1) : 1);
                    setSearch(nextSearch);
                }}
                scroll={{x: "max-content"}}
            />
            <MaterialNgDetailModal
                open={detailOpen}
                data={selected}
                quantities={quantities}
                saving={saving}
                canIssue={can("IPCS.MATERIAL_NG_ISSUE")}
                canClose={can("IPCS.MATERIAL_NG_CLOSE")}
                onClose={() => setDetailOpen(false)}
                onQuantityChange={(detailId, quantity) =>
                    setQuantities((current) => ({...current, [detailId]: quantity}))
                }
                onIssue={() => void issue()}
                onCloseCase={close}
            />
            <TraceabilityDetailModal
                open={tracePoId !== null}
                poId={tracePoId}
                onClose={() => setTracePoId(null)}
            />
            <Modal
                centered
                width={1050}
                open={open}
                title="Report Material NG"
                onCancel={() => setOpen(false)}
                onOk={() => void save()}
                confirmLoading={saving}
                destroyOnHidden
                forceRender
            >
                <Alert
                    type="info"
                    title="Material NG does not change the standard BOM or deduct rack stock again. Replacement is issued separately."
                    style={{marginBottom: 12}}
                />
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="poId"
                        label="Production PO"
                        rules={[{required: true}]}
                    >
                        <Select
                            showSearch={{
                                filterOption: false,
                                onSearch: (value) => void findOrders(value),
                            }}
                            onChange={(v) => void selectPo(v)}
                            options={orders.map((o) => ({
                                value: o.PoId,
                                label: `${o.PoId} — ${o.FinishGoodId}`,
                            }))}
                        />
                    </Form.Item>
                    <Space align="start">
                        <Form.Item
                            name="stage"
                            label="Process Stage"
                            rules={[{required: true, whitespace: true}]}
                        >
                            <Select
                                placeholder="Select process stage"
                                options={[
                                    {value: "MATERIAL_PREPARATION", label: "Material Preparation"},
                                    {value: "ASSEMBLY", label: "Assembly"},
                                    {value: "POKAYOKE", label: "Poka-Yoke"},
                                    {value: "PRE_DELIVERY", label: "Pre Delivery"},
                                    {value: "OTHER", label: "Other"},
                                ]}
                            />
                        </Form.Item>
                        <Form.Item
                            name="reason"
                            label="Reason"
                            rules={[{required: true, whitespace: true}]}
                        >
                            <Input.TextArea style={{width: 550}} maxLength={1000}/>
                        </Form.Item>
                    </Space>
                </Form>
                {!snapshot && (
                    <Alert
                        type="warning"
                        title="Select a PO with an approved BOM snapshot."
                    />
                )}
                {snapshot && (
                    <>
                        <Tag>BOM Revision {snapshot.Revision.Revision}</Tag>
                        <Space style={{margin: "12px 0"}}>
                            <Radio.Group
                                value={mode}
                                onChange={(e) => setMode(e.target.value)}
                                options={[
                                    {value: "MATERIAL", label: "Specific Materials"},
                                    {value: "SET", label: "BOM Set"},
                                ]}
                            />
                            {mode === "SET" && (
                                <>
                                    <InputNumber
                                        min={1}
                                        precision={0}
                                        value={sets}
                                        onChange={(n) => setSets(n ?? 1)}
                                    />
                                    <Button
                                        onClick={() =>
                                            setLines((old) =>
                                                old.map((l) => ({
                                                    ...l,
                                                    qtyNg: l.perUnit * sets,
                                                    qtyReplacement: l.perUnit * sets,
                                                })),
                                            )
                                        }
                                    >
                                        Expand Set
                                    </Button>
                                </>
                            )}
                        </Space>
                        <p>
                            Review every component. Set NG and replacement to zero for
                            components that remain usable.
                        </p>
                        <Table<DraftLine>
                            size="small"
                            rowKey="materialId"
                            dataSource={lines}
                            pagination={false}
                            columns={[
                                {title: "Material", dataIndex: "materialId"},
                                {title: "Name", dataIndex: "name"},
                                {
                                    title: "NG Qty",
                                    render: (_, r) => (
                                        <InputNumber
                                            min={0}
                                            precision={0}
                                            value={r.qtyNg}
                                            onChange={(n) =>
                                                setLines((old) =>
                                                    old.map((l) =>
                                                        l.materialId === r.materialId
                                                            ? {
                                                                ...l,
                                                                qtyNg: n ?? 0,
                                                                qtyReplacement: Math.min(
                                                                    l.qtyReplacement,
                                                                    n ?? 0,
                                                                ),
                                                            }
                                                            : l,
                                                    ),
                                                )
                                            }
                                        />
                                    ),
                                },
                                {
                                    title: "Replacement Needed",
                                    render: (_, r) => (
                                        <InputNumber
                                            min={0}
                                            max={r.qtyNg}
                                            precision={0}
                                            value={r.qtyReplacement}
                                            onChange={(n) =>
                                                setLines((old) =>
                                                    old.map((l) =>
                                                        l.materialId === r.materialId
                                                            ? {...l, qtyReplacement: n ?? 0}
                                                            : l,
                                                    ),
                                                )
                                            }
                                        />
                                    ),
                                },
                            ]}
                        />
                    </>
                )}
            </Modal>
        </Card>
    );
}
