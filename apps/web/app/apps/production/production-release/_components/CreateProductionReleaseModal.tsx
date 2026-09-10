/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, App, DatePicker, Table, Tag, InputRef } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createProductionRelease } from '@/store/features/production/productionRelease/productionReleaseSlice';
import { fetchForecast } from '@/store/features/production/forecast/forecastSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const CreateProductionReleaseModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [searchText, setSearchText] = useState('');
    const searchInput = React.useRef<InputRef>(null);

    const { data: forecasts, loading: forecastLoading } = useSelector((state: RootState) => state.forecast);

    // Filter forecasts yang belum di-release (ProductionReleaseId = null)
    const availableForecasts = useMemo(() => {
        return forecasts.filter(f => !f.ProductionReleaseId);
    }, [forecasts]);

    // Filter dengan search
    const filteredForecasts = useMemo(() => {
        if (!searchText) return availableForecasts;
        const lower = searchText.toLowerCase();
        return availableForecasts.filter(f =>
            f.PoId?.toLowerCase().includes(lower) ||
            f.PartData?.PartNumber?.toLowerCase().includes(lower) ||
            f.VendorName?.toLowerCase().includes(lower)
        );
    }, [availableForecasts, searchText]);

    useEffect(() => {
        if (visible) {
            dispatch(fetchForecast());
            setSelectedRowKeys([]);
            setSearchText('');
        }
    }, [visible, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (selectedRowKeys.length === 0) {
                message.warning('Please select at least 1 PO ID');
                setLoading(false);
                return;
            }

            const payload = {
                releaseNumber: values.releaseNumber,
                planDate: values.planDate.toDate().toISOString(),
                forecastIds: selectedRowKeys.map(String),
                notes: values.notes,
            };

            const result = await dispatch(createProductionRelease(payload));

            if (createProductionRelease.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Production release created successfully');
            form.resetFields();
            setSelectedRowKeys([]);
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create production release');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setSelectedRowKeys([]);
        setSearchText('');
        onClose();
    };

    const columns = [
        {
            title: 'PO ID',
            dataIndex: 'PoId',
            key: 'PoId',
            width: 140,
            render: (val: string) => <code style={{ fontSize: 10 }}>{val}</code>,
        },
        {
            title: 'Part Number',
            dataIndex: ['PartData', 'PartNumber'],
            key: 'PartNumber',
            width: 120,
            render: (val: string) => val || '-',
        },
        {
            title: 'Qty',
            dataIndex: 'Qty',
            key: 'Qty',
            width: 60,
            align: 'right' as const,
        },
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
 };

    return (
        <Modal
            title="Create New Production Release"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={700}
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="releaseNumber" label="Release Number" rules={[{ required: true, message: 'Please enter release number' }]}>
                    <Input placeholder="REL-2024-001" />
                </Form.Item>
                <Form.Item name="planDate" label="Plan Date" rules={[{ required: true, message: 'Please select plan date' }]}>
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="notes" label="Notes">
                    <Input.TextArea placeholder="Notes (optional)" rows={2} />
                </Form.Item>
                <Form.Item label="PO IDs" required>
                    <div style={{ marginBottom: 8 }}>
                        <Input
                            ref={searchInput}
                            placeholder="Search PO ID / Part Number / Vendor"
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: '100%' }}
                            allowClear
                        />
                    </div>
                    <Table
                        rowSelection={rowSelection}
                        columns={columns}
                        dataSource={filteredForecasts}
                        size="small"
                        loading={forecastLoading}
                        rowKey="PoId"
                        pagination={{
                            size: 'small',
                            pageSize: 10,
                            showSizeChanger: false,
                            showTotal: (total) => `${total} items`,
                        }}
                        scroll={{ y: 300 }}
                        className="small-table"
                        style={{ fontSize: '10px' }}
                    />
                    {selectedRowKeys.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <Tag color="blue">{selectedRowKeys.length} selected</Tag>
                        </div>
                    )}
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateProductionReleaseModal;