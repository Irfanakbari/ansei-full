/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState } from 'react';
import { Modal, Form, Select, DatePicker, App } from 'antd';

const { RangePicker } = DatePicker;

interface Props {
    visible: boolean;
    onClose: () => void;
}

const ExportStockTransactionModal: React.FC<Props> = ({ visible, onClose }) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleExport = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload: Record<string, string> = {};

            if (values.dateRange && values.dateRange[0] && values.dateRange[1]) {
                payload.transactionDateFrom = values.dateRange[0].format('YYYY-MM-DD');
                payload.transactionDateTo = values.dateRange[1].format('YYYY-MM-DD');
            }
            if (values.itemCategory) {
                payload.itemCategory = values.itemCategory;
            }
            if (values.transactionType) {
                payload.transactionType = values.transactionType;
            }
            if (values.materialId) {
                payload.materialId = values.materialId;
            }
            if (values.referenceDoc) {
                payload.referenceDoc = values.referenceDoc;
            }
            if (values.createdBy) {
                payload.createdBy = values.createdBy;
            }

            const response = await fetch('/ansei/api/system-administration/stock-transaction-log/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                message.error(errorData.message || 'Gagal export stock transaction log');
                setLoading(false);
                return;
            }

            // Get the blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'stock-transaction-log.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            message.success('Export berhasil');
            onClose();
            form.resetFields();
        } catch (error: any) {
            if (error?.errorFields) return;
            message.error(error.message || 'Gagal export stock transaction log');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title="Export Stock Transaction Log"
            open={visible}
            onOk={handleExport}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={500}
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="dateRange" label="Date Range">
                    <RangePicker
                        style={{ width: '100%' }}
                        format="YYYY-MM-DD"
                        allowClear
                    />
                </Form.Item>
                <Form.Item name="itemCategory" label="Category">
                    <Select
                        placeholder="Select category"
                        allowClear
                        options={[
                            { label: 'MATERIAL', value: 'MATERIAL' },
                            { label: 'FINISH_GOOD', value: 'FINISH_GOOD' },
                        ]}
                    />
                </Form.Item>
                <Form.Item name="transactionType" label="Transaction Type">
                    <Select
                        placeholder="Select transaction type"
                        allowClear
                        options={[
                            { label: 'INCOMING_SUPPLIER', value: 'INCOMING_SUPPLIER' },
                            { label: 'INCOMING_PRODUCTION', value: 'INCOMING_PRODUCTION' },
                            { label: 'OUTGOING_SHIPMENT', value: 'OUTGOING_SHIPMENT' },
                            { label: 'OUTGOING_RETURN', value: 'OUTGOING_RETURN' },
                            { label: 'TRANSFER_TO_RACK', value: 'TRANSFER_TO_RACK' },
                            { label: 'TRANSFER_TO_FINISH_GOOD', value: 'TRANSFER_TO_FINISH_GOOD' },
                            { label: 'ADJUSTMENT_IN', value: 'ADJUSTMENT_IN' },
                            { label: 'ADJUSTMENT_OUT', value: 'ADJUSTMENT_OUT' },
                            { label: 'SHOPPING_PICK', value: 'SHOPPING_PICK' },
                        ]}
                    />
                </Form.Item>
                <Form.Item name="materialId" label="Material ID">
                    <Select
                        placeholder="Enter Material ID"
                        allowClear
                        showSearch
                        mode="tags"
                        maxCount={5}
                        tokenSeparators={[',']}
                    />
                </Form.Item>
                <Form.Item name="referenceDoc" label="Reference">
                    <Select
                        placeholder="Enter Reference"
                        allowClear
                        showSearch
                        mode="tags"
                        maxCount={5}
                        tokenSeparators={[',']}
                    />
                </Form.Item>
                <Form.Item name="createdBy" label="Created By">
                    <Select
                        placeholder="Enter Created By"
                        allowClear
                        showSearch
                        mode="tags"
                        maxCount={5}
                        tokenSeparators={[',']}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ExportStockTransactionModal;
