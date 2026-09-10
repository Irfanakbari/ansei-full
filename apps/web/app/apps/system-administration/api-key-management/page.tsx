/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Space, Button, Tag } from 'antd';
import type { InputRef } from 'antd';
import { DeleteOutlined, ReloadOutlined, ExclamationCircleOutlined, SearchOutlined, PlusOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
    const { data, loading } = useSelector((state: RootState) => state.apiKeys);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

    useEffect(() => {
        dispatch(fetchApiKeys());
    }, [dispatch]);

    const searchInput = useRef<InputRef>(null);

    const getColumnSearchProps = (dataIndex: string) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput}
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
        onFilter: (value: any, record: any) =>
            record[dataIndex]
                ?.toString()
                .toLowerCase()
                .includes((value as string).toLowerCase()),
    });

    const columns = [
        {
            title: 'Name',
            dataIndex: 'Name',
            key: 'Name',
            ...getColumnSearchProps('Name')
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
                    <span>{record.User?.Name || record.UserId}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{record.User?.Email}</span>
                </Space>
            ),
            ...getColumnSearchProps('UserId')
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
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => { dispatch(fetchApiKeys()); }} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
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
                pagination={{
                    size: 'small',
                    pageSize: 100,
                    showSizeChanger: true,
                    hideOnSinglePage: true,
                    showTotal: (total) => `Total ${total} items`,
                }}
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
