/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState } from 'react';
import { Modal, Upload, App, Button, Space, Typography } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { importForecast } from '@/store/features/production/forecast/forecastSlice';

const { Text } = Typography;

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const ImportForecastModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [loading, setLoading] = useState(false);

    const handleUpload = async () => {
        if (fileList.length === 0) {
            message.warning('Please select Excel file first');
            return;
        }

        const file = fileList[0].originFileObj;
        if (!file) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const result = await dispatch(importForecast(formData));
            if (importForecast.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to import forecast');
            }
            message.success('Forecast imported successfully');
            setFileList([]);
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            message.error(err?.message || String(error) || 'Failed to import forecast');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFileList([]);
        onClose();
    };

    const templateColumns = [
        { key: 'poId', label: 'PO ID' },
        { key: 'date', label: 'Date' },
        { key: 'vendorCode', label: 'Vendor Code' },
        { key: 'vendorName', label: 'Vendor Name' },
        { key: 'receivingArea', label: 'Receiving Area' },
        { key: 'deliveryDate', label: 'Delivery Date' },
        { key: 'deliveryPeriod', label: 'Delivery Period' },
        { key: 'classification', label: 'Classification' },
        { key: 'poNumber', label: 'PO Number' },
        { key: 'item', label: 'Item' },
        { key: 'qty', label: 'Qty' },
        { key: 'finishGoodId', label: 'Finish Good ID' },
    ];

    return (
        <Modal
            title="Import Forecast from Excel"
            open={visible}
            onOk={handleUpload}
            centered={true}
            onCancel={handleClose}
            confirmLoading={loading}
            width={600}
            zIndex={1050}
        >
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Upload
                    accept=".xlsx,.xls"
                    fileList={fileList}
                    onChange={({ fileList }) => setFileList(fileList)}
                    beforeUpload={() => false}
                    maxCount={1}
                >
                    <Button icon={<UploadOutlined />}>Select Excel File</Button>
                </Upload>

                <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                    <Text strong>Excel column format:</Text>
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {templateColumns.map(col => (
                            <Text key={col.key} style={{ fontSize: 12 }}>
                                • {col.label}
                            </Text>
                        ))}
                    </div>
                </div>
            </Space>
        </Modal>
    );
};

export default ImportForecastModal;