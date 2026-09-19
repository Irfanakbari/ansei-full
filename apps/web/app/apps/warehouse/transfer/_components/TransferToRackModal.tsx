/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useRef, useState } from 'react';
import { Modal, Form, InputNumber, App, Descriptions, Alert, Space } from 'antd';
import { SwapOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { transferToRack, clearTransferResult } from '@/store/features/warehouse/transfer/transferSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    material: {
        Id: number;
        PartNumber: string;
        PartName: string;
        QtyRack: number;
        QtyWarehouse: number;
    };
    onSuccess?: () => void;
}

const TransferToRackModal: React.FC<Props> = ({ visible, onClose, material, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const inFlight = useRef(false);
    const [previewQty, setPreviewQty] = useState<number>(0);

    const { result } = useSelector((state: RootState) => state.transfer);

    const handleOk = async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (values.qty > material.QtyWarehouse) {
                message.error('Transfer qty cannot exceed warehouse qty');
                setLoading(false);
                return;
            }

            const result = await dispatch(transferToRack({ partNumber: material.PartNumber, qty: values.qty }));
            if (transferToRack.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to transfer to rack');
            }
            message.success('Transfer successful');
            form.resetFields();
            setPreviewQty(0);
            onSuccess?.();
            onClose();
            dispatch(clearTransferResult());
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to transfer to rack');
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setPreviewQty(0);
        dispatch(clearTransferResult());
        onClose();
    };

    const handleQtyChange = (value: number | null) => {
        setPreviewQty(value || 0);
    };

    // Calculate preview
    const warehouseAfter = material.QtyWarehouse - previewQty;
    const rackAfter = material.QtyRack + previewQty;

    return (
        <Modal
            title={
                <Space>
                    <SwapOutlined />
                    <span>Transfer to Rack</span>
                </Space>
            }
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={500}
            destroyOnHidden
            zIndex={1050}
        >
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Part Number" span={2}>
                    <code style={{ fontSize: 11 }}>{material.PartNumber}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Part Name" span={2}>
                    {material.PartName}
                </Descriptions.Item>
                <Descriptions.Item label="Rack Qty">
                    <span style={{ color: '#52c41a', fontWeight: 600 }}>{material.QtyRack}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Warehouse Qty">
                    <span style={{ color: '#1677ff', fontWeight: 600 }}>{material.QtyWarehouse}</span>
                </Descriptions.Item>
            </Descriptions>

            <Form form={form} layout="vertical">
                <Form.Item
                    name="qty"
                    label="Quantity to Transfer"
                    rules={[
                        { required: true, message: 'Please enter qty' },
                        { type: 'number', min: 1, message: 'Minimum qty is 1' },
                        { type: 'number', max: material.QtyWarehouse, message: `Qty cannot exceed ${material.QtyWarehouse}` },
                    ]}
                >
                    <InputNumber
                        placeholder="Enter qty"
                        min={1}
                        max={material.QtyWarehouse}
                        style={{ width: '100%' }}
                        onChange={handleQtyChange}
                    />
                </Form.Item>
            </Form>

            {previewQty > 0 && previewQty <= material.QtyWarehouse && (
                <Alert
                    type="info"
                    showIcon
                    title="Preview Transfer"
                    description={
                        <div>
                            <div>Warehouse: <strong>{material.QtyWarehouse}</strong> → <strong>{warehouseAfter}</strong></div>
                            <div>Rack: <strong>{material.QtyRack}</strong> → <strong>{rackAfter}</strong></div>
                        </div>
                    }
                    style={{ marginTop: 16 }}
                />
            )}

            {result && result.success && (
                <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                    title="Transfer Successful"
                    description={
                        <div>
                            <div>Part Number: <strong>{result.partNumber}</strong></div>
                            <div>Transfer Qty: <strong>{result.transferQty}</strong></div>
                            <div>Warehouse: {result.warehouseBefore} → {result.warehouseAfter}</div>
                            <div>Rack: {result.rackBefore} → {result.rackAfter}</div>
                        </div>
                    }
                    style={{ marginTop: 16 }}
                />
            )}
        </Modal>
    );
};

export default TransferToRackModal;