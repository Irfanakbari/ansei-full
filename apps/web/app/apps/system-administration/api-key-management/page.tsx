/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
"use client";

import React, {useState, useEffect} from 'react';
import {Table, Card, Breadcrumb, App, Input, Space, Tag} from 'antd';
import type {TableProps} from 'antd';
import {
    ReloadOutlined,
    PlusOutlined,
    StopOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {
    ApiKeyEntity,
    fetchApiKeys,
    revokeApiKey,
    reactivateApiKey
} from '@/store/features/apiKeys/apiKeysSlice';
import CreateApiKeyModal from './_components/CreateApiKeyModal';
import ApiKeyDetailModal from './_components/ApiKeyDetailModal';
import {formatDateTime} from '@/lib/utils/dateTime';
import GoldenArrowAction from '@/components/GoldenArrowAction';

export default function ApiKeyManagementPage() {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination} = useSelector((state: RootState) => state.apiKeys);
    const [query, setQuery] = useState({page: 1, limit: 50, search: ''});
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [detailData, setDetailData] = useState<ApiKeyEntity | null>(null);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);

    useEffect(() => {
        dispatch(fetchApiKeys(query));
    }, [dispatch, query]);

    const columns: TableProps<ApiKeyEntity>['columns'] = [
        {
            title: 'Name',
            dataIndex: 'Name',
            key: 'Name',
            render: (value: string, record) => (
                <Space size={4}>
                    <GoldenArrowAction
                        tooltip="View API Key details"
                        ariaLabel={`View API Key details for ${value}`}
                        onClick={() => {
                            setSelectedRowKeys([record.Id]);
                            setDetailData(record);
                        }}
                    />
                    <span>{value}</span>
                </Space>
            ),
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
            render: (_: string, record) => (
                <Space orientation="vertical" size={0}>
                    <span>{record.User?.Name || '-'}</span>
                    <span style={{fontSize: 11, color: '#888'}}>{record.User?.Email}</span>
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

    const handleRevoke = () => {
        if (selectedRowKeys.length === 1) {
            const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);
            if (selectedRecord && !selectedRecord.IsActive) {
                message.warning('This API Key is already revoked');
                return;
            }

            modal.confirm({
                title: 'Are you sure you want to revoke this API Key?',
                icon: <StopOutlined/>,
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
                icon: <CheckCircleOutlined/>,
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
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: 'Home'}, {title: 'System Administration'}, {title: 'API Key Management'}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={() => {
                    dispatch(fetchApiKeys(query));
                }}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/>
                <ButtonToolbar
                    title="Revoke"
                    icon={<StopOutlined/>}
                    onClick={handleRevoke}
                    enable={selectedRowKeys.length === 1 && data.find(d => d.Id === selectedRowKeys[0])?.IsActive === true}
                />
                <ButtonToolbar
                    title="Reactivate"
                    icon={<CheckCircleOutlined/>}
                    onClick={handleReactivate}
                    enable={selectedRowKeys.length === 1 && data.find(d => d.Id === selectedRowKeys[0])?.IsActive === false}
                />
            </ToolbarWrapper>
            <Input.Search allowClear placeholder="Search name, description, user, email, or creator"
                          style={{width: 420, marginBottom: 12}}
                          onSearch={(search) => setQuery((current) => ({...current, page: 1, search}))}/>

            <Table
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
                onChange={(pageConfig) => setQuery((current) => ({
                    ...current,
                    page: pageConfig.current ?? 1,
                    limit: pageConfig.pageSize ?? 50
                }))}
                rowKey="Id"
                onRow={(record) => ({
                    onClick: () => setSelectedRowKeys([record.Id]),
                    onDoubleClick: () => {
                        setSelectedRowKeys([record.Id]);
                        setDetailData(record);
                    },
                })}
                rowClassName={(record) => selectedRowKeys[0] === record.Id ? 'ant-table-row-selected' : ''}
                scroll={{y: 'calc(100vh - 420px)'}}
                className="small-table"
                style={{fontSize: '11px'}}
            />

            <CreateApiKeyModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
            />
            <ApiKeyDetailModal
                open={detailData !== null}
                data={detailData}
                onClose={() => setDetailData(null)}
                onDeleted={() => {
                    setDetailData(null);
                    setSelectedRowKeys([]);
                    void dispatch(fetchApiKeys(query));
                }}
            />
        </Card>
    );
}
