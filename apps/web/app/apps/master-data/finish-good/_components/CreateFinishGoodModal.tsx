/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, App } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { createFinishGood, fetchFinishGood } from '@/store/features/master/finishGoodSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const CreateFinishGoodModal: React.FC<Props> = ({ visible, onClose }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                partNumber: values.partNumber,
                partName: values.partName,
                price: values.price,
                qty: values.qty || 0,
            };

            const result = await dispatch(createFinishGood(payload));

            if (createFinishGood.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Finish good created successfully');
            dispatch(fetchFinishGood());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create finish good');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New Finish Good"
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
            <Form form={form} layout="vertical">
                <Form.Item name="partNumber" label="Part Number" rules={[{ required: true, message: 'Please enter part number' }]}>
                    <Input placeholder="Enter part number" />
                </Form.Item>
                <Form.Item name="partName" label="Part Name" rules={[{ required: true, message: 'Please enter part name' }]}>
                    <Input placeholder="Enter part name" />
                </Form.Item>
                <Form.Item name="price" label="Price">
                    <InputNumber placeholder="0" min={0} style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                </Form.Item>
                <Form.Item name="qty" label="Qty">
                    <InputNumber placeholder="0" min={0} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateFinishGoodModal;
