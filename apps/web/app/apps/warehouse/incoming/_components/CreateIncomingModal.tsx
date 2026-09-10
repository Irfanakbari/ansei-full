/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, App, Select, Table, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createIncoming } from '@/store/features/warehouse/incoming/incomingSlice';
import { fetchMaterial } from '@/store/features/master/materialSlice';
import { fetchSupplier } from '@/store/features/master/supplierSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface MaterialItem {
    key: number;
    materialId: number;
    qty: number;
    materialData?: { PartNumber: string; PartName: string };
}

const CreateIncomingModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [selectedMaterialId, setSelectedMaterialId] = useState<number | undefined>();
    const [selectedQty, setSelectedQty] = useState<number | undefined>();

    const { data: supplierData } = useSelector((state: RootState) => state.supplier);
    const { data: materialData } = useSelector((state: RootState) => state.material);

    useEffect(() => {
        if (visible) {
            dispatch(fetchSupplier());
            dispatch(fetchMaterial());
            setMaterials([]);
            setSelectedMaterialId(undefined);
            setSelectedQty(undefined);
        }
    }, [visible, dispatch]);

    const handleAddMaterial = () => {
        if (selectedMaterialId && selectedQty && selectedQty > 0) {
            const selectedMaterial = materialData.find(m => m.Id === selectedMaterialId);
            const newKey = Date.now();
            setMaterials(prev => [
                ...prev,
                {
                    key: newKey,
                    materialId: selectedMaterialId,
                    qty: selectedQty,
                    materialData: selectedMaterial ? { PartNumber: selectedMaterial.PartNumber, PartName: selectedMaterial.PartName } : undefined,
                },
            ]);
            setSelectedMaterialId(undefined);
            setSelectedQty(undefined);
        } else {
            message.error('Please select material and enter qty');
        }
    };

    const handleRemoveMaterial = (key: number) => {
        setMaterials(prev => prev.filter(m => m.key !== key));
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (materials.length === 0) {
                message.error('Please add at least 1 material');
                setLoading(false);
                return;
            }

            const payload = {
                poId: values.poId,
                supplierId: Number(values.supplierId),
                receivedBy: values.receivedBy,
                description: values.description,
                materials: materials.map(m => ({ materialId: m.materialId, qty: m.qty })),
            };

            const result = await dispatch(createIncoming(payload));

            if (createIncoming.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Incoming created successfully');
            form.resetFields();
            setMaterials([]);
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create incoming');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setMaterials([]);
        onClose();
    };

    const materialColumns = [
        {
            title: 'Part Number',
            key: 'PartNumber',
            width: 150,
            render: (_: any, record: MaterialItem) => record.materialData?.PartNumber || '-',
        },
        {
            title: 'Part Name',
            key: 'PartName',
            render: (_: any, record: MaterialItem) => record.materialData?.PartName || '-',
        },
        {
            title: 'Qty',
            dataIndex: 'qty',
            key: 'qty',
            width: 80,
            align: 'right' as const,
        },
        {
            title: '',
            key: 'action',
            width: 50,
            render: (_: any, record: MaterialItem) => (
                <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveMaterial(record.key)} />
            ),
        },
    ];

    return (
        <Modal
            title="Create New Incoming"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={800}
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="poId" label="PO ID" rules={[{ required: true, message: 'Please enter PO ID' }]}>
                    <Input placeholder="PO-2024-001" onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        form.setFieldValue('poId', value);
                    }} />
                </Form.Item>
                <Form.Item name="supplierId" label="Supplier" rules={[{ required: true, message: 'Please select supplier' }]}>
                    <Select placeholder="Select supplier" showSearch filterOption={(input, option) =>
                        (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                    }>
                        {supplierData.map(s => (
                            <Select.Option key={s.Id} value={s.Id} label={s.Name}>
                                {s.Name}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item name="receivedBy" label="Received By" rules={[{ required: true, message: 'Please enter receiver name' }]}>
                    <Input placeholder="Receiver name" />
                </Form.Item>
                <Form.Item name="description" label="Description">
                    <Input.TextArea placeholder="Description (optional)" rows={2} />
                </Form.Item>
            </Form>

            <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 500 }}>Materials</div>
            <Space style={{ marginBottom: 8 }}>
                <Select
                    placeholder="Select material"
                    style={{ width: 250 }}
                    showSearch
                    value={selectedMaterialId}
                    onChange={setSelectedMaterialId}
                    filterOption={(input, option) =>
                        (option?.label?.toString() || '').toLowerCase().includes(input.toLowerCase())
                    }
                >
                    {materialData.map(m => (
                        <Select.Option key={m.Id} value={m.Id} label={`${m.PartNumber} - ${m.PartName}`}>
                            {m.PartNumber} - {m.PartName}
                        </Select.Option>
                    ))}
                </Select>
                <InputNumber
                    placeholder="Qty"
                    min={1}
                    value={selectedQty}
                    onChange={(val) => setSelectedQty(val ?? undefined)}
                    style={{ width: 100 }}
                />
                <Button icon={<PlusOutlined />} onClick={handleAddMaterial}>Add</Button>
            </Space>

            <Table
                columns={materialColumns}
                dataSource={materials}
                size="small"
                rowKey="key"
                pagination={false}
                scroll={{ x: 500 }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />
        </Modal>
    );
};

export default CreateIncomingModal;