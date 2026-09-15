/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Table, Tag, Button, Space, Input, Descriptions, Statistic, Card, Row, Col, App, Tabs, Popconfirm } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import {
    updateActualStock,
    fetchInventoryCountingDetails,
    InventoryCountingEntity,
    InventoryCountingDetailEntity,
} from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';
import { InboxOutlined, SaveOutlined, SyncOutlined } from '@ant-design/icons';

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

    const [details, setDetails] = useState<InventoryCountingDetailEntity[]>([]);
    const [editingKey, setEditingKey] = useState<number | null>(null);
    const [editingWarehouse, setEditingWarehouse] = useState<number | null>(null);
    const [editingRack, setEditingRack] = useState<number | null>(null);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [loading, setLoading] = useState(false);

    // Fetch details when modal opens
    useEffect(() => {
        if (visible && data?.Id) {
            const loadDetails = async () => {
                try {
                    setLoading(true);
                    const result = await dispatch(fetchInventoryCountingDetails(data.Id));
                    if (fetchInventoryCountingDetails.fulfilled.match(result)) {
                        const fetchedDetails = Array.isArray(result.payload) ? result.payload : (result.payload as any)?.data || [];

                        // Group by MaterialId/FinishGoodId
                        // API returns 2 rows per material: one with SystemQty (warehouse), one with SystemQtyRack (rack)
                        const materialMap = new Map<string, InventoryCountingDetailEntity>();

                        fetchedDetails.forEach((d: InventoryCountingDetailEntity) => {
                            const key = d.MaterialId || d.FinishGoodId || `unknown_${d.Id}`;

                            if (materialMap.has(key)) {
                                // Merge rack data into existing record
                                const existing = materialMap.get(key)!;
                                // Rack values come from row where SystemQty=0
                                if (d.SystemQty === 0 && d.SystemQtyRack > 0) {
                                    existing.SystemQtyRack = d.SystemQtyRack;
                                    existing.ActualQtyRack = d.ActualQtyRack;
                                    existing.DiffQtyRack = d.DiffQtyRack;
                                }
                                // Warehouse values come from row where SystemQtyRack=0
                                if (d.SystemQtyRack === 0 && d.SystemQty > 0) {
                                    existing.SystemQty = d.SystemQty;
                                    existing.ActualQty = d.ActualQty;
                                    existing.DiffQty = d.DiffQty;
                                    existing.Notes = d.Notes;
                                    existing.Location = d.Location;
                                }
                            } else {
                                materialMap.set(key, { ...d });
                            }
                        });

                        setDetails(Array.from(materialMap.values()));
                    }
                } catch {
                    antMessage.error('Failed to load details');
                } finally {
                    setLoading(false);
                }
            };
            loadDetails();
        }
    }, [visible, data?.Id, dispatch, antMessage]);

    // Get unique locations
    const locations = useMemo(() => {
        const locs = [...new Set(details.map(d => d.Location).filter(Boolean))];
        return locs.sort();
    }, [details]);

    // Filter by location only (data already has 1 row per material with both warehouse & rack)
    const filteredDetails = useMemo(() => {
        if (activeTab === 'all') return details;
        return details.filter(d => d.Location === activeTab);
    }, [details, activeTab]);

    // Completed count: both warehouse and rack actual qty set
    const completedItems = details.filter(d => d.ActualQty !== null && d.ActualQtyRack !== null).length;
    const totalItems = details.length;
    const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const handleStartEditWarehouse = (record: InventoryCountingDetailEntity) => {
        setEditingKey(record.Id);
        setEditingWarehouse(record.ActualQty ?? 0);
        setEditingRack(record.ActualQtyRack ?? 0);
    };

    const handleStartEditRack = (record: InventoryCountingDetailEntity) => {
        setEditingKey(record.Id);
        setEditingWarehouse(record.ActualQty ?? 0);
        setEditingRack(record.ActualQtyRack ?? 0);
    };

    const handleSaveEdit = async (record: InventoryCountingDetailEntity) => {
        const warehouseVal = editingWarehouse ?? record.ActualQty ?? 0;
        const rackVal = editingRack ?? record.ActualQtyRack ?? 0;

        if (warehouseVal < 0 || rackVal < 0) {
            antMessage.error('Qty must be >= 0');
            return;
        }

        try {
            setUpdatingId(record.Id);

            // Update both warehouse and rack in one request
            const result = await dispatch(updateActualStock({
                detailId: record.Id,
                dto: {
                    actualQty: warehouseVal,
                    actualQtyRack: rackVal,
                }
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
                            ActualQtyRack: rackVal,
                            DiffQty: warehouseVal - d.SystemQty,
                            DiffQtyRack: rackVal - d.SystemQtyRack,
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

    const isEditing = (record: InventoryCountingDetailEntity) => editingKey === record.Id;

    const columns = [
        {
            title: 'Material/FG ID',
            key: 'itemId',
            width: 150,
            fixed: 'left' as const,
            render: (_: any, record: InventoryCountingDetailEntity) => (
                <code style={{ fontSize: 11 }}>
                    {record.MaterialId || record.FinishGoodId || '-'}
                </code>
            ),
        },
        {
            title: 'Notes',
            dataIndex: 'Notes',
            key: 'Notes',
            width: 150,
            ellipsis: true,
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
                    render: (val: number | null, record: InventoryCountingDetailEntity) => {
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
                                {val ?? <Tag color="orange">Not Set</Tag>}
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
                        if (val === null) return '-';
                        const color = val > 0 ? 'green' : val < 0 ? 'red' : 'default';
                        return <Tag color={color}>{val > 0 ? '+' : ''}{val}</Tag>;
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
                    render: (val: number | null, record: InventoryCountingDetailEntity) => {
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
                                {val ?? <Tag color="orange">Not Set</Tag>}
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
                        if (val === null) return '-';
                        const color = val > 0 ? 'green' : val < 0 ? 'red' : 'default';
                        return <Tag color={color}>{val > 0 ? '+' : ''}{val}</Tag>;
                    },
                },
            ],
        },
    ];

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
            footer={null}
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
                <Descriptions.Item label="Created By">{data?.CreatedByName || '-'}</Descriptions.Item>
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
        </Modal>
    );
};

export default DetailInventoryCountingModal;
