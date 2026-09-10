/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, App, Select } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createBOM, fetchBOM } from '@/store/features/master/bomSlice';
import { fetchMaterial } from '@/store/features/master/materialSlice';
import { fetchFinishGood } from '@/store/features/master/finishGoodSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const CreateBOMModal: React.FC<Props> = ({ visible, onClose }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const { data: materials } = useSelector((state: RootState) => state.material);
    const { data: finishGoods } = useSelector((state: RootState) => state.finishGood);

    useEffect(() => {
        if (visible) {
            dispatch(fetchMaterial());
            dispatch(fetchFinishGood());
        }
    }, [visible, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // Konversi eksplisit - pastikan semua jadi string
            const payload = {
                materialId: String(Number(values.materialId) || 0),
                finishGoodId: String(Number(values.finishGoodId) || 0),
                qty: String(Number(values.qty) || 0),
            };

            console.log('Payload to send:', payload);

            const result = await dispatch(createBOM(payload));

            if (createBOM.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to create BOM');
            }
            message.success('BOM created successfully');
            dispatch(fetchBOM());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create BOM');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New BOM"
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
            width={500}
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
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
                <Form.Item name="materialId" label="Material" rules={[{ required: true, message: 'Please select material' }]}>
                    <Select placeholder="Select material" showSearch filterOption={(input, option) =>
                        (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                    }>
                        {materials.map(mat => (
                            <Select.Option key={mat.Id} value={mat.Id} label={`${mat.PartNumber} - ${mat.PartName}`}>
                                {mat.PartNumber} - {mat.PartName}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="qty" label="Qty" rules={[{ required: true, message: 'Please enter qty' }]}>
                    <InputNumber placeholder="0" min={1} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateBOMModal;
