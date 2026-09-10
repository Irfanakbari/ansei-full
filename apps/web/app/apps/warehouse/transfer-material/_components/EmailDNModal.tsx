/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useEffect } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { sendDN } from '@/store/features/warehouse/transferMaterial/transferMaterialSlice';

const { TextArea } = Input;

interface Props {
    visible: boolean;
    onClose: () => void;
    deliveryNoteId: string;
    deliveryNoteNum: string;
}

const EmailDNModal: React.FC<Props> = ({ visible, onClose, deliveryNoteId, deliveryNoteNum }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const { loading } = useSelector((state: RootState) => state.transferMaterial);

    useEffect(() => {
        if (visible) {
            form.setFieldsValue({
                to: '',
                cc: '',
                subject: `Delivery Note - ${deliveryNoteNum}`,
                message: 'Please confirm receipt once materials arrive.',
            });
        }
    }, [visible, deliveryNoteNum, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            const result = await dispatch(sendDN({
                id: deliveryNoteId,
                dto: {
                    to: values.to,
                    cc: values.cc,
                    subject: values.subject,
                    message: values.message,
                },
            }));

            if (sendDN.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to send delivery note');
            }

            message.success('Delivery note sent successfully');
            onClose();
            form.resetFields();
        } catch (error: unknown) {
            // Check if it's a form validation error from Ant Design
            if (error && typeof error === 'object' && 'errorFields' in error) {
                return; // Validation error, Ant Design handles it
            }
            const err = error as Error;
            message.error(err?.message || 'Failed to send delivery note');
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title={
                <span>
                    <MailOutlined style={{ marginRight: 8 }} />
                    Email Delivery Note
                </span>
            }
            open={visible}
            onOk={handleSubmit}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={500}
            okText="Send Email"
            zIndex={1050}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    subject: `Delivery Note - ${deliveryNoteNum}`,
                    message: 'Please confirm receipt once materials arrive.',
                }}
            >
                <Form.Item
                    name="to"
                    label="To (Recipient)"
                    rules={[
                        { required: true, message: 'Recipient email is required' },
                        { type: 'email', message: 'Please enter a valid email' },
                    ]}
                >
                    <Input placeholder="recipient@example.com" />
                </Form.Item>

                <Form.Item
                    name="cc"
                    label="CC"
                    rules={[{ type: 'email', message: 'Please enter a valid email' }]}
                >
                    <Input placeholder="cc@example.com (optional)" />
                </Form.Item>

                <Form.Item
                    name="subject"
                    label="Subject"
                    rules={[{ required: true, message: 'Subject is required' }]}
                >
                    <Input placeholder="Email subject" />
                </Form.Item>

                <Form.Item
                    name="message"
                    label="Message"
                    rules={[{ required: true, message: 'Message is required' }]}
                >
                    <TextArea
                        rows={4}
                        placeholder="Email message content..."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EmailDNModal;
