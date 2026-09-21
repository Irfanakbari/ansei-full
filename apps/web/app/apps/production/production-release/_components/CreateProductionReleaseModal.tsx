/*By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-09-15*/
"use client";

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, App, DatePicker, Table, Tag } from 'antd';
import type { InputRef, TablePaginationConfig } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { createProductionRelease, type CreateProductionReleasePayload } from '@/store/features/production/productionRelease/productionReleaseSlice';
import { fetchForecast, ForecastEntity } from '@/store/features/production/forecast/forecastSlice';
import { formatDate } from '@/lib/utils/dateTime';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const isForecastOpen = (record: ForecastEntity): boolean => {
    if (record.ProductionReleaseId) {
        return false;
    }
    const status = record.Status?.toUpperCase();
    if (status === 'RELEASED') {
        return false;
    }
    if (status && status !== 'OPEN') {
        return false;
    }
    return true;
};

const getForecastStatus = (record: ForecastEntity): string => {
    if (record.ProductionReleaseId || record.Status?.toUpperCase() === 'RELEASED') {
        return 'RELEASED';
    }
    if (record.Status && record.Status.toUpperCase() !== 'OPEN') {
        return record.Status.toUpperCase();
    }
    return 'OPEN';
};

const CreateProductionReleaseModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [searchText, setSearchText] = useState('');
    const [query, setQuery] = useState({ page: 1, limit: 10, search: '' });
    const searchInput = React.useRef<InputRef>(null);

    const { data: forecasts, loading: forecastLoading, pagination } = useSelector((state: RootState) => state.forecast);

    useEffect(() => {
        if (visible) {
            const initialQuery = { page: 1, limit: 10, search: '' };
            setQuery(initialQuery);
            setSearchText('');
            setSelectedRowKeys([]);
            dispatch(fetchForecast({ page: 1, limit: 10 }));
        }
    }, [visible, dispatch]);

    const handleSearch = (value: string) => {
        const trimmed = value.trim();
        const newQuery = { ...query, page: 1, search: trimmed };
        setQuery(newQuery);
        dispatch(fetchForecast({ page: 1, limit: query.limit, search: trimmed || undefined }));
    };

    const handleTableChange = (tablePagination: TablePaginationConfig) => {
        const newPage = tablePagination.current || 1;
        const newLimit = tablePagination.pageSize || 10;
        setQuery(prev => ({ ...prev, page: newPage, limit: newLimit }));
        dispatch(fetchForecast({ page: newPage, limit: newLimit, search: query.search || undefined }));
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            if (selectedRowKeys.length === 0) {
                message.warning('Please select at least 1 PO ID');
                setLoading(false);
                return;
            }

            const invalidSelection = forecasts.find(
                (f) => selectedRowKeys.includes(f.PoId) && !isForecastOpen(f)
            );
            if (invalidSelection) {
                message.warning(`PO ID ${invalidSelection.PoId} is already released or not open`);
                setLoading(false);
                return;
            }

            const releaseNumber = typeof values.releaseNumber === 'string' ? values.releaseNumber.trim() : '';

            const payload: CreateProductionReleasePayload = {
                ...(releaseNumber ? { releaseNumber } : {}),
                planDate: values.planDate.toDate().toISOString(),
                forecastIds: selectedRowKeys.map(String),
                notes: values.notes,
            };

            const result = await dispatch(createProductionRelease(payload));

            if (createProductionRelease.rejected.match(result)) {
                throw new Error((result.payload as string) || 'Failed to create production release');
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
            title: 'PO Number',
            dataIndex: 'PoId',
            key: 'PoId',
            render: (val: string) => <code style={{ fontSize: 10 }}>{val}</code>,
        },
        {
            title: 'Part Number',
            dataIndex: ['PartData', 'PartNumber'],
            key: 'PartNumber',
            render: (val: string) => val || '-',
        },
        {
            title: 'Delivery Date',
            dataIndex: 'DeliveryDate',
            key: 'DeliveryDate',
            render: (val: string) => formatDate(val),
        },
        {
            title: 'Qty',
            dataIndex: 'Qty',
            key: 'Qty',
            align: 'right' as const,
        },
        {
            title: 'Status',
            key: 'Status',
            align: 'center' as const,
            render: (_: any, record: ForecastEntity) => {
                const isOpen = isForecastOpen(record);
                const status = getForecastStatus(record);
                return (
                    <Tag color={isOpen ? 'blue' : 'default'}>
                        {status}
                    </Tag>
                );
            },
        },
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
        preserveSelectedRowKeys: true,
        getCheckboxProps: (record: ForecastEntity) => ({
            disabled: !isForecastOpen(record),
        }),
    };

    return (
        <Modal
            title="Create New Production Release"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            width={720}
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="releaseNumber" label="Release Number (Optional)">
                    <Input placeholder="Auto-generated if blank (e.g. PR-20260921-001)" />
                </Form.Item>
                <Form.Item name="planDate" label="Plan Date" rules={[{ required: true, message: 'Please select plan date' }]}>
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="notes" label="Notes">
                    <Input.TextArea placeholder="Notes (optional)" rows={2} />
                </Form.Item>
                <Form.Item label="Production orders" required>
                    <div style={{ marginBottom: 8 }}>
                        <Input.Search
                            ref={searchInput}
                            placeholder="Search PO ID / Part Number / Vendor"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onSearch={handleSearch}
                            enterButton
                            allowClear
                            loading={forecastLoading}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <Table
                        rowSelection={rowSelection}
                        columns={columns}
                        dataSource={forecasts}
                        size="small"
                        loading={forecastLoading}
                        rowKey="PoId"
                        onChange={handleTableChange}
                        pagination={{
                            size: 'small',
                            current: pagination.page,
                            pageSize: pagination.limit,
                            total: pagination.totalItems,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50'],
                            showTotal: (total) => `Total ${total} items`,
                        }}
                        scroll={{ x: 'max-content', y: 300 }}
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
