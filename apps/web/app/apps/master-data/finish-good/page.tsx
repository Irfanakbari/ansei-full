/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, {useState, useEffect, useRef} from 'react';
import {Table, Card, Breadcrumb, Input, Space, Button, Tag, Tooltip, App} from 'antd';
import type {InputRef} from 'antd';
import {
    ReloadOutlined,
    SearchOutlined,
    PlusOutlined,
    StopOutlined,
    CheckCircleOutlined,
    SwapOutlined
} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {
    FinishGoodEntity,
    fetchFinishGood,
    setFinishGoodQuery,
    reactivateFinishGood
} from '@/store/features/master/finishGoodSlice';
import CreateFinishGoodModal from './_components/CreateFinishGoodModal';
import FinishGoodModal from './_components/FinishGoodModal';
import DiscontinueFinishGoodModal from './_components/DiscontinueFinishGoodModal';
import TransferFinishGoodStockModal from './_components/TransferFinishGoodStockModal';
import GoldenArrowAction from '@/components/GoldenArrowAction';
import {useSingleRowSelection} from '@/hooks/useSingleRowSelection';
import {formatDateTime} from '@/lib/utils/dateTime';

export default function FinishGoodPage() {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination, query} = useSelector((state: RootState) => state.finishGood);
    const {
        selectedRecord,
        selectRecord,
        clearSelection,
        isSelected
    } = useSingleRowSelection(data, (record) => record.Id);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<FinishGoodEntity | null>(null);
    const [isDiscontinueModalVisible, setIsDiscontinueModalVisible] = useState(false);
    const [discontinueData, setDiscontinueData] = useState<FinishGoodEntity | null>(null);
    const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);

    useEffect(() => {
        dispatch(fetchFinishGood(query));
    }, [dispatch, query]);

    const searchInput = useRef<InputRef>(null);

    const getColumnSearchProps = (dataIndex: string) => ({
        filterDropdown: ({setSelectedKeys, selectedKeys, confirm, clearFilters}: any) => (
            <div style={{padding: 8}} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput}
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
        filteredValue: query.search ? [query.search] : null,
    });

    const columns = [
        {
            title: 'Part Number',
            dataIndex: 'PartNumber',
            key: 'PartNumber',
            ...getColumnSearchProps('PartNumber'),
            render: (value: string, record: FinishGoodEntity) => <Space size={4}>
                <GoldenArrowAction tooltip="View finish good details"
                                   ariaLabel={`View finish good details for ${value}`}
                                   onClick={() => {
                                       selectRecord(record);
                                       setModalData(record);
                                   }}/>
                <span>{value}</span>
            </Space>
        },
        {
            title: 'Status',
            dataIndex: 'IsActive',
            key: 'IsActive',
            align: 'center' as const,
            render: (isActive: boolean, record: FinishGoodEntity) => (
                isActive ? (
                    <Tag color="success">Active</Tag>
                ) : (
                    <Tooltip title={record.DiscontinueDate ? `Discontinued on ${formatDateTime(record.DiscontinueDate)}` : 'Discontinued'}>
                        <Tag color="error">Discontinued</Tag>
                    </Tooltip>
                )
            ),
        },
        {
            title: 'Passthrough',
            dataIndex: 'IsPassthrough',
            key: 'IsPassthrough',
            render: (value: boolean) => value ? 'Yes — skip Assy' : 'No — Assy required'
        },
        {
            title: 'Part Name',
            dataIndex: 'PartName',
            key: 'PartName',
            ...getColumnSearchProps('PartName')
        },
        {
            title: 'Alias',
            dataIndex: 'Alias',
            key: 'Alias',
            render: (val: string | null) => val || '-',
            ...getColumnSearchProps('Alias')
        },
        {
            title: 'Price',
            dataIndex: 'Price',
            key: 'Price',
            align: 'right' as const,
            render: (val: number | null) => val ? `Rp ${val.toLocaleString('id-ID')}` : '-'
        },
        {
            title: 'Qty',
            dataIndex: 'Qty',
            key: 'Qty',
            align: 'right' as const
        },
        {
            title: 'Created Date',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            render: (val: string) => formatDateTime(val)
        },
        {
            title: 'Created By',
            dataIndex: 'CreatedBy',
            key: 'CreatedBy',
            render: (_: string, record: FinishGoodEntity) => record.CreatedByName || record.CreatedBy || '-'
        },
        {
            title: 'Updated Date',
            dataIndex: 'UpdatedAt',
            key: 'UpdatedAt',
            render: (value: string) => formatDateTime(value)
        },
        {
            title: 'Updated By',
            dataIndex: 'UpdatedBy',
            key: 'UpdatedBy',
            render: (_: string | null, record: FinishGoodEntity) => record.UpdatedByName || record.UpdatedBy || '-'
        },
    ];

    const handleDiscontinue = () => {
        if (selectedRecord) {
            setDiscontinueData(selectedRecord);
            setIsDiscontinueModalVisible(true);
        }
    };

    const handleReactivate = () => {
        if (!selectedRecord) return;
        modal.confirm({
            title: 'Reactivate Finish Good?',
            icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
            content: `Are you sure you want to reactivate finish good "${selectedRecord.PartNumber}"?`,
            okText: 'Reactivate',
            centered: true,
            onOk: async () => {
                try {
                    const result = await dispatch(reactivateFinishGood(selectedRecord.PartNumber));
                    if (reactivateFinishGood.rejected.match(result)) {
                        throw new Error((result.payload as string) || 'Failed to reactivate finish good');
                    }
                    message.success(`Finish good "${selectedRecord.PartNumber}" reactivated successfully`);
                    dispatch(fetchFinishGood(query));
                } catch (error: unknown) {
                    message.error(error instanceof Error ? error.message : 'Failed to reactivate finish good');
                }
            },
        });
    };

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: 'Home'}, {title: 'Master Data'}, {title: 'Finish Good'}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={() => {
                    dispatch(fetchFinishGood(query));
                }}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/>
                <ButtonToolbar
                    title="Transfer Stock"
                    icon={<SwapOutlined/>}
                    enable={Boolean(selectedRecord && selectedRecord.Qty > 0)}
                    onClick={() => setIsTransferModalVisible(true)}
                />
                <ButtonToolbar
                    title="Discontinue"
                    icon={<StopOutlined/>}
                    onClick={handleDiscontinue}
                    enable={Boolean(selectedRecord && selectedRecord.IsActive)}
                />
                <ButtonToolbar
                    title="Reactivate"
                    icon={<CheckCircleOutlined/>}
                    onClick={handleReactivate}
                    enable={Boolean(selectedRecord && !selectedRecord.IsActive)}
                />
            </ToolbarWrapper>

            <Table
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={(pageInfo, tableFilters) => dispatch(setFinishGoodQuery({
                    page: tableFilters.PartNumber || tableFilters.PartName || tableFilters.Alias ? 1 : pageInfo.current,
                    limit: pageInfo.pageSize,
                    search: String(tableFilters.PartNumber?.[0] ?? tableFilters.PartName?.[0] ?? tableFilters.Alias?.[0] ?? '')
                }))}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} items`,
                }}
                rowKey="Id"
                onRow={(record) => ({
                    onClick: () => selectRecord(record),
                    onDoubleClick: () => {
                        selectRecord(record);
                        setModalData(record);
                    },
                })}
                rowClassName={(record) => isSelected(record) ? 'ant-table-row-selected' : ''}
                scroll={{x: 'max-content', y: 'calc(100vh - 380px)'}}
                className="small-table"
                style={{fontSize: '11px'}}
            />

            <FinishGoodModal open={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                             onChanged={() => {
                                 clearSelection();
                                 setModalData(null);
                                 void dispatch(fetchFinishGood(query));
                             }}/>

            <CreateFinishGoodModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => void dispatch(fetchFinishGood(query))}
            />

            {discontinueData && (
                <DiscontinueFinishGoodModal
                    visible={isDiscontinueModalVisible}
                    onClose={() => {
                        setIsDiscontinueModalVisible(false);
                        void dispatch(fetchFinishGood(query));
                    }}
                    data={discontinueData}
                />
            )}

            {selectedRecord && (
                <TransferFinishGoodStockModal
                    visible={isTransferModalVisible}
                    onClose={() => {
                        setIsTransferModalVisible(false);
                    }}
                    onSuccess={() => {
                        clearSelection();
                        void dispatch(fetchFinishGood(query));
                    }}
                    data={selectedRecord}
                />
            )}
        </Card>
    );
}
