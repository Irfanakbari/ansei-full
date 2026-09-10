/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, App, Select, Upload, Button, Typography, Tag } from 'antd';
import { UploadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { ProductionReleaseEntity, uploadAttachment } from '@/store/features/production/productionRelease/productionReleaseSlice';
import { fetchForecast, ForecastEntity } from '@/store/features/production/forecast/forecastSlice';

const { Text } = Typography;

interface Props {
    visible: boolean;
    onClose: () => void;
    data: ProductionReleaseEntity;
    onSuccess?: () => void;
}

const AttachmentModal: React.FC<Props> = ({ visible, onClose, data, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fileList, setFileList] = useState<any[]>([]);

    // Get forecasts from store
    const { data: allForecasts, loading: forecastLoading } = useSelector((state: RootState) => state.forecast);

    // Get forecasts from production release that are attached (have AttachmentDelivery)
    const attachedForecasts = useMemo(() => {
        return data.Forecasts?.filter((f) => f.AttachmentDelivery) || [];
    }, [data.Forecasts]);

    // Create lookup map: PoId -> PoNumber (from forecast master data)
    const poIdToPoNumber = useMemo(() => {
        const map = new Map<string, string>();
        allForecasts.forEach((f) => {
            if (!map.has(f.PoId)) {
                map.set(f.PoId, f.PoNumber);
            }
        });
        return map;
    }, [allForecasts]);

    // Get PoNumbers that already have attachments (by mapping PoId from production release to PoNumber)
    const attachedPoNumbers = useMemo(() => {
        const poNumbers = attachedForecasts
            .map((f) => poIdToPoNumber.get(f.PoId))
            .filter((p): p is string => Boolean(p));
        return new Set(poNumbers);
    }, [attachedForecasts, poIdToPoNumber]);

    useEffect(() => {
        if (visible) {
            dispatch(fetchForecast());
            form.resetFields();
            setFileList([]);
        }
    }, [visible, form, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (fileList.length === 0) {
                message.error('Please select a file to upload');
                setLoading(false);
                return;
            }

            const file = fileList[0].originFileObj;
            if (!file) {
                message.error('No file selected');
                setLoading(false);
                return;
            }

            // Get PoId from PoNumber selection - find first matching forecast
            const selectedPoNumber = values.forecastId;
            const matchingForecast = allForecasts.find((f) => f.PoNumber === selectedPoNumber);
            const forecastId = matchingForecast?.PoId;

            if (!forecastId) {
                message.error('Forecast not found');
                setLoading(false);
                return;
            }

            const result = await dispatch(uploadAttachment({
                productionReleaseId: data.Id,
                forecastId: forecastId,
                file,
            }));
            if (uploadAttachment.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to upload attachment');
            }
            message.success('Attachment uploaded successfully');
            form.resetFields();
            setFileList([]);
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to upload attachment');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setFileList([]);
        onClose();
    };

    const handleBeforeUpload = (file: File) => {
        const isLt10M = file.size / 1024 / 1024 < 10;
        if (!isLt10M) {
            message.error('File must be smaller than 10MB!');
            return false;
        }

        setFileList([{
            uid: '-1',
            name: file.name,
            status: 'done',
            originFileObj: file,
        }]);

        return false;
    };

    const handleRemove = () => {
        setFileList([]);
    };

    // Create unique forecast options by PoNumber (remove duplicates)
    const forecastOptions = useMemo(() => {
        const uniqueMap = new Map<string, ForecastEntity>();
        allForecasts.forEach((forecast) => {
            if (!uniqueMap.has(forecast.PoNumber)) {
                uniqueMap.set(forecast.PoNumber, forecast);
            }
        });

        return Array.from(uniqueMap.values()).map((forecast: ForecastEntity) => {
            const hasAttachment = attachedPoNumbers.has(forecast.PoNumber);

            return {
                value: forecast.PoNumber, // Use PoNumber as value for display
                label: forecast.PoNumber,
                data: forecast,
                disabled: hasAttachment,
            };
        });
    }, [allForecasts, attachedPoNumbers]);

    return (
        <Modal
            title="Upload Attachment"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={450}
            okText="Upload"
            cancelText="Cancel"
            zIndex={1050}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                {/* Production Release Info */}
                <Form.Item label="Production Release" style={{ marginBottom: 8 }}>
                    <div style={{
                        background: '#f5f5f5',
                        padding: '8px 12px',
                        borderRadius: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <code style={{ fontSize: 13 }}>{data.ReleaseNumber}</code>
                        <Text type="secondary" style={{ fontSize: 11 }}>ID: {data.Id}</Text>
                    </div>
                </Form.Item>

                {/* Po Number Select */}
                <Form.Item
                    name="forecastId"
                    label="PO Number"
                    tooltip="Select PO Number from Forecast Production Plan"
                    rules={[{ required: true, message: 'Please select PO Number' }]}
                >
                    <Select
                        placeholder="Select PO Number"
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                        }
                        loading={forecastLoading}
                        options={forecastOptions}
                        optionFilterProp="label"
                        optionRender={(option) => {
                            const isDisabled = option.data.disabled;
                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: isDisabled ? 0.5 : 1 }}>
                                    <Text>{option.label}</Text>
                                    {isDisabled && (
                                        <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginRight: 0 }}>
                                            Has Attachment
                                        </Tag>
                                    )}
                                </div>
                            );
                        }}
                    />
                </Form.Item>

                {/* File Upload */}
                <Form.Item
                    label="File"
                    required
                    style={{ marginBottom: 8 }}
                >
                    <Upload
                        beforeUpload={handleBeforeUpload}
                        onRemove={handleRemove}
                        fileList={fileList}
                        maxCount={1}
                        listType="text"
                    >
                        <Button icon={<UploadOutlined />}>Select File</Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                        Maximum file size: 10MB
                    </Text>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default AttachmentModal;
