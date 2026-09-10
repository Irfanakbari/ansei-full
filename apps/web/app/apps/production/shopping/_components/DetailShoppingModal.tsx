/*By Irfan Akbari Vuteq Indonesia - 2026-08*/
"use client";

import React from 'react';
import { Modal, Descriptions, Tag, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { ShoppingEntity } from '@/store/features/production/shopping/shoppingSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: ShoppingEntity;
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

const TYPE_COLORS: Record<string, string> = {
    REGULER: 'blue',
    ADDITIONAL: 'orange',
};

const DetailShoppingModal: React.FC<Props> = ({ visible, onClose, data }) => {
    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined />
                    <span>Detail Shopping - {data.Id}</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            centered={true}
            width={700}
            destroyOnHidden
            zIndex={1050}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="ID">
                    <code style={{ fontSize: 11 }}>{data.Id}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                    <Tag color={TYPE_COLORS[data.Type] || 'default'}>{data.Type}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Forecast ID">
                    <code style={{ fontSize: 11 }}>{data.ForecastId}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Qty Pick">
                    <strong>{data.QtyPick}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Material" span={2}>
                    {data.MaterialData?.PartNumber} - {data.MaterialData?.PartName}
                </Descriptions.Item>
                <Descriptions.Item label="Rack Qty">
                    {data.MaterialData?.QtyRack}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                    {formatDT(data.CreatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                    {data.Description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Created By">
                    {data.CreatedBy}
                </Descriptions.Item>
            </Descriptions>
        </Modal>
    );
};

export default DetailShoppingModal;
