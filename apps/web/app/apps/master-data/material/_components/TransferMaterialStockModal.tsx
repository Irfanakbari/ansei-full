/*By Irfan Akbari Vuteq Indonesia - 2026-09-24*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, App, Alert } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    MaterialEntity,
    fetchMaterial,
    transferMaterialStock
} from '@/store/features/master/materialSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    data: MaterialEntity | null;
}

const TransferMaterialStockModal: React.FC<Props> = ({ visible, onClose, onSuccess, data }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<'WAREHOUSE' | 'RACK'>('WAREHOUSE');

    const { data: allMaterials } = useSelector((state: RootState) => state.material);

    useEffect(() => {
        if (visible && data) {
            setSelectedLocation('WAREHOUSE');
            form.setFieldsValue({
                location: 'WAREHOUSE',
                qty: 1,
                targetPartNumber: undefined,
                reason: '',
            });
            // Fetch material list if needed for target selection
            dispatch(fetchMaterial({ page: 1, limit: 100 }));
        }
    }, [visible, data, form, dispatch]);

    if (!data) return null;

    const availableStock = selectedLocation === 'WAREHOUSE' ? data.QtyWarehouse : data.QtyRack;

    // Filter candidate target materials: must be active and not the source material
    const targetOptions = allMaterials
        .filter((m) => m.IsActive && m.PartNumber !== data.PartNumber)
        .map((m) => ({
            value: m.PartNumber,
            label: `${m.PartNumber} - ${m.PartName} (Rack: ${m.QtyRack}, Wh: ${m.QtyWarehouse})`,
        }));

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            if (availableStock <= 0) {
                message.error(`No stock available at ${selectedLocation} to transfer.`);
                return;
            }
            if (values.qty > availableStock) {
                message.error(`Transfer quantity exceeds available stock (${availableStock}).`);
                return;
            }

            setLoading(true);

            const payload = {
                sourcePartNumber: data.PartNumber,
                targetPartNumber: values.targetPartNumber,
                location: values.location as 'WAREHOUSE' | 'RACK',
                qty: values.qty,
                reason: values.reason,
            };

            const result = await dispatch(transferMaterialStock(payload));

            if (transferMaterialStock.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to transfer stock');
            }

            message.success('Material stock transferred successfully');
            onSuccess?.();
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to transfer material stock');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Transfer Stock / Part Supersession (Material)"
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
                    title="Pindah Saldo Stok Antar Part Number"
                    description="Fitur ini digunakan saat terjadi perubahan Part Number (supersession/pengganti). Stok akan dikurangi dari part lama dan ditambahkan ke part baru dengan pencatatan mutasi di Inventory Ledger secara aman."
                    style={{ marginBottom: 16 }}
                />

                <div style={{ marginBottom: 16, background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #f0f0f0' }}>
                    <p style={{ margin: 0 }}><strong>Source Part Number:</strong> {data.PartNumber}</p>
                    <p style={{ margin: '4px 0 0 0' }}><strong>Part Name:</strong> {data.PartName}</p>
                    <p style={{ margin: '4px 0 0 0' }}>
                        <strong>Current Stock:</strong> Warehouse: {data.QtyWarehouse} | Rack: {data.QtyRack}
                    </p>
                </div>

                <Form.Item
                    name="location"
                    label="Lokasi Stok Asal & Tujuan"
                    rules={[{ required: true, message: 'Please select location' }]}
                >
                    <Select
                        onChange={(val) => setSelectedLocation(val)}
                        options={[
                            { value: 'WAREHOUSE', label: `WAREHOUSE (Available: ${data.QtyWarehouse})` },
                            { value: 'RACK', label: `RACK (Available: ${data.QtyRack})` },
                        ]}
                    />
                </Form.Item>

                <Form.Item
                    name="targetPartNumber"
                    label="Target Part Number (Tujuan)"
                    rules={[{ required: true, message: 'Please select target part number' }]}
                >
                    <Select
                        placeholder="Select active target material"
                        showSearch
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
                        placeholder="Contoh: Perubahan part number model 2026, saldo stok lama dimigrasikan ke part baru."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default TransferMaterialStockModal;
