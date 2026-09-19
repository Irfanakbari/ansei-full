/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, App, Select, Divider } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { updateForecast, ForecastEntity } from '@/store/features/production/forecast/forecastSlice';
import { fetchFinishGood } from '@/store/features/master/finishGoodSlice';
import { fetchSupplier } from '@/store/features/master/supplierSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: ForecastEntity;
    onSuccess?: () => void;
}

const STATUS_OPTIONS = [
    { value: 'PENDING', label: 'PENDING' },
    { value: 'RELEASED', label: 'RELEASED' },
    { value: 'COMPLETED', label: 'COMPLETED' },
    { value: 'CANCELLED', label: 'CANCELLED' },
];

const EditForecastModal: React.FC<Props> = ({ visible, onClose, data, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const { data: finishGoods } = useSelector((state: RootState) => state.finishGood);
    const { data: suppliers, loading: supplierLoading } = useSelector((state: RootState) => state.supplier);

    useEffect(() => {
        if (visible) {
            dispatch(fetchFinishGood());
            dispatch(fetchSupplier({ page: 1, limit: 100 }));
        }
    }, [visible, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload: any = {
                status: values.status,
            };

            // Only include other fields if they were modified
            if (values.finishGoodId) payload.finishGoodId = values.finishGoodId;
            if (values.qty) payload.qty = values.qty;
            if (values.vendorCode) payload.vendorCode = values.vendorCode;
            if (values.vendorName) payload.vendorName = values.vendorName;
            if (values.receivingArea) payload.receivingArea = values.receivingArea;
            if (values.classification) payload.classification = values.classification;
            if (values.poNumber) payload.poNumber = values.poNumber;
            if (values.item) payload.item = values.item;
            if (values.deliveryDate) payload.deliveryDate = values.deliveryDate.format('YYYY-MM-DD');
            if (values.deliveryPeriod) payload.deliveryPeriod = values.deliveryPeriod;

            const result = await dispatch(updateForecast({ id: data.Id, data: payload }));
            if (updateForecast.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to create/update/delete');
            }
            message.success('Forecast updated successfully');
            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to update forecast');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Forecast"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            width={700}
            zIndex={1050}
            destroyOnHidden
        >
            <Form form={form} layout="vertical" initialValues={{
                finishGoodId: data.FinishGoodId,
                qty: data.Qty,
                vendorCode: data.VendorCode,
                vendorName: data.VendorName,
                receivingArea: data.ReceivingArea,
                classification: data.Classification,
                poNumber: data.PoNumber,
                item: data.Item,
                deliveryPeriod: data.DeliveryPeriod,
                status: data.Status,
            }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Divider titlePlacement="start" style={{ gridColumn: '1 / -1' }}>Order</Divider>
                <Form.Item name="status" label="Status">
                    <Select options={STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="finishGoodId" label="Finish Good">
                    <Select
                        placeholder="Select finish good"
                        showSearch={{ optionFilterProp: 'label' }}
                        options={finishGoods.map((finishGood) => ({
                            value: finishGood.PartNumber,
                            label: `${finishGood.PartNumber} - ${finishGood.PartName}`,
                        }))}
                    />
                </Form.Item>
                <Form.Item name="qty" label="Qty">
                    <InputNumber placeholder="100" min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="vendorCode" label="Vendor Code">
                    <Input placeholder="VC001" />
                </Form.Item>
                <Form.Item name="vendorName" label="Vendor">
                    <Select
                        placeholder="Select vendor"
                        loading={supplierLoading}
                        showSearch={{ optionFilterProp: 'label' }}
                        options={suppliers.map((supplier) => ({ value: supplier.Name, label: supplier.Name }))}
                    />
                </Form.Item>
                <Form.Item name="receivingArea" label="Receiving Area">
                    <Input placeholder="WAREHOUSE-A" />
                </Form.Item>
                <Form.Item name="classification" label="Classification">
                    <Input placeholder="REGULAR" />
                </Form.Item>
                <Form.Item name="poNumber" label="PO Number">
                    <Input placeholder="PO-2024-001" />
                </Form.Item>
                <Divider titlePlacement="start" style={{ gridColumn: '1 / -1' }}>Quantity and schedule</Divider>
                <Form.Item name="item" label="Item">
                    <InputNumber placeholder="1" min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="deliveryPeriod" label="Delivery Period (days)">
                    <InputNumber placeholder="5" min={1} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditForecastModal;
