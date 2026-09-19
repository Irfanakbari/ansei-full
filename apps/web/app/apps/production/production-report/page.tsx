/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import {useRouter} from "next/navigation";
import {usePhasePermission} from "@/components/traceability/usePhasePermission";
import React, {useCallback, useState, useEffect, useRef} from "react";
import {
    Table,
    Card,
    Breadcrumb,
    App,
    Input,
    Button,
    Space,
    Select,
    Tag,
    Tooltip,
} from "antd";
import type {InputRef} from "antd";
import {
    ReloadOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    PlusOutlined,
    WarningOutlined,
} from "@ant-design/icons";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import {useDispatch, useSelector} from "react-redux";
import {AppDispatch, RootState} from "@/store";
import {
    ProductionReportEntity,
    fetchProductionReport,
    validateProductionReport,
    unvalidateProductionReport,
    setFilters,
} from "@/store/features/production/productionReport/productionReportSlice";
import CreateProductionReportModal from "./_components/CreateProductionReportModal";
import DetailProductionReportModal from "./_components/DetailProductionReportModal";
import FinishGoodLinkedModal from "@/components/production/FinishGoodLinkedModal";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import {useSingleRowSelection} from "@/hooks/useSingleRowSelection";

const formatDate = (val: string | null | undefined) => {
    if (!val) return "-";
    return new Date(val).toLocaleDateString("id-ID");
};

export default function ProductionReportPage() {
    const {message, modal} = App.useApp();
    const {can} = usePhasePermission();
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination, filters} = useSelector(
        (state: RootState) => state.productionReport,
    );

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [detailReport, setDetailReport] = useState<ProductionReportEntity | null>(null);
    const [linkedFinishGood, setLinkedFinishGood] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<"validate" | "unvalidate" | null>(null);

    const searchInput = useRef<InputRef>(null);
    const getProductionReportKey = useCallback((record: ProductionReportEntity) => record.id, []);
    const {
        selectedRecord: selectedRow,
        selectRecord,
        clearSelection,
        isSelected
    } = useSingleRowSelection(data, getProductionReportKey);

    useEffect(() => {
        dispatch(fetchProductionReport(filters));
    }, [dispatch, filters]);

    const getColumnSearchProps = (dataIndex: string): any => ({
        filterDropdown: ({
                             setSelectedKeys,
                             selectedKeys,
                             confirm,
                             clearFilters,
                         }: any) => (
            <div style={{padding: 8}} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput}
                    placeholder={`Search ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) =>
                        setSelectedKeys(e.target.value ? [e.target.value] : [])
                    }
                    onPressEnter={() => confirm()}
                    style={{marginBottom: 8, display: "block"}}
                />
                <Space>
                    <Button
                        type="primary"
                        onClick={() => confirm()}
                        icon={<SearchOutlined/>}
                        size="small"
                        style={{width: 90}}
                    >
                        Search
                    </Button>
                    <Button
                        onClick={() => {
                            if (clearFilters) clearFilters();
                            confirm();
                        }}
                        size="small"
                        style={{width: 90}}
                    >
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{color: filtered ? "#1677ff" : undefined}}/>
        ),
        onFilter: (value: any, record: any) => {
            const fieldValue = dataIndex.includes(".")
                ? dataIndex.split(".").reduce((obj, key) => obj?.[key], record)
                : record[dataIndex];
            return fieldValue
                ?.toString()
                .toLowerCase()
                .includes((value as string).toLowerCase());
        },
    });

    const getValidatedFilterProps = () => ({
        filterDropdown: ({
                             setSelectedKeys,
                             selectedKeys,
                             confirm,
                             clearFilters,
                         }: any) => (
            <div style={{padding: 8}} onKeyDown={(e) => e.stopPropagation()}>
                <Select
                    placeholder="Select status"
                    value={selectedKeys[0]}
                    onChange={(val) => setSelectedKeys(val ? [val] : [])}
                    style={{width: "100%", marginBottom: 8}}
                    allowClear
                    options={[
                        {value: "validated", label: "Validated"},
                        {value: "pending", label: "Pending"},
                    ]}
                />
                <Space>
                    <Button
                        type="primary"
                        onClick={() => confirm()}
                        size="small"
                        style={{width: 80}}
                    >
                        OK
                    </Button>
                    <Button
                        onClick={() => {
                            if (clearFilters) clearFilters();
                            confirm();
                        }}
                        size="small"
                        style={{width: 80}}
                    >
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{color: filtered ? "#1677ff" : undefined}}/>
        ),
        onFilter: (value: any, record: any) => {
            if (value === "validated") return !!record.validatedAt;
            if (value === "pending") return !record.validatedAt;
            return true;
        },
    });

    const columns = [
        {
            title: "Date",
            dataIndex: "date",
            key: "date",
            render: (value: string, record: ProductionReportEntity) => (
                <Space size={4}>
                    <GoldenArrowAction
                        tooltip="View production report details"
                        ariaLabel={`View production report details for ${record.fgData?.PartNumber || record.finishGoodId}`}
                        disabled={!can("IPCS.PRODUCTION_REPORT_READ")}
                        onClick={() => {
                            selectRecord(record);
                            setDetailReport(record);
                        }}
                    />
                    <span>{formatDate(value)}</span>
                </Space>
            ),
            sorter: (a: ProductionReportEntity, b: ProductionReportEntity) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
        },
        {
            title: "Finish Good",
            dataIndex: "finishGoodId",
            key: "finishGoodId",
            ...getColumnSearchProps("fgData.PartNumber"),
            render: (_: any, record: ProductionReportEntity) => (
                <Space size={4}>
                    <GoldenArrowAction tooltip="View Finish Good details"
                                       ariaLabel={`View Finish Good ${record.fgData?.PartNumber || record.finishGoodId}`}
                                       onClick={() => setLinkedFinishGood(record.fgData?.PartNumber || record.finishGoodId)}/>
                    <Tooltip title={`${record.fgData?.PartNumber} - ${record.fgData?.PartName}`}><code
                        style={{fontSize: 10}}>{record.fgData?.PartNumber || record.finishGoodId}</code></Tooltip>
                </Space>
            ),
        },
        {
            title: "Man Power",
            dataIndex: "manPowerUid",
            key: "manPowerUid",
            ...getColumnSearchProps("manPowerData.Name"),
            render: (_: any, record: ProductionReportEntity) => (
                <span>{record.manPowerData?.Name || record.manPowerUid}</span>
            ),
        },
        {
            title: "Qty",
            dataIndex: "qty",
            key: "qty",
            align: "right" as const,
            render: (val: number) => <strong>{val}</strong>,
        },
        {
            title: "NG Qty",
            dataIndex: "ngQty",
            key: "ngQty",
            align: "right" as const,
            render: (val: number) =>
                val > 0 ? <span style={{color: "#ff4d4f"}}>{val}</span> : "-",
        },
        {
            title: "Validated",
            dataIndex: "validatedAt",
            key: "validatedAt",
            ...getValidatedFilterProps(),
            render: (val: string | null) =>
                val ? (
                    <Tag color="success">Validated</Tag>
                ) : (
                    <Tag color="warning">Pending</Tag>
                ),
        },
    ];

    const handleTableChange = (pagination: any) => {
        dispatch(
            setFilters({page: pagination.current, limit: pagination.pageSize}),
        );
    };

    const handleValidate = () => {
        if (selectedRow && !selectedRow.validatedAt) {
            modal.confirm({
                title: "Validate Production Report?",
                icon: <CheckCircleOutlined/>,
                content: `Validate report for ${selectedRow.fgData?.PartNumber} by ${selectedRow.manPowerData?.Name}?`,
                okText: "Validate",
                cancelText: "Cancel",
                centered: true,
                onOk: async () => {
                    try {
                        setActionLoading("validate");
                        const result = await dispatch(
                            validateProductionReport(selectedRow.id),
                        );

                        if (validateProductionReport.rejected.match(result)) {
                            throw new Error(
                                (result.payload as string) ||
                                "Failed to validate production report",
                            );
                        }
                        message.success("Production report validated");
                        clearSelection();
                        dispatch(
                            fetchProductionReport({
                                page: pagination.page,
                                limit: pagination.limit,
                            }),
                        );
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(
                            err?.message || String(error) || "Failed to validate",
                        );
                    } finally {
                        setActionLoading(null);
                    }
                },
            });
        }
    };

    const handleUnvalidate = () => {
        if (selectedRow && selectedRow.validatedAt) {
            modal.confirm({
                title: "Unvalidate Production Report?",
                icon: <CloseCircleOutlined/>,
                content: `Unvalidate report for ${selectedRow.fgData?.PartNumber}?`,
                okText: "Unvalidate",
                cancelText: "Cancel",
                centered: true,
                onOk: async () => {
                    try {
                        setActionLoading("unvalidate");
                        const result = await dispatch(
                            unvalidateProductionReport(selectedRow.id),
                        );

                        if (unvalidateProductionReport.rejected.match(result)) {
                            throw new Error(
                                (result.payload as string) ||
                                "Failed to unvalidate production report",
                            );
                        }
                        message.success("Production report unvalidated");
                        clearSelection();
                        dispatch(
                            fetchProductionReport({
                                page: pagination.page,
                                limit: pagination.limit,
                            }),
                        );
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(
                            err?.message || String(error) || "Failed to unvalidate",
                        );
                    } finally {
                        setActionLoading(null);
                    }
                },
            });
        }
    };

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb
                style={{marginBottom: 16}}
                items={[
                    {title: "Home"},
                    {title: "Production"},
                    {title: "Process"},
                    {title: "Production Report"},
                ]}
            />

            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined/>}
                    onClick={() =>
                        dispatch(
                            fetchProductionReport({
                                page: pagination.page,
                                limit: pagination.limit,
                            }),
                        )
                    }
                />
                <ButtonToolbar
                    title="Create"
                    enable={can("IPCS.PRODUCTION_REPORT_CREATE")}
                    icon={<PlusOutlined/>}
                    onClick={() => setIsCreateModalVisible(true)}
                />
                <ButtonToolbar
                    title="Validate"
                    icon={<CheckCircleOutlined/>}
                    onClick={handleValidate}
                    loading={actionLoading === "validate"}
                    enable={Boolean(selectedRow && !selectedRow.validatedAt && can("IPCS.PRODUCTION_REPORT_UPDATE"))}
                />
                <ButtonToolbar
                    title="Unvalidate"
                    icon={<CloseCircleOutlined/>}
                    onClick={handleUnvalidate}
                    loading={actionLoading === "unvalidate"}
                    enable={Boolean(selectedRow?.validatedAt && can("IPCS.PRODUCTION_REPORT_UPDATE"))}
                />
                <ButtonToolbar
                    title="Material NG"
                    icon={<WarningOutlined/>}
                    enable={can("IPCS.MATERIAL_NG_CREATE")}
                    onClick={() => router.push(
                        selectedRow?.forecastId
                            ? `/apps/production/material-ng?poId=${encodeURIComponent(selectedRow.forecastId)}&productionReportId=${selectedRow.id}`
                            : "/apps/production/material-ng"
                    )}
                />
            </ToolbarWrapper>

            <Table
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={handleTableChange}
                pagination={{
                    size: "small",
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ["20", "50", "100"],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                }}
                rowKey="id"
                onRow={(record) => ({onClick: () => selectRecord(record)})}
                rowClassName={(record) => isSelected(record) ? "ant-table-row-selected" : ""}
                scroll={{x: "max-content", y: "calc(100vh - 400px)"}}
                className="small-table"
                style={{fontSize: "11px"}}
            />

            <CreateProductionReportModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => {
                    dispatch(
                        fetchProductionReport({
                            page: pagination.page,
                            limit: pagination.limit,
                        }),
                    );
                }}
            />
            <DetailProductionReportModal
                report={detailReport}
                onClose={() => setDetailReport(null)}
                onDeleted={() => {
                    clearSelection();
                    setDetailReport(null);
                    void dispatch(fetchProductionReport(filters));
                }}
            />
            <FinishGoodLinkedModal open={linkedFinishGood !== null} partNumber={linkedFinishGood}
                                   onClose={() => setLinkedFinishGood(null)}/>
        </Card>
    );
}
