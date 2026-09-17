/*By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-09-16*/
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, App, Switch, Upload, Button, Space, Typography } from 'antd';
import { UploadOutlined, DeleteOutlined, PictureOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { createManPower, uploadManPowerPicture, fetchManPower } from '@/store/features/master/manPowerSlice';

const { Text } = Typography;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface Props {
    visible: boolean;
    onClose: () => void;
}

const CreateManPowerModal: React.FC<Props> = ({ visible, onClose }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) {
            setSelectedFile(null);
            setPreviewUrl(null);
            form.resetFields();
        }
    }, [visible, form]);

    const handleFileChange = (file: File) => {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const isValidExt = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileExt || '');
        const isValidType = ALLOWED_TYPES.includes(file.type) || isValidExt;

        if (!isValidType) {
            message.error('Format file tidak didukung. Harap upload gambar (PNG, JPG, JPEG, GIF, WEBP).');
            return false;
        }

        if (file.size > MAX_FILE_SIZE) {
            message.error('Ukuran file terlalu besar. Maksimal 5MB.');
            return false;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
        setSelectedFile(file);
        return false;
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
    };

    const handleCleanup = () => {
        handleRemoveFile();
        form.resetFields();
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                nik: values.nik,
                name: values.name,
                line: values.line,
                status: values.status !== undefined ? values.status : true,
                skillMatrix: values.skillMatrix || [],
            };

            const result = await dispatch(createManPower(payload)).unwrap();
            const createdUid = result?.data?.Uid || (result as any)?.Uid;

            if (selectedFile && createdUid) {
                try {
                    await dispatch(uploadManPowerPicture({ uid: createdUid, file: selectedFile })).unwrap();
                } catch (uploadError: unknown) {
                    const uploadErr = uploadError as Error;
                    message.warning(`Man power dibuat, tetapi gagal mengunggah foto: ${uploadErr?.message || String(uploadError)}`);
                }
            }

            message.success('Man power created successfully');
            dispatch(fetchManPower());
            handleCleanup();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create man power');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New Man Power"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                handleCleanup();
                onClose();
            }}
            confirmLoading={loading}
            destroyOnHidden
            forceRender
            width={500}
            zIndex={1050}
        >
            <Form form={form} layout="vertical" initialValues={{ status: true }}>
                <Form.Item name="nik" label="NIK" rules={[{ required: true, message: 'Please enter NIK' }]}>
                    <Input placeholder="Enter NIK" />
                </Form.Item>
                <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}>
                    <Input placeholder="Enter name" />
                </Form.Item>
                <Form.Item name="line" label="Line">
                    <Input placeholder="Enter production line" />
                </Form.Item>
                <Form.Item label="Foto Karyawan (Max 5MB)">
                    {previewUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewUrl}
                                alt="Preview"
                                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #d9d9d9' }}
                            />
                            <Space orientation="vertical" size={2}>
                                <Text ellipsis style={{ maxWidth: 220 }}>{selectedFile?.name}</Text>
                                <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={handleRemoveFile}
                                >
                                    Hapus Foto
                                </Button>
                            </Space>
                        </div>
                    ) : (
                        <Upload
                            beforeUpload={handleFileChange}
                            maxCount={1}
                            showUploadList={false}
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        >
                            <Button icon={<UploadOutlined />}>Pilih Foto</Button>
                        </Upload>
                    )}
                    <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                            <PictureOutlined style={{ marginRight: 4 }} />
                            Format yang didukung: PNG, JPG, JPEG, GIF, WEBP (maks. 5MB)
                        </Text>
                    </div>
                </Form.Item>
                <div style={{ marginBottom: 16 }}>
                    <Text strong>Skill Matrix</Text>
                    <Form.List name="skillMatrix">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'label']}
                                            rules={[{ required: true, message: 'Missing skill name' }]}
                                            style={{ margin: 0 }}
                                        >
                                            <Input placeholder="Skill Label (e.g. Assembly)" />
                                        </Form.Item>
                                        <Form.Item
                                            {...restField}
                                            name={[name, 'point']}
                                            rules={[{ required: true, message: 'Missing point' }]}
                                            style={{ margin: 0 }}
                                        >
                                            <InputNumber min={1} max={4} placeholder="Poin 1-4" style={{ width: '100px' }} />
                                        </Form.Item>
                                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                                    </Space>
                                ))}
                                <Form.Item style={{ margin: 0, marginTop: 8 }}>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                        Add Skill
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </div>
                <Form.Item name="status" label="Active Status" valuePropName="checked">
                    <Switch />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateManPowerModal;
