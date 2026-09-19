/*By Irfan Akbari Vuteq Indonesia - 2026-08*/
"use client";

import React from 'react';
import { Modal, Descriptions, Tag, Space, Button } from 'antd';
import { EyeOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { ShoppingEntity } from '@/store/features/production/shopping/shoppingSlice';
import FinishGoodLinkedModal from '@/components/production/FinishGoodLinkedModal';

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

const DetailShoppingModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const [linkedFinishGood, setLinkedFinishGood] = React.useState<string | null>(null);
    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined />
                    <span>Shopping Detail · {data.ForecastId || 'Non-production'}</span>
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
                <Descriptions.Item label="Type">
                    <Tag color={data.Purpose === 'STANDARD' ? 'blue' : 'orange'}>
                        {data.Purpose === 'STANDARD' ? 'REGULAR' : 'NON-PRODUCTION'}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="PO Number">
                    {data.ForecastId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Qty Pick">
                    <strong>{data.QtyPick}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Material" span={2}>
                    {data.MaterialData?.PartNumber} - {data.MaterialData?.PartName}
                </Descriptions.Item>
                {data.ForecastData?.FinishGoodId && (
                    <Descriptions.Item label="Finish Good" span={2}>
                        <Space size={4}>
                            <Button type="text" size="small" aria-label={`View Finish Good ${data.ForecastData.FinishGoodId}`} icon={<ArrowRightOutlined style={{ color: '#d4a106', fontSize: 12 }} />} onClick={() => setLinkedFinishGood(data.ForecastData.FinishGoodId)} style={{ width: 20, minWidth: 20, height: 20, padding: 0 }} />
                            <span>{data.ForecastData.FinishGoodId}</span>
                        </Space>
                    </Descriptions.Item>
                )}
                {data.Destination && <Descriptions.Item label="Destination" span={2}>{data.Destination}</Descriptions.Item>}
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
                    {data.CreatedByName || '-'}
                </Descriptions.Item>
            </Descriptions>
            <FinishGoodLinkedModal open={linkedFinishGood !== null} partNumber={linkedFinishGood} onClose={() => setLinkedFinishGood(null)} />
        </Modal>
    );
};

export default DetailShoppingModal;
