/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, {useState, useEffect, useRef} from 'react';
import {Table, Card, Breadcrumb, Input, Space, Button} from 'antd';
import type {InputRef} from 'antd';
import {ReloadOutlined, SearchOutlined, PlusOutlined, StopOutlined} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {MaterialEntity, fetchMaterial, setMaterialQuery} from '@/store/features/master/materialSlice';
import CreateMaterialModal from './_components/CreateMaterialModal';
import DiscontinueMaterialModal from './_components/DiscontinueMaterialModal';
import {formatDateTime} from '@/lib/utils/dateTime';
import GoldenArrowAction from '@/components/GoldenArrowAction';
import {useSingleRowSelection} from '@/hooks/useSingleRowSelection';
import MaterialModal from './_components/MaterialModal';

export default function MaterialPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination, query} = useSelector((state: RootState) => state.material);
    const {
        selectedRecord,
        selectRecord,
        clearSelection,
        isSelected
    } = useSingleRowSelection(data, (record) => record.Id);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<MaterialEntity | null>(null);
    const [isDiscontinueModalVisible, setIsDiscontinueModalVisible] = useState(false);
    const [discontinueData, setDiscontinueData] = useState<MaterialEntity | null>(null);

    useEffect(() => {
        dispatch(fetchMaterial(query));
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
            render: (value: string, record: MaterialEntity) => <Space size={4}>
                <GoldenArrowAction tooltip="View material details" ariaLabel={`View material details for ${value}`}
                                   onClick={() => {
                                       selectRecord(record);
                                       setModalData(record);
                                   }}/>
                <span>{value}</span>
            </Space>
        },
        {
            title: 'Part Name',
            dataIndex: 'PartName',
            key: 'PartName',
            ...getColumnSearchProps('PartName')
        },
        {
            title: 'Supplier',
            dataIndex: 'Supplier',
            key: 'Supplier',
            render: (val: string | null) => val || '-'
        },
        {
            title: 'Unit',
            dataIndex: ['SatuanData', 'Name'],
            key: 'SatuanData',
            render: (_: any, record: MaterialEntity) => record.SatuanData?.Name || '-'
        },
        {
            title: 'Rack Location',
            dataIndex: 'RackLocation',
            key: 'RackLocation',
            render: (val: string | null) => val || '-'
        },
        {
            title: 'Qty Rack',
            dataIndex: 'QtyRack',
            key: 'QtyRack',
            align: 'right' as const
        },
        {
            title: 'Qty Warehouse',
            dataIndex: 'QtyWarehouse',
            key: 'QtyWarehouse',
            align: 'right' as const
        },
        {
            title: 'Minimum Stock',
            dataIndex: 'MinimumStock',
            key: 'MinimumStock',
            align: 'right' as const
        },
        {
            title: 'Maximum Stock',
            dataIndex: 'MaximumStock',
            key: 'MaximumStock',
            align: 'right' as const,
            render: (value: number) => value === 0 ? 'Not Set' : value,
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
            render: (_: string, record: MaterialEntity) => record.CreatedByName || record.CreatedBy || '-'
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
            render: (_: string | null, record: MaterialEntity) => record.UpdatedByName || record.UpdatedBy || '-'
        }
    ];

    const handleDiscontinue = () => {
        if (selectedRecord) {
            setDiscontinueData(selectedRecord);
            setIsDiscontinueModalVisible(true);
        }
    };


    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: 'Home'}, {title: 'Master Data'}, {title: 'Material'}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={() => {
                    dispatch(fetchMaterial(query));
                }}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/>
                <ButtonToolbar title="Discontinue" icon={<StopOutlined/>} onClick={handleDiscontinue}
                               enable={Boolean(selectedRecord)}/>
            </ToolbarWrapper>

            <Table
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={(pageInfo, tableFilters) => dispatch(setMaterialQuery({
                    page: tableFilters.PartNumber || tableFilters.PartName ? 1 : pageInfo.current,
                    limit: pageInfo.pageSize,
                    search: String(tableFilters.PartNumber?.[0] ?? tableFilters.PartName?.[0] ?? '')
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

            <MaterialModal open={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                           onChanged={() => {
                               clearSelection();
                               setModalData(null);
                               void dispatch(fetchMaterial(query));
                           }}/>

            <CreateMaterialModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => void dispatch(fetchMaterial(query))}
            />

            {discontinueData && (
                <DiscontinueMaterialModal
                    visible={isDiscontinueModalVisible}
                    onClose={() => {
                        setIsDiscontinueModalVisible(false);
                        void dispatch(fetchMaterial(query));
                    }}
                    data={discontinueData}
                />
            )}
        </Card>
    );
}
