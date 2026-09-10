/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { createRole, fetchRoles } from '@/store/features/roles/rolesSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const CreateRoleModal: React.FC<Props> = ({ visible, onClose }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            const result = await dispatch(createRole(values));

            if (createRole.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to create role');
            }
            message.success('Role created successfully');
            dispatch(fetchRoles());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create Role');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create Role"
            open={visible}
            centered={true}
            onOk={handleOk}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            destroyOnHidden
            forceRender
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="RoleName" label="Role Name" rules={[{ required: true, message: 'Please enter role name' }]}>
                    <Input placeholder="Enter role name" />
                </Form.Item>
                <Form.Item name="Description" label="Description">
                    <Input.TextArea placeholder="Enter description" rows={3} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateRoleModal;
