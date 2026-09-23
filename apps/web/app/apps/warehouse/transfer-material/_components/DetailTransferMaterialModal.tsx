/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, {useState, useEffect} from 'react';
import {Alert, Modal, Table, Tag, Button, Space, Descriptions, Statistic, Card, Row, Col, App, InputNumber} from 'antd';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {
    pickTransferMaterial,
    TransferMaterialEntity,
    TransferMaterialDetailEntity,
    PickMaterialDto,
    deleteTransferMaterial,
} from '@/store/features/warehouse/transferMaterial/transferMaterialSlice';
import {SaveOutlined, SyncOutlined, ScissorOutlined, DeleteOutlined} from '@ant-design/icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: TransferMaterialEntity;
    onRefresh?: () => void;
    onDeleted: () => void;
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'default',
    SHIPPED: 'processing',
    RECEIVED: 'success',
    CANCELLED: 'error',
};

const DetailTransferMaterialModal: React.FC<Props> = ({visible, onClose, data, onRefresh, onDeleted}) => {
    const {message: antMessage, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {user} = useSelector((state: RootState) => state.auth);

    const [isPickingMode, setIsPickingMode] = useState(false);
    const [localDetails, setLocalDetails] = useState<TransferMaterialDetailEntity[]>([]);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState<number>(0);
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const can = (permission: string) => Boolean(
        user?.RoleName === 'SUPER' ||
        user?.GlobalRoles?.includes('SUPER_ADMINISTRATOR') ||
        user?.Permission?.some((value) => value === 'SUPER' || value === '*' || value === permission)
    );
    const canUpdate = can('IPCS.TRANSFER_MATERIAL_UPDATE');
    const canDelete = can('IPCS.TRANSFER_MATERIAL_DELETE');

    const handleDelete = () => {
        if (data.Status !== 'DRAFT' || !canDelete || deleting) return;
        modal.confirm({
            title: 'Delete Transfer Material?',
            icon: <DeleteOutlined/>,
            content: `Delete delivery note ${data.DeliveryNoteNum}?`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            onOk: async () => {
                setDeleting(true);
                try {
                    await dispatch(deleteTransferMaterial(data.Id)).unwrap();
                    antMessage.success('Transfer material deleted successfully');
                    onDeleted();
                } catch (error: unknown) {
                    antMessage.error(typeof error === 'string' ? error : 'Failed to delete transfer material');
                    throw error;
                } finally {
                    setDeleting(false);
                }
            },
        });
    };

    // Sync local details when data changes
    useEffect(() => {
        if (data?.Details) {
            setLocalDetails(data.Details);
        }
    }, [data?.Details]);

    const handleStartEdit = (materialId: string) => {
        const record = localDetails.find(d => d.MaterialId === materialId);
        if (record) {
            setEditingKey(materialId);
            setEditingValue(record.QtyPicking || record.QtyRequested);
        }
    };

    const handleSaveEdit = async (materialId: string) => {
        if (editingValue < 0) {
            antMessage.error('Qty must be >= 0');
            return;
        }

        try {
            setUpdatingKey(materialId);
            const dto: PickMaterialDto = {
                items: [{
                    materialId: materialId,
                    qtyPicking: editingValue,
                }],
            };
            const result = await dispatch(pickTransferMaterial({id: data.Id, dto}));
            if (pickTransferMaterial.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update picking qty');
            }
            antMessage.success('Picking qty updated successfully');

            // Update local state immediately
            setLocalDetails(prev =>
                prev.map(d =>
                    d.MaterialId === materialId ? {...d, QtyPicking: editingValue} : d
                )
            );

            setEditingKey(null);
            setEditingValue(0);
            onRefresh?.();
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Failed to update picking qty';
            antMessage.error(errMsg);
        } finally {
            setUpdatingKey(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingKey(null);
        setEditingValue(0);
    };

    const handleStartPickingMode = () => {
        setIsPickingMode(true);
    };

    const handleCancelPickingMode = () => {
        setIsPickingMode(false);
        setEditingKey(null);
        setEditingValue(0);
    };

    const handleSaveAllPicking = async () => {
        const pickingItems = localDetails.filter(d => d.QtyPicking > 0);

        if (pickingItems.length === 0) {
            antMessage.warning('No items picked yet');
            return;
        }

        try {
            const dto: PickMaterialDto = {
                items: pickingItems.map(item => ({
                    materialId: item.MaterialId,
                    qtyPicking: item.QtyPicking,
                })),
            };
            const result = await dispatch(pickTransferMaterial({id: data.Id, dto}));
            if (pickTransferMaterial.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to save picking');
            }
            antMessage.success('Picking saved successfully');
            setIsPickingMode(false);
            setEditingKey(null);
            onRefresh?.();
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Failed to save picking';
            antMessage.error(errMsg);
        }
    };

    const pickedCount = localDetails.filter(d => d.QtyPicking > 0).length;
    const receivedCount = localDetails.filter(d => d.QtyReceived !== null).length;
    const isDraft = data?.Status === 'DRAFT';

    const columns = [
        {
            title: 'Material',
            key: 'transfer-material-col',
            render: (_: unknown, record: TransferMaterialDetailEntity) => (
                <div key={`material-${record.MaterialId}`}>
                    <code style={{fontSize: 11}}>{record.MaterialId}</code>
                    <div style={{fontSize: 10, color: '#666'}}>
                        {record.MaterialData?.PartName || '-'}
                    </div>
                </div>
            ),
        },
        {
            title: 'Finish Good Part',
            dataIndex: 'FinishGoodPartTemp',
            key: 'transfer-finish-good-part-col',
            render: (value: string | null) => value || '-',
        },
        {
            title: 'Qty Requested',
            dataIndex: 'QtyRequested',
            key: 'transfer-qty-requested-col',
            align: 'center' as const,
        },
        {
            title: 'Qty Picking',
            dataIndex: 'QtyPicking',
            key: 'transfer-qty-picking-col',
            align: 'center' as const,
            render: (val: number, record: TransferMaterialDetailEntity) => {
                const isEditing = editingKey === record.MaterialId;
                if (!isPickingMode) {
                    return val > 0 ? val : <Tag color="orange">Not Set</Tag>;
                }
                if (isEditing) {
                    return (
                        <InputNumber
                            min={0}
                            max={record.MaterialData?.QtyWarehouse || 9999}
                            value={editingValue}
                            onChange={(value) => setEditingValue(value || 0)}
                            style={{width: 80}}
                        />
                    );
                }
                return (
                    <a onClick={() => handleStartEdit(record.MaterialId)} style={{cursor: 'pointer'}}>
                        {val > 0 ? val : <Tag color="orange">Not Set</Tag>}
                    </a>
                );
            },
        },
        {
            title: 'Qty Received',
            dataIndex: 'QtyReceived',
            key: 'transfer-qty-received-col',
            align: 'center' as const,
            render: (val: number | null) => val !== null ? val : '-',
        },
        {
            title: 'Action',
            key: 'transfer-action-col',
            render: (_: unknown, record: TransferMaterialDetailEntity) => {
                if (!isPickingMode) return null;
                if (editingKey !== record.MaterialId) {
                    return (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => handleStartEdit(record.MaterialId)}
                        >
                            Edit
                        </Button>
                    );
                }
                return (
                    <Space size="small">
                        <Button
                            type="primary"
                            size="small"
                            icon={<SaveOutlined/>}
                            loading={updatingKey === record.MaterialId}
                            onClick={() => handleSaveEdit(record.MaterialId)}
                        >
                            Save
                        </Button>
                        <Button
                            size="small"
                            onClick={handleCancelEdit}
                        >
                            Cancel
                        </Button>
                    </Space>
                );
            },
        },
    ];

    return (
        <Modal
            title={`Transfer Material: ${data?.DeliveryNoteNum || '-'}`}
            open={visible}
            onCancel={onClose}
            footer={
                <Space>
                    {isDraft && canDelete && (
                        <Button danger icon={<DeleteOutlined/>} onClick={handleDelete} loading={deleting}>
                            Delete
                        </Button>
                    )}
                    <Button onClick={onClose}>Close</Button>
                </Space>
            }
            centered
            width={900}
            zIndex={1050}
        >
            <Descriptions size="small" column={4} style={{marginBottom: 16}}>
                <Descriptions.Item label="Destination">
                    {data?.Destination || '-'}
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

            <Row gutter={16} style={{marginBottom: 16}}>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Total Items"
                            value={localDetails.length}
                            prefix={<SyncOutlined/>}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Picked"
                            value={pickedCount}
                            styles={{content: {color: '#3f8600'}}}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Received"
                            value={receivedCount}
                            styles={{content: {color: '#1890ff'}}}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                            {!isPickingMode ? (
                                <Button
                                    type="primary"
                                    icon={<ScissorOutlined/>}
                                    onClick={handleStartPickingMode}
                                    disabled={!isDraft || !canUpdate}
                                >
                                    Start Picking
                                </Button>
                            ) : (
                                <Space>
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined/>}
                                        onClick={handleSaveAllPicking}
                                        loading={updatingKey !== null}
                                    >
                                        Save All
                                    </Button>
                                    <Button onClick={handleCancelPickingMode}>
                                        Cancel
                                    </Button>
                                </Space>
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>

            {data?.Notes && (
                <div style={{marginBottom: 16, padding: 8, background: '#f5f5f5', borderRadius: 4}}>
                    <strong>Notes:</strong> {data.Notes}
                </div>
            )}

            {isPickingMode && (
                <Alert
                    type="info"
                    showIcon
                    title="Picking Mode"
                    description="Click Edit to change picking quantity per item, then Save All. Picking is unavailable while material Inventory Counting is active."
                    style={{marginBottom: 8}}
                />
            )}

            <Table
                columns={columns}
                dataSource={localDetails}
                rowKey="MaterialId"
                size="small"
                pagination={{pageSize: 20}}
                scroll={{x: 'max-content', y: 400}}
                style={{maxHeight: 450}}
            />
        </Modal>
    );
};

export default DetailTransferMaterialModal;
