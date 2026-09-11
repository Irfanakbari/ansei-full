/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, App, Switch, Select } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { updateUser, fetchUsers, UserManagementEntity } from '@/store/features/users/usersSlice';
import { fetchRoles } from '@/store/features/roles/rolesSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: UserManagementEntity | null;
}

const EditUserModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const { data: roles } = useSelector((state: RootState) => state.roles);

    useEffect(() => {
        if (visible) {
            dispatch(fetchRoles());
        }
    }, [visible, dispatch]);

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

            const payload: any = {
                Name: values.Name,
                Email: values.Email,
                PhoneNumber: values.PhoneNumber,
                IsActive: values.IsActive,
                DeptPermission: values.DeptPermission || [],
                RoleId: values.RoleId ? Number(values.RoleId) : null,
            };

            const result = await dispatch(updateUser({ id: data.UserId, userData: payload }));
            if (updateUser.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update user');
            }
            message.success('User updated successfully');
            dispatch(fetchUsers());
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to update User');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit User"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            destroyOnHidden
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="Name" label="Name" rules={[{ required: true }]}>
                    <Input placeholder="Enter user name" />
                </Form.Item>
                <Form.Item name="Email" label="Email" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="Enter user email" />
                </Form.Item>
                <Form.Item name="PhoneNumber" label="Phone Number">
                    <Input placeholder="Enter phone number" />
                </Form.Item>
                <Form.Item name="IsActive" label="Account Active" valuePropName="checked">
                    <Switch />
                </Form.Item>
                <Form.Item name="RoleId" label="Role">
                    <Select placeholder="Select a role">
                        {roles.map(role => (
                            <Select.Option key={role.Id} value={role.Id}>{role.RoleName}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditUserModal;
