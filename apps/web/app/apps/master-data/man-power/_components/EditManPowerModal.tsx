/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState } from 'react';
import { Modal, Form, Input, App, Switch } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateManPower, fetchManPower, ManPowerEntity } from '@/store/features/master/manPowerSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: ManPowerEntity;
}

const EditManPowerModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                nik: values.nik,
                name: values.name,
                line: values.line,
                status: values.status,
            };

            const result = await dispatch(updateManPower({ uid: data.Uid, data: payload }));
            if (updateManPower.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update man power');
            }
            message.success('Man power updated successfully');
            dispatch(fetchManPower());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to update man power');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Man Power"
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
            zIndex={1050}
        >
            <Form form={form} layout="vertical" initialValues={{
                nik: data.Nik,
                name: data.Name,
                line: data.Line,
                status: data.Status,
            }}>
                <Form.Item name="nik" label="NIK" rules={[{ required: true, message: 'Please enter NIK' }]}>
                    <Input placeholder="Enter NIK" />
                </Form.Item>
                <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}>
                    <Input placeholder="Enter name" />
                </Form.Item>
                <Form.Item name="line" label="Line">
                    <Input placeholder="Enter production line" />
                </Form.Item>
                <Form.Item name="status" label="Active Status" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditManPowerModal;
