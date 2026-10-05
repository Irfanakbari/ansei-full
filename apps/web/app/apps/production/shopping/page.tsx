/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, {useState, useEffect, useRef, useCallback} from "react";
import {
    Table,
    Card,
    Breadcrumb,
    Input,
    Button,
    Segmented,
    Space,
    Tag,
    Tooltip,
} from "antd";
import type {InputRef} from "antd";
import {
    ReloadOutlined,
    SearchOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import {useDispatch, useSelector} from "react-redux";
import {AppDispatch, RootState} from "@/store";
import {
    ShoppingEntity,
    fetchShopping,
    clearDetail,
    setShoppingQuery,
} from "@/store/features/production/shopping/shoppingSlice";
import DetailShoppingModal from "./_components/DetailShoppingModal";
import CreateShoppingModal from "./_components/CreateShoppingModal";
import {formatDateTime} from "@/lib/utils/dateTime";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import {useSingleRowSelection} from "@/hooks/useSingleRowSelection";

export default function ShoppingPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, query, pagination} = useSelector(
        (state: RootState) => state.shopping,
    );

    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [detailData, setDetailData] = useState<ShoppingEntity | null>(null);
    const [sortedInfo, setSortedInfo] = useState<any>({});

    const searchInput = useRef<InputRef>(null);
    const getShoppingKey = useCallback((record: ShoppingEntity) => record.Id, []);
    const {selectRecord, isSelected} = useSingleRowSelection(data, getShoppingKey);

    useEffect(() => {
        dispatch(fetchShopping(query));
    }, [dispatch, query]);

    const handleViewDetail = (record: ShoppingEntity) => {
        selectRecord(record);
        setDetailData(record);
        setIsDetailModalVisible(true);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalVisible(false);
        setDetailData(null);
        dispatch(clearDetail());
    };

    const handleTableChange = (
        tablePagination: any,
        filters: any,
        sorter: any,
    ) => {
        setSortedInfo(sorter);
        const search = Object.entries(filters)
            .filter(([key]) => key !== "Type")
            .flatMap(([, values]) => values ?? [])
            .find((value) => typeof value === "string") as string | undefined;
        const purpose = filters.Type?.[0]?.toString();
        dispatch(
            setShoppingQuery({
                page:
                    search !== query.search || purpose !== query.purpose
                        ? 1
                        : tablePagination.current,
                limit: tablePagination.pageSize,
                search,
                purpose,
            }),
        );
    };

    const getColumnSearchProps = (dataIndex: string) => ({
        filterDropdown: ({
                             setSelectedKeys,
                             selectedKeys,
                             confirm,
                             clearFilters,
                         }: any) => (
            <div style={{padding: 8}} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput as any}
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
        filteredValue: query.search ? [query.search] : null,
    });

    const columns = [
        {
            title: "Material",
            dataIndex: ["MaterialData", "PartNumber"],
            key: "MaterialData",
            render: (_: any, record: ShoppingEntity) => (
                <Space size={4}>
                    <GoldenArrowAction
                        tooltip="View shopping details"
                        ariaLabel={`View shopping details for ${record.MaterialData?.PartNumber || record.Id}`}
                        onClick={() => handleViewDetail(record)}
                    />
                    <Tooltip title={`${record.MaterialData?.PartNumber} - ${record.MaterialData?.PartName}`}>
                        <span>{record.MaterialData?.PartNumber}</span>
                    </Tooltip>
                </Space>
            ),
            ...getColumnSearchProps("MaterialData.PartNumber"),
        },
        {
            title: "PO Number",
            dataIndex: "ForecastId",
            key: "ForecastId",
            ellipsis: true,
            render: (val: string) => <code style={{fontSize: 11}}>{val}</code>,
            ...getColumnSearchProps("ForecastId"),
        },
        {
            title: "Qty Pick",
            dataIndex: "QtyPick",
            key: "QtyPick",
            align: "right" as const,
            render: (val: number) => <Tag color="green">{val}</Tag>,
            sorter: (a: ShoppingEntity, b: ShoppingEntity) => a.QtyPick - b.QtyPick,
            sortOrder: sortedInfo.columnKey === "QtyPick" ? sortedInfo.order : null,
        },
        {
            title: "Type",
            dataIndex: "Purpose",
            key: "Type",
            filters: [
                {text: "Regular", value: "STANDARD"},
                {text: "Non-production", value: "NON_PRODUCTION"},
            ],
            filterMultiple: false,
            filteredValue: query.purpose ? [query.purpose] : null,
            render: (val: string) => (
                <Tag color={val === "STANDARD" ? "blue" : "orange"}>
                    {val === "STANDARD" ? "REGULAR" : "NON-PRODUCTION"}
                </Tag>
            ),
        },
        {
            title: "Description",
            dataIndex: "Description",
            key: "Description",
            ellipsis: true,
            render: (val: string | null) => val || "-",
        },
        {
            title: "Created Date",
            dataIndex: "CreatedAt",
            key: "CreatedAt",
            render: formatDateTime,
        },
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb
                style={{marginBottom: 16}}
                items={[
                    {title: "Home"},
                    {title: "Production"},
                    {title: "Shopping"},
                ]}
            />
            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined/>}
                    onClick={() => dispatch(fetchShopping(query))}
                />
                <ButtonToolbar
                    title="Create"
                    icon={<PlusOutlined/>}
                    onClick={() => setIsCreateModalVisible(true)}
                />
                <div style={{marginLeft: "auto", display: "flex", alignItems: "center"}}>
                    <Segmented
                        size="small"
                        value={query.activeReleaseOnly !== false ? "ACTIVE" : "ALL"}
                        onChange={(val) =>
                            dispatch(
                                setShoppingQuery({
                                    page: 1,
                                    activeReleaseOnly: val === "ACTIVE",
                                }),
                            )
                        }
                        options={[
                            {label: "Active Release", value: "ACTIVE"},
                            {label: "All History", value: "ALL"},
                        ]}
                    />
                </div>
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
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} records`,
                }}
                rowKey="Id"
                onRow={(record) => ({
                    onClick: () => selectRecord(record),
                    onDoubleClick: () => handleViewDetail(record),
                })}
                rowClassName={(record) => isSelected(record) ? "ant-table-row-selected" : ""}
                scroll={{x: "max-content", y: "calc(100vh - 380px)"}}
                className="small-table"
                style={{fontSize: "11px"}}
            />

            {detailData && (
                <DetailShoppingModal
                    visible={isDetailModalVisible}
                    onClose={handleCloseDetailModal}
                    data={detailData}
                />
            )}

            <CreateShoppingModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => dispatch(fetchShopping(query))}
            />
        </Card>
    );
}
