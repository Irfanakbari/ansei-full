/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, Input, Button, Space, Tag } from 'antd';
import type { InputRef } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import { ReloadOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchMaterial } from '@/store/features/master/materialSlice';
import TransferToRackModal from './_components/TransferToRackModal';

interface MaterialWithQty {
    Id: number;
    PartNumber: string;
    PartName: string;
    QtyRack: number;
    QtyWarehouse: number;
}

export default function TransferPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { data: materials, loading } = useSelector((state: RootState) => state.material);

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);
    const [sortedInfo, setSortedInfo] = useState<SorterResult<MaterialWithQty>>({});

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchMaterial());
    }, [dispatch]);

    const selectedRecord = materials.find((item) => item.Id === selectedRowKeys[0]);

    const handleTransfer = () => {
        if (selectedRecord) {
            setIsTransferModalVisible(true);
        }
    };

    const handleCloseTransferModal = () => {
        setIsTransferModalVisible(false);
    };

    const handleTransferSuccess = () => {
        dispatch(fetchMaterial());
    };

    const handleTableChange = (pagination: any, filters: any, sorter: any) => {
        setSortedInfo(sorter);
    };

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
        onFilter: (value: any, record: any) => {
            return record[dataIndex]?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    const columns = [
        {
            title: 'Part Number',
            dataIndex: 'PartNumber',
            key: 'PartNumber',
            width: 150,
            render: (val: string) => <code style={{ fontSize: 11 }}>{val}</code>,
            ...getColumnSearchProps('PartNumber'),
        },
        {
            title: 'Part Name',
            dataIndex: 'PartName',
            key: 'PartName',
            ...getColumnSearchProps('PartName'),
        },
        {
            title: 'Rack Qty',
            dataIndex: 'QtyRack',
            key: 'QtyRack',
            width: 100,
            align: 'right' as const,
            render: (val: number) => <Tag color="green">{val}</Tag>,
            sorter: (a: MaterialWithQty, b: MaterialWithQty) => a.QtyRack - b.QtyRack,
            sortOrder: sortedInfo.columnKey === 'QtyRack' ? sortedInfo.order : null,
        },
        {
            title: 'Warehouse Qty',
            dataIndex: 'QtyWarehouse',
            key: 'QtyWarehouse',
            width: 120,
            align: 'right' as const,
            render: (val: number) => <Tag color="blue">{val}</Tag>,
            sorter: (a: MaterialWithQty, b: MaterialWithQty) => a.QtyWarehouse - b.QtyWarehouse,
            sortOrder: sortedInfo.columnKey === 'QtyWarehouse' ? sortedInfo.order : null,
        },
        {
            title: 'Total',
            key: 'total',
            width: 100,
            align: 'right' as const,
            render: (_: any, record: MaterialWithQty) => record.QtyRack + record.QtyWarehouse,
            sorter: (a: MaterialWithQty, b: MaterialWithQty) => (a.QtyRack + a.QtyWarehouse) - (b.QtyRack + b.QtyWarehouse),
            sortOrder: sortedInfo.columnKey === 'total' ? sortedInfo.order : null,
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Warehouse' }, { title: 'Transfer to Rack' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => dispatch(fetchMaterial())} />
                <ButtonToolbar
                    title="Transfer to Rack"
                    icon={<SwapOutlined />}
                    onClick={handleTransfer}
                    enable={selectedRowKeys.length === 1 && (selectedRecord?.QtyWarehouse ?? 0) > 0}
                />
            </ToolbarWrapper>

            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
                    checkStrictly: true,
                    type: 'radio',
                }}
                columns={columns}
                dataSource={materials}
                size="small"
                loading={loading}
                onChange={handleTableChange}
                pagination={{
                    size: 'small',
                    pageSize: 50,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} records`,
                }}
                rowKey="Id"
                scroll={{ y: 'calc(100vh - 380px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            {selectedRecord && (
                <TransferToRackModal
                    visible={isTransferModalVisible}
                    onClose={handleCloseTransferModal}
                    material={selectedRecord}
                    onSuccess={handleTransferSuccess}
                />
            )}
        </Card>
    );
}