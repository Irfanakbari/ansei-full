/* By Irfan Akbari Vuteq Indonesia - 2026-07-21 */
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Switch, App, Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import {
    createDisplayConfig,
    updateDisplayConfig,
    uploadDisplayMedia,
    DisplayConfigEntity,
    CreateDisplayConfigDto,
} from '@/store/features/settings/displayConfig/displayConfigSlice';
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
    const [mediaFile, setMediaFile] = useState<File | null>(null);

    const isEdit = !!data;

    useEffect(() => {
        if (visible) {
            if (data) {
                form.setFieldsValue({
                    description: data.Description,
                    url: data.Url,
                    line: data.Line,
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
                url: values.url || undefined,
                line: values.line || undefined,
                isOpen: values.isOpen ?? false,
                loop: values.loop ?? true,
            };

            let result;
            if (isEdit && data) {
                result = await store.dispatch(updateDisplayConfig({ id: data.Id, data: payload }));
            } else {
                result = await store.dispatch(createDisplayConfig(payload));
            }

            let savedId: number;
            if (isEdit && data) {
                if (updateDisplayConfig.rejected.match(result)) {
                    throw new Error((result.payload as string) || 'Failed to update display config');
                }
                savedId = data.Id;
            } else {
                if (createDisplayConfig.rejected.match(result)) {
                    throw new Error((result.payload as string) || 'Failed to create display config');
                }
                const created = result.payload as { data?: DisplayConfigEntity };
                savedId = created.data?.Id as number;
            }

            if (mediaFile && savedId) {
                const uploadResult = await store.dispatch(uploadDisplayMedia({ id: savedId, file: mediaFile }));
                if (uploadDisplayMedia.rejected.match(uploadResult)) {
                    throw new Error((uploadResult.payload as string) || 'Display config saved, but media upload failed');
                }
            }

            message.success(`Display config ${isEdit ? 'updated' : 'created'} successfully`);
            setMediaFile(null);
            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to save display config');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setLoading(false);
        setMediaFile(null);
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
                    label="URL (Optional)"
                    rules={[{ type: 'url', message: 'Invalid URL format' }]}
                    extra="Uploaded media has priority over this URL"
                >
                    <Input placeholder="https://display.example.com/video.mp4" />
                </Form.Item>

                <Form.Item name="line" label="Production Line" extra="Leave empty for default display">
                    <Input placeholder="e.g., LINE-A" />
                </Form.Item>

                <Form.Item label="Upload Media (Max 50MB)" extra={data?.FilePath ? `Current: ${data.FilePath}` : 'Video: MP4/WEBM/OGG. Image: PNG/JPG/GIF/WEBP'}>
                    <Upload
                        beforeUpload={(file) => {
                            if (file.size > 50 * 1024 * 1024) {
                                message.error('File size exceeds 50MB');
                                return Upload.LIST_IGNORE;
                            }
                            setMediaFile(file);
                            return false;
                        }}
                        maxCount={1}
                        onRemove={() => setMediaFile(null)}
                    >
                        <Button icon={<UploadOutlined />}>Select Media</Button>
                    </Upload>
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
