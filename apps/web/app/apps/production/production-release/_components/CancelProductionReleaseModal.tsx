"use client";

import { App, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { cancelProductionRelease, type ProductionReleaseEntity } from '@/store/features/production/productionRelease/productionReleaseSlice';

interface Props {
    open: boolean;
    release: ProductionReleaseEntity | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CancelProductionReleaseModal({ open, release, onClose, onSuccess }: Props) {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<{ reason: string }>();
    const [loading, setLoading] = useState(false);

    const submit = async () => {
        if (!release) return;
        try {
            const values = await form.validateFields();
            setLoading(true);
            await dispatch(cancelProductionRelease({ id: release.Id, reason: values.reason.trim() })).unwrap();
            message.success('Production release cancelled');
            form.resetFields();
            onClose();
            onSuccess();
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'errorFields' in error) return;
            message.error(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title={`Cancel ${release?.ReleaseNumber ?? ''}`} open={open} centered destroyOnHidden okText="Cancel Release" okType="danger" confirmLoading={loading} onOk={submit} onCancel={onClose}>
            <Form form={form} layout="vertical">
                <Form.Item name="reason" label="Reason" rules={[{ required: true, whitespace: true, message: 'Reason is required' }, { max: 500 }]}>
                    <Input.TextArea rows={4} placeholder="Explain why this released schedule must be cancelled" />
                </Form.Item>
            </Form>
        </Modal>
    );
}