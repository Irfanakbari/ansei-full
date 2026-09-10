/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Table, InputNumber, App, Space } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { checkIncoming, IncomingMaterial } from '@/store/features/warehouse/incoming/incomingSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    incomingId: string;
    materials: IncomingMaterial[];
    onSuccess?: () => void;
}

interface CheckingMaterial {
    key: number;
    id: number;
    partNumber: string;
    partName: string;
    qty: number;
    qtyChecked: number;
}

const CheckingIncomingModal: React.FC<Props> = ({ visible, onClose, incomingId, materials, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [loading, setLoading] = useState(false);
    const [checkingMaterials, setCheckingMaterials] = useState<CheckingMaterial[]>([]);

    useEffect(() => {
        if (visible && materials.length > 0) {
            setCheckingMaterials(
                materials.map((m, index) => ({
                    key: index,
                    id: m.Id,
                    partNumber: m.MaterialData?.PartNumber || '-',
                    partName: m.MaterialData?.PartName || '-',
                    qty: m.Qty,
                    qtyChecked: (m.QtyChecked !== null && m.QtyChecked !== undefined && m.QtyChecked !== 0) ? m.QtyChecked : m.Qty,
                }))
            );
        }
    }, [visible, materials]);

    const handleQtyChange = (key: number, value: number | null) => {
        setCheckingMaterials(prev =>
            prev.map(item =>
                item.key === key ? { ...item, qtyChecked: value ?? 0 } : item
            )
        );
    };

    const handleOk = async () => {
        try {
            setLoading(true);

            const payload = {
                id: incomingId,
                materials: checkingMaterials.map(m => ({
                    incomingMaterialId: m.id,
                    qtyChecked: m.qtyChecked,
                })),
            };

            const result = await dispatch(checkIncoming(payload));

            if (checkIncoming.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Material checking completed successfully');
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            message.error(err?.message || String(error) || 'Failed to check incoming');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Part Number',
            dataIndex: 'partNumber',
            key: 'partNumber',
            width: 150,
        },
        {
            title: 'Part Name',
            dataIndex: 'partName',
            key: 'partName',
        },
        {
            title: 'Expected Qty',
            dataIndex: 'qty',
            key: 'qty',
            width: 120,
            align: 'right' as const,
        },
        {
            title: 'Checked Qty',
            key: 'qtyChecked',
            width: 150,
            align: 'center' as const,
            render: (_: any, record: CheckingMaterial) => (
                <InputNumber
                    min={0}
                    value={record.qtyChecked}
                    onChange={(val) => handleQtyChange(record.key, val)}
                    style={{ width: 100 }}
                />
            ),
        },
        {
            title: 'Difference',
            key: 'difference',
            width: 100,
            align: 'right' as const,
            render: (_: any, record: CheckingMaterial) => {
                const diff = record.qtyChecked - record.qty;
                const color = diff === 0 ? 'green' : diff > 0 ? 'blue' : 'red';
                return <span style={{ color, fontWeight: 500 }}>{diff > 0 ? `+${diff}` : diff}</span>;
            },
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <CheckOutlined />
                    <span>Material Checking - {incomingId}</span>
                </Space>
            }
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={onClose}
            confirmLoading={loading}
            width={800}
            destroyOnHidden
            zIndex={1050}
        >
            <p style={{ marginBottom: 16 }}>Enter the checked quantity for each material. Any difference from expected quantity will be recorded.</p>

            <Table
                columns={columns}
                dataSource={checkingMaterials}
                size="small"
                rowKey="key"
                pagination={false}
                scroll={{ x: 700, y: 400 }}
                className="small-table"
                style={{ fontSize: '11px' }}
                footer={() => (
                    <div style={{ textAlign: 'right', paddingRight: 8 }}>
                        Total materials: {checkingMaterials.length}
                    </div>
                )}
            />
        </Modal>
    );
};

export default CheckingIncomingModal;
