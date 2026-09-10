/*By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-06-16*/
"use client";

import React, { useEffect } from 'react';
import { Modal, Descriptions, Tag, Space, Table, Progress, Typography, Button, Popconfirm, App } from 'antd';
import { EyeOutlined, PaperClipOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { ProductionReleaseEntity, fetchAttachments, deleteAttachment } from '@/store/features/production/productionRelease/productionReleaseSlice';

const { Title, Text } = Typography;

interface Props {
    visible: boolean;
    onClose: () => void;
    data: ProductionReleaseEntity;
}

const formatDT = (val: string | null | undefined) => {
    if (!val) return '-';
    return new Date(val).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'warning',
    IN_PROGRESS: 'processing',
    COMPLETED: 'success',
    CANCELLED: 'error',
};

const DetailProductionReleaseModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { message, modal } = App.useApp();
    const { attachments, attachmentLoading } = useSelector((state: RootState) => state.productionRelease);

    useEffect(() => {
        if (visible && data.Id) {
            dispatch(fetchAttachments(data.Id));
        }
    }, [visible, data.Id, dispatch]);

    const handleDeleteAttachment = (attachmentId: number, fileName: string) => {
        modal.confirm({
            title: 'Delete Attachment?',
            icon: <DeleteOutlined />,
            content: `Delete attachment "${fileName}"?`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            centered: true,
            onOk: async () => {
                try {
                    const result = await dispatch(deleteAttachment(attachmentId));

                    if (deleteAttachment.rejected.match(result)) {
                        throw new Error((result.payload as string) || 'Failed to delete attachment');
                    }
                    message.success('Attachment deleted successfully');
                    dispatch(fetchAttachments(data.Id));
                } catch (error: unknown) {
                    const err = error as Error;
                    message.error(err?.message || 'Failed to delete attachment');
                }
            },
        });
    };

    const forecastColumns = [
        {
            title: 'PO ID',
            dataIndex: 'PoId',
            key: 'PoId',
            width: 130,
            render: (val: string) => <code style={{ fontSize: 10 }}>{val}</code>,
        },
        {
            title: 'Part Number',
            key: 'PartNumber',
            width: 110,
            render: (_: any, record: any) => record.PartData?.PartNumber || '-',
        },
        {
            title: 'Part Name',
            key: 'PartName',
            ellipsis: true,
            render: (_: any, record: any) => record.PartData?.PartName || '-',
        },
        // {
        //     title: 'Qty',
        //     dataIndex: 'Qty',
        //     key: 'Qty',
        //     width: 60,
        //     align: 'right' as const,
        // },
        {
            title: 'Picked Material',
            key: 'Picked',
            width: 120,
            align: 'right' as const,
            render: (_: any, record: any) => {
                const totalPicked = record.Shopping?.reduce((sum: number, s: any) => sum + s.QtyPick, 0) || 0;
                return <Text type={totalPicked > 0 ? 'success' : 'warning'}>{totalPicked} Pcs</Text>;
            },
        },
        {
            title: 'Delivery Date',
            dataIndex: 'DeliveryDate',
            key: 'DeliveryDate',
            width: 100,
            render: (val: string) => val ? new Date(val).toLocaleDateString('id-ID') : '-',
        },
    ];

    const attachmentColumns = [
        {
            title: 'File Name',
            dataIndex: 'FileName',
            key: 'FileName',
            ellipsis: true,
            render: (val: string) => (
                <Space>
                    <PaperClipOutlined />
                    <span style={{ fontSize: 11 }}>{val}</span>
                </Space>
            ),
        },
        {
            title: 'Size',
            dataIndex: 'FileSize',
            key: 'FileSize',
            width: 70,
            align: 'right' as const,
            render: (val: any) => {
                const size = Number(val) || 0;
                if (size < 1024) return `${size} B`;
                if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
                return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            },
        },
        {
            title: 'Action',
            key: 'action',
            width: 100,
            align: 'center' as const,
            render: (_: any, record: { id: number; FileName: string; FilePath: string; FileSize?: number }) => (
                <Space size="small">
                    <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => window.open(record.FilePath, '_blank')}
                        title="Download"
                    />
                    <Popconfirm
                        title="Delete Attachment?"
                        description={`Delete "${record.FileName}"?`}
                        onConfirm={() => handleDeleteAttachment(record.id, record.FileName)}
                        okText="Delete"
                        okType="danger"
                        cancelText="Cancel"
                    >
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            title="Delete"
                        />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined />
                    <span>Detail Production Release - {data.ReleaseNumber}</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            centered={true}
            width={1300}
            destroyOnHidden
            zIndex={1050}
        >
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Release Number">
                    <code style={{ fontSize: 11 }}>{data.ReleaseNumber}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={STATUS_COLORS[data.Status] || 'default'}>{data.Status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Plan Date">
                    {formatDT(data.PlanDate)}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                    {formatDT(data.CreatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Target Qty">
                    <strong>{data.TotalTargetQty || 0}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Good Qty">
                    <Text type="success"><strong>{data.TotalGoodQty || 0}</strong></Text>
                </Descriptions.Item>
                <Descriptions.Item label="NG Qty">
                    <Text type="danger"><strong>{data.TotalNgQty || 0}</strong></Text>
                </Descriptions.Item>
                <Descriptions.Item label="Forecasts Count">
                    {data._count?.Forecasts || data.Forecasts?.length || 0}
                </Descriptions.Item>
                <Descriptions.Item label="Created By" span={2}>
                    {data.CreatedBy}
                </Descriptions.Item>
                <Descriptions.Item label="Notes" span={2}>
                    {data.Notes || '-'}
                </Descriptions.Item>
            </Descriptions>

            {/* Progress Section */}
            {(data.progressShopping || data.progressDelivery || data.progressPokayoke) && (
                <div style={{ marginBottom: 16 }}>
                    <Title level={5} style={{ marginBottom: 8 }}>Progress</Title>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        {data.progressShopping && (
                            <div key="progress-shopping" style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                                <Text strong>Shopping Progress</Text>
                                <Progress
                                    percent={data.progressShopping.percentage}
                                    status={data.progressShopping.percentage === 100 ? 'success' : 'active'}
                                    style={{ marginTop: 8 }}
                                />
                                <div style={{ marginTop: 8, fontSize: 11 }}>
                                    <div>Picked: <strong>{data.progressShopping.totalPicked}</strong> / Target: <strong>{data.progressShopping.totalTarget}</strong></div>
                                </div>
                            </div>
                        )}
                        {data.progressPokayoke && (
                            <div key="progress-pokayoke" style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                                <Text strong>Pokayoke Progress</Text>
                                <Progress
                                    percent={data.progressPokayoke.percentage}
                                    status={data.progressPokayoke.percentage === 100 ? 'success' : 'active'}
                                    style={{ marginTop: 8 }}
                                />
                                <div style={{ marginTop: 8, fontSize: 11 }}>
                                    <div>Scanned: <strong>{data.progressPokayoke.scanned}</strong> / Total: <strong>{data.progressPokayoke.total}</strong></div>
                                    <div>Pending: {data.progressPokayoke.pending}</div>
                                </div>
                            </div>
                        )}
                        {data.progressDelivery && (
                            <div key="progress-delivery" style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                                <Text strong>Delivery Progress</Text>
                                <Progress
                                    percent={data.progressDelivery.percentage}
                                    status={data.progressDelivery.percentage === 100 ? 'success' : 'active'}
                                    style={{ marginTop: 8 }}
                                />
                                <div style={{ marginTop: 8, fontSize: 11 }}>
                                    <div>Scanned: <strong>{data.progressDelivery.scanned}</strong> / Total: <strong>{data.progressDelivery.total}</strong></div>
                                    <div>Pending: {data.progressDelivery.pending}</div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Two Column Layout: Forecasts and Attachments */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Left: Forecasts Table */}
                <div style={{ overflow: 'hidden' }}>
                    <Table
                        title={() => <strong key="forecasts-title">Forecasts ({data.Forecasts?.length || 0})</strong>}
                        columns={forecastColumns}
                        dataSource={data.Forecasts || []}
                        size="small"
                        rowKey={(record) => record.PoId}
                        pagination={false}
                        scroll={{ x: 'max-content', y: 250 }}
                        className="small-table"
                        style={{ fontSize: '11px' }}
                    />
                </div>

                {/* Right: Attachments Table */}
                <div style={{ overflow: 'hidden' }}>
                    <Table
                        title={() => (
                            <Space key="attachments-title">
                                <PaperClipOutlined />
                                <strong>Attachments ({attachments.length || 0})</strong>
                            </Space>
                        )}
                        columns={attachmentColumns}
                        dataSource={attachments}
                        size="small"
                        rowKey={(record) => String(record.id)}
                        pagination={false}
                        loading={attachmentLoading}
                        scroll={{ x: 'max-content', y: 250 }}
                        className="small-table"
                        style={{ fontSize: '11px' }}
                        locale={{ emptyText: 'No attachments yet' }}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default DetailProductionReleaseModal;
