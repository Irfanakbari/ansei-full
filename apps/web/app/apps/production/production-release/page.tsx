/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-06-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Button, Space, Tag, Tooltip, Progress } from 'antd';
import type { InputRef } from 'antd';
import { ReloadOutlined, EyeOutlined, SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, TagsOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { ProductionReleaseEntity, fetchProductionRelease, deleteProductionRelease, clearDetail } from '@/store/features/production/productionRelease/productionReleaseSlice';
import DetailProductionReleaseModal from './_components/DetailProductionReleaseModal';
import CreateProductionReleaseModal from './_components/CreateProductionReleaseModal';
import EditProductionReleaseModal from './_components/EditProductionReleaseModal';
import ManageForecastsModal from './_components/ManageForecastsModal';
import CancelProductionReleaseModal from './_components/CancelProductionReleaseModal';
import { formatDateTime } from '@/lib/utils/dateTime';

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'warning',
    IN_PROGRESS: 'processing',
    COMPLETED: 'success',
    CANCELLED: 'error',
};

export default function ProductionReleasePage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination } = useSelector((state: RootState) => state.productionRelease);

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isManageModalVisible, setIsManageModalVisible] = useState(false);
    const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
    const [detailData, setDetailData] = useState<ProductionReleaseEntity | null>(null);
    const [editData, setEditData] = useState<ProductionReleaseEntity | null>(null);
    const [sortedInfo, setSortedInfo] = useState<any>({});
    const [query, setQuery] = useState({ page: 1, limit: 50, search: undefined as string | undefined, status: undefined as string | undefined });

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchProductionRelease(query));
    }, [dispatch, query]);

    const selectedRecord = Array.isArray(data) ? data.find((item) => item.Id === selectedRowKeys[0]) : undefined;

    const handleViewDetail = () => {
        if (selectedRecord) {
            setDetailData(selectedRecord);
            setIsDetailModalVisible(true);
        }
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalVisible(false);
        setDetailData(null);
        dispatch(clearDetail());
    };

    const handleEdit = () => {
        if (selectedRecord) {
            setEditData(selectedRecord);
            setIsEditModalVisible(true);
        }
    };

    const handleCloseEditModal = () => {
        setIsEditModalVisible(false);
        setEditData(null);
    };

    const handleDelete = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Delete Production Release?',
                icon: <DeleteOutlined />,
                content: `Delete release ${selectedRecord.ReleaseNumber}?`,
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteProductionRelease(selectedRecord.Id));

                        if (deleteProductionRelease.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete production release');
                        }
                        message.success('Production release deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchProductionRelease(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete production release');
                    }
                },
            });
        }
    };

    const handleTableChange = (tablePagination: any, filters: any, sorter: any) => {
        setSortedInfo(sorter);
        const search = String(filters.ReleaseNumber?.[0] ?? '') || undefined;
        const status = String(filters.Status?.[0] ?? '') || undefined;
        setQuery({ page: search !== query.search || status !== query.status ? 1 : tablePagination.current ?? 1, limit: tablePagination.pageSize ?? 50, search, status });
    };

    const getColumnSearchProps = (dataIndex: string) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput as any}
                    placeholder={`Search ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 90 }}>
                        Search
                    </Button>
                    <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
    });

    const columns = [
        {
            title: 'Release Number',
            dataIndex: 'ReleaseNumber',
            key: 'ReleaseNumber',
            ellipsis: true,
            render: (val: string) => <Tooltip title={val}><code style={{ fontSize: 11 }}>{val}</code></Tooltip>,
             ...getColumnSearchProps('ReleaseNumber'),
             filteredValue: query.search ? [query.search] : null,
         },
        {
            title: 'Plan Date',
            dataIndex: 'PlanDate',
            key: 'PlanDate',
            render: formatDateTime,
            sorter: (a: ProductionReleaseEntity, b: ProductionReleaseEntity) => new Date(a.PlanDate).getTime() - new Date(b.PlanDate).getTime(),
            sortOrder: sortedInfo.columnKey === 'PlanDate' ? sortedInfo.order : null,
        },
        {
            title: 'Forecasts',
            dataIndex: 'Forecasts',
            key: 'Forecasts',
            align: 'center' as const,
            render: (val: any[]) => <Tag color="blue">{val?.length || 0}</Tag>,
        },
        {
            title: 'Status',
            dataIndex: 'Status',
            key: 'Status',
            filters: [
                { text: 'DRAFT', value: 'DRAFT' },
                { text: 'RELEASED', value: 'RELEASED' },
                { text: 'COMPLETED', value: 'COMPLETED' },
                { text: 'CANCELLED', value: 'CANCELLED' },
            ],
            filteredValue: query.status ? [query.status] : null,
            render: (_: any, record: ProductionReleaseEntity) => (
                <div>
                    <Tag color={STATUS_COLORS[record.Status] || 'default'} style={{ marginBottom: 4 }}>
                        {record.Status}
                    </Tag>
                    {/* Only show progress bar if status is RELEASED */}
                    {record.Status === 'RELEASED' && record.progressShopping && (
                        <Progress
                            percent={record.progressShopping.percentage}
                            size="small"
                            status={record.progressShopping.percentage === 100 ? 'success' : 'active'}
                        />
                    )}
                </div>
            ),
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Production' }, { title: 'Production Release' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => dispatch(fetchProductionRelease(query))} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
                <ButtonToolbar title="Detail" icon={<EyeOutlined />} onClick={handleViewDetail} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Edit" icon={<EditOutlined />} onClick={handleEdit} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Delete" icon={<DeleteOutlined />} onClick={handleDelete} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Manage Forecasts" icon={<TagsOutlined />} onClick={() => setIsManageModalVisible(true)} enable={selectedRecord?.Status === 'RELEASED'} />
                <ButtonToolbar title="Cancel Release" icon={<StopOutlined />} onClick={() => setIsCancelModalVisible(true)} enable={selectedRecord?.Status === 'RELEASED'} />
            </ToolbarWrapper>

            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
                    checkStrictly: true,
                    type: 'radio',
                }}
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={handleTableChange}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} records`,
                }}
                rowKey="Id"
                scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            {detailData && (
                <DetailProductionReleaseModal
                    visible={isDetailModalVisible}
                    onClose={handleCloseDetailModal}
                    data={detailData}
                />
            )}

            <CreateProductionReleaseModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => dispatch(fetchProductionRelease(query))}
            />

            {editData && (
                <EditProductionReleaseModal
                    visible={isEditModalVisible}
                    onClose={handleCloseEditModal}
                    data={editData}
                    onSuccess={() => dispatch(fetchProductionRelease(query))}
                />
            )}

            <ManageForecastsModal open={isManageModalVisible} release={selectedRecord ?? null} onClose={() => setIsManageModalVisible(false)} onSuccess={() => { setSelectedRowKeys([]); dispatch(fetchProductionRelease(query)); }} />
            <CancelProductionReleaseModal open={isCancelModalVisible} release={selectedRecord ?? null} onClose={() => setIsCancelModalVisible(false)} onSuccess={() => { setSelectedRowKeys([]); dispatch(fetchProductionRelease(query)); }} />

        </Card>
    );
}
