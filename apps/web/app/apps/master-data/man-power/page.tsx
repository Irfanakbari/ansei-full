/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, {useState, useEffect, useRef} from 'react';
import {Table, Card, Breadcrumb, Input, Space, Button, Tag, Avatar, Image} from 'antd';
import type {InputRef} from 'antd';
import {ReloadOutlined, SearchOutlined, PlusOutlined, UserOutlined} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {ManPowerEntity, fetchManPower, setManPowerQuery} from '@/store/features/master/manPowerSlice';
import CreateManPowerModal from './_components/CreateManPowerModal';
import ManPowerModal from './_components/ManPowerModal';
import GoldenArrowAction from '@/components/GoldenArrowAction';
import {useSingleRowSelection} from '@/hooks/useSingleRowSelection';
import {formatDateTime} from '@/lib/utils/dateTime';

export default function ManPowerPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination, query} = useSelector((state: RootState) => state.manPower);
    const {selectRecord, clearSelection, isSelected} = useSingleRowSelection(data, (record) => record.Uid);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<ManPowerEntity | null>(null);

    useEffect(() => {
        dispatch(fetchManPower(query));
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
            title: 'Photo',
            dataIndex: 'PicturePath',
            key: 'PicturePath',
            align: 'center' as const,
            render: (val: string | null, record: ManPowerEntity) => {
                if (val) {
                    return (
                        <Image
                            src={val}
                            alt={record.Name}
                            width={32}
                            height={32}
                            style={{objectFit: 'cover', borderRadius: 4}}
                            preview={{src: val}}
                            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%23bbb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E"
                        />
                    );
                }
                return <Avatar icon={<UserOutlined/>} size={32} shape="square"/>;
            },
        },
        {
            title: 'NIK',
            dataIndex: 'Nik',
            key: 'Nik',
            ...getColumnSearchProps('Nik'),
            render: (value: string, record: ManPowerEntity) => <Space size={4}><GoldenArrowAction
                tooltip="View man power details" ariaLabel={`View man power details for ${value}`} onClick={() => {
                selectRecord(record);
                setModalData(record);
            }}/><span>{value}</span></Space>
        },
        {
            title: 'Name',
            dataIndex: 'Name',
            key: 'Name',
            ...getColumnSearchProps('Name')
        },
        {
            title: 'Line',
            dataIndex: 'Line',
            key: 'Line',
            render: (val: string | null) => val || '-'
        },
        {
            title: 'Status',
            dataIndex: 'Status',
            key: 'Status',
            render: (val: boolean) => <Tag color={val ? 'green' : 'red'}>{val ? 'Active' : 'Inactive'}</Tag>
        },
        {
            title: 'Created At',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            render: (val: string) => formatDateTime(val)
        },
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: 'Home'}, {title: 'Master Data'}, {title: 'Man Power'}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={() => {
                    dispatch(fetchManPower(query));
                }}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/>
            </ToolbarWrapper>

            <Table
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={(pageInfo, tableFilters) => dispatch(setManPowerQuery({
                    page: tableFilters.Nik || tableFilters.Name ? 1 : pageInfo.current,
                    limit: pageInfo.pageSize,
                    search: String(tableFilters.Nik?.[0] ?? tableFilters.Name?.[0] ?? '')
                }))}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} items`,
                }}
                rowKey="Uid"
                onRow={(record) => ({onClick: () => selectRecord(record)})}
                rowClassName={(record) => isSelected(record) ? 'ant-table-row-selected' : ''}
                scroll={{x: 'max-content', y: 'calc(100vh - 380px)'}}
                className="small-table"
                style={{fontSize: '11px'}}
            />

            <ManPowerModal open={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                           onChanged={() => {
                               clearSelection();
                               setModalData(null);
                               void dispatch(fetchManPower(query));
                           }}/>

            <CreateManPowerModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => void dispatch(fetchManPower(query))}
            />
        </Card>
    );
}
