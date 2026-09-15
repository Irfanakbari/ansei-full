/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Button, Space, Tag } from 'antd';
import type { InputRef } from 'antd';
import { ReloadOutlined, EditOutlined, DeleteOutlined, SearchOutlined, PlusOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { EmailNotificationEntity, fetchEmailNotifications, deleteEmailNotification, NotificationType, setEmailNotificationQuery } from '@/store/features/settings/emailNotificationSlice';
import CreateEmailNotificationModal from './_components/CreateEmailNotificationModal';
import EditEmailNotificationModal from './_components/EditEmailNotificationModal';
import { formatDateTime } from '@/lib/utils/dateTime';

const TYPE_COLORS: Record<string, string> = {
    DEFAULT: 'default',
    INCOMING: 'blue',
    OUTGOING: 'green',
    PRODUCTION: 'orange',
    TRANSFER: 'purple',
};

export default function EmailConfigPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, query, pagination } = useSelector((state: RootState) => state.emailNotification);

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editData, setEditData] = useState<EmailNotificationEntity | null>(null);

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchEmailNotifications(query));
    }, [dispatch, query]);

    const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);

    const handleEdit = () => {
        if (selectedRecord) {
            setEditData(selectedRecord);
            setIsEditModalVisible(true);
        }
    };

    const handleDelete = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Delete Email Notification?',
                icon: <ExclamationCircleOutlined />,
                content: `Delete email notification for "${selectedRecord.Name}" (${selectedRecord.Email})?`,
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteEmailNotification(selectedRecord.Id));

                        if (deleteEmailNotification.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete email notification');
                        }
                        message.success('Email notification deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchEmailNotifications(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete email notification');
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
            width: 80,
            align: 'center' as const,
            ...getColumnSearchProps('Id'),
        },
        {
            title: 'Name',
            dataIndex: 'Name',
            key: 'Name',
            width: 150,
            ...getColumnSearchProps('Name'),
        },
        {
            title: 'Email',
            dataIndex: 'Email',
            key: 'Email',
            width: 200,
            ellipsis: true,
            ...getColumnSearchProps('Email'),
        },
        {
            title: 'Type',
            dataIndex: 'Type',
            key: 'Type',
            width: 120,
            align: 'center' as const,
            render: (val: NotificationType) => <Tag color={TYPE_COLORS[val] || 'default'}>{val}</Tag>,
            filters: [
                { text: 'Default', value: 'DEFAULT' },
                { text: 'Incoming', value: 'INCOMING' },
                { text: 'Outgoing', value: 'OUTGOING' },
                { text: 'Production', value: 'PRODUCTION' },
                { text: 'Transfer', value: 'TRANSFER' },
            ],
            onFilter: (value: any, record: EmailNotificationEntity) => record.Type === value,
        },
        {
            title: 'Created By',
            dataIndex: 'CreatedBy',
            key: 'CreatedBy',
            width: 120,
            ...getColumnSearchProps('CreatedBy'),
        },
        {
            title: 'Created At',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            width: 160,
            render: formatDateTime,
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'System Administration' }, { title: 'Email Config' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => dispatch(fetchEmailNotifications(query))} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
                <ButtonToolbar title="Edit" icon={<EditOutlined />} onClick={handleEdit} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Delete" icon={<DeleteOutlined />} onClick={handleDelete} enable={selectedRowKeys.length === 1} />
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
                onChange={(p, filters) => dispatch(setEmailNotificationQuery({ page: p.current, limit: p.pageSize, search: Object.values(filters).flat().find((value) => typeof value === 'string') as string | undefined }))}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} records`,
                }}
                rowKey="Id"
                scroll={{ y: 'calc(100vh - 360px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            <CreateEmailNotificationModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => dispatch(fetchEmailNotifications(query))}
            />

            {editData && (
                <EditEmailNotificationModal
                    visible={isEditModalVisible}
                    onClose={() => setIsEditModalVisible(false)}
                    data={editData}
                    onSuccess={() => dispatch(fetchEmailNotifications(query))}
                />
            )}
        </Card>
    );
}
