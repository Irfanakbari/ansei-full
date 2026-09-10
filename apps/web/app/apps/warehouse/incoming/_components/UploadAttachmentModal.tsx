/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Upload, Button, Typography, Space, App, Popconfirm, Table } from 'antd';
import { UploadOutlined, FileOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { uploadAttachment, deleteAttachment, AttachmentEntity } from '@/store/features/warehouse/incoming/incomingSlice';

const { Text } = Typography;

interface Props {
    visible: boolean;
    onClose: () => void;
    incomingId: string;
    onSuccess?: () => void;
}

const UploadAttachmentModal: React.FC<Props> = ({ visible, onClose, incomingId, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Get incoming data with attachment info from store
    const incomingData = useSelector((state: RootState) =>
        state.incoming.data.find(item => item.Id === incomingId)
    );

    // Check if there's an attachment from the Incoming entity
    const hasAttachment = incomingData?.FileName && incomingData?.FilePath;
    const attachmentInfo: AttachmentEntity | null = hasAttachment ? {
        Id: 0, // FileName/FilePath are on Incoming entity, not separate attachment
        IncomingId: incomingId,
        FileName: incomingData!.FileName || '',
        FilePath: incomingData!.FilePath || '',
        Description: incomingData?.Description || null,
        CreatedAt: incomingData?.CreatedAt || '',
        CreatedBy: incomingData?.CreatedBy || '',
    } : null;

    // Show message from state after render
    const prevUploadError = useRef<string | null>(null);
    useEffect(() => {
        if (uploadError && uploadError !== prevUploadError.current) {
            prevUploadError.current = uploadError;
            message.error(uploadError);
        }
    }, [uploadError, message]);

    useEffect(() => {
        if (visible) {
            form.resetFields();
            setFileList([]);
            setUploadError(null);
        }
    }, [visible, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (fileList.length === 0) {
                setUploadError('Pilih file untuk diupload');
                setLoading(false);
                return;
            }

            const file = fileList[0].originFileObj;
            if (!file) {
                setUploadError('Tidak ada file dipilih');
                setLoading(false);
                return;
            }

            const result = await dispatch(uploadAttachment({
                incomingId,
                file,
                description: values.description,
            }));
            if (uploadAttachment.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to upload attachment');
            }
            message.success('Lampiran berhasil diupload');
            form.resetFields();
            setFileList([]);
            setUploadError(null);
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) {
                setLoading(false);
                return;
            }
            setUploadError(err?.message || String(error) || 'Gagal upload lampiran');
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setFileList([]);
        setUploadError(null);
        onClose();
    };

    const handleBeforeUpload = (file: File) => {
        // Check file size (max 10MB)
        const isLt10M = file.size / 1024 / 1024 < 10;
        if (!isLt10M) {
            setUploadError('File harus lebih kecil dari 10MB!');
            return false;
        }

        // Check file type
        const allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (!fileExt || !allowedTypes.includes(fileExt)) {
            setUploadError('Tipe file tidak diizinkan. Diizinkan: PDF, JPG, PNG, GIF, WEBP');
            return false;
        }

        setFileList([{
            uid: '-1',
            name: file.name,
            status: 'done',
            originFileObj: file,
        }]);

        return false;
    };

    const handleRemove = () => {
        setFileList([]);
    };

    const handleDeleteAttachment = async () => {
        // Since attachments are stored on the Incoming entity itself,
        // we need to call deleteAttachment which will delete the attachment
        try {
            setLoading(true);
            const result = await dispatch(deleteAttachment({ incomingId, attachmentId: 0 }));
            if (deleteAttachment.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to delete attachment');
            }
            message.success('Lampiran berhasil dihapus');
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            message.error(err?.message || String(error) || 'Gagal hapus lampiran');
        } finally {
            setLoading(false);
        }
    };

    const getFileIcon = (fileName: string | null | undefined) => {
        if (!fileName) return <FileOutlined style={{ color: '#999', fontSize: 20 }} />;
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') {
            return <FileOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
        }
        return <FileOutlined style={{ color: '#1677ff', fontSize: 20 }} />;
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Modal
            title="Lampiran"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={600}
            okText="Upload"
            cancelText="Tutup"
            mask={{ closable: false }}
            zIndex={1050}
        >
            {/* Incoming Info */}
            <div style={{
                background: '#f5f5f5',
                padding: '8px 12px',
                borderRadius: 6,
                marginBottom: 16,
            }}>
                <code style={{ fontSize: 13 }}>{incomingId}</code>
            </div>

            {/* Existing Attachments List */}
            <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Lampiran
                </Text>
                {!attachmentInfo ? (
                    <Text type="secondary" style={{ fontStyle: 'italic' }}>
                        Belum ada lampiran
                    </Text>
                ) : (
                    <Table
                        size="small"
                        dataSource={[attachmentInfo]}
                        rowKey={() => 'attachment'}
                        pagination={false}
                        style={{ marginBottom: 8 }}
                        columns={[
                            {
                                title: 'File',
                                key: 'file',
                                render: (_, record) => (
                                    <Space>
                                        {getFileIcon(record.FileName)}
                                        <Text style={{ fontSize: 12 }}>{record.FileName || '-'}</Text>
                                    </Space>
                                ),
                            },
                            {
                                title: 'Tanggal',
                                key: 'date',
                                width: 150,
                                render: (_, record) => (
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        {formatDate(record.CreatedAt)}
                                    </Text>
                                ),
                            },
                            {
                                title: 'Aksi',
                                key: 'action',
                                width: 100,
                                align: 'center' as const,
                                render: (_, record) => (
                                    <Space size="small">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<DownloadOutlined />}
                                            onClick={() => window.open(record.FilePath, '_blank')}
                                            style={{ color: '#1677ff' }}
                                        />
                                        <Popconfirm
                                            title="Hapus lampiran ini?"
                                            onConfirm={handleDeleteAttachment}
                                            okText="Ya"
                                            cancelText="Batal"
                                            okButtonProps={{ danger: true }}
                                        >
                                            <Button
                                                type="text"
                                                danger
                                                size="small"
                                                icon={<DeleteOutlined />}
                                            />
                                        </Popconfirm>
                                    </Space>
                                ),
                            },
                        ]}
                    />
                )}
            </div>

            {/* Upload Section */}
            <Form form={form} layout="vertical">
                {/* File Upload */}
                <Form.Item
                    label="Upload File Baru"
                    required
                    style={{ marginBottom: 8 }}
                >
                    <Upload
                        beforeUpload={handleBeforeUpload}
                        onRemove={handleRemove}
                        fileList={fileList}
                        maxCount={1}
                        listType="text"
                    >
                        <Button icon={<UploadOutlined />}>Pilih File</Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                        Maksimal ukuran file: 10MB. Tipe yang diizinkan: PDF, JPG, PNG, GIF, WEBP
                    </Text>
                </Form.Item>

                {/* Description */}
                <Form.Item
                    name="description"
                    label="Deskripsi"
                >
                    <Input.TextArea placeholder="Tambahkan deskripsi (opsional)" rows={2} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default UploadAttachmentModal;
