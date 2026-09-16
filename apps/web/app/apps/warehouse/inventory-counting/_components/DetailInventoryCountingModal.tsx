/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-09-16 */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Table, Tag, Button, Space, Input, Descriptions, Statistic, Card, Row, Col, App, Tabs, Popconfirm } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    updateActualStock,
    fetchInventoryCountingDetails,
    InventoryCountingEntity,
    InventoryCountingDetailEntity,
} from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';
import { InboxOutlined, SaveOutlined, SyncOutlined, CheckCircleOutlined } from '@ant-design/icons';
import ReviewApprovalModal from './ReviewApprovalModal';

export interface MergedCountingDetail extends InventoryCountingDetailEntity {
    warehouseDetailId?: number;
    rackDetailId?: number;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    data: InventoryCountingEntity;
    onRefresh?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'default',
    IN_PROGRESS: 'processing',
    COMPLETED: 'success',
    CANCELLED: 'error',
};

const DetailInventoryCountingModal: React.FC<Props> = ({ visible, onClose, data, onRefresh }) => {
    const { message: antMessage } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { user } = useSelector((state: RootState) => state.auth);

    const [details, setDetails] = useState<MergedCountingDetail[]>([]);
    const [editingKey, setEditingKey] = useState<number | null>(null);
    const [editingWarehouse, setEditingWarehouse] = useState<number | null>(null);
    const [editingRack, setEditingRack] = useState<number | null>(null);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [loading, setLoading] = useState(false);
    const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);

    const canApprove = Boolean(
        user?.RoleName === 'SUPER' ||
        user?.Permission?.includes('SUPER') ||
        user?.Permission?.includes('*') ||
        user?.Permission?.includes('IPCS.INVENTORY_COUNTING_APPROVE')
    );

    // Fetch details when modal opens
    useEffect(() => {
        if (visible && data?.Id) {
            const loadDetails = async () => {
                try {
                    setLoading(true);
                    const result = await dispatch(fetchInventoryCountingDetails(data.Id));
                    if (fetchInventoryCountingDetails.fulfilled.match(result)) {
                        const fetchedDetails = Array.isArray(result.payload) ? result.payload : (result.payload as any)?.data || [];

                        if (data.Category === 'MATERIAL') {
                            // Group by MaterialId for dual warehouse & rack display
                            const materialMap = new Map<string, MergedCountingDetail>();

                            fetchedDetails.forEach((d: InventoryCountingDetailEntity) => {
                                const key = d.MaterialId || `detail_${d.Id}`;

                                if (!materialMap.has(key)) {
                                    materialMap.set(key, {
                                        ...d,
                                        warehouseDetailId: d.Location === 'WAREHOUSE' ? d.Id : undefined,
                                        rackDetailId: d.Location === 'RACK' ? d.Id : undefined,
                                        SystemQty: d.Location === 'WAREHOUSE' ? d.SystemQty : 0,
                                        SystemQtyRack: d.Location === 'RACK' ? (d.SystemQtyRack || d.SystemQty) : 0,
                                        ActualQty: d.Location === 'WAREHOUSE' ? d.ActualQty : null,
                                        ActualQtyRack: d.Location === 'RACK' ? (d.ActualQtyRack ?? d.ActualQty) : null,
                                        DiffQty: d.Location === 'WAREHOUSE' ? d.DiffQty : null,
                                        DiffQtyRack: d.Location === 'RACK' ? (d.DiffQtyRack ?? d.DiffQty) : null,
                                    });
                                } else {
                                    const existing = materialMap.get(key)!;
                                    if (d.Location === 'RACK') {
                                        existing.rackDetailId = d.Id;
                                        existing.SystemQtyRack = d.SystemQtyRack || d.SystemQty;
                                        existing.ActualQtyRack = d.ActualQtyRack ?? d.ActualQty;
                                        existing.DiffQtyRack = d.DiffQtyRack ?? d.DiffQty;
                                    } else if (d.Location === 'WAREHOUSE') {
                                        existing.warehouseDetailId = d.Id;
                                        existing.SystemQty = d.SystemQty;
                                        existing.ActualQty = d.ActualQty;
                                        existing.DiffQty = d.DiffQty;
                                        existing.Notes = d.Notes || existing.Notes;
                                    }
                                }
                            });

                            setDetails(Array.from(materialMap.values()));
                        } else {
                            // FINISH_GOOD: each row is independent
                            setDetails(
                                fetchedDetails.map((d: InventoryCountingDetailEntity) => ({
                                    ...d,
                                    warehouseDetailId: d.Id,
                                }))
                            );
                        }
                    }
                } catch {
                    antMessage.error('Failed to load details');
                } finally {
                    setLoading(false);
                }
            };
            loadDetails();
        }
    }, [visible, data?.Id, data?.Category, dispatch, antMessage]);

    // Get unique locations
    const locations = useMemo(() => {
        const locs = [...new Set(details.map(d => d.Location).filter(Boolean))];
        return locs.sort();
    }, [details]);

    // Filter by location only
    const filteredDetails = useMemo(() => {
        if (activeTab === 'all') return details;
        return details.filter(d => d.Location === activeTab);
    }, [details, activeTab]);

    // Completed count
    const completedItems = useMemo(() => {
        return details.filter(d => {
            if (data?.Category === 'MATERIAL') {
                return d.ActualQty !== null && (d.ActualQtyRack !== null || d.rackDetailId === undefined);
            }
            return d.ActualQty !== null;
        }).length;
    }, [details, data?.Category]);

    const totalItems = details.length;
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const handleStartEditWarehouse = (record: MergedCountingDetail) => {
        setEditingKey(record.Id);
        setEditingWarehouse(record.ActualQty ?? 0);
        setEditingRack(record.ActualQtyRack ?? 0);
    };

    const handleStartEditRack = (record: MergedCountingDetail) => {
        setEditingKey(record.Id);
        setEditingWarehouse(record.ActualQty ?? 0);
        setEditingRack(record.ActualQtyRack ?? 0);
    };

    const handleSaveEdit = async (record: MergedCountingDetail) => {
        const warehouseVal = editingWarehouse ?? record.ActualQty ?? 0;
        const rackVal = editingRack ?? record.ActualQtyRack ?? 0;

        if (warehouseVal < 0 || (data?.Category === 'MATERIAL' && rackVal < 0)) {
            antMessage.error('Qty must be >= 0');
            return;
        }

        try {
            setUpdatingId(record.Id);

            const detailIdToUpdate = record.warehouseDetailId || record.rackDetailId || record.Id;
            const dto = data?.Category === 'MATERIAL'
                ? {
                    actualQty: warehouseVal,
                    actualQtyRack: rackVal,
                }
                : {
                    actualQty: warehouseVal,
                };

            const result = await dispatch(updateActualStock({
                detailId: detailIdToUpdate,
                dto,
            }));

            if (updateActualStock.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update stock');
            }

            antMessage.success('Stock updated successfully');

            // Update local state
            setDetails(prevDetails =>
                prevDetails.map(d =>
                    d.Id === record.Id
                        ? {
                            ...d,
                            ActualQty: warehouseVal,
                            ActualQtyRack: data?.Category === 'MATERIAL' ? rackVal : null,
                            DiffQty: warehouseVal - d.SystemQty,
                            DiffQtyRack: data?.Category === 'MATERIAL' ? rackVal - d.SystemQtyRack : null,
                        }
                        : d
                )
            );

            handleCancelEdit();
            onRefresh?.();
        } catch (error: unknown) {
            const err = error as Error;
            antMessage.error(err?.message || 'Failed to update stock');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingKey(null);
        setEditingWarehouse(null);
        setEditingRack(null);
    };

    const isEditing = useCallback((record: MergedCountingDetail) => editingKey === record.Id, [editingKey]);

    const columns = useMemo(() => {
        if (data?.Category === 'FINISH_GOOD') {
            return [
                {
                    title: 'Finish Good Part Number',
                    key: 'itemId',
                    width: 180,
                    fixed: 'left' as const,
                    render: (_: unknown, record: MergedCountingDetail) => (
                        <code style={{ fontSize: 11 }}>
                            {record.FinishGoodId || record.MaterialId || '-'}
                        </code>
                    ),
                },
                {
                    title: 'Part Name',
                    dataIndex: 'Notes',
                    key: 'Notes',
                    width: 200,
                    ellipsis: true,
                    render: (val: string | null) => val || '-',
                },
                {
                    title: 'Location',
                    dataIndex: 'Location',
                    key: 'Location',
                    width: 140,
                    render: (val: string) => <Tag color="purple">{val || 'FINISH_GOOD_AREA'}</Tag>,
                },
                {
                    title: 'System Qty',
                    dataIndex: 'SystemQty',
                    key: 'SystemQty',
                    width: 100,
                    align: 'center' as const,
                },
                {
                    title: 'Actual Qty',
                    dataIndex: 'ActualQty',
                    key: 'ActualQty',
                    width: 120,
                    align: 'center' as const,
                    render: (val: number | null, record: MergedCountingDetail) => {
                        if (data?.Status !== 'IN_PROGRESS') {
                            return val ?? '-';
                        }
                        if (isEditing(record)) {
                            return (
                                <Input
                                    type="number"
                                    value={editingWarehouse ?? val ?? 0}
                                    onChange={(e) => setEditingWarehouse(Number(e.target.value) || 0)}
                                    style={{ width: 80 }}
                                    min={0}
                                />
                            );
                        }
                        return (
                            <a onClick={() => handleStartEditWarehouse(record)} style={{ cursor: 'pointer' }}>
                                {val !== null && val !== undefined ? val : <Tag color="orange">Not Set</Tag>}
                            </a>
                        );
                    },
                },
                {
                    title: 'Diff Qty',
                    dataIndex: 'DiffQty',
                    key: 'DiffQty',
                    width: 100,
                    align: 'center' as const,
                    render: (val: number | null) => {
                        if (val === null || val === undefined) return '-';
                        const color = val > 0 ? 'green' : val < 0 ? 'red' : 'default';
                        return <Tag color={color}>{val > 0 ? `+${val}` : val}</Tag>;
                    },
                },
            ];
        }

        return [
            {
                title: 'Material Part Number',
                key: 'itemId',
                width: 150,
                fixed: 'left' as const,
                render: (_: unknown, record: MergedCountingDetail) => (
                    <code style={{ fontSize: 11 }}>
                        {record.MaterialId || record.FinishGoodId || '-'}
                    </code>
                ),
            },
            {
                title: 'Part Name',
                dataIndex: 'Notes',
                key: 'Notes',
                width: 150,
                ellipsis: true,
                render: (val: string | null) => val || '-',
            },
            {
                title: 'Warehouse',
                key: 'warehouseQty',
                align: 'center' as const,
                children: [
                    {
                        title: 'System',
                        dataIndex: 'SystemQty',
                        key: 'SystemQty',
                        width: 80,
                        align: 'center' as const,
                    },
                    {
                        title: 'Actual',
                        dataIndex: 'ActualQty',
                        key: 'ActualQty',
                        width: 100,
                        align: 'center' as const,
                        render: (val: number | null, record: MergedCountingDetail) => {
                            if (data?.Status !== 'IN_PROGRESS') {
                                return val ?? '-';
                            }
                            if (isEditing(record)) {
                                return (
                                    <Input
                                        type="number"
                                        value={editingWarehouse ?? val ?? 0}
                                        onChange={(e) => setEditingWarehouse(Number(e.target.value) || 0)}
                                        style={{ width: 60 }}
                                        min={0}
                                    />
                                );
                            }
                            return (
                                <a onClick={() => handleStartEditWarehouse(record)} style={{ cursor: 'pointer' }}>
                                    {val !== null && val !== undefined ? val : <Tag color="orange">Not Set</Tag>}
                                </a>
                            );
                        },
                    },
                    {
                        title: 'Diff',
                        dataIndex: 'DiffQty',
                        key: 'DiffQty',
                        width: 70,
                        align: 'center' as const,
                        render: (val: number | null) => {
                            if (val === null || val === undefined) return '-';
                            const color = val > 0 ? 'green' : val < 0 ? 'red' : 'default';
                            return <Tag color={color}>{val > 0 ? `+${val}` : val}</Tag>;
                        },
                    },
                ],
            },
            {
                title: 'Rack',
                key: 'rackQty',
                align: 'center' as const,
                children: [
                    {
                        title: 'System',
                        dataIndex: 'SystemQtyRack',
                        key: 'SystemQtyRack',
                        width: 80,
                        align: 'center' as const,
                    },
                    {
                        title: 'Actual',
                        dataIndex: 'ActualQtyRack',
                        key: 'ActualQtyRack',
                        width: 100,
                        align: 'center' as const,
                        render: (val: number | null, record: MergedCountingDetail) => {
                            if (data?.Status !== 'IN_PROGRESS') {
                                return val ?? '-';
                            }
                            if (isEditing(record)) {
                                return (
                                    <Input
                                        type="number"
                                        value={editingRack ?? val ?? 0}
                                        onChange={(e) => setEditingRack(Number(e.target.value) || 0)}
                                        style={{ width: 60 }}
                                        min={0}
                                    />
                                );
                            }
                            return (
                                <a onClick={() => handleStartEditRack(record)} style={{ cursor: 'pointer' }}>
                                    {val !== null && val !== undefined ? val : <Tag color="orange">Not Set</Tag>}
                                </a>
                            );
                        },
                    },
                    {
                        title: 'Diff',
                        dataIndex: 'DiffQtyRack',
                        key: 'DiffQtyRack',
                        width: 70,
                        align: 'center' as const,
                        render: (val: number | null) => {
                            if (val === null || val === undefined) return '-';
                            const color = val > 0 ? 'green' : val < 0 ? 'red' : 'default';
                            return <Tag color={color}>{val > 0 ? `+${val}` : val}</Tag>;
                        },
                    },
                ],
            },
        ];
    }, [data?.Category, data?.Status, editingWarehouse, editingRack, isEditing]);

    // Tab items
    const tabItems = [
        {
            key: 'all',
            label: `All (${details.length})`,
        },
        ...locations.map((loc) => ({
            key: loc,
            label: `${loc} (${details.filter(d => d.Location === loc).length})`,
        })),
    ];

    return (
        <Modal
            title={`Inventory Counting: ${data?.OpnameNumber || '-'}`}
            open={visible}
            onCancel={onClose}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#888' }}>
                        {data?.Status === 'IN_PROGRESS' && !canApprove && (
                            <span>* Approving counting session requires <code>IPCS.INVENTORY_COUNTING_APPROVE</code> permission</span>
                        )}
                    </div>
                    <Space>
                        <Button onClick={onClose}>Close</Button>
                        {data?.Status === 'IN_PROGRESS' && canApprove && (
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={() => setIsReviewModalVisible(true)}
                            >
                                Review & Approval
                            </Button>
                        )}
                    </Space>
                </div>
            }
            centered
            width={950}
            zIndex={1050}
        >
            <Descriptions size="small" column={4} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Category">
                    <Tag color={data?.Category === 'MATERIAL' ? 'blue' : 'purple'}>
                        {data?.Category ? data.Category.replace('_', ' ') : '-'}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={STATUS_COLORS[data?.Status] || 'default'}>
                        {data?.Status || '-'}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created By">{data?.CreatedByName || data?.CreatedBy || '-'}</Descriptions.Item>
                <Descriptions.Item label="Created At">
                    {data?.CreatedAt ? new Date(data.CreatedAt).toLocaleString('id-ID') : '-'}
                </Descriptions.Item>
            </Descriptions>

            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                    <Card size="small">
                        <Statistic
                            title="Total Items"
                            value={totalItems}
                            prefix={<InboxOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small">
                        <Statistic
                            title="Completed"
                            value={completedItems}
                            styles={{ content: { color: '#3f8600' } }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small">
                        <Statistic
                            title="Progress"
                            suffix="%"
                            value={progressPercent}
                            prefix={<SyncOutlined spin={data?.Status === 'IN_PROGRESS'} />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Edit action bar */}
            {editingKey !== null && (
                <div style={{ marginBottom: 8, padding: 8, background: '#f0f0f0', borderRadius: 4 }}>
                    <Space>
                        <span>Editing row #{editingKey}</span>
                        <Popconfirm
                            title="Save changes?"
                            onConfirm={() => {
                                const record = details.find(d => d.Id === editingKey);
                                if (record) handleSaveEdit(record);
                            }}
                            onCancel={handleCancelEdit}
                            okText="Save"
                            cancelText="Cancel"
                        >
                            <Button type="primary" size="small" icon={<SaveOutlined />} loading={updatingId !== null}>
                                Save
                            </Button>
                        </Popconfirm>
                        <Button size="small" onClick={handleCancelEdit}>
                            Cancel
                        </Button>
                    </Space>
                </div>
            )}

            {locations.length > 1 && (
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    style={{ marginBottom: 8 }}
                    size="small"
                />
            )}

            <div style={{ maxHeight: 'calc(100vh - 340px)', overflow: 'auto' }}>
                <Table
                    columns={columns}
                    dataSource={filteredDetails}
                    rowKey="Id"
                    size="small"
                    loading={loading}
                    pagination={{ pageSize: 50, size: 'small' }}
                    scroll={{ x: 750, y: 400 }}
                />
            </div>

            <ReviewApprovalModal
                visible={isReviewModalVisible}
                onClose={() => setIsReviewModalVisible(false)}
                data={data}
                onSuccess={() => {
                    setIsReviewModalVisible(false);
                    onClose();
                    onRefresh?.();
                }}
            />
        </Modal>
    );
};

export default DetailInventoryCountingModal;
