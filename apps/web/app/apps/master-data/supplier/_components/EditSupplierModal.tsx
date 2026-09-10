/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateSupplier, fetchSupplier, SupplierEntity } from '@/store/features/master/supplierSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: SupplierEntity;
}

const EditSupplierModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                name: values.name,
            };

            const result = await dispatch(updateSupplier({ id: data.Id, data: payload }));
            if (updateSupplier.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update supplier');
            }
            message.success('Supplier updated successfully');
            dispatch(fetchSupplier());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to update supplier');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Supplier"
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
            width={400}
            zIndex={1050}
        >
            <Form form={form} layout="vertical" initialValues={{ name: data.Name }}>
                <Form.Item name="name" label="Supplier Name" rules={[{ required: true, message: 'Please enter supplier name' }]}>
                    <Input placeholder="Enter supplier name" />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditSupplierModal;
