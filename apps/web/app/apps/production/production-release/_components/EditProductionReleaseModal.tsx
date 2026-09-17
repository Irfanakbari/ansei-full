/*By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-09-17*/
"use client";

import React, { useEffect, useState } from 'react';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { DeleteOutlined, DownloadOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    deleteAttachment,
    downloadAttachment,
    fetchAttachments,
    ProductionAttachment,
    ProductionReleaseEntity,
    replaceAttachment,
    updateProductionRelease,
    UpdateProductionReleasePayload,
    uploadAttachments,
} from '@/store/features/production/productionRelease/productionReleaseSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: ProductionReleaseEntity;
    onSuccess?: () => void;
}

interface FormValues {
    status: UpdateProductionReleasePayload['status'];
    notes?: string;
    isNoAttachment: boolean;
}

const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

const EditProductionReleaseModal: React.FC<Props> = ({ visible, onClose, data, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { attachments, attachmentLoading } = useSelector((state: RootState) => state.productionRelease);
    const [form] = Form.useForm<FormValues>();
    const [loading, setLoading] = useState(false);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const noAttachment = Form.useWatch('isNoAttachment', form);
    const status = Form.useWatch('status', form);

    useEffect(() => {
        if (!visible) return;
        form.setFieldsValue({ status: data.Status as FormValues['status'], notes: data.Notes ?? undefined, isNoAttachment: data.IsNoAttachment });
        setFileList([]);
        void dispatch(fetchAttachments(data.Id));
    }, [data, dispatch, form, visible]);

    const validateFile = (file: File): boolean => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!extension || !allowedExtensions.includes(extension)) {
            message.error('Allowed file types: PDF, JPG, JPEG, PNG, GIF, WEBP');
            return false;
        }
        if (file.size > 10 * 1024 * 1024) {
            message.error('Each file must be 10 MB or smaller');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const files = fileList.flatMap((item) => item.originFileObj ? [item.originFileObj] : []);
            if (values.status === 'COMPLETED' && !values.isNoAttachment && attachments.length + files.length === 0) {
                message.error('Upload at least one attachment or select No Attachment before completing the release');
                return;
            }
            if (values.isNoAttachment && attachments.length > 0) {
                message.error('Delete existing attachments before selecting No Attachment');
                return;
            }
            setLoading(true);
            if (files.length > 0) await dispatch(uploadAttachments({ productionReleaseId: data.Id, files })).unwrap();
            const payload: UpdateProductionReleasePayload = { status: values.status, notes: values.notes, isNoAttachment: values.isNoAttachment };
            await dispatch(updateProductionRelease({ id: data.Id, data: payload })).unwrap();
            message.success('Production release updated successfully');
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'errorFields' in error) return;
            message.error(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    };

    const handleReplace = async (attachment: ProductionAttachment, file: File) => {
        if (!validateFile(file)) return false;
        try {
            await dispatch(replaceAttachment({ productionReleaseId: data.Id, attachmentId: attachment.Id, file })).unwrap();
            message.success('Attachment replaced');
        } catch (error: unknown) {
            message.error(error instanceof Error ? error.message : String(error));
        }
        return false;
    };

    const columns = [
        { title: 'File', dataIndex: 'FileName', key: 'FileName', ellipsis: true },
        { title: 'Size', dataIndex: 'FileSize', key: 'FileSize', width: 90, render: (value: number | null) => value == null ? '-' : `${(value / 1024).toFixed(1)} KB` },
        { title: 'Created By', dataIndex: 'CreatedByName', key: 'CreatedByName', width: 130, render: (_: string, record: ProductionAttachment) => record.CreatedByName ?? record.CreatedBy ?? '-' },
        {
            title: 'Actions', key: 'actions', width: 130, render: (_: unknown, record: ProductionAttachment) => (
                <Space size="small">
                    <Button type="text" icon={<DownloadOutlined />} onClick={() => void dispatch(downloadAttachment({ productionReleaseId: data.Id, attachment: record }))} />
                    <Upload showUploadList={false} maxCount={1} beforeUpload={(file) => handleReplace(record, file)} disabled={data.Status === 'COMPLETED'}>
                        <Button type="text" icon={<EditOutlined />} disabled={data.Status === 'COMPLETED'} />
                    </Upload>
                    <Popconfirm title="Delete attachment?" onConfirm={() => dispatch(deleteAttachment({ productionReleaseId: data.Id, attachmentId: record.Id })).unwrap().catch((error) => message.error(String(error)))}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Modal title="Edit Production Release" open={visible} onOk={handleSubmit} centered onCancel={onClose} confirmLoading={loading} width={850} destroyOnHidden>
            <Form form={form} layout="vertical">
                <Form.Item name="status" label="Status"><Select options={['DRAFT', 'RELEASED', 'COMPLETED'].map((value) => ({ value, label: value }))} /></Form.Item>
                <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
                <Form.Item name="isNoAttachment" label="No Attachment" valuePropName="checked"><Switch /></Form.Item>
                <Typography.Title level={5}>Attachments</Typography.Title>
                <Table<ProductionAttachment> columns={columns} dataSource={attachments} rowKey="Id" size="small" pagination={false} loading={attachmentLoading} locale={{ emptyText: 'No attachments' }} />
                <Form.Item label="Add files" required={status === 'COMPLETED' && !noAttachment} style={{ marginTop: 16 }}>
                    <Upload multiple maxCount={10} fileList={fileList} disabled={noAttachment || data.Status === 'COMPLETED'} beforeUpload={(file) => { if (!validateFile(file)) return Upload.LIST_IGNORE; setFileList((current) => current.length >= 10 ? current : [...current, file]); return false; }} onRemove={(file) => setFileList((current) => current.filter((item) => item.uid !== file.uid))}>
                        <Button icon={<UploadOutlined />} disabled={noAttachment || data.Status === 'COMPLETED'}>Select files</Button>
                    </Upload>
                    <Typography.Text type="secondary">Up to 10 files per upload, 10 MB each. PDF and image files only.</Typography.Text>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditProductionReleaseModal;
