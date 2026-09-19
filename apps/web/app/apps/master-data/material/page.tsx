/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Space, Button } from 'antd';
import type { InputRef } from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined, ExclamationCircleOutlined, SearchOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { MaterialEntity, fetchMaterial, deleteMaterial, setMaterialQuery } from '@/store/features/master/materialSlice';
import CreateMaterialModal from './_components/CreateMaterialModal';
import EditMaterialModal from './_components/EditMaterialModal';
import DiscontinueMaterialModal from './_components/DiscontinueMaterialModal';
import { formatDateTime } from '@/lib/utils/dateTime';

export default function MaterialPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination, query } = useSelector((state: RootState) => state.material);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isDiscontinueModalVisible, setIsDiscontinueModalVisible] = useState(false);
    const [editData, setEditData] = useState<MaterialEntity | null>(null);
    const [discontinueData, setDiscontinueData] = useState<MaterialEntity | null>(null);

    useEffect(() => {
        dispatch(fetchMaterial(query));
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
            title: 'Supplier',
            dataIndex: 'Supplier',
            key: 'Supplier',
            render: (val: string | null) => val || '-'
        },
        {
            title: 'Unit',
            dataIndex: ['SatuanData', 'Name'],
            key: 'SatuanData',
            render: (_: any, record: MaterialEntity) => record.SatuanData?.Name || '-'
        },
        {
            title: 'Rack Location',
            dataIndex: 'RackLocation',
            key: 'RackLocation',
            render: (val: string | null) => val || '-'
        },
        {
            title: 'Qty Rack',
            dataIndex: 'QtyRack',
            key: 'QtyRack',
            align: 'right' as const
        },
        {
            title: 'Qty Warehouse',
            dataIndex: 'QtyWarehouse',
            key: 'QtyWarehouse',
            align: 'right' as const
        },
        {
            title: 'Minimum Stock',
            dataIndex: 'MinimumStock',
            key: 'MinimumStock',
            align: 'right' as const
        },
        {
            title: 'Maximum Stock',
            dataIndex: 'MaximumStock',
            key: 'MaximumStock',
            align: 'right' as const,
            render: (value: number) => value === 0 ? 'Not Set' : value,
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
                title: 'Are you sure you want to delete this material?',
                icon: <ExclamationCircleOutlined />,
                content: `Part Number: ${data.find(d => d.Id === selectedRowKeys[0])?.PartNumber}`,
                okText: 'Yes, Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteMaterial(selectedRowKeys[0] as number));

                        if (deleteMaterial.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete material');
                        }
                        message.success('Material deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchMaterial(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete material');
                    }
                },
            });
        }
    };

    const handleDiscontinue = () => {
        if (selectedRowKeys.length === 1) {
            const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);
            if (selectedRecord) {
                setDiscontinueData(selectedRecord);
                setIsDiscontinueModalVisible(true);
            }
        }
    };


    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Master Data' }, { title: 'Material' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => { dispatch(fetchMaterial(query)); }} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
                <ButtonToolbar title="Edit" icon={<EditOutlined />} onClick={handleEdit} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Delete" icon={<DeleteOutlined />} onClick={handleDelete} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Discontinue" icon={<StopOutlined />} onClick={handleDiscontinue} enable={selectedRowKeys.length === 1} />
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
                onChange={(pageInfo, tableFilters) => dispatch(setMaterialQuery({ page: tableFilters.PartNumber || tableFilters.PartName ? 1 : pageInfo.current, limit: pageInfo.pageSize, search: String(tableFilters.PartNumber?.[0] ?? tableFilters.PartName?.[0] ?? '') }))}
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
                <EditMaterialModal
                    visible={isEditModalVisible}
                    onClose={() => setIsEditModalVisible(false)}
                    data={editData}
                />
            )}

            <CreateMaterialModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
            />

            {discontinueData && (
                <DiscontinueMaterialModal
                    visible={isDiscontinueModalVisible}
                    onClose={() => setIsDiscontinueModalVisible(false)}
                    data={discontinueData}
                />
            )}
        </Card>
    );
}
