/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 */
"use client";

import IntegrationPanel from './_components/IntegrationPanel';
import ActionAuditPanel from './_components/ActionAuditPanel';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Table,
    Tabs,
    Card,
    Breadcrumb,
    Input,
    Typography,
    Badge,
    Tooltip,
    Button,
    Space,
} from 'antd';
import type { InputRef } from 'antd';
import {
    ReloadOutlined,
    EyeOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';

import type { ColumnsType } from 'antd/es/table';
import { fetchSystemLogDetail, fetchSystemLogs, FetchSystemLogsParams } from '@/store/features/system-log/systemLogSlice';
import DetailSystemLogModal from './_components/DetailSystemLogModal';
import { formatDateTime } from '@/lib/utils/dateTime';

const { Text } = Typography;

const STATUS_OPTIONS = [
    { text: 'SUCCESS', value: 'SUCCESS' },
    { text: 'COMPLETED', value: 'COMPLETED' },
    { text: 'FAILED', value: 'FAILED' },
    { text: 'ERROR', value: 'ERROR' },
    { text: 'RUNNING', value: 'RUNNING' },
    { text: 'PENDING', value: 'PENDING' },
];

export default function SystemLogPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {
        data,
        total,
        page,
        limit,
        loading,
        detail,
        detailLoading,
    } = useSelector((state: RootState) => state.systemLog);

    const [modalOpen, setModalOpen] = useState(false);
    const [filters, setFilters] = useState<FetchSystemLogsParams>({
        page: 1,
        limit: 50,
        functionId: '',
        processStatus: '',
    });
    const [filteredInfo, setFilteredInfo] = useState<Record<string, any>>({});
    const searchInput = useRef<InputRef>(null);

    const load = useCallback((params: FetchSystemLogsParams) => {
        dispatch(fetchSystemLogs(params));
    }, [dispatch]);

    useEffect(() => {
        load({ page: 1, limit: 50 });
    }, [load]);

    const handleTableChange = (pagination: any, tableFilters: any) => {
        // Build filters from table filters
        const newFilters: FetchSystemLogsParams = {};

        if (tableFilters.functionId?.length) {
            newFilters.functionId = tableFilters.functionId[0];
        }
        if (tableFilters.processStatus?.length) {
            newFilters.processStatus = tableFilters.processStatus[0];
        }

        setFilteredInfo(tableFilters);

        setFilters(prev => ({
            ...prev,
            page: pagination.current,
            limit: pagination.pageSize,
            functionId: newFilters.functionId || '',
            processStatus: newFilters.processStatus || '',
        }));

        load({
            page: pagination.current,
            limit: pagination.pageSize,
            functionId: newFilters.functionId || '',
            processStatus: newFilters.processStatus || '',
        });
    };

    const handleReset = () => {
        setFilteredInfo({});
        setFilters({ page: 1, limit: 50, functionId: '', processStatus: '' });
        load({ page: 1, limit: 50, functionId: '', processStatus: '' });
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
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 80 }}>
                        Filter
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
            const fieldValue = record[dataIndex] || '';
            return fieldValue?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    const mainColumns: ColumnsType<any> = [
        {
            title: 'Process ID',
            dataIndex: 'processId',
            key: 'processId',
            ellipsis: true,
            render: (val: string) => <Tooltip title={val}><Text code style={{ fontSize: 11 }}>{val}</Text></Tooltip>,
        },
        {
            title: 'Function ID',
            dataIndex: 'functionId',
            key: 'functionId',
            ellipsis: true,
            filteredValue: filteredInfo.functionId || null,
            ...getColumnSearchProps('functionId', 'Search Function ID'),
        },
        {
            title: 'Function Name',
            dataIndex: 'functionName',
            key: 'functionName',
            ellipsis: true,
        },
        {
            title: 'Status',
            dataIndex: 'processStatus',
            key: 'processStatus',
            filteredValue: filteredInfo.processStatus || null,
            filterMultiple: false,
            filters: STATUS_OPTIONS,
            render: (val: string) => (
                <Badge
                    status={
                        val === 'SUCCESS' || val === 'COMPLETED' ? 'success'
                        : val === 'FAILED' || val === 'ERROR' ? 'error'
                        : val === 'RUNNING' ? 'processing'
                        : 'warning'
                    }
                    text={val}
                />
            ),
        },
        {
            title: 'Process Date',
            dataIndex: 'processDate',
            key: 'processDate',
            render: formatDateTime,
        },
        {
            title: 'Start',
            dataIndex: 'processStart',
            key: 'processStart',
            render: formatDateTime,
        },
        {
            title: 'End',
            dataIndex: 'processEnd',
            key: 'processEnd',
            render: formatDateTime,
        },
        {
            title: 'Created At',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: formatDateTime,
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: any, record: any) => (
                <Tooltip title="View Detail">
                    <EyeOutlined
                        style={{ cursor: 'pointer', color: '#1677ff', fontSize: 16 }}
                        onClick={() => {
                            dispatch(fetchSystemLogDetail(record.processId));
                            setModalOpen(true);
                        }}
                    />
                </Tooltip>
            ),
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb
                style={{ marginBottom: 16 }}
                items={[{ title: 'Home' }, { title: 'System Administration' }, { title: 'System Logs' }]}
            />

            <Tabs items={[
                { key: 'processes', label: 'Process Logs', children: <>
            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined />}
                    onClick={() => load({ page: 1, limit: filters.limit || 50 })}
                />
                <ButtonToolbar
                    title="Reset Filter"
                    icon={<ReloadOutlined />}
                    onClick={handleReset}
                />
            </ToolbarWrapper>

            <Table
                columns={mainColumns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={handleTableChange}
                pagination={{
                    size: 'small',
                    current: page,
                    pageSize: limit,
                    total: total,
                    showSizeChanger: true,
                    pageSizeOptions: ['20', '50', '100'],
                    showTotal: (t) => `Total ${t} records`,
                }}
                rowKey="processId"
                scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

                </> },
                { key: 'actions', label: 'Action Audit', children: <ActionAuditPanel /> },
                { key: 'integrations', label: 'Integrations', children: <IntegrationPanel /> },
            ]} />

            <DetailSystemLogModal
                visible={modalOpen}
                onClose={() => setModalOpen(false)}
                detail={detail}
                loading={detailLoading}
            />
        </Card>
    );
}
