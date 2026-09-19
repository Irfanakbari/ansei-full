/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import {useEffect, useState} from "react";
import {
    Alert,
    App,
    Breadcrumb,
    Button,
    Card,
    Checkbox,
    Form,
    Input,
    Modal,
    Select,
    Space,
    Table,
    Tag,
} from "antd";
import type {TableProps} from "antd";
import type {FilterDropdownProps} from "antd/es/table/interface";
import {PlusOutlined, ReloadOutlined, SearchOutlined} from "@ant-design/icons";
import {useDispatch, useSelector} from "react-redux";
import {useRouter} from "next/navigation";
import type {AppDispatch, RootState} from "@/store";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import FinishGoodLinkedModal from "@/components/production/FinishGoodLinkedModal";
import {usePhasePermission} from "@/components/traceability/usePhasePermission";
import {
    createRevision,
    fetchRevisions,
    setRevisionQuery,
} from "@/store/features/traceability/traceabilitySlice";
import type {BomRevision, Page} from "@/store/features/traceability/types";
import {fetchFinishGood} from "@/store/features/master/finishGoodSlice";
import RevisionDetailsModal from "./_components/RevisionDetailsModal";

export default function BillOfMaterialsPage() {
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();
    const {message} = App.useApp();
    const {can} = usePhasePermission();
    const query = useSelector((s: RootState) => s.phaseOne.revisionQuery);
    const finishGoods = useSelector((s: RootState) => s.finishGood);
    const [data, setData] = useState<Page<BomRevision> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState<BomRevision | null>(null);
    const [refresh, setRefresh] = useState(0);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [finishGoodPartNumber, setFinishGoodPartNumber] = useState<string | null>(null);
    const [form] = Form.useForm<{
        finishGoodId: number;
        reason: string;
        importLegacy: boolean;
    }>();
    useEffect(() => {
        let alive = true;
        void (async () => {
            setLoading(true);
            setError("");
            try {
                const result = await dispatch(fetchRevisions(query)).unwrap();
                if (alive) setData(result);
            } catch (e) {
                if (alive) setError(String(e));
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [dispatch, query, refresh]);
    const statusFilter = query.active === "true" ? "ACTIVE" : query.status;
    const handleTableChange: TableProps<BomRevision>["onChange"] = (
        pagination,
        filters,
    ) => {
        const search = String(filters.finishGood?.[0] ?? "").trim();
        const selectedStatus = filters.status?.[0]
            ? String(filters.status[0])
            : undefined;
        const filterChanged = search !== (query.search ?? "") || selectedStatus !== statusFilter;
        setSelected(null);
        dispatch(
            setRevisionQuery({
                page: filterChanged ? 1 : (pagination.current ?? query.page),
                limit: pagination.pageSize ?? query.limit,
                ...(search ? {search} : {}),
                ...(selectedStatus === "ACTIVE"
                    ? {active: "true"}
                    : selectedStatus
                        ? {status: selectedStatus}
                        : {}),
            }),
        );
    };
    const renderFinishGoodSearch = ({
                                        setSelectedKeys,
                                        selectedKeys,
                                        confirm,
                                        clearFilters,
                                    }: FilterDropdownProps) => (
        <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
            <Input
                autoFocus
                placeholder="Search finish good"
                value={String(selectedKeys[0] ?? "")}
                onChange={(event) =>
                    setSelectedKeys(event.target.value ? [event.target.value] : [])
                }
                onPressEnter={() => confirm()}
                style={{display: "block", marginBottom: 8, width: 240}}
            />
            <Space>
                <Button type="primary" icon={<SearchOutlined/>} onClick={() => confirm()}>
                    Search
                </Button>
                <Button
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
    const columns: TableProps<BomRevision>["columns"] = [
        {
            title: "Revision",
            render: (_, r) => (
                <span style={{display: "inline-flex", alignItems: "center", gap: 4}}>
          {r.Revision}
                    <GoldenArrowAction
                        ariaLabel={`Open BOM revision ${r.Revision}`}
                        tooltip="Open BOM revision"
                        onClick={() => setRevisionId(r.Id)}
                    />
        </span>
            ),
        },
        {
            title: "FG Part Number",
            key: "finishGood",
            render: (_, r) => (
                <Space size={4}>
                    <GoldenArrowAction
                        ariaLabel={`Open Finish Good detail for ${r.FinishGood.PartNumber}`}
                        tooltip="Open Finish Good detail"
                        onClick={() => setFinishGoodPartNumber(r.FinishGood.PartNumber)}
                    />
                    <span>{r.FinishGood.PartNumber}</span>
                </Space>
            ),
            filterDropdown: renderFinishGoodSearch,
            filteredValue: query.search ? [query.search] : null,
            filterIcon: (filtered) => <SearchOutlined style={{color: filtered ? "#1677ff" : undefined}}/>,
        },
        {title: "FG Part Name", render: (_, r) => r.FinishGood.PartName},
        {title: "Materials", render: (_, r) => r.Lines.length},
        {title: "Approved By", dataIndex: "ApprovedBy"},
        {
            title: "Approved At",
            render: (_, r) =>
                r.ApprovedAt
                    ? new Date(r.ApprovedAt).toLocaleString("id-ID", {
                        timeZone: "Asia/Jakarta",
                    })
                    : "-",
        },
        {
            title: "Status",
            key: "status",
            filters: ["ACTIVE", "DRAFT", "SUBMITTED", "APPROVED", "CANCELLED"].map(
                (status) => ({text: status, value: status}),
            ),
            filterMultiple: false,
            filteredValue: statusFilter ? [statusFilter] : null,
            render: (_, r) => {
                const status = r.FinishGood.ActiveBomRevisionId === r.Id ? "ACTIVE" : r.Status;
                const colors = {
                    ACTIVE: "green",
                    DRAFT: "default",
                    SUBMITTED: "orange",
                    APPROVED: "blue",
                    CANCELLED: "red",
                } as const;
                return <Tag color={colors[status]}>{status}</Tag>;
            },
        },
    ];
    const create = async () => {
        try {
            const value = await form.validateFields();
            setSaving(true);
            const result = await dispatch(createRevision(value)).unwrap();
            setOpen(false);
            router.push(`/apps/master-data/bill-of-materials/${result.Id}`);
        } catch (e) {
            if (typeof e === "string") message.error(e);
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
                    {title: "Master Data"},
                    {title: "Bill of Materials"},
                ]}
            />
            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined/>}
                    onClick={() => setRefresh((v) => v + 1)}
                />
                <ButtonToolbar
                    title="Create Revision"
                    icon={<PlusOutlined/>}
                    enable={can("IPCS.BOM_REVISION_CREATE")}
                    onClick={() => {
                        setOpen(true);
                        void dispatch(fetchFinishGood({limit: 50}));
                    }}
                />
            </ToolbarWrapper>
            {error && <Alert type="error" title={error} showIcon/>}
            <Table<BomRevision>
                size="small"
                className="small-table"
                rowKey="Id"
                columns={columns}
                dataSource={data?.data ?? []}
                loading={loading}
                scroll={{x: "max-content"}}
                onChange={handleTableChange}
                onRow={(row) => ({
                    onClick: () => setSelected(row),
                    onDoubleClick: () => setRevisionId(row.Id),
                })}
                rowClassName={(row) =>
                    selected?.Id === row.Id ? "ant-table-row-selected" : ""
                }
                pagination={{
                    current: query.page,
                    pageSize: query.limit,
                    total: data?.meta.totalItems ?? 0,
                }}
            />
            <Modal
                centered
                open={open}
                title="Create BOM Revision"
                onCancel={() => setOpen(false)}
                onOk={() => void create()}
                confirmLoading={saving}
                destroyOnHidden
                afterOpenChange={(isOpen) => {
                    if (isOpen) form.resetFields();
                }}
            >
                <Form form={form} layout="vertical" preserve={false}>
                    <Form.Item
                        name="finishGoodId"
                        label="Finish Good"
                        rules={[{required: true}]}
                    >
                        <Select
                            showSearch={{
                                filterOption: false,
                                onSearch: (search) =>
                                    void dispatch(fetchFinishGood({search, limit: 50})),
                            }}
                            loading={finishGoods.loading}
                            options={finishGoods.data.map((f) => ({
                                value: f.Id,
                                label: `${f.PartNumber} - ${f.PartName}`,
                            }))}
                        />
                    </Form.Item>
                    <Form.Item
                        name="reason"
                        label="Change Reason"
                        rules={[{required: true, whitespace: true}]}
                    >
                        <Input.TextArea maxLength={1000}/>
                    </Form.Item>
                    <Form.Item name="importLegacy" valuePropName="checked">
                        <Checkbox>Import current BOM as an initial baseline draft</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
            <RevisionDetailsModal
                open={Boolean(revisionId)}
                revisionId={revisionId}
                onClose={() => setRevisionId(null)}
                onChanged={() => setRefresh((value) => value + 1)}
            />
            <FinishGoodLinkedModal
                open={finishGoodPartNumber !== null}
                partNumber={finishGoodPartNumber}
                onClose={() => setFinishGoodPartNumber(null)}
            />
        </Card>
    );
}
