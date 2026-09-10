/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, App, Select } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createBoxQTY, fetchBoxQTY } from '@/store/features/master/boxQtySlice';
import { fetchFinishGood } from '@/store/features/master/finishGoodSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const CreateBoxQTYModal: React.FC<Props> = ({ visible, onClose }) => {
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
                partNumber: values.partNumber,
                qty: Number(values.qty),
            };

            const result = await dispatch(createBoxQTY(payload));

            if (createBoxQTY.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to create box QTY');
            }
            message.success('Box QTY created successfully');
            dispatch(fetchBoxQTY());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create box QTY');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New Box QTY"
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
                <Form.Item name="partNumber" label="Finish Good" rules={[{ required: true, message: 'Please select finish good' }]}>
                    <Select placeholder="Select finish good" showSearch filterOption={(input, option) =>
                        (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                    }>
                        {finishGoods.map(fg => (
                            <Select.Option key={fg.Id} value={fg.PartNumber} label={`${fg.PartNumber} - ${fg.PartName}`}>
                                {fg.PartNumber} - {fg.PartName}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="qty" label="Qty Per Box" rules={[{ required: true, message: 'Please enter qty' }]}>
                    <InputNumber placeholder="0" min={1} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateBoxQTYModal;
