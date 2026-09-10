/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 */
"use client";

import React from 'react';
import { Modal, Descriptions, Table, Tooltip, Typography, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { IncomingEntity, IncomingMaterial } from '@/store/features/warehouse/incoming/incomingSlice';

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
    const columns: ColumnsType<IncomingMaterial> = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Part Number',
            dataIndex: ['MaterialData', 'PartNumber'],
            key: 'PartNumber',
            width: 150,
            render: (val: string) => <Tooltip title={val}><code style={{ fontSize: 11 }}>{val}</code></Tooltip>,
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
            width: 100,
            align: 'right' as const,
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined />
                    <span>Detail Incoming - {data.Id}</span>
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
                <Descriptions.Item label="ID">
                    <code style={{ fontSize: 11 }}>{data.Id}</code>
                </Descriptions.Item>
                <Descriptions.Item label="PO ID">
                    {data.PoId}
                </Descriptions.Item>
                <Descriptions.Item label="Supplier">
                    {data.SupplierData?.Name}
                </Descriptions.Item>
                <Descriptions.Item label="Received By">
                    {data.ReceivedBy}
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                    {data.Description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                    {formatDT(data.CreatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Created By">
                    {data.CreatedBy}
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
                scroll={{ x: 600, y: 300 }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />
        </Modal>
    );
};

export default DetailIncomingModal;