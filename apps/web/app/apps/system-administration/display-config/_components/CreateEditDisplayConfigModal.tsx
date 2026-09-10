/* By Irfan Akbari Vuteq Indonesia - 2026-07-21 */
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, App } from 'antd';
import {
    createDisplayConfig,
    updateDisplayConfig,
    DisplayConfigEntity,
    CreateDisplayConfigDto,
} from '@/store/features/system-administration/displayConfig/displayConfigSlice';
import { store } from '@/store';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    data?: DisplayConfigEntity | null;
}

const CreateEditDisplayConfigModal: React.FC<Props> = ({
    visible,
    onClose,
    onSuccess,
    data,
}) => {
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);

    const isEdit = !!data;

    useEffect(() => {
        if (visible) {
            if (data) {
                form.setFieldsValue({
                    description: data.Description,
                    url: data.Url,
                    isOpen: data.IsOpen,
                    loop: data.Loop,
                });
            } else {
                form.resetFields();
                form.setFieldsValue({
                    isOpen: false,
                    loop: true,
                });
            }
        }
    }, [visible, data, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload: CreateDisplayConfigDto = {
                description: values.description,
                url: values.url,
                isOpen: values.isOpen ?? false,
                loop: values.loop ?? true,
            };

            let result;
            if (isEdit && data) {
                result = await store.dispatch(updateDisplayConfig({ id: data.Id, data: payload }));
            } else {
                result = await store.dispatch(createDisplayConfig(payload));
            }

            if (isEdit && data) {
                if (updateDisplayConfig.rejected.match(result)) {
                    throw new Error((result.payload as string) || 'Failed to update display config');
                }
                message.success('Display config updated successfully');
            } else {
                if (createDisplayConfig.rejected.match(result)) {
                    throw new Error((result.payload as string) || 'Failed to create display config');
                }
                message.success('Display config created successfully');
            }

            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) {
                setLoading(false);
                return;
            }
            message.error(err?.message || String(error) || 'Failed to save display config');
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title={isEdit ? 'Edit Display Config' : 'Create Display Config'}
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={500}
            okText={isEdit ? 'Update' : 'Save'}
            cancelText="Cancel"
            zIndex={1050}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item
                    name="description"
                    label="Description"
                    rules={[
                        { required: true, message: 'Description is required' },
                        { max: 255, message: 'Description max 255 characters' },
                    ]}
                >
                    <Input placeholder="e.g., Display Utama Gudang" />
                </Form.Item>

                <Form.Item
                    name="url"
                    label="URL"
                    rules={[
                        { required: true, message: 'URL is required' },
                        { type: 'url', message: 'Invalid URL format' },
                    ]}
                >
                    <Input placeholder="https://display.example.com/screen/1" />
                </Form.Item>

                <Form.Item
                    name="isOpen"
                    label="Auto Open"
                    valuePropName="checked"
                    extra="Automatically open the display when system starts"
                >
                    <Switch />
                </Form.Item>

                <Form.Item
                    name="loop"
                    label="Loop"
                    valuePropName="checked"
                    extra="Continuously loop the display content"
                >
                    <Switch />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateEditDisplayConfigModal;
