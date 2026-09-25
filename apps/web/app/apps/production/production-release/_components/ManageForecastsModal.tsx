"use client";

import { App, Form, Input, Modal, Segmented, Table, Tag, Button, Space, DatePicker } from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import {
    fetchProductionReleaseForecastCandidates,
    tagProductionReleaseForecasts,
    untagProductionReleaseForecasts,
    type ForecastItem,
    type ProductionReleaseEntity,
} from '@/store/features/production/productionRelease/productionReleaseSlice';

interface Props {
    open: boolean;
    release: ProductionReleaseEntity | null;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ManageForecastsModal({ open, release, onClose, onSuccess }: Props) {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { forecastCandidates, forecastCandidatesLoading, forecastCandidatesPagination } = useSelector(
        (state: RootState) => state.productionRelease
    );
    const [mode, setMode] = useState<'tag' | 'untag'>('tag');
    const [selected, setSelected] = useState<React.Key[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [query, setQuery] = useState<{ page: number; limit: number; search?: string; poNumber?: string; partNumber?: string; deliveryDate?: string }>({ page: 1, limit: 10, search: '' });
    const [form] = Form.useForm<{ reason: string }>();
    const searchInput = useRef<any>(null);

    useEffect(() => {
        if (open && release) {
            setSelected([]);
            form.resetFields();
            setQuery({ page: 1, limit: 10, search: '' });
            void dispatch(fetchProductionReleaseForecastCandidates({ id: release.Id, mode, page: 1, limit: 10 }));
        }
    }, [dispatch, form, mode, open, release]);

    const getColumnSearchProps = (title: string) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput}
                    placeholder={`Search ${title}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 90 }}>
                        Search
                    </Button>
                    <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
    });

    const columns: TableColumnsType<ForecastItem> = [
        { 
            title: 'Delivery Date', 
            dataIndex: 'DeliveryDate', 
            key: 'DeliveryDate',
            render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD') : '-'),
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                    <DatePicker
                        value={selectedKeys[0] ? dayjs(selectedKeys[0]) : null}
                        onChange={(date, dateString) => setSelectedKeys(date ? [dateString] : [])}
                        style={{ marginBottom: 8, display: 'flex' }}
                    />
                    <Space>
                        <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 90 }}>
                            Filter
                        </Button>
                        <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>
                            Reset
                        </Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered: boolean) => <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
        },
        { title: 'PO Number', dataIndex: 'PoId', key: 'PoId', ...getColumnSearchProps('PO Number') },
        { title: 'Part Number', dataIndex: 'FinishGoodId', key: 'FinishGoodId', ...getColumnSearchProps('Part Number') },
        { title: 'Qty', dataIndex: 'Qty', key: 'Qty', align: 'right' },
        { title: 'State', key: 'state', render: (_, item) => <Tag color={item.ProductionReleaseId ? 'blue' : 'default'}>{item.ProductionReleaseId ? 'LINKED' : 'UNLINKED'}</Tag> },
    ];

    const loadCandidates = (nextQuery: typeof query) => {
        if (!release) return;
        setQuery(nextQuery);
        setSelected([]);
        void dispatch(fetchProductionReleaseForecastCandidates({
            id: release.Id,
            mode,
            page: nextQuery.page,
            limit: nextQuery.limit,
            search: nextQuery.search || undefined,
            poNumber: nextQuery.poNumber || undefined,
            partNumber: nextQuery.partNumber || undefined,
            deliveryDate: nextQuery.deliveryDate || undefined,
        }));
    };

    const handleTableChange = (pagination: TablePaginationConfig, filters: any) => {
        const poNumber = filters.PoId?.[0] as string | undefined;
        const partNumber = filters.FinishGoodId?.[0] as string | undefined;
        const deliveryDate = filters.DeliveryDate?.[0] as string | undefined;

        loadCandidates({
            ...query,
            page: (poNumber !== query.poNumber || partNumber !== query.partNumber || deliveryDate !== query.deliveryDate) ? 1 : (pagination.current ?? 1),
            limit: pagination.pageSize ?? 10,
            poNumber,
            partNumber,
            deliveryDate,
        });
    };

    const submit = async () => {
        if (!release) return;
        if (!selected.length) {
            message.warning('Select at least one forecast');
            return;
        }
        try {
            const values = await form.validateFields();
            setSubmitting(true);
            const thunk = mode === 'tag' ? tagProductionReleaseForecasts : untagProductionReleaseForecasts;
            await dispatch(thunk({ id: release.Id, forecastIds: selected.map(String), reason: values.reason.trim() })).unwrap();
            message.success(mode === 'tag' ? 'Forecasts tagged' : 'Forecasts untagged');
            onClose();
            onSuccess();
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'errorFields' in error) return;
            message.error(error instanceof Error ? error.message : String(error));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={`Manage Forecasts (${release?.Status ?? ''}) - ${release?.ReleaseNumber ?? ''}`}
            open={open}
            centered
            destroyOnHidden
            width={800}
            confirmLoading={submitting}
            onOk={submit}
            onCancel={onClose}
        >
            <Segmented
                block
                value={mode}
                options={[
                    { label: 'Tag Unlinked Forecasts', value: 'tag' },
                    { label: 'Untag Linked Forecasts', value: 'untag' },
                ]}
                onChange={(value) => setMode(value as 'tag' | 'untag')}
            />
            <Input.Search
                style={{ marginTop: 16 }}
                allowClear
                placeholder="Search PO ID, part number, or vendor"
                onSearch={(search) => loadCandidates({ ...query, page: 1, search: search.trim() })}
            />
            <Table<ForecastItem>
                style={{ marginTop: 16 }}
                columns={columns}
                dataSource={forecastCandidates}
                rowKey="PoId"
                size="small"
                loading={forecastCandidatesLoading}
                onChange={handleTableChange}
                pagination={{
                    current: forecastCandidatesPagination.page,
                    pageSize: forecastCandidatesPagination.limit,
                    total: forecastCandidatesPagination.totalItems,
                    showSizeChanger: true,
                }}
                rowSelection={{
                    selectedRowKeys: selected,
                    onChange: setSelected,
                    preserveSelectedRowKeys: false,
                }}
            />
            <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                <Form.Item
                    name="reason"
                    label="Reason"
                    rules={[
                        { required: true, whitespace: true, message: 'Reason is required' },
                        { max: 500 },
                    ]}
                >
                    <Input.TextArea rows={3} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
