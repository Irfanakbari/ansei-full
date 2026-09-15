/*By Irfan Akbari Vuteq Indonesia - 2026-06-09*/
"use client";

import React, { useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, Input, Button, Select, Tag, Tooltip, Space } from 'antd';
import type { InputRef } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { PreDeliveryEntity, fetchPreDelivery, setFilters } from '@/store/features/production/preDelivery/preDeliverySlice';
import { fetchProductionRelease, ProductionReleaseEntity } from '@/store/features/production/productionRelease/productionReleaseSlice';

const formatDate = (val: string | null | undefined) => {
    if (!val) return '-';
    return new Date(val).toLocaleDateString('id-ID');
};

export default function PreDeliveryPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination, filters } = useSelector((state: RootState) => state.preDelivery);
    const { data: productionReleases } = useSelector((state: RootState) => state.productionRelease);
    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchPreDelivery(filters));
    }, [dispatch, filters]);

    useEffect(() => {
        dispatch(fetchProductionRelease());
    }, [dispatch]);

    const handleTableChange = (pag: any) => {
        dispatch(setFilters({ page: pag.current, limit: pag.pageSize }));
    };

    // Column search filter
    const getColumnSearchProps = (dataIndex: string) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput as any}
                    placeholder={`Search ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 80 }}>
                        Search
                    </Button>
                    <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 80 }}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        onFilter: (value: any, record: any) => {
            return record[dataIndex]?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    // Scanned filter dropdown
    const getScannedFilterProps = () => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Select
                    placeholder="Select status"
                    value={selectedKeys[0]}
                    onChange={(val) => setSelectedKeys(val ? [val] : [])}
                    style={{ width: '100%', marginBottom: 8 }}
                    allowClear
                >
                    <Select.Option value="scanned">Scanned</Select.Option>
                    <Select.Option value="unscanned">Unscanned</Select.Option>
                </Select>
                <Space>
                    <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 60 }}>
                        OK
                    </Button>
                    <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 60 }}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        onFilter: (value: any, record: any) => {
            if (value === 'scanned') return record.scanned === true;
            if (value === 'unscanned') return record.scanned === false;
            return true;
        },
    });

    // Production Release filter dropdown
    const getProductionReleaseFilterProps = () => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Select
                    placeholder="Select PR Number"
                    value={selectedKeys[0]}
                    onChange={(val) => setSelectedKeys(val ? [val] : [])}
                    style={{ width: '100%', marginBottom: 8 }}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                >
                    {productionReleases.map((pr: ProductionReleaseEntity) => (
                        <Select.Option key={pr.Id} value={pr.ReleaseNumber}>
                            {pr.ReleaseNumber}
                        </Select.Option>
                    ))}
                </Select>
                <Space>
                    <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 60 }}>
                        OK
                    </Button>
                    <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 60 }}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        onFilter: (value: any, record: any) => {
            return record.productionReleaseNumber?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    const columns = [
        {
            title: 'Prod Release ID',
            dataIndex: 'productionReleaseNumber',
            key: 'productionReleaseNumber',
            width: 160,
            ...getProductionReleaseFilterProps(),
            render: (val: string) => <code style={{ fontSize: 10 }}>{val}</code>,
        },
        {
            title: 'Label Number',
            dataIndex: 'labelNumber',
            key: 'labelNumber',
            width: 180,
            ...getColumnSearchProps('labelNumber'),
            render: (val: string) => (
                <Tooltip title={val}>
                    <code style={{ fontSize: 11 }}>{val}</code>
                </Tooltip>
            ),
        },
        {
            title: 'Finish Good',
            key: 'finishGood',
            width: 200,
            ...getColumnSearchProps('finishGoodId'),
            render: (_: any, record: PreDeliveryEntity) => (
                <span>
                    <code style={{ fontSize: 10 }}>{record.finishGoodId}</code>
                    <br />
                    <span style={{ fontSize: 11 }}>{record.finishGoodName}</span>
                </span>
            ),
        },
        {
            title: 'Forecast ID',
            dataIndex: 'forecastId',
            key: 'forecastId',
            width: 140,
            ...getColumnSearchProps('forecastId'),
            render: (val: string) => <code style={{ fontSize: 10 }}>{val}</code>,
        },
        {
            title: 'Vendor',
            dataIndex: 'vendorName',
            key: 'vendorName',
            width: 150,
            ...getColumnSearchProps('vendorName'),
        },
        {
            title: 'Delivery Date',
            dataIndex: 'deliveryDate',
            key: 'deliveryDate',
            width: 100,
            render: formatDate,
        },
        {
            title: 'Qty/Box',
            dataIndex: 'qtyThisBox',
            key: 'qtyThisBox',
            width: 80,
            align: 'right' as const,
            render: (val: number) => <strong>{val}</strong>,
        },
        {
            title: 'Scanned',
            dataIndex: 'scanned',
            key: 'scanned',
            width: 80,
            align: 'center' as const,
            ...getScannedFilterProps(),
            render: (val: boolean) => (
                <Tag color={val ? 'success' : 'warning'}>{val ? 'Yes' : 'No'}</Tag>
            ),
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb
                style={{ marginBottom: 16 }}
                items={[
                    { title: 'Home' },
                    { title: 'Production' },
                    { title: 'Process' },
                    { title: 'Pre Delivery' },
                ]}
            />

            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined />}
                    onClick={() => dispatch(fetchPreDelivery(filters))}
                />
            </ToolbarWrapper>

            <Table
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={handleTableChange}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ['20', '50', '100'],
                    showTotal: (total: number, range: number[]) => `${range[0]}-${range[1]} of ${total}`,
                }}
                rowKey="id"
                scroll={{ x: 1200, y: 'calc(100vh - 380px)' }}
                className="small-table"
            />
        </Card>
    );
}
