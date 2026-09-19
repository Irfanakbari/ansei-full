/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Space, Button } from 'antd';
import type { InputRef } from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined, ExclamationCircleOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { FinishGoodEntity, fetchFinishGood, deleteFinishGood, setFinishGoodQuery } from '@/store/features/master/finishGoodSlice';
import CreateFinishGoodModal from './_components/CreateFinishGoodModal';
import EditFinishGoodModal from './_components/EditFinishGoodModal';
import { formatDateTime } from '@/lib/utils/dateTime';

export default function FinishGoodPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination, query } = useSelector((state: RootState) => state.finishGood);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editData, setEditData] = useState<FinishGoodEntity | null>(null);

    useEffect(() => {
        dispatch(fetchFinishGood(query));
    }, [dispatch, query]);

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
        filteredValue: query.search ? [query.search] : null,
    });

    const columns = [
        { title: 'Passthrough', dataIndex: 'IsPassthrough', key: 'IsPassthrough', render: (value: boolean) => value ? 'Yes — skip Assy' : 'No — Assy required' },
        {
            title: 'Part Number',
            dataIndex: 'PartNumber',
            key: 'PartNumber',
            ...getColumnSearchProps('PartNumber')
        },
        {
            title: 'Part Name',
            dataIndex: 'PartName',
            key: 'PartName',
            ...getColumnSearchProps('PartName')
        },
        {
            title: 'Alias',
            dataIndex: 'Alias',
            key: 'Alias',
            render: (val: string | null) => val || '-',
            ...getColumnSearchProps('Alias')
        },
        {
            title: 'Price',
            dataIndex: 'Price',
            key: 'Price',
            align: 'right' as const,
            render: (val: number | null) => val ? `Rp ${val.toLocaleString('id-ID')}` : '-'
        },
        {
            title: 'Qty',
            dataIndex: 'Qty',
            key: 'Qty',
            align: 'right' as const
        },
        {
            title: 'Created By',
            dataIndex: 'CreatedBy',
            key: 'CreatedBy',
            render: (_: any, record: any) => record.CreatedByName || record.createdByName || '-'
        },
        {
            title: 'Created Date',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            render: (val: string) => formatDateTime(val)
        }
    ];

    const handleEdit = () => {
        if (selectedRowKeys.length === 1) {
            const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);
            if (selectedRecord) {
                setEditData(selectedRecord);
                setIsEditModalVisible(true);
            }
        }
    };

    const handleDelete = () => {
        if (selectedRowKeys.length === 1) {
            modal.confirm({
                title: 'Are you sure you want to delete this finish good?',
                icon: <ExclamationCircleOutlined />,
                content: `Part Number: ${data.find(d => d.Id === selectedRowKeys[0])?.PartNumber}`,
                okText: 'Yes, Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteFinishGood(selectedRowKeys[0] as number));

                        if (deleteFinishGood.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete finish good');
                        }
                        message.success('Finish good deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchFinishGood(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete finish good');
                    }
                },
            });
        }
    };

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Master Data' }, { title: 'Finish Good' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => { dispatch(fetchFinishGood(query)); }} />
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
                onChange={(pageInfo, tableFilters) => dispatch(setFinishGoodQuery({ page: tableFilters.PartNumber || tableFilters.PartName || tableFilters.Alias ? 1 : pageInfo.current, limit: pageInfo.pageSize, search: String(tableFilters.PartNumber?.[0] ?? tableFilters.PartName?.[0] ?? tableFilters.Alias?.[0] ?? '') }))}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} items`,
                }}
                rowKey="Id"
                scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            {editData && (
                <EditFinishGoodModal
                    visible={isEditModalVisible}
                    onClose={() => setIsEditModalVisible(false)}
                    data={editData}
                />
            )}

            <CreateFinishGoodModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
            />
        </Card>
    );
}
