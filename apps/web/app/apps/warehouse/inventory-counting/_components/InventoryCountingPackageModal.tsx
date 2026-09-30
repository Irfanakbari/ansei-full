/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */
"use client";

import {useEffect} from 'react';
import {Alert, Button, Form, Input, Modal, Space, Tag, Typography} from 'antd';
import type {InventoryCountingPackageStatus} from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';

interface Props {
    open: boolean;
    status: InventoryCountingPackageStatus | null;
    loading: boolean;
    sending: boolean;
    onClose: () => void;
    onRefresh: () => void;
    onGenerate: () => void;
    onDownload: () => void;
    onSend: (recipients: string[], subject?: string, message?: string) => Promise<void>;
}

interface FormValues {
    recipients: string;
    subject?: string;
    message?: string;
}

export default function InventoryCountingPackageModal({open, status, loading, sending, onClose, onRefresh, onGenerate, onDownload, onSend}: Props) {
    const [form] = Form.useForm<FormValues>();
    useEffect(() => {
        if (!open) form.resetFields();
    }, [form, open]);
    const generationStatus = status?.generation?.status ?? 'NOT_STARTED';
    return (
        <Modal centered open={open} title="Inventory Counting Document Package" onCancel={onClose} footer={null} destroyOnHidden forceRender>
            <Space orientation="vertical" style={{width: '100%'}} size="middle">
                <Space><Typography.Text>Generation:</Typography.Text><Tag>{generationStatus}</Tag></Space>
                {status?.generation?.error && <Alert type="error" showIcon title={status.generation.error.message}/>}
                {status?.artifact ? (
                    <Alert type="success" showIcon title={status.artifact.FileName} description={`${Math.ceil(status.artifact.FileSize / 1024)} KB`}/>
                ) : (
                    <Alert type="info" showIcon title="The durable worker is preparing XLSX, PDF, labels, and ZIP files."/>
                )}
                <Space>
                    <Button loading={loading} onClick={onRefresh}>Refresh</Button>
                    {!status?.generation && (
                        <Button type="primary" loading={loading} onClick={onGenerate}>Generate Package</Button>
                    )}
                    <Button type="primary" disabled={!status?.artifact} onClick={onDownload}>Download ZIP</Button>
                </Space>
                <Form form={form} layout="vertical" onFinish={(values) => onSend(values.recipients.split(/[,;\n]/).map((value) => value.trim()).filter(Boolean), values.subject, values.message)}>
                    <Form.Item name="recipients" label="Recipients" rules={[{required: true, message: 'Enter at least one email address'}]}>
                        <Input.TextArea rows={2} placeholder="recipient@example.com"/>
                    </Form.Item>
                    <Form.Item name="subject" label="Subject"><Input maxLength={200}/></Form.Item>
                    <Form.Item name="message" label="Message"><Input.TextArea rows={3} maxLength={2000}/></Form.Item>
                    <Button type="primary" htmlType="submit" loading={sending} disabled={!status?.artifact}>Send Package</Button>
                </Form>
            </Space>
        </Modal>
    );
}
