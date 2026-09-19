/* By Irfan Akbari Vuteq Indonesia - 2026-07-21 */
"use client";

import React, { useState, useEffect } from 'react';
import { Table, Card, Breadcrumb, App, Tag } from 'antd';
import { ReloadOutlined, EditOutlined, DeleteOutlined, PlusOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    fetchDisplayConfig,
    deleteDisplayConfig,
    DisplayConfigEntity,
    setDisplayConfigQuery,
} from '@/store/features/settings/displayConfig/displayConfigSlice';
import CreateEditDisplayConfigModal from './_components/CreateEditDisplayConfigModal';
import { formatDateTime } from '@/lib/utils/dateTime';

const DisplayConfigPage: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, query, pagination } = useSelector((state: RootState) => state.displayConfig);
    const { message, modal } = App.useApp();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingData, setEditingData] = useState<DisplayConfigEntity | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    useEffect(() => {
        dispatch(fetchDisplayConfig(query));
    }, [dispatch, query]);

    const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);

    const handleCreate = () => {
        setEditingData(null);
        setIsModalVisible(true);
    };

    const handleEdit = () => {
        if (selectedRecord) {
            setEditingData(selectedRecord);
            setIsModalVisible(true);
        }
    };

    const handleDelete = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Delete Display Config?',
                icon: <ExclamationCircleOutlined />,
                content: `Delete display config "${selectedRecord.Description}" with URL ${selectedRecord.Url}?`,
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteDisplayConfig(selectedRecord.Id));

                        if (deleteDisplayConfig.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete display config');
                        }
                        message.success('Display config deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchDisplayConfig(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete display config');
                    }
                },
            });
        }
    };

    const columns = [
        {
            title: 'Description',
            dataIndex: 'Description',
            key: 'Description',
        },
        {
            title: 'URL',
            dataIndex: 'Url',
            key: 'Url',
            ellipsis: true,
        },
        {
            title: 'Auto Open',
            dataIndex: 'IsOpen',
            key: 'IsOpen',
            align: 'center' as const,
            render: (IsOpen: boolean) => (
                <Tag color={IsOpen ? 'green' : 'default'}>
                    {IsOpen ? 'Yes' : 'No'}
                </Tag>
            ),
        },
        {
            title: 'Loop',
            dataIndex: 'Loop',
            key: 'Loop',
            align: 'center' as const,
            render: (Loop: boolean) => (
                <Tag color={Loop ? 'green' : 'default'}>
                    {Loop ? 'Yes' : 'No'}
                </Tag>
            ),
        },
        {
            title: 'Created At',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            render: formatDateTime,
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb
                style={{ marginBottom: 16 }}
                items={[
                    { title: 'Home' },
                    { title: 'System Administration' },
                    { title: 'Display Config' },
                ]}
            />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => dispatch(fetchDisplayConfig(query))} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={handleCreate} />
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
                onChange={(p) => dispatch(setDisplayConfigQuery({ page: p.current, limit: p.pageSize }))}
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

            <CreateEditDisplayConfigModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                onSuccess={() => dispatch(fetchDisplayConfig(query))}
                data={editingData}
            />
        </Card>
    );
};

export default DisplayConfigPage;
