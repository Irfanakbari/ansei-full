import React, {useState, useEffect} from 'react';
import {Modal, Form, Input, App, Switch, Select} from 'antd';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {createUser} from '@/store/features/users/usersSlice';
import {fetchRoles} from '@/store/features/roles/rolesSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface FormValues {
    UserId: string;
    SsoObjectId: string;
    Name: string;
    Email: string;
    PhoneNumber?: string;
    RoleId?: number;
    IsActive: boolean;
}

const CreateUserModal: React.FC<Props> = ({visible, onClose, onSuccess}) => {
    const {message} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [loading, setLoading] = useState(false);

    // Get role list for dropdown
    const {data: roles} = useSelector((state: RootState) => state.roles);

    useEffect(() => {
        if (visible) {
            dispatch(fetchRoles());
        }
    }, [visible, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                ...values,
                RoleId: values.RoleId ? Number(values.RoleId) : undefined,
            };

            await dispatch(createUser(payload)).unwrap();
            message.success('User created successfully');
            onSuccess();
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New User"
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
            width={600}
            zIndex={1050}
        >
            <Form form={form} layout="vertical" initialValues={{IsActive: true}}>
                <Form.Item name="UserId" label="User ID" rules={[{required: true, message: 'Please enter User ID'}]}>
                    <Input placeholder="Enter unique user ID"/>
                </Form.Item>
                <Form.Item name="SsoObjectId" label="SSO Subject ID"
                           rules={[{required: true, message: 'Please enter SSO subject ID'}]}>
                    <Input placeholder="Enter SSO subject ID"/>
                </Form.Item>
                <Form.Item name="Name" label="Full Name" rules={[{required: true, message: 'Please enter full name'}]}>
                    <Input placeholder="Enter full name"/>
                </Form.Item>
                <Form.Item name="Email" label="Email Address"
                           rules={[{required: true, type: 'email', message: 'Please enter a valid email'}]}>
                    <Input placeholder="Enter email address"/>
                </Form.Item>
                <Form.Item name="PhoneNumber" label="Phone Number">
                    <Input placeholder="Enter phone number"/>
                </Form.Item>
                <Form.Item name="RoleId" label="Role">
                    <Select
                        placeholder="Select a role"
                        showSearch={{optionFilterProp: 'label'}}
                        options={roles.map((role) => ({value: role.Id, label: role.RoleName}))}
                    />
                </Form.Item>

                <Form.Item name="IsActive" label="Active Status" valuePropName="checked">
                    <Switch/>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateUserModal;
