/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
import React, {useState, useEffect} from 'react';
import {Form, Input, App, Select, Typography, Alert, Modal} from 'antd';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {createApiKey, fetchApiKeys, clearNewApiKey} from '@/store/features/apiKeys/apiKeysSlice';
import {fetchUsers} from '@/store/features/users/usersSlice';

const {Text} = Typography;

interface Props {
    visible: boolean;
    onClose: () => void;
}

const CreateApiKeyModal: React.FC<Props> = ({visible, onClose}) => {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const {newApiKey} = useSelector((state: RootState) => state.apiKeys);
    const {data: users} = useSelector((state: RootState) => state.users);

    useEffect(() => {
        if (visible) {
            form.resetFields();
            dispatch(fetchUsers({limit: 100}));
        }
    }, [visible, form, dispatch]);

    useEffect(() => {
        if (newApiKey) {
            modal.success({
                title: 'API Key Created Successfully',
                content: (
                    <div style={{textAlign: 'center'}}>
                        <Alert
                            title="Save this key now! It will not be shown again."
                            type="warning"
                            showIcon
                            style={{marginBottom: 16, textAlign: 'left'}}
                        />
                        <div
                            style={{
                                background: '#f5f5f5',
                                padding: '16px',
                                borderRadius: '8px',
                                marginBottom: 12,
                            }}
                        >
                            <Text copyable={{text: newApiKey.ApiKey, tooltips: ['Click to copy']}}
                                  style={{fontSize: 16}}>
                                <code style={{
                                    fontSize: 14,
                                    color: '#52c41a',
                                    background: '#f6ffed',
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    border: '1px solid #b7eb8f',
                                    wordBreak: 'break-all',
                                    fontFamily: 'Monaco, Consolas, monospace',
                                }}>
                                    {newApiKey.ApiKey}
                                </code>
                            </Text>
                        </div>
                        <div>
                            <Text type="secondary">Key Prefix: </Text>
                            <Text code>{newApiKey.KeyPrefix}</Text>
                        </div>
                    </div>
                ),
                okText: 'Close',
                centered: true,
                onOk: () => {
                    dispatch(clearNewApiKey());
                    dispatch(fetchApiKeys());
                    onClose();
                },
            });
        }
    }, [newApiKey, modal, dispatch, onClose]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                userId: values.userId,
                name: values.name,
                description: values.description,
            };

            await dispatch(createApiKey(payload)).unwrap();
        } catch (error: any) {
            if (error?.errorFields) return;
            message.error(error || 'Failed to create API Key');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New API Key"
            open={visible}
            onOk={handleOk}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            destroyOnHidden
            forceRender
            centered
            width={500}
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    name="userId"
                    label="User ID"
                    rules={[{required: true, message: 'Please select User ID'}]}
                >
                    <Select
                        showSearch={{
                            filterOption: (input, option) =>
                                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()),
                        }}
                        placeholder="Select User"
                        options={users.map(u => ({
                            value: u.UserId,
                            label: `${u.UserId} - ${u.Name}`
                        }))}
                    />
                </Form.Item>
                <Form.Item
                    name="name"
                    label="API Key Name"
                    rules={[{required: true, message: 'Please enter API Key name'}]}
                >
                    <Input placeholder="e.g., HRIS Integration, Mobile App"/>
                </Form.Item>
                <Form.Item name="description" label="Description">
                    <Input.TextArea rows={3} placeholder="Describe the purpose of this API Key"/>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateApiKeyModal;
