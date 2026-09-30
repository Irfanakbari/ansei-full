/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, {useCallback, useEffect, useState} from 'react';
import {Table, Card, Breadcrumb, Tag, App, Progress, Tooltip, Dropdown, Space} from 'antd';
import type {TableProps} from 'antd';
import {
    ReloadOutlined,
    PlusOutlined,
    PlayCircleOutlined,
    StopOutlined,
    FileExcelOutlined,
    CameraOutlined,
    DownOutlined,
    DownloadOutlined
} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {
    fetchInventoryCounting,
    startInventoryCounting,
    setFilters,
    downloadWorksheet,
    downloadSnapshot,
    InventoryCountingEntity,
    InventoryCountingQuery,
    fetchInventoryCountingPackageStatus,
    generateInventoryCountingPackage,
    downloadInventoryCountingPackage,
    sendInventoryCountingPackageEmail,
    InventoryCountingPackageStatus,
} from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';
import CreateInventoryCountingModal from './_components/CreateInventoryCountingModal';
import DetailInventoryCountingModal from './_components/DetailInventoryCountingModal';
import ReviewApprovalModal from './_components/ReviewApprovalModal';
import InventoryCountingPackageModal from './_components/InventoryCountingPackageModal';
import {formatDateTime} from '@/lib/utils/dateTime';
import GoldenArrowAction from '@/components/GoldenArrowAction';
import {useSingleRowSelection} from '@/hooks/useSingleRowSelection';
import {getApiErrorMessage} from '@/store/utils/apiService';

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
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination, filters} = useSelector((state: RootState) => state.inventoryCounting);
    const {user} = useSelector((state: RootState) => state.auth);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
    const [detailData, setDetailData] = useState<InventoryCountingEntity | null>(null);
    const [downloadingWs, setDownloadingWs] = useState(false);
    const [downloadingSnapshot, setDownloadingSnapshot] = useState(false);
    const [packageOpen, setPackageOpen] = useState(false);
    const [packageStatus, setPackageStatus] = useState<InventoryCountingPackageStatus | null>(null);
    const [packageLoading, setPackageLoading] = useState(false);
    const [packageSending, setPackageSending] = useState(false);

    const getInventoryCountingKey = useCallback((record: InventoryCountingEntity) => record.Id, []);
    const {
        selectedRecord,
        selectRecord,
        clearSelection,
        isSelected
    } = useSingleRowSelection(data, getInventoryCountingKey);
    const can = (permission: string) => Boolean(
        user?.RoleName === 'SUPER' ||
        user?.GlobalRoles?.includes('SUPER_ADMINISTRATOR') ||
        user?.Permission?.some((value) => value === 'SUPER' || value === '*' || value === permission)
    );
    const canRead = can('IPCS.INVENTORY_COUNTING_READ');
    const canUpdate = can('IPCS.INVENTORY_COUNTING_UPDATE');
    const canApprove = can('IPCS.INVENTORY_COUNTING_APPROVE');

    useEffect(() => {
        dispatch(fetchInventoryCounting(filters));
    }, [dispatch, filters]);

    const handleTableChange: TableProps<InventoryCountingEntity>['onChange'] = (pagination, tableFilters) => {
        const newFilters: InventoryCountingQuery = {
            ...filters,
            page: tableFilters.RecordNumber || tableFilters.Category || tableFilters.Status ? 1 : pagination.current,
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

    const handleStart = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Start Inventory Counting?',
                icon: <PlayCircleOutlined/>,
                content: `Start ${selectedRecord.RecordNumber}? Status will change to IN_PROGRESS.`,
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

    const refreshPackage = useCallback(async () => {
        if (!selectedRecord) return;
        setPackageLoading(true);
        try {
            setPackageStatus(await dispatch(fetchInventoryCountingPackageStatus(selectedRecord.Id)).unwrap());
        } catch (error: unknown) {
            message.error(error instanceof Error ? error.message : String(error));
        } finally {
            setPackageLoading(false);
        }
    }, [dispatch, message, selectedRecord]);

    useEffect(() => {
        if (!packageOpen || !selectedRecord) return;
        void refreshPackage();
        const intervalId = window.setInterval(() => void refreshPackage(), 5000);
        return () => window.clearInterval(intervalId);
    }, [packageOpen, refreshPackage, selectedRecord]);

    const openPackage = () => {
        setPackageOpen(true);
        void refreshPackage();
    };

    const handleGeneratePackage = async () => {
        if (!selectedRecord) return;
        setPackageLoading(true);
        try {
            await dispatch(generateInventoryCountingPackage(selectedRecord.Id)).unwrap();
            message.success('Document package generation queued');
            await refreshPackage();
        } catch (error: unknown) {
            message.error(error instanceof Error ? error.message : String(error));
        } finally {
            setPackageLoading(false);
        }
    };

    const handleDownloadPackage = async () => {
        if (!selectedRecord) return;
        try {
            await dispatch(downloadInventoryCountingPackage(selectedRecord.Id)).unwrap();
        } catch (error: unknown) {
            message.error(getApiErrorMessage(error, 'Unable to download the document package. Please try again or contact the administrator.'));
        }
    };

    const handleSendPackage = async (recipients: string[], subject?: string, emailMessage?: string) => {
        if (!selectedRecord) return;
        setPackageSending(true);
        try {
            await dispatch(sendInventoryCountingPackageEmail({id: selectedRecord.Id, recipients, subject, message: emailMessage})).unwrap();
            message.success('Document package email queued');
            await refreshPackage();
        } catch (error: unknown) {
            message.error(error instanceof Error ? error.message : String(error));
        } finally {
            setPackageSending(false);
        }
    };

    const handleOpenApproval = () => {
        if (selectedRecord) {
            setIsReviewModalVisible(true);
        }
    };

    const columns = [
        {
            title: 'Record Number',
            dataIndex: 'RecordNumber',
            key: 'RecordNumber',
            ellipsis: true,
            render: (val: string, record: InventoryCountingEntity) => (
                <Space size={4}>
                    <GoldenArrowAction
                        tooltip="View inventory counting details"
                        ariaLabel={`View inventory counting details for ${record.RecordNumber}`}
                        disabled={!canRead}
                        onClick={() => {
                            selectRecord(record);
                            setDetailData(record);
                            setIsDetailModalVisible(true);
                        }}
                    />
                    <Tooltip title={val || '-'}><code style={{fontSize: 11}}>{val || '-'}</code></Tooltip>
                </Space>
            ),
        },
        {
            title: 'Category',
            dataIndex: 'Category',
            key: 'Category',
            render: (val: string) => (
                <Tag color={CATEGORY_COLORS[val] || 'default'}>
                    {val ? val.replace('_', ' ') : '-'}
                </Tag>
            ),
            filters: [
                {text: 'MATERIAL', value: 'MATERIAL'},
                {text: 'FINISH_GOOD', value: 'FINISH_GOOD'},
            ],
            filteredValue: filters.category ? [filters.category] : null,
        },
        {
            title: 'Tolerance (%)',
            dataIndex: 'Tolerance',
            key: 'Tolerance',
            align: 'center' as const,
            render: (val: number | undefined) => `${val ?? 5}%`,
        },
        {
            title: 'Status',
            key: 'Status',
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
                            style={{marginTop: 4}}
                        />
                    )}
                </div>
            ),
            filters: [
                {text: 'DRAFT', value: 'DRAFT'},
                {text: 'IN_PROGRESS', value: 'IN_PROGRESS'},
                {text: 'COMPLETED', value: 'COMPLETED'},
                {text: 'CANCELLED', value: 'CANCELLED'},
            ],
            filteredValue: filters.status ? [filters.status] : null,
        },
        {
            title: 'Items',
            key: 'items',
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
            ellipsis: true,
            render: (val: string | null) => val || '-',
        },
        {
            title: 'Created Date',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            render: formatDateTime,
        },
        {
            title: 'Created By',
            dataIndex: 'CreatedBy',
            key: 'CreatedBy',
            render: (_: any, record: any) => record.CreatedByName || record.createdByName || '-',
        },
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb
                style={{marginBottom: 16}}
                items={[
                    {title: 'Home'},
                    {title: 'Warehouse'},
                    {title: 'Inventory Counting'},
                ]}
            />

            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined/>}
                    onClick={handleRefresh}
                />
                <ButtonToolbar
                    title="Create"
                    icon={<PlusOutlined/>}
                    onClick={() => setIsCreateModalVisible(true)}
                    enable={can('IPCS.INVENTORY_COUNTING_CREATE')}
                />
                <Dropdown
                    menu={{
                        items: [
                            {
                                key: 'start',
                                label: 'Start',
                                icon: <PlayCircleOutlined/>,
                                onClick: handleStart,
                                disabled: !(selectedRecord?.Status === 'DRAFT' && canUpdate),
                            },
                            {
                                key: 'approve',
                                label: 'Approve & Close',
                                icon: <StopOutlined/>,
                                onClick: handleOpenApproval,
                                disabled: !(selectedRecord?.Status === 'IN_PROGRESS' && canApprove),
                            },
                        ],
                    }}
                    trigger={['click', 'hover']}
                    disabled={!selectedRecord || (selectedRecord.Status === 'DRAFT' ? !canUpdate : selectedRecord.Status === 'IN_PROGRESS' ? !canApprove : true)}
                >
                    <span
                        className={`p-1 text-xs flex flex-row items-center justify-center gap-1 transition-colors ${!selectedRecord || (selectedRecord.Status === 'DRAFT' ? !canUpdate : selectedRecord.Status === 'IN_PROGRESS' ? !canApprove : true) ? "text-[#93A8B8] cursor-not-allowed" : "text-white hover:cursor-pointer hover:bg-[#3A4E61]"}`}>
                        <PlayCircleOutlined/>
                        <span>Update Status <DownOutlined style={{fontSize: '10px'}}/></span>
                    </span>
                </Dropdown>

                <Dropdown
                    menu={{
                        items: [
                            {
                                key: 'worksheet',
                                label: 'Worksheet',
                                icon: <FileExcelOutlined/>,
                                onClick: handleDownloadWorksheet,
                                disabled: !selectedRecord || !canRead,
                            },
                            {
                                key: 'snapshot',
                                label: 'Snapshot',
                                icon: <CameraOutlined/>,
                                onClick: handleDownloadSnapshot,
                                disabled: !selectedRecord || !canRead,
                            },
                            {
                                key: 'package',
                                label: 'Document Package',
                                icon: <DownloadOutlined/>,
                                onClick: openPackage,
                                disabled: !selectedRecord || selectedRecord.Category !== 'MATERIAL' || selectedRecord.Status === 'DRAFT' || !canRead,
                            },
                        ],
                    }}
                    trigger={['click', 'hover']}
                    disabled={!selectedRecord || !canRead || downloadingWs || downloadingSnapshot}
                >
                    <span
                        className={`p-1 text-xs flex flex-row items-center justify-center gap-1 transition-colors ${!selectedRecord || !canRead || downloadingWs || downloadingSnapshot ? "text-[#93A8B8] cursor-not-allowed" : "text-white hover:cursor-pointer hover:bg-[#3A4E61]"}`}>
                        {downloadingWs || downloadingSnapshot ? (
                            <ReloadOutlined spin/>
                        ) : (
                            <DownloadOutlined/>
                        )}
                        <span>Downloads <DownOutlined style={{fontSize: '10px'}}/></span>
                    </span>
                </Dropdown>
            </ToolbarWrapper>

            <Table
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
                onRow={(record) => ({
                    onClick: () => selectRecord(record),
                    onDoubleClick: () => {
                        selectRecord(record);
                        setDetailData(record);
                        setIsDetailModalVisible(true);
                    },
                })}
                rowClassName={(record) => isSelected(record) ? 'ant-table-row-selected' : ''}
                scroll={{x: 'max-content', y: 'calc(100vh - 380px)'}}
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
                    onDeleted={() => {
                        clearSelection();
                        setIsDetailModalVisible(false);
                        setDetailData(null);
                        void dispatch(fetchInventoryCounting(filters));
                    }}
                />
            )}

            <InventoryCountingPackageModal
                open={packageOpen}
                status={packageStatus}
                loading={packageLoading}
                sending={packageSending}
                onClose={() => setPackageOpen(false)}
                onRefresh={refreshPackage}
                onGenerate={handleGeneratePackage}
                onDownload={handleDownloadPackage}
                onSend={handleSendPackage}
            />

            <ReviewApprovalModal
                visible={isReviewModalVisible}
                onClose={() => setIsReviewModalVisible(false)}
                data={selectedRecord || null}
                onSuccess={() => {
                    clearSelection();
                    dispatch(fetchInventoryCounting(filters));
                }}
            />
        </Card>
    );
}
