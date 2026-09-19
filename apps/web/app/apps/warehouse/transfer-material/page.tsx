/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Button, Space, Tag, Tooltip } from 'antd';
import type { InputRef, TableProps } from 'antd';
import { ReloadOutlined, EyeOutlined, SearchOutlined, PlusOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined, FilePdfOutlined, MailOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    fetchTransferMaterial,
    deleteTransferMaterial,
    shipTransferMaterial,
    receiveTransferMaterial,
    cancelTransferMaterial,
    TransferMaterialEntity,
} from '@/store/features/warehouse/transferMaterial/transferMaterialSlice';
import DetailTransferMaterialModal from './_components/DetailTransferMaterialModal';
import CreateTransferMaterialModal from './_components/CreateTransferMaterialModal';
import DeliveryNotePreviewModal from './_components/DeliveryNotePreviewModal';
import EmailDNModal from './_components/EmailDNModal';
import { formatDateTime } from '@/lib/utils/dateTime';

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'default',
    SHIPPED: 'processing',
    RECEIVED: 'success',
    CANCELLED: 'error',
};

export default function TransferMaterialPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination } = useSelector((state: RootState) => state.transferMaterial);

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
    const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
    const [detailData, setDetailData] = useState<TransferMaterialEntity | null>(null);
    const [sortedInfo, setSortedInfo] = useState<any>({});
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [query, setQuery] = useState({ page: 1, limit: 50, status: undefined as string | undefined, search: undefined as string | undefined });

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchTransferMaterial(query));
    }, [dispatch, query]);

    const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);

    const handleViewDetail = () => {
        if (selectedRecord) {
            setDetailData(selectedRecord);
            setIsDetailModalVisible(true);
        }
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalVisible(false);
        setDetailData(null);
    };

    const handleShip = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Ship Transfer Material?',
                icon: <SendOutlined />,
                content: `Ship delivery note ${selectedRecord.DeliveryNoteNum}? Stock will be deducted from warehouse.`,
                okText: 'Ship',
                okType: 'primary',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        setActionLoading('ship');
                        const result = await dispatch(shipTransferMaterial(selectedRecord.Id));

                        if (shipTransferMaterial.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to ship transfer material');
                        }
                        message.success('Transfer material shipped successfully');
                        dispatch(fetchTransferMaterial(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || 'Failed to ship transfer material');
                    } finally {
                        setActionLoading(null);
                    }
                },
            });
        }
    };

    const handleReceive = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Confirm Receipt?',
                icon: <CheckCircleOutlined />,
                content: `Confirm receipt of delivery note ${selectedRecord.DeliveryNoteNum}?`,
                okText: 'Receive',
                okType: 'primary',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        setActionLoading('receive');
                        const result = await dispatch(receiveTransferMaterial(selectedRecord.Id));

                        if (receiveTransferMaterial.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to receive transfer material');
                        }
                        message.success('Transfer material received successfully');
                        dispatch(fetchTransferMaterial(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || 'Failed to receive transfer material');
                    } finally {
                        setActionLoading(null);
                    }
                },
            });
        }
    };

    const handleCancel = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Cancel Transfer Material?',
                icon: <CloseCircleOutlined />,
                content: `Cancel delivery note ${selectedRecord.DeliveryNoteNum}?`,
                okText: 'Cancel',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        setActionLoading('cancel');
                        const result = await dispatch(cancelTransferMaterial(selectedRecord.Id));

                        if (cancelTransferMaterial.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to cancel transfer material');
                        }
                        message.success('Transfer material cancelled');
                        dispatch(fetchTransferMaterial(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || 'Failed to cancel transfer material');
                    } finally {
                        setActionLoading(null);
                    }
                },
            });
        }
    };

    const handleDelete = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Delete Transfer Material?',
                icon: <DeleteOutlined />,
                content: `Delete delivery note ${selectedRecord.DeliveryNoteNum}? Can only be deleted when status is DRAFT.`,
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        setActionLoading('delete');
                        const result = await dispatch(deleteTransferMaterial(selectedRecord.Id));

                        if (deleteTransferMaterial.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete transfer material');
                        }
                        message.success('Transfer material deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchTransferMaterial(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || 'Failed to delete transfer material');
                    } finally {
                        setActionLoading(null);
                    }
                },
            });
        }
    };

    const handleDownloadDN = () => {
        if (!selectedRecord) {
            message.warning('Please select delivery note first');
            return;
        }
        setIsPreviewModalVisible(true);
    };

    const handleEmailDN = () => {
        if (!selectedRecord) {
            message.warning('Please select delivery note first');
            return;
        }
        setIsEmailModalVisible(true);
    };

    const handleTableChange: TableProps<TransferMaterialEntity>['onChange'] = (pagination, filters, sorter) => {
        setSortedInfo(sorter);
        const search = String(filters.DeliveryNoteNum?.[0] ?? filters.Destination?.[0] ?? filters.CreatedBy?.[0] ?? '') || undefined;
        setQuery({ page: search !== query.search || filters.Status ? 1 : pagination.current ?? 1, limit: pagination.pageSize ?? 50, status: String(filters.Status?.[0] ?? '') || undefined, search });
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
        filteredValue: query.search ? [query.search] : null,
    });

    const columns = [
        {
            title: 'Delivery Note Num',
            dataIndex: 'DeliveryNoteNum',
            key: 'DeliveryNoteNum',
            ellipsis: true,
            render: (val: string) => <Tooltip title={val}><code style={{ fontSize: 11 }}>{val}</code></Tooltip>,
            ...getColumnSearchProps('DeliveryNoteNum'),
        },
        {
            title: 'Destination',
            dataIndex: 'Destination',
            key: 'Destination',
            ellipsis: true,
            ...getColumnSearchProps('Destination'),
        },
        {
            title: 'Status',
            dataIndex: 'Status',
            key: 'Status',
            render: (val: string) => <Tag color={STATUS_COLORS[val] || 'default'}>{val}</Tag>,
            filters: [
                { text: 'DRAFT', value: 'DRAFT' },
                { text: 'SHIPPED', value: 'SHIPPED' },
                { text: 'RECEIVED', value: 'RECEIVED' },
                { text: 'CANCELLED', value: 'CANCELLED' },
            ],
            filteredValue: query.status ? [query.status] : null,
        },
        {
            title: 'Items',
            key: 'Items',
            align: 'center' as const,
            render: (_: any, record: TransferMaterialEntity) => (
                <Tag color="blue">{record.Details?.length || 0}</Tag>
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
            title: 'Shipped At',
            dataIndex: 'ShippedAt',
            key: 'ShippedAt',
            render: (val: string | null) => val ? formatDateTime(val) : '-',
        },
        {
            title: 'Received At',
            dataIndex: 'ReceivedAt',
            key: 'ReceivedAt',
            render: (val: string | null) => val ? formatDateTime(val) : '-',
        },
        {
            title: 'Created By',
            dataIndex: 'CreatedBy',
            key: 'CreatedBy',
            render: (_: any, record: any) => record.CreatedByName || record.createdByName || '-',
            ...getColumnSearchProps('CreatedBy'),
        },
        {
            title: 'Created At',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            render: formatDateTime,
            sorter: (a: any, b: any) => new Date(a.CreatedAt).getTime() - new Date(b.CreatedAt).getTime(),
            sortOrder: sortedInfo.columnKey === 'CreatedAt' ? sortedInfo.order : null,
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Warehouse' }, { title: 'Transfer Material' }]} />

            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined />}
                    onClick={() => dispatch(fetchTransferMaterial(query))}
                />
                <ButtonToolbar
                    title="Create"
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                />
                <ButtonToolbar
                    title="Delete"
                    icon={<DeleteOutlined />}
                    onClick={handleDelete}
                    loading={actionLoading === 'delete'}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'}
                />
                <ButtonToolbar
                    title="Detail"
                    icon={<EyeOutlined />}
                    onClick={handleViewDetail}
                    enable={selectedRowKeys.length === 1}
                />
                <ButtonToolbar
                    title="Ship"
                    icon={<SendOutlined />}
                    onClick={handleShip}
                    loading={actionLoading === 'ship'}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'}
                />
                <ButtonToolbar
                    title="Receive"
                    icon={<CheckCircleOutlined />}
                    onClick={handleReceive}
                    loading={actionLoading === 'receive'}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'SHIPPED'}
                />
                <ButtonToolbar
                    title="Cancel"
                    icon={<CloseCircleOutlined />}
                    onClick={handleCancel}
                    loading={actionLoading === 'cancel'}
                    enable={selectedRowKeys.length === 1 && selectedRecord?.Status === 'DRAFT'}
                />
                <ButtonToolbar
                    title="Delivery Note"
                    icon={<FilePdfOutlined />}
                    onClick={handleDownloadDN}
                    enable={selectedRowKeys.length === 1 && (selectedRecord?.Status === 'SHIPPED' || selectedRecord?.Status === 'RECEIVED')}
                />
                <ButtonToolbar
                    title="Email DN"
                    icon={<MailOutlined />}
                    onClick={handleEmailDN}
                    enable={selectedRowKeys.length === 1 && (selectedRecord?.Status === 'SHIPPED' || selectedRecord?.Status === 'RECEIVED')}
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
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ['20', '50', '100'],
                    showTotal: (total: number, range: number[]) => `${range[0]}-${range[1]} of ${total}`,
                }}
                rowKey="Id"
                scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
                className="small-table"
            />

            {detailData && (
                <DetailTransferMaterialModal
                    visible={isDetailModalVisible}
                    onClose={handleCloseDetailModal}
                    data={detailData}
                    onRefresh={() => dispatch(fetchTransferMaterial(query))}
                />
            )}

            <CreateTransferMaterialModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => {
                    dispatch(fetchTransferMaterial(query));
                }}
            />

            {selectedRecord && (
                <DeliveryNotePreviewModal
                    visible={isPreviewModalVisible}
                    onClose={() => setIsPreviewModalVisible(false)}
                    deliveryNoteId={selectedRecord.Id}
                    deliveryNoteNum={selectedRecord.DeliveryNoteNum}
                />
            )}

            {selectedRecord && (
                <EmailDNModal
                    visible={isEmailModalVisible}
                    onClose={() => setIsEmailModalVisible(false)}
                    deliveryNoteId={selectedRecord.Id}
                    deliveryNoteNum={selectedRecord.DeliveryNoteNum}
                />
            )}
        </Card>
    );
}
