/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Button, Space, Tag, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { ReloadOutlined, EyeOutlined, SearchOutlined, PlusOutlined, CheckOutlined, CheckCircleOutlined, DeleteOutlined, PaperClipOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { IncomingEntity, fetchIncoming, deleteIncoming, receiveIncoming, clearDetail } from '@/store/features/warehouse/incoming/incomingSlice';
import DetailIncomingModal from './_components/DetailIncomingModal';
import CreateIncomingModal from './_components/CreateIncomingModal';
import UploadAttachmentModal from './_components/UploadAttachmentModal';
import CheckingIncomingModal from './_components/CheckingIncomingModal';
import { formatDateTime } from '@/lib/utils/dateTime';

export default function IncomingPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading } = useSelector((state: RootState) => state.incoming);

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [isCheckingModalVisible, setIsCheckingModalVisible] = useState(false);
    const [detailData, setDetailData] = useState<IncomingEntity | null>(null);
    const [sortedInfo, setSortedInfo] = useState<any>({});

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchIncoming());
    }, [dispatch]);

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
        dispatch(clearDetail());
    };

    const handleReceive = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Receive Incoming?',
                icon: <CheckOutlined />,
                content: `Receive incoming ${selectedRecord.Id} from ${selectedRecord.SupplierData?.Name}?`,
                okText: 'Receive',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(receiveIncoming(selectedRecord.Id));

                        if (receiveIncoming.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to receive incoming');
                        }
                        message.success('Incoming received successfully');
                        dispatch(fetchIncoming());
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to receive incoming');
                    }
                },
            });
        }
    };

    const handleDelete = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Delete Incoming?',
                icon: <DeleteOutlined />,
                content: `Delete incoming ${selectedRecord.Id}?`,
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteIncoming(selectedRecord.Id as string));

                        if (deleteIncoming.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete incoming');
                        }
                        message.success('Incoming deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchIncoming());
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete incoming');
                    }
                },
            });
        }
    };

    const handleUploadAttachment = () => {
        if (selectedRecord) {
            setIsUploadModalVisible(true);
        }
    };

    const handleCloseUploadModal = () => {
        setIsUploadModalVisible(false);
    };

    const handleUploadSuccess = () => {
        dispatch(fetchIncoming());
    };

    const handleChecking = () => {
        if (selectedRecord) {
            setIsCheckingModalVisible(true);
        }
    };

    const handleCloseCheckingModal = () => {
        setIsCheckingModalVisible(false);
    };

    const handleCheckingSuccess = () => {
        dispatch(fetchIncoming());
    };

    const handleTableChange = (pagination: any, filters: any, sorter: any) => {
        setSortedInfo(sorter);
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
        onFilter: (value: any, record: any) => {
            const fieldValue = dataIndex.includes('.')
                ? dataIndex.split('.').reduce((obj, key) => obj?.[key], record)
                : record[dataIndex];
            return fieldValue?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    const columns = [
        {
            title: 'ID',
            dataIndex: 'Id',
            key: 'Id',
            width: 180,
            ellipsis: true,
            render: (val: string) => <Tooltip title={val}><code style={{ fontSize: 11 }}>{val}</code></Tooltip>,
            ...getColumnSearchProps('Id'),
        },
        {
            title: 'PO ID',
            dataIndex: 'PoId',
            key: 'PoId',
            width: 150,
            ellipsis: true,
            ...getColumnSearchProps('PoId'),
        },
        {
            title: 'Supplier',
            dataIndex: ['SupplierData', 'Name'],
            key: 'SupplierName',
            width: 200,
            ...getColumnSearchProps('SupplierData.Name'),
        },
        {
            title: 'Received By',
            dataIndex: 'ReceivedBy',
            key: 'ReceivedBy',
            width: 120,
            ...getColumnSearchProps('ReceivedBy'),
        },
        {
            title: 'Materials',
            dataIndex: 'IncomingMaterial',
            key: 'Materials',
            width: 80,
            align: 'center' as const,
            render: (val: any[]) => <Tag color="blue">{val?.length || 0}</Tag>,
        },
        {
            title: 'Closed',
            dataIndex: 'Closed',
            key: 'Closed',
            width: 80,
            align: 'center' as const,
            render: (val: boolean) => <Tag color={val ? 'green' : 'red'}>{val ? 'Yes' : 'No'}</Tag>,
        },
        {
            title: 'Approved At',
            dataIndex: 'ApprovedAt',
            key: 'ApprovedAt',
            width: 150,
            render: (val: string | null) => val ? formatDateTime(val) : '-',
        },
        {
            title: 'Submitted At',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            width: 150,
            render: formatDateTime,
            sorter: (a: any, b: any) => new Date(a.CreatedAt).getTime() - new Date(b.CreatedAt).getTime(),
            sortOrder: sortedInfo.columnKey === 'CreatedAt' ? sortedInfo.order : null,
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Warehouse' }, { title: 'Incoming' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => dispatch(fetchIncoming())} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
                <ButtonToolbar title="Detail" icon={<EyeOutlined />} onClick={handleViewDetail} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Receive" icon={<CheckOutlined />} onClick={handleReceive} enable={selectedRowKeys.length === 1 && !selectedRecord?.Closed} />
                <ButtonToolbar title="Checking" icon={<CheckCircleOutlined />} onClick={handleChecking} enable={selectedRowKeys.length === 1 && !selectedRecord?.Closed} />
                <ButtonToolbar title="Attachment" icon={<PaperClipOutlined />} onClick={handleUploadAttachment} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Delete" icon={<DeleteOutlined />} onClick={handleDelete} enable={selectedRowKeys.length === 1 && !selectedRecord?.Closed} />
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
                    pageSize: 50,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} records`,
                }}
                rowKey="Id"
                scroll={{ y: 'calc(100vh - 360px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            {detailData && (
                <DetailIncomingModal
                    visible={isDetailModalVisible}
                    onClose={handleCloseDetailModal}
                    data={detailData}
                />
            )}

            <CreateIncomingModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => {
                    dispatch(fetchIncoming());
                }}
            />

            {selectedRecord && (
                <UploadAttachmentModal
                    visible={isUploadModalVisible}
                    onClose={handleCloseUploadModal}
                    incomingId={selectedRecord.Id}
                    onSuccess={handleUploadSuccess}
                />
            )}

            {selectedRecord && (
                <CheckingIncomingModal
                    visible={isCheckingModalVisible}
                    onClose={handleCloseCheckingModal}
                    incomingId={selectedRecord.Id}
                    materials={selectedRecord.IncomingMaterial}
                    onSuccess={handleCheckingSuccess}
                />
            )}
        </Card>
    );
}
