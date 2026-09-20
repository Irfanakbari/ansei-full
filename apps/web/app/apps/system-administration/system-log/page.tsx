/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 */
'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, Badge, Breadcrumb, Button, Card, Input, Space, Table, Tag} from 'antd';
import type {InputRef, TableProps} from 'antd';
import type {FilterValue, TablePaginationConfig} from 'antd/es/table/interface';
import {ReloadOutlined, SearchOutlined} from '@ant-design/icons';
import {useDispatch, useSelector} from 'react-redux';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import GoldenArrowAction from '@/components/GoldenArrowAction';
import {usePhasePermission} from '@/components/traceability/usePhasePermission';
import type {AppDispatch, RootState} from '@/store';
import {
    fetchSystemLogDetail,
    fetchSystemLogEvents,
    type FetchSystemLogEventsParams,
    type SystemLogEvent,
    type SystemLogEventType,
} from '@/store/features/system-log/systemLogSlice';
import {formatDateTime} from '@/lib/utils/dateTime';
import DetailSystemLogModal from './_components/DetailSystemLogModal';
import ActionDetailModal from './_components/ActionDetailModal';
import IntegrationEventModals from './_components/IntegrationEventModals';

const TYPE_FILTERS = ['PROCESS', 'ACTION', 'INTEGRATION'].map(value => ({text: value, value}));
const SUCCESS_VALUES = new Set(['SUCCESS', 'COMPLETED', 'SUCCEEDED']);
const ERROR_VALUES = new Set(['FAILED', 'ERROR', 'DENIED']);

export default function SystemLogPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {can} = usePhasePermission();
    const canRecover = can('IPCS.INTEGRATION_RECOVER');
    const {
        events,
        eventsTotal,
        eventsPage,
        eventsLimit,
        eventsLoading,
        eventsError,
        detail,
        detailLoading
    } = useSelector((state: RootState) => state.systemLog);
    const [query, setQuery] = useState<FetchSystemLogEventsParams>({page: 1, limit: 50});
    const [processOpen, setProcessOpen] = useState(false);
    const [actionEvent, setActionEvent] = useState<SystemLogEvent>();
    const [auditEvent, setAuditEvent] = useState<SystemLogEvent>();
    const [recoveryEvent, setRecoveryEvent] = useState<SystemLogEvent>();
    const searchInput = useRef<InputRef>(null);

    const load = useCallback((params: FetchSystemLogEventsParams) => {
        void dispatch(fetchSystemLogEvents(params));
    }, [dispatch]);

    useEffect(() => {
        load({page: 1, limit: 50});
    }, [load]);

    const changeTable = (pagination: TablePaginationConfig, filters: Record<string, FilterValue | null>) => {
        const type = filters.type?.[0] as SystemLogEventType | undefined;
        const search = filters.identity?.[0]?.toString() || undefined;
        const next = {page: pagination.current ?? 1, limit: pagination.pageSize ?? 50, type, search};
        setQuery(next);
        load(next);
    };

    const reset = () => {
        const next = {page: 1, limit: 50};
        setQuery(next);
        load(next);
    };

    const openProcess = (event: SystemLogEvent) => {
        if (!event.processId) return;
        void dispatch(fetchSystemLogDetail(event.processId));
        setProcessOpen(true);
    };

    const openEventDetail = (event: SystemLogEvent) => {
        if (event.type === 'PROCESS') openProcess(event);
        else if (event.type === 'ACTION') setActionEvent(event);
        else setAuditEvent(event);
    };

    const searchFilter: NonNullable<TableProps<SystemLogEvent>['columns']>[number] = {
        filterDropdown: ({setSelectedKeys, selectedKeys, confirm, clearFilters}) => (
            <div style={{padding: 8}} onKeyDown={event => event.stopPropagation()}>
                <Input
                    ref={searchInput}
                    aria-label="Search event or reference"
                    placeholder="Search event or reference"
                    value={selectedKeys[0]?.toString()}
                    onChange={event => setSelectedKeys(event.target.value ? [event.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{marginBottom: 8, display: 'block', width: 240}}
                />
                <Space>
                    <Button type="primary" size="small" icon={<SearchOutlined/>}
                            onClick={() => confirm()}>Search</Button>
                    <Button size="small" onClick={() => {
                        clearFilters?.();
                        confirm();
                    }}>Reset</Button>
                </Space>
            </div>
        ),
        filterIcon: filtered => <SearchOutlined style={{color: filtered ? '#1677ff' : undefined}}/>,
        filteredValue: query.search ? [query.search] : null,
        filterDropdownProps: {
            onOpenChange: open => {
                if (open) setTimeout(() => searchInput.current?.select(), 100);
            },
        },
    };

    const columns: TableProps<SystemLogEvent>['columns'] = [
        {title: 'Time', dataIndex: 'occurredAt', width: 170, render: formatDateTime},
        {
            title: 'Event',
            dataIndex: 'event',
            key: 'identity',
            ellipsis: true,
            render: (value, event) => (
                <Space size={4}>
                    <GoldenArrowAction
                        tooltip={`View ${event.type.toLowerCase()} detail`}
                        ariaLabel={`View ${event.type.toLowerCase()} detail for ${value}`}
                        onClick={() => openEventDetail(event)}
                    />
                    <span>{value}</span>
                </Space>
            ),
            ...searchFilter,
        },
        {
            title: 'Reference',
            dataIndex: 'referenceId',
            ellipsis: true,
            render: value => value || '—',
        },
        {
            title: 'Status / Action',
            dataIndex: 'status',
            render: value => <Tag
                color={SUCCESS_VALUES.has(value) ? 'success' : ERROR_VALUES.has(value) ? 'error' : value === 'RUNNING' || value === 'PROCESSING' ? 'processing' : 'default'}>{value}</Tag>,
        },
        {title: 'Actor', dataIndex: 'actor', ellipsis: true, render: value => value || <Tag>Unattributed</Tag>},
        {title: 'Result / Attention', dataIndex: 'summary', ellipsis: true, render: value => value || '—'},
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            render: (_, event) =>
                event.type === 'INTEGRATION' && canRecover && event.recoverable ? (
                    <Button size="small" onClick={() => setRecoveryEvent(event)}>Recover</Button>
                ) : '—',
        },
        {
            title: 'Type',
            dataIndex: 'type',
            fixed: 'right',
            width: 120,
            filters: TYPE_FILTERS,
            filterMultiple: false,
            filteredValue: query.type ? [query.type] : null,
            render: value => <Badge color={value === 'PROCESS' ? 'blue' : value === 'ACTION' ? 'purple' : 'orange'}
                                    text={value}/>,
        },
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: 'Home'}, {title: 'System Administration'}, {title: 'System Logs'}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={() => load(query)}/>
                <ButtonToolbar title="Reset Filter" icon={<ReloadOutlined/>} onClick={reset}/>
            </ToolbarWrapper>
            {eventsError && <Alert type="error" showIcon title={eventsError} style={{marginBottom: 12}}/>}
            <Table<SystemLogEvent>
                columns={columns}
                dataSource={events}
                size="small"
                loading={eventsLoading}
                onChange={changeTable}
                pagination={{
                    size: 'small',
                    current: eventsPage,
                    pageSize: eventsLimit,
                    total: eventsTotal,
                    showSizeChanger: true,
                    pageSizeOptions: ['20', '50', '100'],
                    showTotal: total => `Total ${total} records`,
                }}
                rowKey={event => `${event.type}:${event.id}`}
                scroll={{x: 1250, y: 'calc(100vh - 380px)'}}
                className="small-table"
                style={{fontSize: 11}}
            />
            <DetailSystemLogModal visible={processOpen} onClose={() => setProcessOpen(false)} detail={detail}
                                  loading={detailLoading}/>
            <ActionDetailModal event={actionEvent} onClose={() => setActionEvent(undefined)}/>
            <IntegrationEventModals
                auditEvent={auditEvent}
                recoveryEvent={recoveryEvent}
                onCloseAudit={() => setAuditEvent(undefined)}
                onCloseRecovery={() => setRecoveryEvent(undefined)}
                onRecovered={() => load(query)}
            />
        </Card>
    );
}
