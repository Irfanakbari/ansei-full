/*By Irfan Akbari Vuteq Indonesia - 2026-07-20*/
import React, { useState } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { discontinueMaterial, fetchMaterial } from '@/store/features/master/materialSlice';
import { MaterialEntity } from '@/store/features/master/materialSlice';

const { TextArea } = Input;

interface Props {
    visible: boolean;
    onClose: () => void;
    data: MaterialEntity;
}

const DiscontinueMaterialModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                partNumber: data.PartNumber,
                reason: values.reason,
            };

            const result = await dispatch(discontinueMaterial(payload));

            if (discontinueMaterial.rejected.match(result)) {
                const errorMsg = (result.payload as string) || 'Failed to discontinue material';
                // Check if it's a 409 conflict (already discontinued)
                if (errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('discontinue')) {
                    message.warning('Material is already discontinued');
                } else {
                    throw new Error(errorMsg);
                }
                return;
            }
            message.success('Material discontinued successfully');
            dispatch(fetchMaterial());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to discontinue material');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Discontinue Material"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            destroyOnHidden
            forceRender
            width={500}
            okText="Discontinue"
            okButtonProps={{ danger: true }}
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <div style={{ marginBottom: 16 }}>
                    <p><strong>Part Number:</strong> {data?.PartNumber}</p>
                    <p><strong>Part Name:</strong> {data?.PartName}</p>
                    <p><strong>Supplier:</strong> {data?.Supplier || '-'}</p>
                </div>
                <Form.Item
                    name="reason"
                    label="Reason"
                    rules={[{ required: true, message: 'Please enter the reason for discontinuing' }]}
                >
                    <TextArea
                        rows={4}
                        placeholder="Enter reason for discontinuing this material"
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default DiscontinueMaterialModal;
