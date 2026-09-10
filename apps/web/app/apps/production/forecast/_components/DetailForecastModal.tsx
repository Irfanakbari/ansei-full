/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Tag, Space, Progress, Table, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { ForecastEntity } from '@/store/features/production/forecast/forecastSlice';
import {fetchShoppingStatus, ShoppingStatusResponse} from "@/store/features/production/shopping/shoppingSlice";

const { Title, Text } = Typography;

interface Props {
    visible: boolean;
    onClose: () => void;
    data: ForecastEntity;
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
    RELEASED: 'processing',
    COMPLETED: 'success',
    CANCELLED: 'error',
    DRAFT: 'default',
};

const DetailForecastModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const dispatch = useDispatch<AppDispatch>();
    const [shoppingStatus, setShoppingStatus] = useState<ShoppingStatusResponse | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);

    useEffect(() => {
        if (visible && data.ProductionReleaseId) {
            setLoadingStatus(true);
            dispatch(fetchShoppingStatus(data.PoId))
                .then((result: any) => {
                    if (fetchShoppingStatus.rejected.match(result)) {
                        throw new Error((result.payload as string) || 'Failed to fetch shopping status');
                    }
                    setShoppingStatus(result.payload as ShoppingStatusResponse);
                })
                .catch(() => {
                    setShoppingStatus(null);
                })
                .finally(() => {
                    setLoadingStatus(false);
                });
        } else {
            setShoppingStatus(null);
        }
    }, [visible, data.PoId, data.ProductionReleaseId, dispatch]);

    const derivedStatus = data.ProductionReleaseId ? 'RELEASED' : 'DRAFT';

    const bomColumns = [
        {
            title: 'Material',
            key: 'material',
            render: (_: any, record: ShoppingStatusResponse['bomSummary'][0]) => (
                <span>
                    <code style={{ fontSize: 10 }}>{record.materialId}</code> - {record.materialName}
                </span>
            ),
        },
        {
            title: 'BOM Qty/Unit',
            dataIndex: 'bomQtyPerUnit',
            key: 'bomQtyPerUnit',
            width: 100,
            align: 'right' as const,
        },
        {
            title: 'Required',
            dataIndex: 'totalRequired',
            key: 'totalRequired',
            width: 80,
            align: 'right' as const,
        },
        {
            title: 'Picked',
            dataIndex: 'alreadyPicked',
            key: 'alreadyPicked',
            width: 80,
            align: 'right' as const,
        },
        {
            title: 'Remaining',
            dataIndex: 'remainingToPick',
            key: 'remainingToPick',
            width: 80,
            align: 'right' as const,
            render: (val: number, record: ShoppingStatusResponse['bomSummary'][0]) => (
                <Text type={record.isCompleted ? 'success' : 'warning'} strong={!record.isCompleted}>
                    {val}
                </Text>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'isCompleted',
            key: 'isCompleted',
            width: 80,
            align: 'center' as const,
            render: (val: boolean) => (
                <Tag color={val ? 'success' : 'warning'}>{val ? 'Done' : 'Pending'}</Tag>
            ),
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined />
                    <span>Detail Forecast - {data.PoId}</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            centered={true}
            width={900}
            destroyOnHidden
            zIndex={1050}
        >
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="PO ID">
                    <code style={{ fontSize: 11 }}>{data.PoId}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={STATUS_COLORS[derivedStatus] || 'default'}>{derivedStatus}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Finish Good">
                    {data.PartData?.PartNumber} - {data.PartData?.PartName}
                </Descriptions.Item>
                <Descriptions.Item label="Qty">
                    <strong>{data.Qty}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Vendor Code">
                    {data.VendorCode}
                </Descriptions.Item>
                <Descriptions.Item label="Vendor Name">
                    {data.VendorName}
                </Descriptions.Item>
                <Descriptions.Item label="Receiving Area">
                    {data.ReceivingArea}
                </Descriptions.Item>
                <Descriptions.Item label="Classification">
                    {data.Classification}
                </Descriptions.Item>
                <Descriptions.Item label="PO Number">
                    {data.PoNumber}
                </Descriptions.Item>
                <Descriptions.Item label="Item">
                    {data.Item}
                </Descriptions.Item>
                <Descriptions.Item label="Date">
                    {formatDT(data.Date)}
                </Descriptions.Item>
                <Descriptions.Item label="Delivery Date">
                    {formatDT(data.DeliveryDate)}
                </Descriptions.Item>
                <Descriptions.Item label="Delivery Period">
                    {data.DeliveryPeriod}
                </Descriptions.Item>
                <Descriptions.Item label="Production Release">
                    {data.ProductionReleaseId || '-'}
                </Descriptions.Item>
            </Descriptions>

            {data.ProductionReleaseId && shoppingStatus && (
                <>
                    <Title level={5} style={{ marginBottom: 8 }}>Shopping Status</Title>
                    <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="Status" span={2}>
                            <Tag color={STATUS_COLORS[shoppingStatus.status] || 'default'}>
                                {shoppingStatus.status}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Forecast Qty">
                            {shoppingStatus.forecastQty}
                        </Descriptions.Item>
                    </Descriptions>

                    <div style={{ marginBottom: 8 }}>
                        <Text strong>Progress: </Text>
                        <Text>{shoppingStatus.progress.completedMaterials}/{shoppingStatus.progress.totalMaterials} materials completed</Text>
                        <Progress
                            percent={shoppingStatus.progress.totalPickedPercent}
                            size="small"
                            status={shoppingStatus.progress.completedMaterials === shoppingStatus.progress.totalMaterials ? 'success' : 'active'}
                            style={{ marginTop: 4 }}
                        />
                    </div>

                    <Table
                        title={() => <strong>BOM Summary ({shoppingStatus.bomSummary.length})</strong>}
                        columns={bomColumns}
                        dataSource={shoppingStatus.bomSummary}
                        size="small"
                        rowKey="materialId"
                        pagination={false}
                        loading={loadingStatus}
                        scroll={{ x: 700 }}
                        className="small-table"
                        style={{ fontSize: '11px' }}
                    />
                </>
            )}

            {data.ProductionReleaseId && loadingStatus && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                    Loading shopping status...
                </div>
            )}
        </Modal>
    );
};

export default DetailForecastModal;