/*By Irfan Akbari Vuteq Indonesia - 2026-06-09*/
"use client";

import React, {useEffect, useRef} from 'react';
import {Table, Card, Breadcrumb, App, Input, Button, Select, Segmented, Tag, Tooltip, Space} from 'antd';
import type {InputRef} from 'antd';
import {ReloadOutlined, SearchOutlined, ScanOutlined} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import GoldenArrowAction from '@/components/GoldenArrowAction';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {fetchPokayoke, PokayokeScanEntity, setFilters} from '@/store/features/production/pokayoke/pokayokeSlice';
import ScanPokayokeModal from './_components/ScanPokayokeModal';
import FinishGoodLinkedModal from '@/components/production/FinishGoodLinkedModal';

const formatDateTime = (val: string | null | undefined) => {
    if (!val) return '-';
    return new Date(val).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const STATUS_COLORS: Record<string, string> = {
    SUKSES: 'green',
    GAGAL: 'red',
};

export default function PokayokePage() {
    const {message: antMessage} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination, filters} = useSelector((state: RootState) => state.pokayoke);
    const searchInput = useRef<InputRef>(null);
    const [isScanModalVisible, setIsScanModalVisible] = React.useState(false);
    const [linkedFinishGood, setLinkedFinishGood] = React.useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchPokayoke(filters));
    }, [dispatch, filters]);

    // Column search filter
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
                            style={{width: 80}}>
                        Search
                    </Button>
                    <Button onClick={() => {
                        if (clearFilters) clearFilters();
                        confirm();
                    }} size="small" style={{width: 80}}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{color: filtered ? '#1677ff' : undefined}}/>
        ),
        onFilter: (value: any, record: any) => {
            return record[dataIndex]?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    // Status filter dropdown
    const getStatusFilterProps = () => ({
        filterDropdown: ({setSelectedKeys, selectedKeys, confirm, clearFilters}: any) => (
            <div style={{padding: 8}} onKeyDown={(e) => e.stopPropagation()}>
                <Select
                    placeholder="Select status"
                    value={selectedKeys[0]}
                    onChange={(val) => setSelectedKeys(val ? [val] : [])}
                    style={{width: '100%', marginBottom: 8}}
                    allowClear
                    options={[
                        {value: 'SUKSES', label: 'SUKSES'},
                        {value: 'GAGAL', label: 'GAGAL'},
                    ]}
                />
                <Space>
                    <Button type="primary" onClick={() => confirm()} size="small" style={{width: 60}}>
                        OK
                    </Button>
                    <Button onClick={() => {
                        if (clearFilters) clearFilters();
                        confirm();
                    }} size="small" style={{width: 60}}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{color: filtered ? '#1677ff' : undefined}}/>
        ),
        onFilter: (value: any, record: PokayokeScanEntity) => {
            return record.status === value;
        },
    });

    const columns = [
        {
            title: 'Label Number',
            dataIndex: 'labelNumber',
            key: 'labelNumber',
            ...getColumnSearchProps('labelNumber'),
            render: (val: string) => (
                <Tooltip title={val}>
                    <code style={{fontSize: 11}}>{val}</code>
                </Tooltip>
            ),
        },
        {
            title: 'PO Number',
            dataIndex: 'poId',
            key: 'poId',
            ...getColumnSearchProps('poId'),
            render: (val: string) => <code style={{fontSize: 10}}>{val}</code>,
        },
        {
            title: 'Finish Good',
            dataIndex: 'partNumber',
            key: 'partNumber',
            ...getColumnSearchProps('partNumber'),
            render: (val: string, record: PokayokeScanEntity) => (
                <Space size={4}>
                    <GoldenArrowAction tooltip="View Finish Good details" ariaLabel={`View Finish Good ${val}`}
                                       onClick={() => setLinkedFinishGood(val)}/>
                    <Tooltip title={`${val} - ${record.partName}`}><code style={{fontSize: 10}}>{val}</code></Tooltip>
                </Space>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            align: 'center' as const,
            ...getStatusFilterProps(),
            render: (val: string) => (
                <Tag color={STATUS_COLORS[val] || 'default'}>{val}</Tag>
            ),
        },
        {
            title: 'Scanned At',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: formatDateTime,
        },
    ];

    const handleScanSuccess = () => {
        antMessage.success('Pokayoke scan successful');
        dispatch(fetchPokayoke(filters));
    };

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb
                style={{marginBottom: 16}}
                items={[
                    {title: 'Home'},
                    {title: 'Production'},
                    {title: 'Process'},
                    {title: 'Pokayoke Validation'},
                ]}
            />

            <ToolbarWrapper>
                <ButtonToolbar
                    title="Refresh"
                    icon={<ReloadOutlined/>}
                    onClick={() => dispatch(fetchPokayoke(filters))}
                />
                <ButtonToolbar
                    title="Scan"
                    icon={<ScanOutlined/>}
                    onClick={() => setIsScanModalVisible(true)}
                />
                <div style={{marginLeft: "auto", display: "flex", alignItems: "center"}}>
                    <Segmented
                        size="small"
                        value={filters.activeReleaseOnly !== false ? "ACTIVE" : "ALL"}
                        onChange={(val) =>
                            dispatch(
                                setFilters({
                                    page: 1,
                                    activeReleaseOnly: val === "ACTIVE",
                                }),
                            )
                        }
                        options={[
                            {label: "Active Release", value: "ACTIVE"},
                            {label: "All History", value: "ALL"},
                        ]}
                    />
                </div>
            </ToolbarWrapper>

            <Table
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={(page) => dispatch(setFilters({page: page.current, limit: page.pageSize}))}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    showSizeChanger: true,
                    showTotal: (total: number) => `Total ${total} records`,
                }}
                rowKey="id"
                scroll={{x: 'max-content', y: 'calc(100vh - 380px)'}}
                className="small-table"
            />

            <ScanPokayokeModal
                visible={isScanModalVisible}
                onClose={() => setIsScanModalVisible(false)}
                onSuccess={handleScanSuccess}
            />
            <FinishGoodLinkedModal open={linkedFinishGood !== null} partNumber={linkedFinishGood}
                                   onClose={() => setLinkedFinishGood(null)}/>
        </Card>
    );
}
