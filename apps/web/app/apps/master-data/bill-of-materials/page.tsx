/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Table, Card, Breadcrumb, App, Input, Space, Button, Tag } from 'antd';
import type { InputRef } from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined, ExclamationCircleOutlined, SearchOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { BOMEntity, BOMGrouped, fetchBOM, deleteBOM, setBOMQuery } from '@/store/features/master/bomSlice';
import CreateBOMModal from './_components/CreateBOMModal';
import EditBOMModal from './_components/EditBOMModal';
import DetailBOMModal from './_components/DetailBOMModal';

export default function BillOfMaterialsPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination, query } = useSelector((state: RootState) => state.bom);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [editData, setEditData] = useState<BOMEntity | null>(null);
    const [detailData, setDetailData] = useState<BOMGrouped | null>(null);

    useEffect(() => {
        dispatch(fetchBOM(query));
    }, [dispatch, query]);

    // Group data by Finish Good
    const groupedData = useMemo(() => {
        const groups: Record<number, BOMGrouped> = {};
        (Array.isArray(data) ? data : []).forEach((item) => {
            const fgId:any = item.FinishGoodId;
            if (!groups[fgId]) {
                groups[fgId] = {
                    FinishGoodId: fgId,
                    FGData: item.FGData,
                    materials: [],
                };
            }
            groups[fgId].materials.push(item);
        });
        return Object.values(groups);
    }, [data]);

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
            title: 'FG Part Number',
            dataIndex: ['FGData', 'PartNumber'],
            key: 'FGPartNumber',
            width: 200,
            render: (_: any, record: BOMGrouped) => (
                <strong>{record.FGData?.PartNumber}</strong>
            ),
            ...getColumnSearchProps('FGData.PartNumber')
        },
        {
            title: 'FG Part Name',
            dataIndex: ['FGData', 'PartName'],
            key: 'FGPartName',
            render: (_: any, record: BOMGrouped) => record.FGData?.PartName || '-',
            ...getColumnSearchProps('FGData.PartName')
        },
        {
            title: 'Materials',
            key: 'MaterialCount',
            width: 120,
            align: 'center' as const,
            render: (_: any, record: BOMGrouped) => <Tag color="blue">{record.materials?.length || 0}</Tag>,
        },
    ];

    const handleDetail = () => {
        if (selectedRowKeys.length === 1) {
            const selectedGroup = groupedData.find((item) => item.FinishGoodId === selectedRowKeys[0]);
            if (selectedGroup) {
                setDetailData(selectedGroup);
                setIsDetailModalVisible(true);
            }
        }
    };

    const handleEdit = () => {
        if (selectedRowKeys.length === 1) {
            // Get first material from group for edit
            const selectedGroup = groupedData.find((item) => item.FinishGoodId === selectedRowKeys[0]);
            if (selectedGroup && selectedGroup.materials.length > 0) {
                setEditData(selectedGroup.materials[0]);
                setIsEditModalVisible(true);
            }
        }
    };

    const handleDelete = () => {
        if (selectedRowKeys.length === 1) {
            modal.confirm({
                title: 'Are you sure you want to delete all BOM for this Finish Good?',
                icon: <ExclamationCircleOutlined />,
                content: `Finish Good: ${groupedData.find(d => d.FinishGoodId === selectedRowKeys[0])?.FGData.PartNumber}`,
                okText: 'Yes, Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        // Delete all materials in the group
                        const group = groupedData.find(g => g.FinishGoodId === selectedRowKeys[0]);
                        if (group) {
                            for (const material of group.materials) {
                                const result = await dispatch(deleteBOM(material.Id));

                                if (deleteBOM.rejected.match(result)) {
                                    throw new Error((result.payload as string) || 'Failed to delete BOM');
                                }
                            }
                        }
                        message.success('BOM deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchBOM(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete BOM');
                    }
                },
            });
        }
    };


    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Master Data' }, { title: 'Bill of Materials' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => { dispatch(fetchBOM(query)); }} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
                <ButtonToolbar title="Detail" icon={<EyeOutlined />} onClick={handleDetail} enable={selectedRowKeys.length === 1} />
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
                dataSource={groupedData}
                size="small"
                loading={loading}
                onChange={(pageInfo, tableFilters) => dispatch(setBOMQuery({ page: tableFilters.FGPartNumber || tableFilters.FGPartName || tableFilters.FGData ? 1 : pageInfo.current, limit: pageInfo.pageSize, search: String(tableFilters.FGPartNumber?.[0] ?? tableFilters.FGPartName?.[0] ?? tableFilters.FGData?.[0] ?? '') }))}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} items`,
                }}
                rowKey="FinishGoodId"
                scroll={{ y: 'calc(100vh - 380px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            {editData && (
                <EditBOMModal
                    visible={isEditModalVisible}
                    onClose={() => setIsEditModalVisible(false)}
                    data={editData}
                />
            )}

            <CreateBOMModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
            />

            {detailData && (
                <DetailBOMModal
                    visible={isDetailModalVisible}
                    onClose={() => setIsDetailModalVisible(false)}
                    data={detailData}
                />
            )}
        </Card>
    );
}
