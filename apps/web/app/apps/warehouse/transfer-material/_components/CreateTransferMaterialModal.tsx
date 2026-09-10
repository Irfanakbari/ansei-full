/*By Irfan Akbari Vuteq Indonesia - 2026-06-11*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Table, InputNumber, App, Row, Col, Select } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createTransferMaterial, CreateTransferMaterialDto } from '@/store/features/warehouse/transferMaterial/transferMaterialSlice';
import { fetchMaterial } from '@/store/features/master/materialSlice';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface ItemRow {
    key: string;
    materialId: string;
    qtyRequested: number;
}

const CreateTransferMaterialModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const { message: antMessage } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<ItemRow[]>([
        { key: '1', materialId: '', qtyRequested: 1 },
    ]);

    const { data: materials, loading: materialLoading } = useSelector((state: RootState) => state.material);

    // Fetch materials when modal opens
    useEffect(() => {
        if (visible) {
            dispatch(fetchMaterial());
        }
    }, [visible, dispatch]);

    const handleAddItem = () => {
        setItems([
            ...items,
            { key: Date.now().toString(), materialId: '', qtyRequested: 1 },
        ]);
    };

    const handleRemoveItem = (key: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.key !== key));
        }
    };

    const handleItemChange = (key: string, field: keyof ItemRow, value: string | number) => {
        setItems(items.map(item =>
            item.key === key ? { ...item, [field]: value } : item
        ));
    };

    const handleFinish = async (values: { destination: string; notes?: string }) => {
        // Validate items
        const validItems = items.filter(item => item.materialId && item.qtyRequested > 0);
        if (validItems.length === 0) {
            antMessage.error('At least 1 material item is required');
            return;
        }

        try {
            setLoading(true);
            const dto: CreateTransferMaterialDto = {
                destination: values.destination,
                notes: values.notes,
                items: validItems.map(item => ({
                    materialId: item.materialId,
                    qtyRequested: item.qtyRequested,
                })),
            };

            const resultAction = await dispatch(createTransferMaterial(dto));
            if (createTransferMaterial.fulfilled.match(resultAction)) {
                antMessage.success('Transfer material created successfully');
                form.resetFields();
                setItems([{ key: '1', materialId: '', qtyRequested: 1 }]);
                onClose();
                onSuccess?.();
            } else if (createTransferMaterial.rejected.match(resultAction)) {
                antMessage.error(resultAction.payload as string || 'Failed to create transfer material');
            }
        } catch (error: any) {
            antMessage.error(error?.message || 'Failed to create transfer material');
        } finally {
            setLoading(false);
        }
    };

    // Material options for select
    const materialOptions = materials.map(m => ({
        value: m.PartNumber,
        label: (
            <div>
                <code style={{ fontSize: 11 }}>{m.PartNumber}</code>
                <span style={{ fontSize: 10, color: '#666', marginLeft: 8 }}> - {m.PartName}</span>
            </div>
        ),
    }));

    const columns = [
        {
            title: 'Material Part Number',
            dataIndex: 'materialId',
            key: 'materialId',
            width: 350,
            render: (_: any, record: ItemRow) => (
                <Select
                    showSearch
                    placeholder="Select Material"
                    optionFilterProp="label"
                    value={record.materialId || undefined}
                    onChange={(value) => handleItemChange(record.key, 'materialId', value)}
                    options={materialOptions}
                    loading={materialLoading}
                    style={{ width: '100%' }}
                    filterOption={(input, option) =>
                        (option?.label?.props?.children?.[0]?.props?.children || '').toLowerCase().includes(input.toLowerCase())
                    }
                />
            ),
        },
        {
            title: 'Qty Requested',
            dataIndex: 'qtyRequested',
            key: 'qtyRequested',
            width: 120,
            render: (_: any, record: ItemRow) => (
                <InputNumber
                    min={1}
                    value={record.qtyRequested}
                    onChange={(value) => handleItemChange(record.key, 'qtyRequested', value || 1)}
                    style={{ width: '100%' }}
                />
            ),
        },
        {
            title: '',
            key: 'action',
            width: 60,
            render: (_: any, record: ItemRow) => (
                items.length > 1 ? (
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveItem(record.key)}
                    />
                ) : null
            ),
        },
    ];

    return (
        <Modal
            title="Create New Transfer Material"
            open={visible}
            onCancel={() => {
                form.resetFields();
                setItems([{ key: '1', materialId: '', qtyRequested: 1 }]);
                onClose();
            }}
            footer={null}
            centered
            width={700}
            zIndex={1050}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
            >
                <Row gutter={16}>
                    <Col span={16}>
                        <Form.Item
                            name="destination"
                            label="Destination"
                            rules={[{ required: true, message: 'Please enter destination' }]}
                        >
                            <Input placeholder="Example: Subcont Warehouse A" size="large" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            name="notes"
                            label="Notes"
                        >
                            <Input.TextArea rows={1} placeholder="Notes (optional)" />
                        </Form.Item>
                    </Col>
                </Row>

                <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>Items</span>
                </div>

                <Table
                    columns={columns}
                    dataSource={items}
                    rowKey="key"
                    size="small"
                    pagination={false}
                    scroll={{ x: 550 }}
                    style={{ marginBottom: 16 }}
                />

                <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={handleAddItem}
                    style={{ marginBottom: 16 }}
                    block
                >
                    Add Item
                </Button>

                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Space>
                        <Button onClick={() => {
                            form.resetFields();
                            setItems([{ key: '1', materialId: '', qtyRequested: 1 }]);
                            onClose();
                        }}>
                            Cancel
                        </Button>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            {loading ? 'Creating...' : 'Create'}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateTransferMaterialModal;