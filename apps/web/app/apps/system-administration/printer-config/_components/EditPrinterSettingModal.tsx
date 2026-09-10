/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { PrinterSettingEntity, updatePrinterSetting } from '@/store/features/settings/printerSettingSlice';
import { store } from '@/store';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: PrinterSettingEntity;
    onSuccess?: () => void;
}

const EditPrinterSettingModal: React.FC<Props> = ({ visible, onClose, data, onSuccess }) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && data) {
            form.setFieldsValue({
                name: data.Name,
                ipAddress: data.IpAddress,
            });
        }
    }, [visible, data, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const result = await store.dispatch(updatePrinterSetting({
                id: data.Id,
                data: values,
            }));

            if (updatePrinterSetting.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update printer setting');
            }

            message.success('Printer setting updated successfully');
            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) {
                setLoading(false);
                return;
            }
            message.error(err?.message || String(error) || 'Failed to update printer setting');
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title="Edit Printer Setting"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={400}
            okText="Save"
            cancelText="Cancel"
            zIndex={1050}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item label="ID" style={{ marginBottom: 8 }}>
                    <code>{data.Id}</code>
                </Form.Item>

                <Form.Item
                    name="name"
                    label="Printer Name"
                    rules={[{ required: true, message: 'Printer name is required' }]}
                >
                    <Input placeholder="Example: Warehouse Printer 1" />
                </Form.Item>

                <Form.Item
                    name="ipAddress"
                    label="IP Address"
                    rules={[
                        { required: true, message: 'IP Address is required' },
                        {
                            pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
                            message: 'Invalid IP Address format',
                        },
                    ]}
                >
                    <Input placeholder="Example: 192.168.1.100" />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditPrinterSettingModal;
