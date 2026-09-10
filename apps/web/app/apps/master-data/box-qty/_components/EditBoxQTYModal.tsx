/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, App, Select } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { updateBoxQTY, fetchBoxQTY, BoxQTYEntity } from '@/store/features/master/boxQtySlice';
import { fetchFinishGood } from '@/store/features/master/finishGoodSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: BoxQTYEntity;
}

const EditBoxQTYModal: React.FC<Props> = ({ visible, onClose, data }) => {
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
                qty: values.qty ? Number(values.qty) : undefined,
            };

            const result = await dispatch(updateBoxQTY({ id: data.Id, data: payload }));
            if (updateBoxQTY.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to update box QTY');
            }
            message.success('Box QTY updated successfully');
            dispatch(fetchBoxQTY());
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to update box QTY');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Edit Box QTY"
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
            <Form form={form} layout="vertical" initialValues={{
                partNumber: data.PartNumber,
                qty: data.Qty,
            }}>
                <Form.Item name="partNumber" label="Finish Good">
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
                <Form.Item name="qty" label="Qty Per Box">
                    <InputNumber placeholder="0" min={1} style={{ width: '100%' }} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default EditBoxQTYModal;
