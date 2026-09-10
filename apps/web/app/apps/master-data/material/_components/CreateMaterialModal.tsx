/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, App, Select } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createMaterial, fetchMaterial } from '@/store/features/master/materialSlice';
import { fetchSatuan } from '@/store/features/master/satuanSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const CreateMaterialModal: React.FC<Props> = ({ visible, onClose }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const { data: satuan } = useSelector((state: RootState) => state.satuan);

    useEffect(() => {
        if (visible) {
            dispatch(fetchSatuan());
        }
    }, [visible, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                partNumber: values.partNumber,
                partName: values.partName,
                supplier: values.supplier,
                satuanId: values.satuanId,
                rackLocation: values.rackLocation,
                qtyRack: values.qtyRack || 0,
                qtyWarehouse: values.qtyWarehouse || 0,
            };

            const result = await dispatch(createMaterial(payload));

            if (createMaterial.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Material created successfully');
            dispatch(fetchMaterial());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create material');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New Material"
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
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="partNumber" label="Part Number" rules={[{ required: true, message: 'Please enter part number' }]}>
                    <Input placeholder="Enter part number" />
                </Form.Item>
                <Form.Item name="partName" label="Part Name" rules={[{ required: true, message: 'Please enter part name' }]}>
                    <Input placeholder="Enter part name" />
                </Form.Item>
                <Form.Item name="supplier" label="Supplier">
                    <Input placeholder="Enter supplier name" />
                </Form.Item>
                <Form.Item name="satuanId" label="Unit">
                    <Select placeholder="Select unit" allowClear>
                        {satuan.map(s => (
                            <Select.Option key={s.Id} value={s.Id}>{s.Name}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="rackLocation" label="Rack Location">
                    <Input placeholder="Enter rack location" />
                </Form.Item>
                <Form.Item name="qtyRack" label="Qty Rack">
                    <InputNumber placeholder="0" min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="qtyWarehouse" label="Qty Warehouse">
                    <InputNumber placeholder="0" min={0} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateMaterialModal;
