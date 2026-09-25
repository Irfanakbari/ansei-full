/*By Irfan Akbari Vuteq Indonesia - 2026-09-24*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, App, Alert } from 'antd';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import {
    FinishGoodEntity,
    transferFinishGoodStock
} from '@/store/features/master/finishGoodSlice';
import { get, type PaginatedApiSuccessEnvelope } from '@/store/utils/apiService';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    data: FinishGoodEntity | null;
}

const TransferFinishGoodStockModal: React.FC<Props> = ({ visible, onClose, onSuccess, data }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fetchingTargets, setFetchingTargets] = useState(false);
    const [targetFinishGoods, setTargetFinishGoods] = useState<FinishGoodEntity[]>([]);

    const partNumber = data?.PartNumber;

    useEffect(() => {
        if (visible && partNumber) {
            form.setFieldsValue({
                qty: 1,
                targetPartNumber: undefined,
                reason: '',
            });
            let alive = true;
            setFetchingTargets(true);
            void (async () => {
                try {
                    const res = await get<PaginatedApiSuccessEnvelope<FinishGoodEntity>>('/master/finish-good', {
                        params: { limit: 200 }
                    });
                    if (alive && Array.isArray(res.data)) {
                        setTargetFinishGoods(res.data);
                    }
                } catch {
                    // ignore
                } finally {
                    if (alive) setFetchingTargets(false);
                }
            })();
            return () => {
                alive = false;
            };
        }
    }, [visible, partNumber, form]);

    if (!data) return null;

    const availableStock = data.Qty;

    // Filter candidate target FG: active and not source FG
    const targetOptions = targetFinishGoods
        .filter((fg) => fg.IsActive && fg.PartNumber !== data.PartNumber)
        .map((fg) => ({
            value: fg.PartNumber,
            label: `${fg.PartNumber} - ${fg.PartName} (Stock: ${fg.Qty})`,
        }));

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            if (availableStock <= 0) {
                message.error('No stock available to transfer.');
                return;
            }
            if (values.qty > availableStock) {
                message.error(`Transfer quantity exceeds available stock (${availableStock}).`);
                return;
            }

            setLoading(true);

            const payload = {
                id: data.Id,
                targetPartNumber: values.targetPartNumber,
                qty: values.qty,
                reason: values.reason,
            };

            const result = await dispatch(transferFinishGoodStock(payload));

            if (transferFinishGoodStock.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to transfer finish good stock');
            }

            message.success('Finish good stock transferred successfully');
            onSuccess?.();
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to transfer finish good stock');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Transfer Stock / Part Supersession (Finish Good)"
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
            width={600}
            okText="Transfer Stock"
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Alert
                    type="info"
                    showIcon
                    title="Pindah Saldo Stok Antar Part Number Finish Good"
                    description="Fitur ini digunakan saat terjadi perubahan Part Number Finish Good (supersession/pengganti). Stok di area Finish Good akan dikurangi dari part lama dan ditambahkan ke part baru dengan pencatatan mutasi di Inventory Ledger secara aman."
                    style={{ marginBottom: 16 }}
                />

                <div style={{ marginBottom: 16, background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #f0f0f0' }}>
                    <p style={{ margin: 0 }}><strong>Source Part Number:</strong> {data.PartNumber}</p>
                    <p style={{ margin: '4px 0 0 0' }}><strong>Part Name:</strong> {data.PartName}</p>
                    <p style={{ margin: '4px 0 0 0' }}><strong>Current Stock:</strong> {data.Qty}</p>
                </div>

                <Form.Item
                    name="targetPartNumber"
                    label="Target Part Number (Tujuan)"
                    rules={[{ required: true, message: 'Please select target finish good' }]}
                >
                    <Select
                        placeholder="Select active target finish good"
                        showSearch
                        loading={fetchingTargets}
                        optionFilterProp="label"
                        options={targetOptions}
                    />
                </Form.Item>

                <Form.Item
                    name="qty"
                    label={`Quantity to Transfer (Max: ${availableStock})`}
                    rules={[
                        { required: true, message: 'Please enter transfer quantity' },
                        { type: 'number', min: 1, message: 'Quantity must be at least 1' },
                        { type: 'number', max: Math.max(availableStock, 1), message: `Quantity cannot exceed ${availableStock}` },
                    ]}
                >
                    <InputNumber
                        min={1}
                        max={availableStock > 0 ? availableStock : 1}
                        precision={0}
                        style={{ width: '100%' }}
                        disabled={availableStock <= 0}
                    />
                </Form.Item>

                <Form.Item
                    name="reason"
                    label="Alasan Transfer / Supersession"
                    rules={[{ required: true, message: 'Please enter the reason for transfer' }]}
                >
                    <Input.TextArea
                        rows={3}
                        placeholder="Contoh: Engineering change model baru FG-002, sisa stok lama dimigrasikan ke part baru."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default TransferFinishGoodStockModal;
