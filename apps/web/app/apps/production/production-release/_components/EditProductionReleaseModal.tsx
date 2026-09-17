/*By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-06-16*/
"use client";

import React, { useState } from 'react';
import { Modal, Form, Input, App, Select, Switch } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import {
    updateProductionRelease,
    ProductionReleaseEntity,
    UpdateProductionReleasePayload,
} from '@/store/features/production/productionRelease/productionReleaseSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: ProductionReleaseEntity;
    onSuccess?: () => void;
}

const STATUS_OPTIONS = [
    { value: 'DRAFT', label: 'DRAFT' },
    { value: 'RELEASED', label: 'RELEASED' },
    { value: 'COMPLETED', label: 'COMPLETED' },
    // { value: 'CANCELLED', label: 'CANCELLED' },
];

const EditProductionReleaseModal: React.FC<Props> = ({ visible, onClose, data, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload: UpdateProductionReleasePayload = {};

            if (values.status) payload.status = values.status;
            if (values.notes !== undefined) payload.notes = values.notes;
            if (values.isNoAttachment !== undefined) payload.isNoAttachment = values.isNoAttachment;

            await dispatch(updateProductionRelease({ id: data.Id, data: payload })).unwrap();
            message.success('Production release updated successfully');
            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to update production release');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Production Release"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            width={500}
            zIndex={1050}
        >
            <Form form={form} layout="vertical" initialValues={{
                status: data.Status,
                notes: data.Notes,
                isNoAttachment: data.IsNoAttachment || false,
            }}>
                <Form.Item name="status" label="Status">
                    <Select>
                        {STATUS_OPTIONS.map(opt => (
                            <Select.Option key={opt.value} value={opt.value}>
                                {opt.label}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="notes" label="Notes">
                    <Input.TextArea placeholder="Notes" rows={3} />
                </Form.Item>
                <Form.Item name="isNoAttachment" label="No Attachment" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditProductionReleaseModal;