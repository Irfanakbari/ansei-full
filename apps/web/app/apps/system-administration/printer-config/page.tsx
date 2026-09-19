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
import { PrinterSettingEntity, fetchPrinterSettings, deletePrinterSetting, setPrinterSettingQuery } from '@/store/features/settings/printerSettingSlice';
import CreatePrinterSettingModal from './_components/CreatePrinterSettingModal';
import EditPrinterSettingModal from './_components/EditPrinterSettingModal';
import { formatDateTime } from '@/lib/utils/dateTime';

export default function PrinterConfigPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, query, pagination } = useSelector((state: RootState) => state.printerSetting);

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editData, setEditData] = useState<PrinterSettingEntity | null>(null);

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchPrinterSettings(query));
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
                title: 'Delete Printer Setting?',
                icon: <ExclamationCircleOutlined />,
                content: `Delete printer "${selectedRecord.Name}" with IP ${selectedRecord.IpAddress}?`,
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deletePrinterSetting(selectedRecord.Id));

                        if (deletePrinterSetting.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete printer setting');
                        }
                        message.success('Printer setting deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchPrinterSettings(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete printer setting');
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
            title: 'Printer Name',
            dataIndex: 'Name',
            key: 'Name',
            ...getColumnSearchProps('Name'),
        },
        {
            title: 'IP Address',
            dataIndex: 'IpAddress',
            key: 'IpAddress',
            render: (val: string) => <Tag color="blue">{val}</Tag>,
            ...getColumnSearchProps('IpAddress'),
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
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'System Administration' }, { title: 'Printer Config' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => dispatch(fetchPrinterSettings(query))} />
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
                onChange={(p, filters) => dispatch(setPrinterSettingQuery({ page: p.current, limit: p.pageSize, search: Object.values(filters).flat().find((value) => typeof value === 'string') as string | undefined }))}
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

            <CreatePrinterSettingModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => dispatch(fetchPrinterSettings(query))}
            />

            {editData && (
                <EditPrinterSettingModal
                    visible={isEditModalVisible}
                    onClose={() => setIsEditModalVisible(false)}
                    data={editData}
                    onSuccess={() => dispatch(fetchPrinterSettings(query))}
                />
            )}
        </Card>
    );
}
