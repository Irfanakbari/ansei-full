/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useEffect, useState } from 'react';
import { Table, Card, Breadcrumb, Tag, App, Progress, Tooltip, Dropdown } from 'antd';
import type { TableProps } from 'antd';
import { ReloadOutlined, PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined, FileExcelOutlined, CameraOutlined, DownOutlined, DownloadOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    fetchInventoryCounting,
    deleteInventoryCounting,
    startInventoryCounting,
    setFilters,
    downloadWorksheet,
    downloadSnapshot,
    InventoryCountingEntity,
    InventoryCountingQuery,
} from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';
import CreateInventoryCountingModal from './_components/CreateInventoryCountingModal';
import DetailInventoryCountingModal from './_components/DetailInventoryCountingModal';
import ReviewApprovalModal from './_components/ReviewApprovalModal';
import { formatDateTime } from '@/lib/utils/dateTime';

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'default',
    IN_PROGRESS: 'processing',
    COMPLETED: 'success',
    CANCELLED: 'error',
};

const CATEGORY_COLORS: Record<string, string> = {
    MATERIAL: 'blue',
    FINISH_GOOD: 'purple',
};

export default function InventoryCountingPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination, filters } = useSelector((state: RootState) => state.inventoryCounting);
    const { user } = useSelector((state: RootState) => state.auth);

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
    const [detailData, setDetailData] = useState<InventoryCountingEntity | null>(null);
    const [downloadingWs, setDownloadingWs] = useState(false);
    const [downloadingSnapshot, setDownloadingSnapshot] = useState(false);

    const canApprove = Boolean(
        user?.RoleName === 'SUPER' ||
        user?.Permission?.includes('SUPER') ||
        user?.Permission?.includes('*') ||
        user?.Permission?.includes('IPCS.INVENTORY_COUNTING_APPROVE')
    );

    useEffect(() => {
        dispatch(fetchInventoryCounting(filters));
    }, [dispatch, filters]);

    const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);

    const handleTableChange: TableProps<InventoryCountingEntity>['onChange'] = (pagination, tableFilters) => {
        const newFilters: InventoryCountingQuery = {
            ...filters,
            page: tableFilters.OpnameNumber || tableFilters.Category || tableFilters.Status ? 1 : pagination.current,
            limit: pagination.pageSize,
            createdBy: filters.createdBy,
            category: String(tableFilters.Category?.[0] ?? ''),
            status: String(tableFilters.Status?.[0] ?? ''),
        };
        dispatch(setFilters(newFilters));
    };

    const handleRefresh = () => {
        dispatch(fetchInventoryCounting(filters));
    };

    const handleDownloadWorksheet = async () => {
        if (!selectedRecord) {
            message.warning('Please select inventory counting first');
            return;
        }

        try {
            setDownloadingWs(true);
            const resultAction = await dispatch(downloadWorksheet(selectedRecord.Id));
            if (downloadWorksheet.fulfilled.match(resultAction)) {
                message.success('Worksheet downloaded successfully');
            } else {
                message.error(resultAction.payload as string || 'Failed to download worksheet');
            }
        } catch (error: any) {
            message.error(error?.message || 'Failed to download worksheet');
        } finally {
            setDownloadingWs(false);
        }
    };

    const handleDownloadSnapshot = async () => {
        if (!selectedRecord) {
            message.warning('Please select inventory counting first');
            return;
        }

        try {
            setDownloadingSnapshot(true);
            const resultAction = await dispatch(downloadSnapshot(selectedRecord.Id));
            if (downloadSnapshot.fulfilled.match(resultAction)) {
                message.success('Snapshot downloaded successfully');
            } else {
                message.error(resultAction.payload as string || 'Failed to download snapshot');
            }
        } catch (error: any) {
            message.error(error?.message || 'Failed to download snapshot');
        } finally {
            setDownloadingSnapshot(false);
        }
    };

    const handleViewDetail = () => {
        if (selectedRecord) {
            // Langsung set detailData dari selectedRecord (sudah ada details dari list)
            setDetailData(selectedRecord);
            setIsDetailModalVisible(true);
        }
    };

    const handleDelete = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Delete Inventory Counting?',
                icon: <DeleteOutlined />,
                content: `Delete ${selectedRecord.OpnameNumber}? Can only be deleted when status is DRAFT.`,
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteInventoryCounting(selectedRecord.Id));
                        if (deleteInventoryCounting.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete inventory counting');
                        }
                        message.success('Inventory counting deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchInventoryCounting(filters));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete inventory counting');
                    }
                },
            });
        }
    };

    const handleStart = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Start Inventory Counting?',
                icon: <PlayCircleOutlined />,
                content: `Start ${selectedRecord.OpnameNumber}? Status will change to IN_PROGRESS.`,
                okText: 'Start',
                okType: 'primary',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(startInventoryCounting(selectedRecord.Id));
                        if (startInventoryCounting.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to start inventory counting');
                        }
                        message.success('Inventory counting started');
                        dispatch(fetchInventoryCounting(filters));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to start inventory counting');
                    }
                },
            });
        }
    };

    const handleOpenApproval = () => {
        if (selectedRecord) {
            setIsReviewModalVisible(true);
        }
    };

    const columns = [
        {
            title: 'Opname Number',
            dataIndex: 'OpnameNumber',
            key: 'OpnameNumber',
            width: 180,
            ellipsis: true,
            render: (val: string) => <Tooltip title={val || '-'}><code style={{ fontSize: 11 }}>{val || '-'}</code></Tooltip>,
        },
        {
            title: 'Category',
            dataIndex: 'Category',
            key: 'Category',
            width: 120,
            render: (val: string) => (
                <Tag color={CATEGORY_COLORS[val] || 'default'}>
                    {val ? val.replace('_', ' ') : '-'}
                </Tag>
            ),
            filters: [
                { text: 'MATERIAL', value: 'MATERIAL' },
                { text: 'FINISH_GOOD', value: 'FINISH_GOOD' },
            ],
            filteredValue: filters.category ? [filters.category] : null,
        },
        {
            title: 'Tolerance (%)',
            dataIndex: 'Tolerance',
            key: 'Tolerance',
            width: 120,
            align: 'center' as const,
            render: (val: number | undefined) => `${val ?? 5}%`,
        },
        {
            title: 'Status',
            key: 'Status',
            width: 180,
            render: (_: any, record: InventoryCountingEntity) => (
                <div>
                    <Tag color={STATUS_COLORS[record.Status] || 'default'}>
                        {record.Status}
                    </Tag>
                    {record.Status === 'IN_PROGRESS' && record.TotalItems && (
                        <Progress
                            percent={record.TotalItems > 0 ? Math.round(((record.CompletedItems || 0) / record.TotalItems) * 100) : 0}
                            size="small"
                            status="active"
                            style={{ marginTop: 4 }}
                        />
                    )}
                </div>
            ),
            filters: [
                { text: 'DRAFT', value: 'DRAFT' },
                { text: 'IN_PROGRESS', value: 'IN_PROGRESS' },
                { text: 'COMPLETED', value: 'COMPLETED' },
                { text: 'CANCELLED', value: 'CANCELLED' },
            ],
            filteredValue: filters.status ? [filters.status] : null,
        },
        {
            title: 'Items',
            key: 'items',
            width: 100,
            align: 'center' as const,
            render: (_: any, record: InventoryCountingEntity) => (
                <span>
                    {record.CompletedItems || 0} / {record.TotalItems || 0}
                </span>
            ),
        },
        {
            title: 'Notes',
            dataIndex: 'Notes',
            key: 'Notes',
            width: 150,
            ellipsis: true,
            render: (val: string | null) => val || '-',
        },
        {
            title: 'Created At',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            width: 150,
            render: formatDateTime,
        },
        {
            title: 'Created By',
            dataIndex: 'CreatedBy',
            key: 'CreatedBy',
            width: 140,
            render: (_: any, record: any) => record.CreatedByName || record.createdByName || '-',
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb
                style={{ marginBottom: 16 }}
                items={[
                    { title: 'Home' },
                    { title: 'Warehouse' },
                    { title: 'Inventory Counting' },
                ]}
            />

            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined />}
                    onClick={handleRefresh}
                />
                <ButtonToolbar
                    title="Create"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                />
                <ButtonToolbar
                    title="Detail"
                    icon={<EyeOutlined />}
                    onClick={handleViewDetail}
                    enable={selectedRowKeys.length === 1}
                />
                
                <Dropdown
                    menu={{
                        items: [
                            {
                                key: 'start',
                                label: 'Start',
                                icon: <PlayCircleOutlined />,
                                onClick: handleStart,
                                disabled: !(selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'),
                            },
                            {
                                key: 'approve',
                                label: 'Approve & Close',
                                icon: <StopOutlined />,
                                onClick: handleOpenApproval,
                                disabled: !(selectedRowKeys.length === 1 && selectedRecord?.Status === 'IN_PROGRESS' && canApprove),
                            },
                        ],
                    }}
                    trigger={['click', 'hover']}
                    disabled={selectedRowKeys.length !== 1 || (selectedRecord?.Status !== 'DRAFT' && selectedRecord?.Status !== 'IN_PROGRESS')}
                >
                    <span className={`p-1 text-xs flex flex-row items-center justify-center gap-1 transition-colors ${selectedRowKeys.length !== 1 || (selectedRecord?.Status !== 'DRAFT' && selectedRecord?.Status !== 'IN_PROGRESS') ? "text-[#93A8B8] cursor-not-allowed" : "text-white hover:cursor-pointer hover:bg-[#3A4E61]"}`}>
                        <PlayCircleOutlined />
                        <span>Update Status <DownOutlined style={{ fontSize: '10px' }}/></span>
                    </span>
                </Dropdown>

                <Dropdown
                    menu={{
                        items: [
                            {
                                key: 'worksheet',
                                label: 'Worksheet',
                                icon: <FileExcelOutlined />,
                                onClick: handleDownloadWorksheet,
                                disabled: selectedRowKeys.length !== 1,
                            },
                            {
                                key: 'snapshot',
                                label: 'Snapshot',
                                icon: <CameraOutlined />,
                                onClick: handleDownloadSnapshot,
                                disabled: selectedRowKeys.length !== 1,
                            },
                        ],
                    }}
                    trigger={['click', 'hover']}
                    disabled={selectedRowKeys.length !== 1 || downloadingWs || downloadingSnapshot}
                >
                    <span className={`p-1 text-xs flex flex-row items-center justify-center gap-1 transition-colors ${selectedRowKeys.length !== 1 || downloadingWs || downloadingSnapshot ? "text-[#93A8B8] cursor-not-allowed" : "text-white hover:cursor-pointer hover:bg-[#3A4E61]"}`}>
                        {downloadingWs || downloadingSnapshot ? (
                            <ReloadOutlined spin />
                        ) : (
                            <DownloadOutlined />
                        )}
                        <span>Downloads <DownOutlined style={{ fontSize: '10px' }}/></span>
                    </span>
                </Dropdown>

                <ButtonToolbar
                    title="Delete"
                    icon={<DeleteOutlined />}
                    onClick={handleDelete}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'}
                />
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
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ['20', '50', '100'],
                    showTotal: (total: number, range: number[]) => `${range[0]}-${range[1]} of ${total}`,
                }}
                rowKey="Id"
                scroll={{ x: 1000, y: 'calc(100vh - 380px)' }}
                className="small-table"
            />

            <CreateInventoryCountingModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => {
                    dispatch(fetchInventoryCounting(filters));
                }}
            />

            {detailData && (
                <DetailInventoryCountingModal
                    visible={isDetailModalVisible}
                    onClose={() => {
                        setIsDetailModalVisible(false);
                        setDetailData(null);
                    }}
                    data={detailData}
                    onRefresh={() => dispatch(fetchInventoryCounting(filters))}
                />
            )}

            <ReviewApprovalModal
                visible={isReviewModalVisible}
                onClose={() => setIsReviewModalVisible(false)}
                data={selectedRecord || null}
                onSuccess={() => {
                    setSelectedRowKeys([]);
                    dispatch(fetchInventoryCounting(filters));
                }}
            />
        </Card>
    );
}