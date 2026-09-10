/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Table, Card, Breadcrumb, Input, Button, Space, Tag, App, Progress, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { ReloadOutlined, SearchOutlined, PlusOutlined, EyeOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined, FileExcelOutlined, CameraOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    fetchInventoryCounting,
    deleteInventoryCounting,
    startInventoryCounting,
    closeInventoryCounting,
    downloadWorksheet,
    downloadSnapshot,
    InventoryCountingEntity,
    InventoryCountingQuery,
} from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';
import CreateInventoryCountingModal from './_components/CreateInventoryCountingModal';
import DetailInventoryCountingModal from './_components/DetailInventoryCountingModal';
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

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [detailData, setDetailData] = useState<InventoryCountingEntity | null>(null);
    const [downloadingWs, setDownloadingWs] = useState(false);
    const [downloadingSnapshot, setDownloadingSnapshot] = useState(false);
    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchInventoryCounting(filters));
    }, [dispatch, filters]);

    const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);

    const handleTableChange = (pagination: any, filters: any) => {
        const newFilters: InventoryCountingQuery = {
            ...filters,
            page: pagination.current,
            limit: pagination.pageSize,
        };
        dispatch(fetchInventoryCounting(newFilters));
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

    const handleClose = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Close Inventory Counting?',
                icon: <StopOutlined />,
                content: `Close ${selectedRecord.OpnameNumber}? All stock will be adjusted according to counting results.`,
                okText: 'Close',
                okType: 'primary',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(closeInventoryCounting({ id: selectedRecord.Id }));
                        if (closeInventoryCounting.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to close inventory counting');
                        }
                        message.success('Inventory counting closed');
                        dispatch(fetchInventoryCounting(filters));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to close inventory counting');
                    }
                },
            });
        }
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
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 80 }}>
                        Search
                    </Button>
                    <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 80 }}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        onFilter: (value: any, record: any) => {
            return record[dataIndex]?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    const columns = [
        {
            title: 'Opname Number',
            dataIndex: 'OpnameNumber',
            key: 'OpnameNumber',
            width: 180,
            ellipsis: true,
            render: (val: string) => <Tooltip title={val || '-'}><code style={{ fontSize: 11 }}>{val || '-'}</code></Tooltip>,
            ...getColumnSearchProps('OpnameNumber'),
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
            onFilter: (value: any, record: any) => record.Category === value,
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
            onFilter: (value: any, record: any) => record.Status === value,
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
            width: 100,
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
                <ButtonToolbar
                    title="Start"
                    icon={<PlayCircleOutlined />}
                    onClick={handleStart}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'}
                />
                <ButtonToolbar
                    title="Close"
                    icon={<StopOutlined />}
                    onClick={handleClose}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'IN_PROGRESS'}
                />
                <ButtonToolbar
                    title="Delete"
                    icon={<DeleteOutlined />}
                    onClick={handleDelete}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'}
                />
                <ButtonToolbar
                    title="Worksheet"
                    icon={<FileExcelOutlined />}
                    onClick={handleDownloadWorksheet}
                    loading={downloadingWs}
                    enable={selectedRowKeys.length === 1}
                />
                <ButtonToolbar
                    title="Snapshot"
                    icon={<CameraOutlined />}
                    onClick={handleDownloadSnapshot}
                    loading={downloadingSnapshot}
                    enable={selectedRowKeys.length === 1}
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
                scroll={{ x: 1000, y: 'calc(100vh - 360px)' }}
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
        </Card>
    );
}