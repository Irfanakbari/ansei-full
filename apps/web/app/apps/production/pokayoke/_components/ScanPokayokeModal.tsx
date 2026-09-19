/*By Irfan Akbari Vuteq Indonesia - 2026-06-09*/
"use client";

import React from 'react';
import { Modal, Form, Input, Select, Button, Space, App } from 'antd';
import { ScanOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { scanPokayoke, PokayokeScanRequest } from '@/store/features/production/pokayoke/pokayokeSlice';

interface ScanPokayokeModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ScanPokayokeModal: React.FC<ScanPokayokeModalProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const { message: antMessage } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { scanning } = useSelector((state: RootState) => state.pokayoke);
    const [form] = Form.useForm();

    const handleFinish = async (values: { labelNumber: string; status: string }) => {
        try {
            const scanData: PokayokeScanRequest = {
                labelNumber: values.labelNumber,
                status: values.status,
            };

            const resultAction = await dispatch(scanPokayoke(scanData));

            if (scanPokayoke.fulfilled.match(resultAction)) {
                // Success
                form.resetFields();
                onClose();
                onSuccess();
            } else if (scanPokayoke.rejected.match(resultAction)) {
                // Show error message
                const errorMessage = resultAction.payload as string;
                antMessage.error(errorMessage || 'Scan failed');
            }
        } catch (error: any) {
            antMessage.error(error?.message || 'Scan failed');
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title="Scan Pokayoke"
            open={visible}
            onCancel={handleCancel}
            footer={null}
            centered
            zIndex={1050}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{ status: 'SUKSES' }}
            >
                <Form.Item
                    name="labelNumber"
                    label="Label Number"
                    rules={[{ required: true, message: 'Please enter label number' }]}
                >
                    <Input placeholder="e.g., PO-00100100005" size="large" />
                </Form.Item>

                <Form.Item
                    name="status"
                    label="Status"
                    rules={[{ required: true, message: 'Please select status' }]}
                >
                    <Select
                        size="large"
                        options={[
                            { value: 'SUKSES', label: 'SUKSES' },
                            { value: 'GAGAL', label: 'GAGAL' },
                        ]}
                    />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Space>
                        <Button onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button type="primary" htmlType="submit" loading={scanning} icon={<ScanOutlined />}>
                            Scan
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ScanPokayokeModal;
