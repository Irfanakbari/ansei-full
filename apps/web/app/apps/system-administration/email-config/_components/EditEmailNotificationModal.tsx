/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, App } from 'antd';
import { EmailNotificationEntity, updateEmailNotification } from '@/store/features/settings/emailNotificationSlice';
import { store } from '@/store';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: EmailNotificationEntity;
    onSuccess?: () => void;
}

const EditEmailNotificationModal: React.FC<Props> = ({ visible, onClose, data, onSuccess }) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && data) {
            form.setFieldsValue({
                name: data.Name,
                email: data.Email,
                type: data.Type,
            });
        }
    }, [visible, data, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const result = await store.dispatch(updateEmailNotification({
                id: data.Id,
                data: values,
            }));

            if (updateEmailNotification.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update email notification');
            }

            message.success('Email notification updated successfully');
            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) {
                setLoading(false);
                return;
            }
            message.error(err?.message || String(error) || 'Failed to update email notification');
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title="Edit Email Notification"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={450}
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
                    label="Recipient Name"
                    rules={[{ required: true, message: 'Recipient name is required' }]}
                >
                    <Input placeholder="Example: John Doe" />
                </Form.Item>

                <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                        { required: true, message: 'Email is required' },
                        { type: 'email', message: 'Invalid email format' },
                    ]}
                >
                    <Input placeholder="Example: john@company.com" />
                </Form.Item>

                <Form.Item
                    name="type"
                    label="Notification Type"
                    rules={[{ required: true, message: 'Notification type is required' }]}
                >
                    <Select placeholder="Select notification type">
                        <Select.Option value="DEFAULT">Default</Select.Option>
                        <Select.Option value="INCOMING">Incoming</Select.Option>
                        <Select.Option value="OUTGOING">Outgoing</Select.Option>
                        <Select.Option value="PRODUCTION">Production</Select.Option>
                        <Select.Option value="TRANSFER">Transfer</Select.Option>
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditEmailNotificationModal;
