/*By Irfan Akbari Vuteq Indonesia - 2026-06-11*/
"use client";

import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, App, InputNumber } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { createInventoryCounting, CreateInventoryCountingDto } from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const CreateInventoryCountingModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const { message: antMessage } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleFinish = async (values: CreateInventoryCountingDto) => {
        try {
            setLoading(true);
            const resultAction = await dispatch(createInventoryCounting(values));

            if (createInventoryCounting.fulfilled.match(resultAction)) {
                antMessage.success('Inventory counting created successfully');
                form.resetFields();
                onClose();
                onSuccess?.();
            } else if (createInventoryCounting.rejected.match(resultAction)) {
                const errorMsg = resultAction.payload as string;
                antMessage.error(errorMsg || 'Failed to create inventory counting');
            }
        } catch (error: any) {
            antMessage.error(error?.message || 'Failed to create inventory counting');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title="Create New Inventory Counting"
            open={visible}
            onCancel={handleCancel}
            footer={null}
            centered
            width={500}
            zIndex={1050}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
            >
                <Form.Item
                    name="opnameNumber"
                    label="Opname Number"
                    rules={[{ required: true, message: 'Please enter Opname Number' }]}
                >
                    <Input placeholder="Example: INV-2025-001" size="large" />
                </Form.Item>

                <Form.Item
                    name="category"
                    label="Category"
                    rules={[{ required: true, message: 'Please select Category' }]}
                >
                    <Select
                        placeholder="Select category"
                        size="large"
                        options={[
                            { value: 'MATERIAL', label: 'Material' },
                            { value: 'FINISH_GOOD', label: 'Finish Good' },
                        ]}
                    />
                </Form.Item>

                <Form.Item
                    name="tolerance"
                    label="Tolerance (%)"
                    initialValue={5}
                    rules={[{ required: true, message: 'Please enter tolerance percentage' }]}
                >
                    <InputNumber
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                        size="large"
                    />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notes"
                >
                    <Input.TextArea
                        rows={3}
                        placeholder="Add notes if needed"
                    />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Space>
                        <Button onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            {loading ? 'Creating...' : 'Create'}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateInventoryCountingModal;