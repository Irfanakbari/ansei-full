/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, {useState} from 'react';
import {Modal, Form, Input, App} from 'antd';
import {useDispatch} from 'react-redux';
import {AppDispatch} from '@/store';
import {createPermission} from '@/store/features/permissions/permissionsSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface FormValues {
    Action: string;
    Description?: string;
}

const CreatePermissionModal: React.FC<Props> = ({visible, onClose, onSuccess}) => {
    const {message} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [loading, setLoading] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            await dispatch(createPermission(values)).unwrap();
            message.success('Permission created successfully');
            onSuccess();
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create Permission');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create Permission"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            mask={{closable: !loading}}
            closable={!loading}
            destroyOnHidden
            forceRender
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="Action" label="Action"
                           rules={[{required: true, message: 'Please enter permission action'}]}>
                    <Input placeholder="Enter permission action"/>
                </Form.Item>
                <Form.Item name="Description" label="Description">
                    <Input.TextArea placeholder="Enter description" rows={3}/>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreatePermissionModal;
