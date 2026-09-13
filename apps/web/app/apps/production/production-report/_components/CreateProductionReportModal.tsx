/*By Irfan Akbari Vuteq Indonesia - 2026-06-08*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, App, Select, DatePicker, Input, Typography } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchFinishGood } from '@/store/features/master/finishGoodSlice';
import { fetchManPower } from '@/store/features/master/manPowerSlice';
import { fetchForecast } from '@/store/features/production/forecast/forecastSlice';

const { Text } = Typography;

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const PART_TYPE_OPTIONS = [
    { value: 'ONE', label: 'ONE' },
    { value: 'TWO', label: 'TWO' },
    { value: 'THREE', label: 'THREE' },
    { value: 'FOUR', label: 'FOUR' },
];

const CreateProductionReportModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const { data: finishGoods } = useSelector((state: RootState) => state.finishGood);
    const { data: manPowers } = useSelector((state: RootState) => state.manPower);
    const { data: forecasts } = useSelector((state: RootState) => state.forecast);

    useEffect(() => {
        if (visible) {
            dispatch(fetchFinishGood());
            dispatch(fetchManPower());
            dispatch(fetchForecast());
        }
    }, [visible, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                date: values.date?.format('YYYY-MM-DD'),
                time: values.time || '00:00:00',
                productionStamp: values.productionStamp?.toISOString(),
                ngQty: values.ngQty || 0,
                startTime: values.startTime || undefined,
                startStamp: values.startStamp?.toISOString() || undefined,
                endTime: values.endTime || undefined,
                endStamp: values.endStamp?.toISOString() || undefined,
                stopMinute: values.stopMinute || 0,
                latchDate: values.latchDate?.format('YYYY-MM-DD') || undefined,
                cableHDate: values.cableHDate?.format('YYYY-MM-DD') || undefined,
                cableLDate: values.cableLDate?.format('YYYY-MM-DD') || undefined,
                coverDate: values.coverDate?.format('YYYY-MM-DD') || undefined,
                rodDate: values.rodDate?.format('YYYY-MM-DD') || undefined,
                sponsDate: values.sponsDate?.format('YYYY-MM-DD') || undefined,
                sponsRearDate: values.sponsRearDate?.format('YYYY-MM-DD') || undefined,
                clipDate: values.clipDate?.format('YYYY-MM-DD') || undefined,
                leverDate: values.leverDate?.format('YYYY-MM-DD') || undefined,
                smallPadDate: values.smallPadDate?.format('YYYY-MM-DD') || undefined,
                actuatorDate: values.actuatorDate?.format('YYYY-MM-DD') || undefined,
                backPlateDate: values.backPlateDate?.format('YYYY-MM-DD') || undefined,
                stampDate: values.stampDate?.format('YYYY-MM-DD') || undefined,
                poNumber: values.poNumber || undefined,
                recordType: values.recordType,
                qty: values.qty,
                manPowerUid: values.manPowerUid,
                finishGoodId: values.finishGoodId,
            };

            const response = await fetch('/api/proxy/v1/production/production-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create production report');
            }

            message.success('Production report created successfully');
            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: any) {
            message.error(error.message || 'Failed to create production report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create Production Report"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            width={900}
            zIndex={1050}
        >
            <Form form={form} layout="vertical" initialValues={{ ngQty: 0, stopMinute: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
                    <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select date' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="time" label="Time">
                        <Input type="time" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="productionStamp" label="Production Stamp">
                        <DatePicker showTime style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
                    <Form.Item name="manPowerUid" label="Man Power" rules={[{ required: true, message: 'Please select man power' }]}>
                        <Select
                            placeholder="Select man power"
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {manPowers.map(mp => (
                                <Select.Option key={mp.Uid} value={mp.Uid} label={`${mp.Nik} - ${mp.Name}`}>
                                    {mp.Nik} - {mp.Name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="finishGoodId" label="Finish Good" rules={[{ required: true, message: 'Please select finish good' }]}>
                        <Select
                            placeholder="Select finish good"
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {finishGoods.map(fg => (
                                <Select.Option key={fg.PartNumber} value={fg.PartNumber} label={`${fg.PartNumber} - ${fg.PartName}`}>
                                    {fg.PartNumber} - {fg.PartName}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="poNumber" label="PO Number">
                        <Select
                            placeholder="Select PO Number"
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {forecasts.map(f => (
                                <Select.Option key={f.Id} value={f.PoId} label={f.PoId}>
                                    {f.PoId}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
                    <Form.Item name="recordType" label="Part Type" rules={[{ required: true, message: 'Please select part type' }]}>
                        <Select placeholder="Select part type">
                            {PART_TYPE_OPTIONS.map(opt => (
                                <Select.Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="qty" label="Good Qty" rules={[{ required: true, message: 'Please enter good qty' }]}>
                        <InputNumber placeholder="100" min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="ngQty" label="NG Qty">
                        <InputNumber placeholder="0" min={0} style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <Text type="secondary" style={{ fontSize: 12 }}>Time Details</Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px', marginTop: 8 }}>
                    <Form.Item name="startTime" label="Start Time">
                        <Input type="time" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="endTime" label="End Time">
                        <Input type="time" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="stopMinute" label="Stop (min)">
                        <InputNumber placeholder="0" min={0} style={{ width: '100%' }} />
                    </Form.Item>
                </div>

                <Text type="secondary" style={{ fontSize: 12 }}>Production Stamps</Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px', marginTop: 8 }}>
                    <Form.Item name="latchDate" label="Latch Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="cableHDate" label="Cable H Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="cableLDate" label="Cable L Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="coverDate" label="Cover Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="rodDate" label="Rod Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="sponsDate" label="Spons Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="sponsRearDate" label="Spons Rear Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="clipDate" label="Clip Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="leverDate" label="Lever Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="smallPadDate" label="Small Pad Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="actuatorDate" label="Actuator Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="backPlateDate" label="Back Plate Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="stampDate" label="Stamp Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                </div>
            </Form>
        </Modal>
    );
};

export default CreateProductionReportModal;
