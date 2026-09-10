/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, App } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { updatePermission, fetchPermissions, PermissionData } from '@/store/features/permissions/permissionsSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: PermissionData | null;
}

const EditPermissionModal: React.FC<Props> = ({ visible, onClose, data }) => {
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
            const result = await dispatch(updatePermission({ id: data.Id, permissionData: values }));
            if (updatePermission.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update permission');
            }
            message.success('Permission updated successfully');
            dispatch(fetchPermissions());
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to update Permission');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Permission"
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
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="Action" label="Action" rules={[{ required: true, message: 'Please enter permission action' }]}>
                    <Input placeholder="Enter permission action" />
                </Form.Item>
                <Form.Item name="Description" label="Description">
                    <Input.TextArea placeholder="Enter description" rows={3} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditPermissionModal;
