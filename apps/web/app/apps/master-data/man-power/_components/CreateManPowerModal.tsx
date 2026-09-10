/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState } from 'react';
import { Modal, Form, Input, App, Switch } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { createManPower, fetchManPower } from '@/store/features/master/manPowerSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const CreateManPowerModal: React.FC<Props> = ({ visible, onClose }) => {
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
                status: values.status !== undefined ? values.status : true,
            };

            const result = await dispatch(createManPower(payload));

            if (createManPower.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Man power created successfully');
            dispatch(fetchManPower());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create man power');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New Man Power"
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
            <Form form={form} layout="vertical" initialValues={{ status: true }}>
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

export default CreateManPowerModal;
