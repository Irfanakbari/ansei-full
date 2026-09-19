/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
"use client";

import React, { useState, useEffect } from 'react';
import { Table, Card, Breadcrumb, App, Input, Space, Tag } from 'antd';
import { DeleteOutlined, ReloadOutlined, ExclamationCircleOutlined, PlusOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { ApiKeyEntity, fetchApiKeys, deleteApiKey, revokeApiKey, reactivateApiKey } from '@/store/features/apiKeys/apiKeysSlice';
import CreateApiKeyModal from './_components/CreateApiKeyModal';
import { formatDateTime } from '@/lib/utils/dateTime';

export default function ApiKeyManagementPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination } = useSelector((state: RootState) => state.apiKeys);
    const [query, setQuery] = useState({ page: 1, limit: 50, search: '' });
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

    useEffect(() => {
        dispatch(fetchApiKeys(query));
    }, [dispatch, query]);

    const columns = [
        {
            title: 'Name',
            dataIndex: 'Name',
            key: 'Name',
        },
        {
            title: 'Key Prefix',
            dataIndex: 'KeyPrefix',
            key: 'KeyPrefix',
        },
        {
            title: 'User',
            dataIndex: 'UserId',
            key: 'UserId',
            render: (_: any, record: ApiKeyEntity) => (
                <Space orientation="vertical" size={0}>
                    <span>{record.User?.Name || '-'}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{record.User?.Email}</span>
                </Space>
            ),
        },
        {
            title: 'Description',
            dataIndex: 'Description',
            key: 'Description',
            ellipsis: true,
        },
        {
            title: 'Status',
            dataIndex: 'IsActive',
            key: 'IsActive',
            render: (val: boolean) => (
                <Tag color={val ? 'green' : 'default'}>
                    {val ? 'Active' : 'Revoked'}
                </Tag>
            )
        },
        {
            title: 'Last Used',
            dataIndex: 'LastUsedAt',
            key: 'LastUsedAt',
            render: (val: string | null) => val ? formatDateTime(val) : '-'
        },
        {
            title: 'Created',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            render: (val: string) => formatDateTime(val)
        },
    ];

    const handleDelete = () => {
        if (selectedRowKeys.length === 1) {
            modal.confirm({
                title: 'Are you sure you want to delete this API Key?',
                icon: <ExclamationCircleOutlined />,
                content: `API Key Name: ${data.find(d => d.Id === selectedRowKeys[0])?.Name}`,
                okText: 'Yes, Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        await dispatch(deleteApiKey(selectedRowKeys[0] as string)).unwrap();
                        message.success('API Key successfully deleted');
                        setSelectedRowKeys([]);
                    } catch (error: any) {
                        message.error(error || 'Failed to delete API Key');
                    }
                },
            });
        }
    };

    const handleRevoke = () => {
        if (selectedRowKeys.length === 1) {
            const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);
            if (selectedRecord && !selectedRecord.IsActive) {
                message.warning('This API Key is already revoked');
                return;
            }

            modal.confirm({
                title: 'Are you sure you want to revoke this API Key?',
                icon: <StopOutlined />,
                content: `API Key Name: ${selectedRecord?.Name}`,
                okText: 'Yes, Revoke',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        await dispatch(revokeApiKey(selectedRowKeys[0] as string)).unwrap();
                        message.success('API Key successfully revoked');
                        setSelectedRowKeys([]);
                    } catch (error: any) {
                        message.error(error || 'Failed to revoke API Key');
                    }
                },
            });
        }
    };

    const handleReactivate = () => {
        if (selectedRowKeys.length === 1) {
            const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);
            if (selectedRecord && selectedRecord.IsActive) {
                message.warning('This API Key is already active');
                return;
            }

            modal.confirm({
                title: 'Are you sure you want to reactivate this API Key?',
                icon: <CheckCircleOutlined />,
                content: `API Key Name: ${selectedRecord?.Name}`,
                okText: 'Yes, Reactivate',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        await dispatch(reactivateApiKey(selectedRowKeys[0] as string)).unwrap();
                        message.success('API Key successfully reactivated');
                        setSelectedRowKeys([]);
                    } catch (error: any) {
                        message.error(error || 'Failed to reactivate API Key');
                    }
                },
            });
        }
    };

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'System Administration' }, { title: 'API Key Management' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => { dispatch(fetchApiKeys(query)); }} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
                <ButtonToolbar title="Delete" icon={<DeleteOutlined />} onClick={handleDelete} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar
                    title="Revoke"
                    icon={<StopOutlined />}
                    onClick={handleRevoke}
                    enable={selectedRowKeys.length === 1 && data.find(d => d.Id === selectedRowKeys[0])?.IsActive === true}
                />
                <ButtonToolbar
                    title="Reactivate"
                    icon={<CheckCircleOutlined />}
                    onClick={handleReactivate}
                    enable={selectedRowKeys.length === 1 && data.find(d => d.Id === selectedRowKeys[0])?.IsActive === false}
                />
            </ToolbarWrapper>
            <Input.Search allowClear placeholder="Search name, description, user, email, or creator" style={{ width: 420, marginBottom: 12 }} onSearch={(search) => setQuery((current) => ({ ...current, page: 1, search }))} />

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
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    hideOnSinglePage: true,
                    showTotal: (total) => `Total ${total} items`,
                }}
                onChange={(pageConfig) => setQuery((current) => ({ ...current, page: pageConfig.current ?? 1, limit: pageConfig.pageSize ?? 50 }))}
                rowKey="Id"
                scroll={{ y: 'calc(100vh - 420px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            <CreateApiKeyModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
            />
        </Card>
    );
}
