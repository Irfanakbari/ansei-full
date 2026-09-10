/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, App, Select, DatePicker } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createForecast } from '@/store/features/production/forecast/forecastSlice';
import { fetchFinishGood } from '@/store/features/master/finishGoodSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const CreateForecastModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const { data: finishGoods } = useSelector((state: RootState) => state.finishGood);

    useEffect(() => {
        if (visible) {
            dispatch(fetchFinishGood());
        }
    }, [visible, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                poId: values.poId,
                date: values.date.format('YYYY-MM-DD'),
                vendorCode: values.vendorCode,
                vendorName: values.vendorName,
                receivingArea: values.receivingArea,
                deliveryDate: values.deliveryDate.format('YYYY-MM-DD'),
                deliveryPeriod: values.deliveryPeriod,
                classification: values.classification,
                poNumber: values.poNumber,
                item: values.item,
                qty: values.qty,
                finishGoodId: values.finishGoodId,
            };

            const result = await dispatch(createForecast(payload));

            if (createForecast.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Forecast created successfully');
            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create forecast');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New Forecast"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            width={800}
            zIndex={1050}
        >
            <Form form={form} layout="vertical" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Form.Item name="poId" label="PO ID" rules={[{ required: true, message: 'Please enter PO ID' }]}>
                    <Input placeholder="PO-2024-001" />
                </Form.Item>
                <Form.Item name="finishGoodId" label="Finish Good" rules={[{ required: true, message: 'Please select finish good' }]}>
                    <Select placeholder="Select finish good" showSearch filterOption={(input, option) =>
                        (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                    }>
                        {finishGoods.map(fg => (
                            <Select.Option key={fg.Id} value={fg.Id} label={`${fg.PartNumber} - ${fg.PartName}`}>
                                {fg.PartNumber} - {fg.PartName}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="vendorCode" label="Vendor Code" rules={[{ required: true, message: 'Please enter vendor code' }]}>
                    <Input placeholder="VC001" />
                </Form.Item>
                <Form.Item name="vendorName" label="Vendor Name" rules={[{ required: true, message: 'Please enter vendor name' }]}>
                    <Input placeholder="PT Supplier Indonesia" />
                </Form.Item>
                <Form.Item name="receivingArea" label="Receiving Area" rules={[{ required: true, message: 'Please enter receiving area' }]}>
                    <Input placeholder="WAREHOUSE-A" />
                </Form.Item>
                <Form.Item name="classification" label="Classification" rules={[{ required: true, message: 'Please enter classification' }]}>
                    <Input placeholder="REGULAR" />
                </Form.Item>
                <Form.Item name="poNumber" label="PO Number" rules={[{ required: true, message: 'Please enter PO number' }]}>
                    <Input placeholder="PO-2024-001" />
                </Form.Item>
                <Form.Item name="item" label="Item" rules={[{ required: true, message: 'Please enter item' }]}>
                    <InputNumber placeholder="1" min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="qty" label="Qty" rules={[{ required: true, message: 'Please enter qty' }]}>
                    <InputNumber placeholder="100" min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select date' }]}>
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="deliveryDate" label="Delivery Date" rules={[{ required: true, message: 'Please select delivery date' }]}>
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="deliveryPeriod" label="Delivery Period (days)" rules={[{ required: true, message: 'Please enter delivery period' }]}>
                    <InputNumber placeholder="5" min={1} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateForecastModal;