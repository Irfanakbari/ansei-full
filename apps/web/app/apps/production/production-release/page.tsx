/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-06-16 */
"use client";

import React, {useState, useEffect, useRef} from 'react';
import {Table, Card, Breadcrumb, Input, Button, Space, Tag, Tooltip, Progress} from 'antd';
import type {InputRef} from 'antd';
import {ReloadOutlined, SearchOutlined, PlusOutlined, StopOutlined, TagsOutlined} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {
    ProductionReleaseEntity,
    fetchProductionRelease
} from '@/store/features/production/productionRelease/productionReleaseSlice';
import CreateProductionReleaseModal from './_components/CreateProductionReleaseModal';
import ProductionReleaseModal from './_components/ProductionReleaseModal';
import ManageForecastsModal from './_components/ManageForecastsModal';
import CancelProductionReleaseModal from './_components/CancelProductionReleaseModal';
import {formatDateTime} from '@/lib/utils/dateTime';
import GoldenArrowAction from '@/components/GoldenArrowAction';

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'warning',
    IN_PROGRESS: 'processing',
    COMPLETED: 'success',
    CANCELLED: 'error',
};

export default function ProductionReleasePage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination} = useSelector((state: RootState) => state.productionRelease);

    const [selectedRecord, setSelectedRecord] = useState<ProductionReleaseEntity | null>(null);
    const [modalData, setModalData] = useState<ProductionReleaseEntity | null>(null);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isManageModalVisible, setIsManageModalVisible] = useState(false);
    const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
    const [sortedInfo, setSortedInfo] = useState<any>({});
    const [query, setQuery] = useState({
        page: 1,
        limit: 50,
        search: undefined as string | undefined,
        status: undefined as string | undefined
    });

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchProductionRelease(query));
    }, [dispatch, query]);

    useEffect(() => {
        setSelectedRecord((current) =>
            current ? (data.find((record) => record.Id === current.Id) ?? null) : null,
        );
    }, [data]);

    const handleTableChange = (tablePagination: any, filters: any, sorter: any) => {
        setSortedInfo(sorter);
        const search = String(filters.ReleaseNumber?.[0] ?? '') || undefined;
        const status = String(filters.Status?.[0] ?? '') || undefined;
        setQuery({
            page: search !== query.search || status !== query.status ? 1 : tablePagination.current ?? 1,
            limit: tablePagination.pageSize ?? 50,
            search,
            status
        });
    };

    const getColumnSearchProps = (dataIndex: string) => ({
        filterDropdown: ({setSelectedKeys, selectedKeys, confirm, clearFilters}: any) => (
            <div style={{padding: 8}} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput as any}
                    placeholder={`Search ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{marginBottom: 8, display: 'block'}}
                />
                <Space>
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined/>} size="small"
                            style={{width: 90}}>
                        Search
                    </Button>
                    <Button onClick={() => {
                        if (clearFilters) clearFilters();
                        confirm();
                    }} size="small" style={{width: 90}}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{color: filtered ? '#1677ff' : undefined}}/>
        ),
    });

    const columns = [
        {
            title: 'Release Number',
            dataIndex: 'ReleaseNumber',
            key: 'ReleaseNumber',
            ellipsis: true,
            render: (val: string, record: ProductionReleaseEntity) => (
                <Space size={4}>
                    <GoldenArrowAction tooltip="View production release"
                                       ariaLabel={`View production release ${record.ReleaseNumber}`} onClick={() => {
                        setSelectedRecord(record);
                        setModalData(record);
                    }}/>
                    <Tooltip title={val}><code style={{fontSize: 11}}>{val}</code></Tooltip>
                </Space>
            ),
            ...getColumnSearchProps('ReleaseNumber'),
            filteredValue: query.search ? [query.search] : null,
        },
        {
            title: 'Plan Date',
            dataIndex: 'PlanDate',
            key: 'PlanDate',
            render: formatDateTime,
            sorter: (a: ProductionReleaseEntity, b: ProductionReleaseEntity) => new Date(a.PlanDate).getTime() - new Date(b.PlanDate).getTime(),
            sortOrder: sortedInfo.columnKey === 'PlanDate' ? sortedInfo.order : null,
        },
        {
            title: 'Forecasts',
            dataIndex: 'Forecasts',
            key: 'Forecasts',
            align: 'center' as const,
            render: (val: any[]) => <Tag color="blue">{val?.length || 0}</Tag>,
        },
        {
            title: 'Status',
            dataIndex: 'Status',
            key: 'Status',
            filters: [
                {text: 'DRAFT', value: 'DRAFT'},
                {text: 'RELEASED', value: 'RELEASED'},
                {text: 'COMPLETED', value: 'COMPLETED'},
                {text: 'CANCELLED', value: 'CANCELLED'},
            ],
            filteredValue: query.status ? [query.status] : null,
            render: (_: any, record: ProductionReleaseEntity) => (
                <div>
                    <Tag color={STATUS_COLORS[record.Status] || 'default'} style={{marginBottom: 4}}>
                        {record.Status}
                    </Tag>
                    {record.Status === 'RELEASED' && record.progressOverall && (
                        <Progress
                            percent={record.progressOverall.percentage}
                            size="small"
                            status={record.progressOverall.percentage === 100 ? 'success' : 'active'}
                        />
                    )}
                </div>
            ),
        },
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: 'Home'}, {title: 'Production'}, {title: 'Production Release'}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>}
                               onClick={() => dispatch(fetchProductionRelease(query))}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/>
                <ButtonToolbar title="Manage Forecasts" icon={<TagsOutlined/>}
                               onClick={() => setIsManageModalVisible(true)}
                               enable={selectedRecord?.Status === 'DRAFT' || selectedRecord?.Status === 'RELEASED'}/>
                <ButtonToolbar title="Cancel Release" icon={<StopOutlined/>}
                               onClick={() => setIsCancelModalVisible(true)}
                               enable={selectedRecord?.Status === 'RELEASED'}/>
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
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} records`,
                }}
                rowKey="Id"
                onRow={(record) => ({
                    onClick: () => setSelectedRecord(record),
                    onDoubleClick: () => {
                        setSelectedRecord(record);
                        setModalData(record);
                    },
                })}
                rowClassName={(record) => record.Id === selectedRecord?.Id ? 'ant-table-row-selected' : ''}
                scroll={{x: 'max-content', y: 'calc(100vh - 380px)'}}
                className="small-table"
                style={{fontSize: '11px'}}
            />

            <ProductionReleaseModal open={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                                    onUpdated={() => {
                                        setModalData(null);
                                        void dispatch(fetchProductionRelease(query));
                                    }} onDeleted={() => {
                setSelectedRecord(null);
                setModalData(null);
                void dispatch(fetchProductionRelease(query));
            }}/>

            <CreateProductionReleaseModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => dispatch(fetchProductionRelease(query))}
            />

            <ManageForecastsModal open={isManageModalVisible} release={selectedRecord}
                                  onClose={() => setIsManageModalVisible(false)} onSuccess={() => {
                setSelectedRecord(null);
                dispatch(fetchProductionRelease(query));
            }}/>
            <CancelProductionReleaseModal open={isCancelModalVisible} release={selectedRecord}
                                          onClose={() => setIsCancelModalVisible(false)} onSuccess={() => {
                setSelectedRecord(null);
                dispatch(fetchProductionRelease(query));
            }}/>

        </Card>
    );
}
