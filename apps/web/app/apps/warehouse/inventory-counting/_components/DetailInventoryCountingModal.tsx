/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-09-16 */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Table, Tag, Button, Space, Input, Descriptions, Progress, App, Select, InputNumber } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    updateActualStock,
    fetchInventoryCountingDetails,
    generateTemporaryReport,
    InventoryCountingEntity,
    InventoryCountingDetailEntity,
} from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';
import { SaveOutlined, CheckCircleOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
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
    const [editedValues, setEditedValues] = useState<Record<number, { wh?: number, rack?: number }>>({});
    const [updating, setUpdating] = useState(false);
    
    // Filters
    const [searchText, setSearchText] = useState('');
    const [locationFilter, setLocationFilter] = useState('all');

    const [loading, setLoading] = useState(false);
    const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
    
    // Tolerance state
    const [tolerance, setTolerance] = useState<number>(5);
    const [downloadingTemp, setDownloadingTemp] = useState(false);

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
                    setEditedValues({});
                    const result = await dispatch(fetchInventoryCountingDetails(data.Id));
                    if (fetchInventoryCountingDetails.fulfilled.match(result)) {
                        const fetchedDetails = Array.isArray(result.payload) ? result.payload : (result.payload as any)?.data || [];

                        if (data.Category === 'MATERIAL') {
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

    // Get unique locations for dropdown
    const locations = useMemo(() => {
        const locs = [...new Set(details.map(d => d.Location).filter(Boolean))];
        return locs.sort();
    }, [details]);

    // Apply filters
    const filteredDetails = useMemo(() => {
        return details.filter(d => {
            const matchLoc = locationFilter === 'all' || d.Location === locationFilter;
            const searchStr = searchText.toLowerCase();
            const matchSearch = searchStr.length < 1 || 
                (d.MaterialId?.toLowerCase().includes(searchStr)) || 
                (d.FinishGoodId?.toLowerCase().includes(searchStr)) || 
                (d.Notes?.toLowerCase().includes(searchStr));
            return matchLoc && matchSearch;
        });
    }, [details, locationFilter, searchText]);

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

    const handleActualChange = (recordId: number, type: 'wh' | 'rack', val: number | null) => {
        setEditedValues(prev => ({
            ...prev,
            [recordId]: {
                ...prev[recordId],
                [type]: val
            }
        }));
    };

    const handleSavePageChanges = async () => {
        const keys = Object.keys(editedValues).map(Number);
        if (keys.length === 0) {
            antMessage.info('No changes to save');
            return;
        }

        setUpdating(true);
        try {
            const promises = keys.map(async (recordId) => {
                const record = details.find(d => d.Id === recordId);
                if (!record) return;

                const edits = editedValues[recordId];
                const warehouseVal = edits.wh !== undefined ? edits.wh : (record.ActualQty ?? 0);
                const rackVal = edits.rack !== undefined ? edits.rack : (record.ActualQtyRack ?? 0);

                if (warehouseVal < 0 || (data?.Category === 'MATERIAL' && rackVal < 0)) {
                    throw new Error('Qty must be >= 0');
                }

                const detailIdToUpdate = record.warehouseDetailId || record.rackDetailId || record.Id;
                const dto = data?.Category === 'MATERIAL'
                    ? { actualQty: warehouseVal, actualQtyRack: rackVal }
                    : { actualQty: warehouseVal };

                const result = await dispatch(updateActualStock({
                    detailId: detailIdToUpdate,
                    dto,
                }));

                if (updateActualStock.rejected.match(result)) {
                    throw new Error((result.payload as string) || 'Failed to update stock');
                }

                // Update local state for success
                setDetails(prev => prev.map(d => d.Id === recordId ? {
                    ...d,
                    ActualQty: warehouseVal,
                    ActualQtyRack: data?.Category === 'MATERIAL' ? rackVal : null,
                    DiffQty: warehouseVal - d.SystemQty,
                    DiffQtyRack: data?.Category === 'MATERIAL' ? rackVal - d.SystemQtyRack : null,
                } : d));
            });

            await Promise.all(promises);
            antMessage.success('Page changes saved successfully');
            setEditedValues({});
            onRefresh?.();
        } catch (error: any) {
            antMessage.error(error?.message || 'Failed to save some changes');
        } finally {
            setUpdating(false);
        }
    };

    const handleDownloadTempReport = async () => {
        setDownloadingTemp(true);
        try {
            const result = await dispatch(generateTemporaryReport({ inventoryCountingId: data.Id, tolerance }));
            if (generateTemporaryReport.rejected.match(result)) {
                throw new Error(result.payload as string);
            }
            antMessage.success('Temporary report downloaded');
        } catch (error: any) {
            antMessage.error(error?.message || 'Failed to download temporary report');
        } finally {
            setDownloadingTemp(false);
        }
    };

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
                        if (data?.Status !== 'IN_PROGRESS') return val ?? '-';
                        const editVal = editedValues[record.Id]?.wh;
                        return (
                            <InputNumber
                                value={editVal !== undefined ? editVal : (val ?? 0)}
                                onChange={(v) => handleActualChange(record.Id, 'wh', v)}
                                style={{ width: 80 }}
                                min={0}
                            />
                        );
                    },
                },
                {
                    title: 'Diff Qty',
                    dataIndex: 'DiffQty',
                    key: 'DiffQty',
                    width: 100,
                    align: 'center' as const,
                    render: (val: number | null, record: MergedCountingDetail) => {
                        let displayVal = val;
                        const editVal = editedValues[record.Id]?.wh;
                        if (editVal !== undefined && editVal !== null) {
                            displayVal = editVal - record.SystemQty;
                        }
                        if (displayVal === null || displayVal === undefined) return '-';
                        const color = displayVal > 0 ? 'green' : displayVal < 0 ? 'red' : 'default';
                        return <Tag color={color}>{displayVal > 0 ? `+${displayVal}` : displayVal}</Tag>;
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
                            if (data?.Status !== 'IN_PROGRESS') return val ?? '-';
                            const editVal = editedValues[record.Id]?.wh;
                            return (
                                <InputNumber
                                    value={editVal !== undefined ? editVal : val}
                                    onChange={(v) => handleActualChange(record.Id, 'wh', v)}
                                    style={{ width: 80 }}
                                    min={0}
                                />
                            );
                        },
                    },
                    {
                        title: 'Diff',
                        dataIndex: 'DiffQty',
                        key: 'DiffQty',
                        width: 70,
                        align: 'center' as const,
                        render: (val: number | null, record: MergedCountingDetail) => {
                            let displayVal = val;
                            const editVal = editedValues[record.Id]?.wh;
                            if (editVal !== undefined && editVal !== null) {
                                displayVal = editVal - record.SystemQty;
                            }
                            if (displayVal === null || displayVal === undefined) return '-';
                            const color = displayVal > 0 ? 'green' : displayVal < 0 ? 'red' : 'default';
                            return <Tag color={color}>{displayVal > 0 ? `+${displayVal}` : displayVal}</Tag>;
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
                            if (data?.Status !== 'IN_PROGRESS') return val ?? '-';
                            const editVal = editedValues[record.Id]?.rack;
                            return (
                                <InputNumber
                                    value={editVal !== undefined ? editVal : val}
                                    onChange={(v) => handleActualChange(record.Id, 'rack', v)}
                                    style={{ width: 80 }}
                                    min={0}
                                />
                            );
                        },
                    },
                    {
                        title: 'Diff',
                        dataIndex: 'DiffQtyRack',
                        key: 'DiffQtyRack',
                        width: 70,
                        align: 'center' as const,
                        render: (val: number | null, record: MergedCountingDetail) => {
                            let displayVal = val;
                            const editVal = editedValues[record.Id]?.rack;
                            if (editVal !== undefined && editVal !== null) {
                                displayVal = editVal - (record.SystemQtyRack ?? 0);
                            }
                            if (displayVal === null || displayVal === undefined) return '-';
                            const color = displayVal > 0 ? 'green' : displayVal < 0 ? 'red' : 'default';
                            return <Tag color={color}>{displayVal > 0 ? `+${displayVal}` : displayVal}</Tag>;
                        },
                    },
                ],
            },
        ];
    }, [data?.Category, data?.Status, editedValues]);

    return (
        <Modal
            title={`Inventory Counting: ${data?.OpnameNumber || '-'}`}
            open={visible}
            onCancel={onClose}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {!canApprove && (
                            <span>* Approving counting session requires <code>IPCS.INVENTORY_COUNTING_APPROVE</code> permission</span>
                        )}
                        <Space>
                            <span style={{ marginLeft: 16 }}>Tolerance %:</span>
                            <InputNumber 
                                min={0} 
                                max={100} 
                                value={tolerance} 
                                onChange={(v) => setTolerance(v || 0)} 
                                style={{ width: 60 }} 
                            />
                            <Button 
                                type="dashed" 
                                icon={<DownloadOutlined />} 
                                onClick={handleDownloadTempReport}
                                loading={downloadingTemp}
                            >
                                Download Temporary Report
                            </Button>
                        </Space>
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
            width={1100}
            zIndex={1050}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Descriptions size="small" column={4} style={{ flex: 1 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#888' }}>Progress</div>
                        <div style={{ fontSize: 14, fontWeight: 'bold' }}>{completedItems} / {totalItems} Items</div>
                    </div>
                    <Progress type="circle" percent={progressPercent} size={40} />
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                <Space>
                    <Input
                        placeholder="Search part..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        prefix={<SearchOutlined />}
                        style={{ width: 200 }}
                        allowClear
                    />
                    {locations.length > 1 && (
                        <Select
                            value={locationFilter}
                            onChange={setLocationFilter}
                            style={{ width: 120 }}
                            options={[
                                { value: 'all', label: 'All Locations' },
                                ...locations.map(l => ({ value: l, label: l }))
                            ]}
                        />
                    )}
                </Space>
                {data?.Status === 'IN_PROGRESS' && (
                    <Button 
                        type="primary" 
                        icon={<SaveOutlined />} 
                        onClick={handleSavePageChanges}
                        loading={updating}
                        disabled={Object.keys(editedValues).length === 0}
                    >
                        Apply / Save Changes in Page
                    </Button>
                )}
            </div>

            <div style={{ maxHeight: 'calc(100vh - 340px)', overflow: 'auto' }}>
                <Table
                    columns={columns}
                    dataSource={filteredDetails}
                    rowKey="Id"
                    size="small"
                    loading={loading || updating}
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
