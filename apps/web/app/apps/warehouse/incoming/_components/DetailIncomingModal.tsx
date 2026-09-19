/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 */
"use client";

import React, { useState } from 'react';
import { Button, Modal, Descriptions, Table, Tooltip, Typography, Space } from 'antd';
import { ArrowRightOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { IncomingEntity, IncomingMaterial } from '@/store/features/warehouse/incoming/incomingSlice';
import MaterialLinkedModal from './LinkedModal/MaterialLinkedModal';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: IncomingEntity;
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
        second: '2-digit',
    });
};

const DetailIncomingModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const [linkedPartNumber, setLinkedPartNumber] = useState<string | null>(null);

    const columns: ColumnsType<IncomingMaterial> = [
        {
            title: '#',
            key: 'index',
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Part Number',
            dataIndex: ['MaterialData', 'PartNumber'],
            key: 'PartNumber',
            render: (val: string) => (
                <Space size={4}>
                    <Tooltip title="View Material details">
                        <Button
                            type="text"
                            size="small"
                            aria-label={`View Material details for ${val}`}
                            icon={<ArrowRightOutlined style={{ color: '#d4a106', fontSize: 12 }} />}
                            onClick={(event) => {
                                event.stopPropagation();
                                setLinkedPartNumber(val);
                            }}
                            style={{ width: 20, minWidth: 20, height: 20, padding: 0 }}
                        />
                    </Tooltip>
                    <Tooltip title={val}><code style={{ fontSize: 11 }}>{val}</code></Tooltip>
                </Space>
            ),
        },
        {
            title: 'Part Name',
            dataIndex: ['MaterialData', 'PartName'],
            key: 'PartName',
        },
        {
            title: 'Qty',
            dataIndex: 'Qty',
            key: 'Qty',
            align: 'right' as const,
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined />
                    <span>Incoming Detail - PO {data.PoId}</span>
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
                <Descriptions.Item label="PO Number">
                    {data.PoId}
                </Descriptions.Item>
                <Descriptions.Item label="Supplier">
                    {data.SupplierData?.Name}
                </Descriptions.Item>
                <Descriptions.Item label="Received By">
                    {data.ReceivedByName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                    {data.Description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                    {formatDT(data.CreatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Created By">
                    {data.CreatedByName || '-'}
                </Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{ marginBottom: 8 }}>
                Materials ({data.IncomingMaterial?.length ?? 0})
            </Typography.Title>
            <Table
                columns={columns}
                dataSource={data.IncomingMaterial ?? []}
                size="small"
                rowKey="Id"
                pagination={false}
                scroll={{ x: 'max-content', y: 300 }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            <MaterialLinkedModal
                open={linkedPartNumber !== null}
                partNumber={linkedPartNumber}
                onClose={() => setLinkedPartNumber(null)}
            />
        </Modal>
    );
};

export default DetailIncomingModal;
