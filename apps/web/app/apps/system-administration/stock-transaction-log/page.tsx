/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, Input, Button, Tag, Tooltip, Space } from 'antd';
import type { InputRef } from 'antd';
import { ReloadOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import ExportStockTransactionModal from './_components/ExportStockTransactionModal';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
    StockTransactionLogEntity,
    StockTransactionLogQuery,
    fetchStockTransactionLog,
    setFilters,
    resetFilters,
    TRANSACTION_TYPE_OPTIONS,
    ITEM_CATEGORY_OPTIONS,
    TransactionType,
    ItemCategory,
} from '@/store/features/system-administration/stockTransactionLogSlice';
import { formatDateTime } from '@/lib/utils/dateTime';

const TRANSACTION_COLORS: Record<string, string> = {
    INCOMING_SUPPLIER: 'green',
    INCOMING_PRODUCTION: 'cyan',
    OUTGOING_SHIPMENT: 'blue',
    OUTGOING_RETURN: 'orange',
    TRANSFER_TO_RACK: 'purple',
    TRANSFER_TO_FINISH_GOOD: 'magenta',
    ADJUSTMENT_IN: 'lime',
    ADJUSTMENT_OUT: 'gold',
    SHOPPING_PICK: 'volcano',
    LABEL_PRINTED: 'geekblue',
    LABEL_SCANNED: 'blue',
};

const LOCATION_COLORS: Record<string, string> = {
    WAREHOUSE: 'default',
    RACK: 'processing',
    FINISH_GOOD_AREA: 'success',
};

export default function StockTransactionLogPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination, filters } = useSelector((state: RootState) => state.stockTransactionLog);

    const [filteredInfo, setFilteredInfo] = useState<Record<string, any>>({});
    const [sortedInfo, setSortedInfo] = useState<any>({});
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchStockTransactionLog(filters));
    }, [dispatch, filters]);

    const handleTableChange = (pagination: any, tableFilters: any, sorter: any) => {
        // Build filters object from table filters
        const newFilters: StockTransactionLogQuery = {};

        if (tableFilters.itemCategory?.length) {
            newFilters.itemCategory = tableFilters.itemCategory[0];
        }
        if (tableFilters.transactionType?.length) {
            newFilters.transactionType = tableFilters.transactionType[0];
        }
        if (tableFilters.materialId?.length) {
            newFilters.materialId = tableFilters.materialId[0];
        }
        if (tableFilters.referenceDoc?.length) {
            newFilters.referenceDoc = tableFilters.referenceDoc[0];
        }
        if (tableFilters.createdBy?.length) {
            newFilters.createdBy = tableFilters.createdBy[0];
        }

        setFilteredInfo(tableFilters);
        setSortedInfo(sorter);

        dispatch(setFilters({
            ...newFilters,
            page: pagination.current,
            limit: pagination.pageSize,
        }));
    };

    const handleReset = () => {
        setFilteredInfo({});
        setSortedInfo({});
        dispatch(resetFilters());
    };

    const getColumnSearchProps = (dataIndex: string, placeholder?: string) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput as any}
                    placeholder={placeholder || `Search ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{ marginBottom: 8, display: 'block' }}
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
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        onFilter: (value: any, record: any) => {
            let fieldValue: any;
            if (dataIndex === 'materialId') {
                fieldValue = record.materialId || record.finishGoodId || '';
            } else if (dataIndex === 'transactionDate') {
                fieldValue = record.transactionDate || '';
            } else {
                fieldValue = record[dataIndex] || '';
            }
            return fieldValue?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    const columns = [
        {
            title: 'Date',
            dataIndex: 'transactionDate',
            key: 'transactionDate',
            filteredValue: null,
            render: (val: string) => formatDateTime(val),
            sorter: (a: StockTransactionLogEntity, b: StockTransactionLogEntity) =>
                new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
            sortOrder: sortedInfo.columnKey === 'transactionDate' ? sortedInfo.order : null,
        },
        {
            title: 'Category',
            dataIndex: 'itemCategory',
            key: 'itemCategory',
            filteredValue: filteredInfo.itemCategory || null,
            filterMultiple: false,
            render: (val: ItemCategory) => (
                <Tag color={val === 'MATERIAL' ? 'blue' : 'purple'}>{val}</Tag>
            ),
            filters: ITEM_CATEGORY_OPTIONS.map(opt => ({ text: opt.label, value: opt.value })),
        },
        {
            title: 'Item Reference',
            key: 'itemId',
            filteredValue: filteredInfo.materialId || null,
            ...getColumnSearchProps('materialId', 'Search item reference'),
            render: (_: any, record: StockTransactionLogEntity) => (
                <code style={{ fontSize: 10 }}>
                    {record.materialId || record.finishGoodId || '-'}
                </code>
            ),
        },
        {
            title: 'Transaction Type',
            dataIndex: 'transactionType',
            key: 'transactionType',
            filteredValue: filteredInfo.transactionType || null,
            filterMultiple: false,
            render: (val: TransactionType) => (
                <Tag color={TRANSACTION_COLORS[val] || 'default'}>
                    {val.replace(/_/g, ' ')}
                </Tag>
            ),
            filters: TRANSACTION_TYPE_OPTIONS.map(opt => ({ text: opt.label, value: opt.value })),
        },
        {
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
            filteredValue: null,
            render: (val: string) => (
                <Tag color={LOCATION_COLORS[val] || 'default'}>
                    {val.replace(/_/g, ' ')}
                </Tag>
            ),
        },
        {
            title: 'Reference',
            dataIndex: 'referenceDoc',
            key: 'referenceDoc',
            ellipsis: true,
            filteredValue: filteredInfo.referenceDoc || null,
            ...getColumnSearchProps('referenceDoc', 'Search Reference'),
            render: (val: string) => <Tooltip title={val}><code style={{ fontSize: 10 }}>{val}</code></Tooltip>,
        },
        {
            title: 'Balance Before',
            dataIndex: 'balanceBefore',
            key: 'balanceBefore',
            align: 'right' as const,
            filteredValue: null,
        },
        {
            title: 'Qty In',
            dataIndex: 'qtyIn',
            key: 'qtyIn',
            align: 'right' as const,
            filteredValue: null,
            render: (val: number) => val > 0 ? <span style={{ color: '#52c41a' }}>{val}</span> : '-',
        },
        {
            title: 'Qty Out',
            dataIndex: 'qtyOut',
            key: 'qtyOut',
            align: 'right' as const,
            filteredValue: null,
            render: (val: number) => val > 0 ? <span style={{ color: '#ff4d4f' }}>{val}</span> : '-',
        },
        {
            title: 'Balance After',
            dataIndex: 'balanceAfter',
            key: 'balanceAfter',
            align: 'right' as const,
            filteredValue: null,
            render: (val: number) => <strong>{val}</strong>,
        },
        {
            title: 'Created By',
            dataIndex: 'createdBy',
            key: 'createdBy',
            filteredValue: filteredInfo.createdBy || null,
            render: (_: any, record: any) => record.createdByName || record.CreatedByName || '-',
            ...getColumnSearchProps('createdBy', 'Search Created By'),
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            ellipsis: true,
            filteredValue: null,
            render: (val: string | null) => val || '-',
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'System Administration' }, { title: 'Stock Transaction Log' }]} />

            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => dispatch(fetchStockTransactionLog(filters))} />
                <ButtonToolbar title="Reset Filter" icon={<ReloadOutlined />} onClick={handleReset} />
                <ButtonToolbar title="Export Excel" icon={<DownloadOutlined />} onClick={() => setIsExportModalVisible(true)} />
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
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
                }}
                rowKey="id"
                scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            <ExportStockTransactionModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
            />
        </Card>
    );
}
