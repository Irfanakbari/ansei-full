/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updateRole, fetchRoles, RoleData } from '@/store/features/roles/rolesSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: RoleData | null;
}

const EditRoleModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && data) {
            form.setFieldsValue(data);
        }
    }, [visible, data, form]);

    const handleOk = async () => {
        if (!data) return;
        try {
            const values = await form.validateFields();
            setLoading(true);
            const result = await dispatch(updateRole({ id: data.Id, roleData: values }));
            if (updateRole.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update role');
            }
            message.success('Role updated successfully');
            dispatch(fetchRoles());
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to update Role');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Role"
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

export default EditRoleModal;
