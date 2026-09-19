/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, {useState} from 'react';
import {Modal, Form, Input, App} from 'antd';
import {useDispatch} from 'react-redux';
import {AppDispatch} from '@/store';
import {createSatuan} from '@/store/features/master/satuanSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const CreateSatuanModal: React.FC<Props> = ({visible, onClose, onSuccess}) => {
    const {message} = App.useApp();
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

            const result = await dispatch(createSatuan(payload));

            if (createSatuan.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Unit created successfully');
            onSuccess?.();
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create unit');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New Unit"
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
            <Form form={form} layout="vertical">
                <Form.Item name="name" label="Unit Name" rules={[{required: true, message: 'Please enter unit name'}]}>
                    <Input placeholder="Enter unit name"/>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateSatuanModal;
